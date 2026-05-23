---
phase: 2
title: examData.ts dual emit 제거 + stripChoicePrefix 이전 + aggregateVerifiedProblems 삭제
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/examData.ts
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/examData.test.ts
  - ngd-studio/server/stages/__tests__/extractor.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 2: examData.ts dual emit 제거 + stripChoicePrefix 이전 + aggregateVerifiedProblems 삭제

> **범위**: Backend
> **난이도**: M
> **의존성**: P1
> **영향 파일**: `ngd-studio/server/stages/examData.ts`, `extractor.ts`

## 배경

P1에서 `ExamMeta` 단일 타입 확정. 이제 디스크 write 측을 정리한다.

### F-cleanup-1: `normalizeMeta` dual emit (`examData.ts:105-128`)
현재 `info`에 `schoolLevel`+`school_level`, `examType`+`exam_type` **둘 다** 영속화. P4에서 Python adapter가 camelCase만 읽도록 바꿀 거라, 여기서 디스크 키를 camelCase only로 좁힌다.

### F-cleanup-2: `aggregateVerifiedProblems` dead code (`examData.ts:244-283`)
호출처 0건(`grep -rn "aggregateVerifiedProblems" ngd-studio` 결과 정의·테스트만). `buildExamDataJson`과 거의 동일하지만 partial-skip 정책만 다름. 미래 oncall이 잘못 부르면 silent partial 산출 위험. 삭제.

### F-cleanup-3: `stripChoicePrefix` 밴드에이드 (`examData.ts:181-200`)
extractor 출력의 `[{"t":"① "}, {"eq":"-20"}]` 같은 contract 위반을 merge 단계에서 제거. 진짜 fix는 extractor validator. **`extractor.ts`로 이동** — extractor가 결과를 `qNN_extracted.json`에 쓰기 전에 prefix 제거.

## 설계

### 1) `examData.ts` 단순화

```ts
// Before: ExamMetaInput (alias 둘 다) + normalizeMeta (dual emit)
// After:  ExamMeta (camelCase only, from P1) + assertCompleteMeta
import type { ExamMeta } from "@/lib/exam/meta";
import { buildFilenameBase, isExamMetaComplete } from "@/lib/exam/meta";

export interface ExamDataOutput {
  info: ExamMeta;          // ← camelCase only
  problems: ExamDataProblem[];
}

function assertCompleteMeta(meta: ExamMetaInput): ExamMeta {
  if (!isExamMetaComplete(meta)) {
    throw new Error(`exam_data.json: meta missing required fields (schoolLevel/school/grade/year/subject/semester/examType/range)`);
  }
  const complete: ExamMeta = { ...meta };
  complete.filenameBase = meta.filenameBase ?? buildFilenameBase(complete);
  return complete;
}

export async function buildExamDataJson(input: {
  cache: StageCache;
  meta: ExamMetaInput;
  questionNumbers: number[];
}): Promise<ExamDataOutput> {
  const meta = assertCompleteMeta(input.meta);
  // ... 나머지는 기존과 동일하지만 normalizeMeta 호출 자리에 meta 그대로 사용
  const output: ExamDataOutput = { info: meta, problems };
  await writeFile(cache.paths.examData, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}
```

- `normalizeMeta` 함수 삭제.
- `ExamMetaInput` 로컬 정의 삭제 → `@/lib/exam/meta`에서 import.
- `aggregateVerifiedProblems` + `AggregateResult` + `AggregateError` 삭제.

### 2) `mergeQuestionSources` 단순화

```ts
async function mergeQuestionSources(cache, n, opts): Promise<ExamDataProblem> {
  const [extracted, solved] = await Promise.all([
    tryReadJson(cache.extractorResultPath(n)),
    tryReadJson(cache.solverResultPath(n)),
  ]);
  if (!extracted) throw new Error(`missing extracted for Q${n}`);
  if (opts.requireSolved && !solved) throw new Error(`missing solved for Q${n}`);
  return solved ? { ...extracted, ...solved } : extracted;
}
```

- `normalizeProblem` / `stripChoicePrefix` 호출 제거 (extractor에서 사전 처리되므로 더 이상 필요 없음).
- 단, 기존 캐시 호환 위해 **단 한 줄 방어** 옵션 — 권장 안 함. P9 fixture 재생성으로 깨끗하게.

### 3) `extractor.ts`에 prefix 제거 추가

extractor 결과 검증 끝 또는 디스크 write 직전에:

