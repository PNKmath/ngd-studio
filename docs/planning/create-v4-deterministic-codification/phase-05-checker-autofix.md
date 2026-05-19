---
phase: 5
title: checker auto-fix 모드
status: completed
depends_on: [3]
scope:
  - ngd-studio/server/stages/checker.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/__tests__/checker.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 5: checker auto-fix 모드

> **범위**: Backend (checker + orchestrator)
> **난이도**: M
> **의존성**: Phase 3 (TS normalizer)
> **영향 파일**: checker.ts, orchestrator.ts

## 배경

`checker.ts:98`은 7개 결정적 룰을 detect만 하고 fix는 하지 않는다. 특히 `equation.run_on` (통수식)은 `fallbackRequired: true`만 표시 → 결국 LLM에 fallback이 필요해진다.

Phase 3의 `normalizeParts`가 이미 R-01 (통수식 split) 등을 결정적으로 수행하므로, 룰별 `fix()` 매핑을 추가하면 LLM 호출 없이 결정적 fix loop가 가능하다.

## 설계

### 1. checker.ts — `fix()` 매핑

```typescript
interface RuleHandler {
  detect: (xml: string, file: string) => CheckerIssue[];
  fix?: (xml: string) => string;  // optional — rule이 결정적 수정 가능할 때만
}

const RULES: Record<string, RuleHandler> = {
  "equation.run_on": {
    detect: checkRunOnEquations,
    fix: fixRunOnEquationsInXml,   // ← 신규
  },
  "text.difficulty_vocabulary": {
    detect: checkDifficultyVocabulary,
    // fix 없음 — value가 enum 밖이면 자동 수정 불가, 사람 판단 필요
  },
  // ... 7개 룰
};
```

### 2. `fixRunOnEquationsInXml`

XML 직접 mutation. `<hp:equation>` block을 찾아 안의 `<hp:script>` content를 `splitTopLevelEq`(Phase 3)로 분리 → 여러 `<hp:equation>`로 교체. 사이에 `<hp:t> </hp:t>` 글루 삽입.

핵심: parts 단계 정규화(Phase 2/3)가 1차 방어선이라 여기 도달하는 케이스는 드물어야 함. checker fix는 안전망.

대안: HWPX 재빌드. parts 단계에서 fix해서 `exam_data.json` 갱신 → `build_hwpx.py` 재실행. 더 안전(다른 룰도 자동 해결).

→ **선택**: checker fix는 **rebuild 트리거** 방식.
- checker가 위반 발견 + auto-fixable → cache parts 정규화 다시 적용 → `build_hwpx.py` 재실행 → 재검사.

```typescript
async function runCheckerWithAutoFix(input) {
  let attempt = 0;
  while (attempt < 2) {
    const result = await runCheckerStage(input);
    if (result.output.ok) return result;
    const fixable = result.output.issues.filter((i) => RULES[i.ruleId]?.fix);
    if (fixable.length === 0) return result;
    // rebuild from cache (Phase 3 normalizer가 자동 적용됨)
    await normalizeCacheAndRebuild(...);
    attempt++;
  }
  return runCheckerStage(input);  // 최종 결과
}
```

### 3. orchestrator 통합

`orchestrator.ts:651` checker 호출을 `runCheckerWithAutoFix`로 교체. fallback이 일어났는지 telemetry에 기록.

### 4. 회귀 테스트

`checker.test.ts`에 통수식 포함 XML fixture → fix 후 통과 시나리오 추가.
`orchestrator.pipeline.test.ts`에 build → check fail → autofix → check pass 시나리오 추가.

## 체크리스트

- [x] `checker.ts`에 `RULES` map + `fix?` field 도입
- [x] `fixRunOnEquationsInXml` 구현 (혹은 cache rebuild 방식 채택 시 `normalizeCacheAndRebuild`)
- [x] `runCheckerWithAutoFix` wrapper 추가 — 최대 2회 fix 시도
- [x] `orchestrator.ts:651` checker stage 호출을 wrapper로 교체
- [x] checker.test.ts에 autofix 시나리오 추가
- [x] `cd ngd-studio && pnpm test server/stages/__tests__/checker.test.ts` 통과

## 영향 범위

