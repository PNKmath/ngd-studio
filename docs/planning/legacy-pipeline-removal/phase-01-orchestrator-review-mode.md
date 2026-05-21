---
phase: 1
title: orchestrator에 review mode 통합 + auto default resolve 보장
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/reviewRunner.ts
  - ngd-studio/server/stages/types.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - review-full-pipeline
e2e_triggers: []
---

# Phase 1: orchestrator에 review mode 통합 + auto default resolve 보장

> **범위**: Backend (TS orchestrator)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `server/stages/orchestrator.ts`, `server/stages/reviewRunner.ts`

## 배경

`runStageOrchestrator` (server/stages/orchestrator.ts:161) 의 `OrchestratorInput.mode` 는 현재 `"create" | "resume"` 만 지원. `mode === "review"` 는 sse.ts 의 legacy 분기 (`runLegacyPromptJob` + `buildReviewPrompt` + ngd-exam-review skill prompt) 로 처리된다.

`server/stages/reviewRunner.ts:98` 의 `runReviewStage` 는 이미 구현되어 있고 (`ReviewIssueDraft[]` → mutation → postprocess) 단위 테스트도 있지만, production 호출처가 0건이다. orchestrator 에 review 분기를 추가해 wiring 만 하면 된다.

또한 본 task 가 legacy 분기를 모두 제거하면 stageOverrides 가 비어 있는 (모든 stage=auto) 경우도 orchestrator 로 흘러가게 된다. 현재 `getProviderForStage` (orchestrator.ts:148) 는 `stageOverrides[key] ?? "auto"` 로 떨어지고 `resolveProviderId("auto")` (lib/ai/registry.ts:54) 가 `"claude-cli"` 로 매핑하므로 동작은 하지만, 이 경로가 모든 stage (create.extractor/solver/verifier, figure/builder/checker, review.reviewer) 에서 깨지지 않는지 명시적 테스트로 보장한다.

## 설계

### 1. `OrchestratorInput` 확장

```ts
export interface OrchestratorInput {
  mode: "create" | "resume" | "review";
  // ...기존 필드...

  /** review mode 전용: 검수 대상 HWPX 경로 (orchestrator 내부에서 mutate). */
  hwpxPath?: string;
  /** review mode 전용: 자유 텍스트 추가 지시 (followup 등). reviewer prompt 에 append. */
  additionalInstruction?: string;
}
```

create/resume 사용자에게는 `hwpxPath`, `additionalInstruction` 모두 optional 이라 기존 호출처는 영향 없음.

### 2. review 분기 wiring

`runStageOrchestrator` 본문에서 `input.mode === "review"` 이면 create/resume 의 per-question 파이프라인 분기로 들어가지 않고 별도 함수 `runReviewModeOrchestrator(input)` 로 분기.

`runReviewModeOrchestrator` 의 책임:
1. `hwpxPath` 검증 (없으면 `error` 이벤트 + 실패 반환)
2. reviewer agent callable 빌드:
   ```ts
   const reviewerAdapter = getProviderForStage("review.reviewer", input.stageOverrides);
   const runReviewerAgent = async (hwpxPath, { skipRuleIds }) => {
     // reviewer prompt 빌드 (기존 .claude/agents/ngd-exam-reviewer.md 의 책임을 인라인 prompt 로)
     // additionalInstruction 이 있으면 "추가 지시:" 섹션 append
     // adapter.run(prompt, ...) → stdout 의 JSON 을 ReviewIssueDraft[] 로 파싱
   };
   ```
3. `runReviewStage({ hwpxPath, runReviewerAgent })` 호출
4. SSE event: `stage("reviewer", "running") → log → stage("reviewer", "done", { summary })` + `result({ status, outputPath: hwpxPath })`
5. providerTelemetry append

reviewer prompt 빌드는 본 phase에서 *최소한*으로 구현 — 기존 `.claude/agents/ngd-exam-reviewer.md` 의 system instruction 을 그대로 임베드. 별도 prompt template 파일은 phase 04 의 sse.ts 통합 시 정리.

### 3. auto default resolve 보장

- `getProviderForStage` 동작 확인 — `stageOverrides[key] ?? "auto"` 가 `auto` 로 떨어져도 `getProviderAdapter("auto")` 가 `claudeCliProvider` 반환.
- 단위 테스트 추가: 빈 `stageOverrides = {}` + `getProviderForStage("review.reviewer", {})` → adapter.id === "claude-cli".

### 4. 테스트