```ts
// extractor.ts validator 통과 후
const CHOICE_PREFIX_RE = /^[①②③④⑤]\s*/;

function sanitizeExtractedChoices(extracted: ExtractorOutput): ExtractorOutput {
  if (!Array.isArray(extracted.choices)) return extracted;
  const normalized = extracted.choices.map((choice) => {
    if (!Array.isArray(choice) || choice.length === 0) return choice;
    const first = choice[0];
    if (!first || typeof first !== "object" || !("t" in first)) return choice;
    const t = (first as { t: unknown }).t;
    if (typeof t !== "string" || !CHOICE_PREFIX_RE.test(t)) return choice;
    const stripped = t.replace(CHOICE_PREFIX_RE, "");
    if (stripped.length === 0) return choice.slice(1);
    return [{ ...(first as Record<string, unknown>), t: stripped }, ...choice.slice(1)];
  });
  return { ...extracted, choices: normalized };
}
```

`runExtractorStage` 마지막에 `output = sanitizeExtractedChoices(output)` 후 `writeFile`.

### 4) 테스트 갱신

- `examData.test.ts`:
  - 기존 `aggregateVerifiedProblems` 케이스 전부 삭제
  - `normalizeMeta` dual emit 케이스 삭제
  - 신규: `buildExamDataJson`이 camelCase only로 디스크 작성 확인 + `filenameBase` 자동 채움 확인
  - 신규: `meta` 불완전 시 throw
- `extractor.test.ts` (없으면 신설):
  - `sanitizeExtractedChoices` 단위 테스트 (① prefix가 들어있는 입력 → 제거 확인)

## 체크리스트
- [x] `examData.ts`에서 `normalizeMeta`, `stripChoicePrefix`, `normalizeProblem`, `aggregateVerifiedProblems`, `AggregateError`, `AggregateResult`, 로컬 `ExamMetaInput` 모두 삭제
- [x] `buildExamDataJson`이 `assertCompleteMeta`로 검증 + camelCase only 작성, `filenameBase` 자동 채움
- [x] `extractor.ts`에 `sanitizeExtractedChoices` 추가하고 디스크 write 직전 호출
- [x] `examData.test.ts` 갱신: dual emit / aggregate 케이스 제거, 새 컨트랙트 검증
- [x] `extractor.test.ts`에 `sanitizeExtractedChoices` 단위 케이스 추가
- [x] 저장소 루트에서 `cd ngd-studio && npx vitest run server/stages/__tests__/examData.test.ts server/stages/__tests__/extractor.test.ts --reporter=basic` 통과

## 영향 범위

- `.v3cache/exam_data.json` `info` 키가 camelCase only로 바뀐다.
- **Python 측(figure_processor, assemble)은 아직 snake_case를 읽는 상태**라 이 phase 종료 직후 build 단계가 깨질 수 있다. **P3 → P4가 끝나야 Python read가 정합**된다.
- 즉 P2/P3/P4는 **하나의 contract change 묶음** — 셋이 다 끝나기 전에 신규 작업 흐름을 실 사용자에게 노출하면 안 됨 (개발자 본인 manual smoke 금지 구간).

## 검증

```bash
cd ngd-studio
npx vitest run server/stages/__tests__/examData.test.ts server/stages/__tests__/extractor.test.ts --reporter=basic
npx tsc --noEmit
```

manual:
```bash
grep -rn "normalizeMeta\|aggregateVerifiedProblems\|stripChoicePrefix" ngd-studio --include="*.ts"
# 결과 0건
```

## 실행 결과

### 1회차 (2026-05-23 22:58 KST) — 완료

**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`examData.ts`에서 `normalizeMeta`, `stripChoicePrefix`, `normalizeProblem`, `aggregateVerifiedProblems`, `AggregateError`, `AggregateResult` 삭제 및 camelCase-only `assertCompleteMeta` 도입. `extractor.ts`에 `sanitizeExtractedChoices` 추가 및 디스크 write 직전 적용. 테스트 63/63 통과, `npx tsc --noEmit` 에러 없음.

#### 변경 파일
- `ngd-studio/server/stages/examData.ts` (수정, 약 -170/+70줄 — 대규모 dead code 삭제 + assertCompleteMeta 신규)
- `ngd-studio/server/stages/extractor.ts` (수정, +40줄 — sanitizeExtractedChoices 추가)
- `ngd-studio/server/stages/__tests__/examData.test.ts` (수정, 전면 갱신 — aggregate/dual-emit 케이스 제거, camelCase-only/assertCompleteMeta 케이스 추가)
- `ngd-studio/server/stages/__tests__/extractor.test.ts` (수정, +70줄 — sanitizeExtractedChoices 단위 케이스 7개 추가)

