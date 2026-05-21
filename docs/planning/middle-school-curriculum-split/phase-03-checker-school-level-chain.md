---
phase: 3
title: checker schoolLevel chain + text.vocabulary 분기
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/checker.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/__tests__/checker.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "checker.ts 의 (a) 신규 loadUnitClassificationMiddle lazy cache, (b) checkTextVocabulary 의 schoolLevel 분기 + 미지정 시 union fallback, (c) orchestrator → runCheckerWithAutoFix 호출 chain 에 schoolLevel 전달"
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 3: checker schoolLevel chain + text.vocabulary 분기

> **범위**: Backend (checker + orchestrator chain + tests)
> **난이도**: M
> **의존성**: Phase 1 (`unit_classification_middle.json` 존재 전제)
> **영향 파일**: `server/stages/checker.ts:7-69, 79-83, 134-145, 218-233, 650-744`, `server/stages/orchestrator.ts:708-719`, `server/stages/__tests__/checker.test.ts`

## 배경

`server/stages/checker.ts` 의 `text.vocabulary` 룰 (`checker.ts:650-744`) 은 HWPX 의 `[중단원]`/`[과목]`/`[범위]` 토큰을 `unit_classification.json` 의 vocabulary 와 대조. 현재 로더 `loadUnitClassification` (`checker.ts:41`) 는 고등 JSON 만 lazy load + cache.

`schoolLevel="중"` 으로 빌드된 HWPX 는 중학교 단원 (예: `[중단원] 소인수분해`) 을 포함할 텐데, 현 vocab 에는 없으므로 `text.vocabulary` 에러로 빌드 실패 — checker auto-fix 가 2회 시도 후 결국 실패 처리.

## 설계

### 1. 중학교 분류표 lazy loader 추가

```ts
// checker.ts 상단 (33줄 부근)
const UNIT_CLASSIFICATION_MIDDLE_PATH = join(
  __dirname,
  "../../../.claude/data/unit_classification_middle.json",
);

let _unitClassificationMiddleCache: UnitClassification | null | false = false;

async function loadUnitClassificationMiddle(): Promise<UnitClassification | null> {
  if (_unitClassificationMiddleCache !== false) return _unitClassificationMiddleCache;
  try {
    const raw = await readFile(UNIT_CLASSIFICATION_MIDDLE_PATH, "utf8");
    _unitClassificationMiddleCache = JSON.parse(raw);
  } catch (err) {
    console.warn(
      `[checker] unit_classification_middle.json not found at ${UNIT_CLASSIFICATION_MIDDLE_PATH} — middle vocabulary skipped`,
    );
    _unitClassificationMiddleCache = null;
  }
  return _unitClassificationMiddleCache;
}

export function _resetUnitClassificationMiddleCache(): void { /* test util */ }
export function _injectUnitClassificationMiddle(data: UnitClassification): void { /* test util */ }
```

기존 `loadUnitClassification` 과 동일 패턴.

### 2. `CheckerStageInput` 에 schoolLevel 추가

```ts
export interface CheckerStageInput {
  hwpxPath?: string;
  sectionXmlPath?: string;
  sectionXml?: string;
  schoolLevel?: "중" | "고";  // 신규
}
```

### 3. `runCheckerStage` / `runCheckerWithAutoFix` 가 양쪽 분류표 preload

```ts
await loadUnitClassification();
await loadUnitClassificationMiddle();
```

(둘 다 lazy cache 이므로 비용 무시 가능)

### 4. `checkTextVocabularySync` → schoolLevel 받아 분기

```ts
function checkTextVocabularySync(
  xml: string,
  file: string,
  schoolLevel?: "중" | "고",
): CheckerIssue[] {
  const high = _unitClassificationCache && _unitClassificationCache !== false ? _unitClassificationCache : null;
  const middle = _unitClassificationMiddleCache && _unitClassificationMiddleCache !== false ? _unitClassificationMiddleCache : null;

  let target: UnitClassification[] = [];
  if (schoolLevel === "중" && middle) target = [middle];
  else if (schoolLevel === "고" && high) target = [high];
  else {
    // 미지정 → 양쪽 union fallback (관대 기본값)
    if (high) target.push(high);
    if (middle) target.push(middle);
  }
  if (target.length === 0) return [];
  return checkTextVocabulary(xml, file, target);
}
```

`checkTextVocabulary` 시그니처도 `UnitClassification` → `UnitClassification[]` (배열) 로 일반화:
```ts
export function checkTextVocabulary(
  xml: string,
  file: string,
  classifications: UnitClassification[],
): CheckerIssue[] {
  // 기존 allSubjects 집합을 모든 classification 의 subjects + legacy.subjects 로 union
  ...
}
```

기존 호출자 ([checker.ts:121] `RULES` 테이블) 는 `checkTextVocabularySync` 만 호출하므로 외부 영향 없음.

### 5. RULES 테이블 ↔ schoolLevel 전달

RULES handler.detect 시그니처가 현재 `(xml, file) => issues`. schoolLevel 을 전달하려면:

- (옵션 a) `RuleHandler.detect` 시그니처에 optional `context?: { schoolLevel? }` 추가 → 모든 룰 핸들러 무영향, vocab 만 사용.
- (옵션 b) `runDeterministicCheckerRules(xml, file, context)` 가 context 를 받아 클로저로 주입.

**옵션 a** 채택 (시그니처 변경 최소).

```ts
interface RuleHandler {
  detect(xml: string, file: string, context?: { schoolLevel?: "중" | "고" }): CheckerIssue[];
  fix?(...): string | null;
}
```