`server/stages/__tests__/orchestrator.pipeline.test.ts` 에 review mode 시나리오 추가:
- `mode: "review"` + `hwpxPath` + mock reviewer adapter
- `runReviewStage` 가 실제 mutation 까지 하지 않도록 stub 사용 (또는 fixture HWPX)
- 빈 `stageOverrides` 로 호출 시 reviewer adapter 가 claudeCliProvider 인지 검증

## 체크리스트

- [x] `OrchestratorInput.mode` 타입을 `"create" | "resume" | "review"` 로 확장
- [x] `OrchestratorInput` 에 `hwpxPath?: string`, `additionalInstruction?: string` 추가 + JSDoc
- [x] `runStageOrchestrator` 본문에 `input.mode === "review"` 분기 추가 — `runReviewModeOrchestrator` 호출
- [x] `runReviewModeOrchestrator` 구현: hwpxPath 검증, reviewer adapter 빌드, `runReviewStage` 호출, SSE event 발생
- [x] reviewer prompt 빌더 — `.claude/agents/ngd-exam-reviewer.md` 의 system prompt 를 임베드, `additionalInstruction` append 지원
- [x] `getProviderForStage("review.reviewer", {})` → claude-cli adapter 반환을 단위 테스트로 보장
- [x] `orchestrator.pipeline.test.ts` 에 review mode 시나리오 3개 추가 (E: wiring 검증, F: missing hwpxPath, G: auto default resolve)
- [x] `cd ngd-studio && npx tsc --noEmit` 통과 + `npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic` 통과

## 영향 범위

- **호환성**: 기존 create/resume 호출처는 영향 없음 (mode 타입 확장은 호환).
- **신규 review 호출처**: phase 02 (followup) + phase 04 (sse) 가 본 phase 의 output 에 의존.
- **롤백**: review 분기를 무력화하면 (early return) phase 04 의 sse.ts review 분기는 여전히 legacy 경로 사용 가능 → 부분 롤백 가능.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic
```

수동 확인은 phase 04 wiring 후에야 가능 (sse.ts 가 review mode 를 orchestrator 로 라우팅해야 실제 흐름 검증 가능).

## 실행 결과

### 1회차 (2026-05-22 00:51 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`OrchestratorInput.mode`를 `"review"` 로 확장하고 `hwpxPath`, `additionalInstruction` 필드를 추가했다.
`runReviewModeOrchestrator` 를 구현해 hwpxPath 검증 → reviewer adapter 빌드 → `runReviewStage` 호출 → SSE 이벤트 발생 흐름을 완성했다.
reviewer system prompt는 `.claude/agents/ngd-exam-reviewer.md` 핵심 지시사항을 인라인으로 임베드했고 `additionalInstruction` append를 지원한다.
테스트 3개 (E: wiring, F: missing hwpxPath, G: auto default resolve) 추가 — 기존 5개 포함 총 8개 모두 통과.

#### 변경 파일
- `ngd-studio/server/stages/orchestrator.ts` (수정, +164/-4줄): mode 확장, 신규 import, `runReviewModeOrchestrator` 구현, `runStageOrchestrator` 분기
- `ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts` (수정, +112/-0줄): reviewRunner mock + 시나리오 E/F/G

#### 검증 결과
- [x] `npx tsc --noEmit`: 출력 없음 → pass
- [x] `npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic`: 8 tests passed → pass

#### 추가 발견사항
- `runReviewStage` stub이 `runReviewerAgent`를 호출하면 실제 claude-cli를 spawn해 timeout이 발생함 → stub을 reviewer 호출 없이 즉시 반환하도록 설계. reviewer adapter telemetry는 `runReviewerAgent` 내부에서만 기록되므로 테스트 (E)에서 telemetry 검증은 생략하고 wiring 검증(runReviewStage 호출 여부 + SSE 이벤트)에 집중함.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (orchestrator.ts, orchestrator.pipeline.test.ts)

#### Verification Re-run (orchestrator)
exit 0 — tsc + vitest 8 tests passed 재현됨

#### Simplify (orchestrator)
SIMPLIFIED: 1, CHANGES: 1 file, 3 edits — 중복 섹션 헤더 배너 제거 + stage 라벨 ternary 중복을 stageLabel 객체로 통합. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass — A~J 전 항목 이상 없음. reviewRunner.ts/types.ts 미수정은 scope 축소(필요한 확장이 orchestrator.ts에서 처리됨)로 위반 아님.

#### Commit
90ae123 — feat(orchestrator): Phase 1 — review mode 통합 + auto default resolve 보장