#### 검증 결과
- [x] vitest run examData.test.ts extractor.test.ts: 63/63 통과
- [x] `npx tsc --noEmit`: 에러 없음 (초기 `as Record<string, unknown>` 형변환 오류 수정 완료)
- [x] grep `normalizeMeta|aggregateVerifiedProblems|stripChoicePrefix` → 소스 내 0건

#### 추가 발견사항
- `ExamMetaInput` 타입은 삭제하지 않음 — `@/lib/exam/meta`에 `ExamMetaInput = Partial<ExamMeta>`로 P1에서 정의된 것을 `examData.ts`가 import하는 구조이고, orchestrator.ts 등 외부가 아직 `ExamMetaInput`을 `buildExamDataJson` 인수로 전달하므로 외부 시그니처는 유지.
- `buildExamDataJson` 시그니처의 `meta: ExamMetaInput`은 유지하되, 함수 내부에서 `assertCompleteMeta`로 완전성 검증 후 `ExamMeta`로 좁힘.

#### 질문 / 결정 사항
없음

---

### 2회차 (2026-05-23 23:13 KST) — fix_required 재시도

**상태**: completed (fix applied)
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 원인 분석

1회차에서 `assertCompleteMeta`가 incomplete meta 시 throw하도록 설계했는데, orchestrator 통합/파이프라인 테스트들이 `{ school: "테스트고", grade: 2, subject: "수학" }` 같은 불완전 meta를 `buildExamDataJson`에 전달하고 있었음. 기존 `normalizeMeta`는 lenient(throw 없이 defaults 적용)했지만 신규 `assertCompleteMeta`는 strict.

**영향 범위**:
- `orchestrator.pipeline.test.ts` (A/B/C/verifier retry): `expect(result.status).toBe("done")` 실패
- `orchestrator.integration.test.ts` (4건): `exam_data.json 생성 실패: expected 'failed' to be 'done'`
- `orchestrator.test.ts` (resumeFrom=builder): builder stage event 미발행으로 `expect(builderStageEvent).toBeDefined()` 실패

#### 수정 내용

3개 테스트 파일에 `COMPLETE_META` 상수 추가 후 실패 테스트의 incomplete meta를 교체:
- `orchestrator.pipeline.test.ts`: `COMPLETE_META` 상수 추가, 7개 `meta: { school: ... }` → `meta: COMPLETE_META` 일괄 교체
- `orchestrator.integration.test.ts`: `COMPLETE_META` 상수 추가, 5개 교체
- `orchestrator.test.ts`: `COMPLETE_META` 상수 추가, `resumeFrom=builder` 테스트의 `meta: {}` → `meta: COMPLETE_META`, pre-written `exam_data.json`의 `info: {}` → `info: COMPLETE_META`

`examData.ts` / `extractor.ts`는 변경 없음 (production behavior 유지).

#### 검증 결과
- [x] vitest run lib/__tests__ server/stages/__tests__: 524/524 통과 (전체)
- [x] `npx tsc --noEmit`: 에러 없음
- [x] grep `normalizeMeta|aggregateVerifiedProblems|stripChoicePrefix` → 소스 내 0건

#### Scope Audit (orchestrator)
1회차: pass — examData.ts, extractor.ts, examData.test.ts, extractor.test.ts 모두 scope 내.
2회차 (retry): escalate → 사용자 승인 — orchestrator.pipeline.test.ts, orchestrator.integration.test.ts, orchestrator.test.ts 3개는 P7 scope이나 assertCompleteMeta strict 도입에 따른 fixture 강제 갱신 필요. 사용자 drift 허용, P2 commit에 포함.

#### Verification Re-run (orchestrator)
1회차: exit 1 — orchestrator 9건 회귀 → fix_required.
2회차 (retry 후): tsc exit 0, vitest 524/524 통과.

#### Simplify (orchestrator)
SIMPLIFIED: 0 — retry 직후 추가 정리 대상 없음.

#### Review (orchestrator)
VERDICT: pass — contract 변경(assertCompleteMeta strict)에 따른 fixture 정합. ISSUES 0건.