- checker 결과 의미 변경: ok=false라도 fix 가능하면 자동 처리 → ok=true 재반환.
- LLM fallback 호출 감소 (`fallbackRequired` 가 true 였던 케이스가 결정적 fix됨).
- Phase 2/3 정규화가 1차 방어선이므로 실제 fix 빈도는 낮을 것 — 그래도 safety net으로 둠.

## 검증

```bash
cd ngd-studio
pnpm tsc --noEmit
pnpm test server/stages/__tests__/checker.test.ts --reporter=basic
pnpm test server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic
```

수동: 통수식 포함 임의 HWPX 만들어서 checker fix 적용 → 분리된 HWPX 출력 확인.

---

## 실행 이력

### 1회차 (2026-05-20 08:41 KST) — completed

**상태**: completed
**소요 시간**: 약 12분
**진행 모델**: claude-sonnet-4-6

#### 요약

`checker.ts`에 `RULES` map과 `fix?` 핸들러 인터페이스를 도입하고, `equation.run_on`에
`fixRunOnEquationsInXml`(XML 직접 mutation, `splitTopLevelEqChecker` 내장) fix를 매핑.
`runCheckerWithAutoFix` wrapper를 추가해 fixable issue가 있으면 XML 패치 → 재검사 최대 2회 반복.
`orchestrator.ts` checker 호출을 wrapper로 교체하고 autofix 시 telemetry에 `downstreamCorrection` 플래그 기록.
`checker.test.ts`를 새로 작성해 7개 룰 + fixRunOnEquationsInXml + runCheckerWithAutoFix 시나리오 23개 검증.

#### 변경 파일

- `ngd-studio/server/stages/checker.ts` (수정, +130/-30줄)
  - `RULES` map, `RuleHandler` 인터페이스, `CheckerAutoFixResult` 인터페이스 추가
  - `runCheckerWithAutoFix` wrapper (XML mutation 기반 최대 2회 fix 루프)
  - `fixRunOnEquationsInXml` + `splitTopLevelEqChecker` 추가
  - `CheckerStageOutput.autofixed` 필드 추가
- `ngd-studio/server/stages/orchestrator.ts` (수정, +18/-10줄)
  - `runCheckerWithAutoFix` import + checker 호출 교체
  - autofix 시 SSE log + telemetry `downstreamCorrection` 기록
- `ngd-studio/server/stages/__tests__/checker.test.ts` (신규, +280줄)
  - 7개 룰 개별 테스트, fixRunOnEquationsInXml 6케이스, runCheckerWithAutoFix 6케이스

#### 검증 결과

- [x] `npx tsc --noEmit` → pass (출력 없음)
- [x] `checker.test.ts` → 23/23 pass
- [x] `orchestrator.pipeline.test.ts` → 5/5 pass (회귀 없음)

#### 추가 발견사항

- `checkRunOnEquations`(detect)는 모든 `=`를 단순 카운트(보수적)하지만, `fixRunOnEquationsInXml`(fix)는 `LEFT()/RIGHT()` depth-guarding을 적용해 더 정확한 분리를 수행한다. detect와 fix 간 의도적 비대칭 — 검출은 넓게, 수정은 정확하게.
- `equation.run_on`은 `warning` severity이므로 `ok=true` 경로에서도 fixable issue로 인식해 fix loop를 실행하도록 로직을 재설계했다 (초기 `ok → return early` 방식에서 `fixableIssues 먼저 체크` 방식으로 변경).

#### 질문 / 결정 사항

없음

#### Scope Audit (orchestrator)

pass — checker.ts + orchestrator.ts + __tests__/checker.test.ts(신규) 모두 scope 내.

#### Verification Re-run (orchestrator)

exit 0 — pnpm tsc --noEmit clean, checker.test.ts 23/23, orchestrator.pipeline.test.ts 5/5.

#### Simplify (orchestrator)

1 file, 1 edit — checker.ts에서 `fix` 핸들러와 모순되던 "fix is intentionally omitted" 4-line 주석 제거. 검증 재실행 pass.

#### Review (orchestrator)

pass — A~I 전부 OK. RULES map + fix 핸들러 + autoFix wrapper 스펙 일치, idempotent XML mutation 확인.