`runCheckerStage` / `runCheckerWithAutoFix` 가 `context = { schoolLevel: input.schoolLevel }` 를 `runDeterministicCheckerRules` 에 전달.

### 6. orchestrator chain

`orchestrator.ts:719` 의 `runCheckerWithAutoFix(input, maxAttempts)` 호출에 `schoolLevel: input.meta.schoolLevel` 을 input 객체에 포함시켜야 함. 현재 호출 형태를 확인 후 `CheckerStageInput` 객체 구성 시점에 `schoolLevel` 추가.

## 체크리스트

- [x] `loadUnitClassificationMiddle` lazy loader + cache + reset/inject test util 추가 (기존 `loadUnitClassification` 패턴 복사)
- [x] `CheckerStageInput.schoolLevel?: "중" | "고"` 추가, `runCheckerStage` / `runCheckerWithAutoFix` 가 양쪽 cache preload + context 로 schoolLevel 전파
- [x] `checkTextVocabulary` 시그니처를 `UnitClassification[]` (배열) 로 일반화, `checkTextVocabularySync` 가 schoolLevel 로 분기 (미지정 → union fallback)
- [x] `RuleHandler.detect` 시그니처에 optional `context?` 추가, `runDeterministicCheckerRules` 가 context 전달
- [x] `orchestrator.ts` 의 `runCheckerWithAutoFix(...)` 호출에 `schoolLevel: input.meta.schoolLevel` 포함
- [x] `checker.test.ts` 에 신규 케이스 3개: (a) `schoolLevel='중'` + 중학교 vocab pass, (b) `schoolLevel='중'` + 고등 only vocab (`수학 I`) 사용 시 error 발생, (c) `schoolLevel` 미지정 + 중학교 vocab + 고등 vocab 모두 pass (union)

## 영향 범위

- **회귀 표면**:
  - 기존 `schoolLevel` 미지정 호출 (Phase A 이전 데이터 / legacy job) → union fallback 으로 고등 vocab 검증 유지 → 회귀 없음.
  - `checkTextVocabulary` 시그니처가 `UnitClassification` → `UnitClassification[]` 로 변경 → 직접 호출하는 외부 코드 없음 (private helper). 단, `_injectUnitClassification` 테스트 util 을 쓰는 기존 테스트가 있다면 적응 필요.
- **lazy loader 의 catch warn**: middle JSON 이 없는 환경 (Phase 1 빌드 안 한 상태) 에서도 어플리케이션은 살아있어야 함 → middle = null 으로 두고 vocab 검증 skip (현재 고등 패턴과 동일).
- **롤백**: orchestrator/checker 두 파일만 영향 → phase revert 단순.

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run server/stages/__tests__/checker.test.ts server/stages/__tests__/orchestrator.test.ts --reporter=basic
```

수동 확인:
1. `loadUnitClassificationMiddle()` 두 번 호출 시 두 번째는 cache hit (debug log 1회만)
2. 중학교 토큰 (예: `[중단원] 소인수분해`) 가 schoolLevel='중' 일 때 error 발생 안 함

## 실행 결과

### 1회차 (2026-05-21 12:05 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`checker.ts`에 중학교 분류표 lazy loader(`loadUnitClassificationMiddle`)를 추가하고, `CheckerStageInput.schoolLevel` 필드 및 `RuleHandler.detect` context 시그니처를 추가했다. `checkTextVocabulary`를 `UnitClassification[]` 배열 시그니처로 일반화하고 `checkTextVocabularySync`에서 schoolLevel 분기(미지정 → union fallback)를 구현했다. `orchestrator.ts`의 checker 호출부에 `schoolLevel: input.meta.schoolLevel` 전달을 추가했다. 신규 테스트 케이스 3개 포함 전체 51개 테스트 통과.

#### 변경 파일
- `ngd-studio/server/stages/checker.ts` (수정, +80/-20줄)
- `ngd-studio/server/stages/orchestrator.ts` (수정, +1/-1줄)
- `ngd-studio/server/stages/__tests__/checker.test.ts` (수정, +60/-0줄)

#### 검증 결과
- [x] TypeScript 타입 체크: `NODE_OPTIONS="" npx tsc --noEmit` → pass (출력 없음)
- [x] 유닛 테스트: `vitest run checker.test.ts` → 51 tests passed
- [x] 회귀 테스트: `vitest run orchestrator.test.ts` → 18 tests passed

#### 추가 발견사항
- `checkTextVocabulary`의 기존 단일 `UnitClassification` 시그니처 → 배열 시그니처로 변경 시, 배열도 단일 객체도 모두 받도록 `UnitClassification | UnitClassification[]` union 처리하여 기존 호출자(테스트 직접 호출) 하위 호환 유지함.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 4 files in scope (checker.ts, orchestrator.ts, checker.test.ts, PHASE_FILE). Phase 2 의 solver/verifier 호출부 미접촉.

#### Verification Re-run (orchestrator)
exit 0 — `env -u NODE_OPTIONS`: tsc pass, vitest checker 51 + orchestrator 18 = 69/69 pass.

#### Simplify (orchestrator)
SIMPLIFIED: 2 — checker.ts cache 체크 `|| null` 단순화; orchestrator.ts checker if/else → 한 줄 + hwpxPath 중복 ?? 제거. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass — 설계 6항목 모두 구현, `checkTextVocabulary` union 시그니처는 하위 호환 정당, 외부 호출자 0건으로 회귀 위험 없음.

