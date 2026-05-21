---
phase: 7
title: orchestrator defaultProvider routing 복구 — body.provider → stage default 전파
status: pending
depends_on: [4]
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
intervention_likely: true
intervention_reason: "Provider routing 회귀 fix — 사용자가 settings UI에서 선택한 default provider가 stageOverrides 비어있을 때 silently 무시되던 회귀를 복구. Phase 4 의 useCodeOrchestrator 통합 결손 보강. fix 후 사용자 manual smoke 필수."
executor: sonnet
load_bearing: "OrchestratorInput.defaultProvider — 모든 stage가 default provider를 상속하는 핵심 라우팅 키"
e2e_refs:
  - create-v4-full-pipeline
  - review-full-pipeline
e2e_triggers: []
---

# Phase 7: orchestrator defaultProvider routing 복구

> **범위**: Backend (orchestrator + sse.ts + followup route)
> **난이도**: S~M
> **의존성**: Phase 4 (sse.ts legacy 통합)
> **영향 파일**: `server/stages/orchestrator.ts`, `server/sse.ts`, `app/api/run/[jobId]/followup/route.ts`

## 배경 (회귀 발견 경위)

Phase 4 commit 0763faf 이후 사용자 manual E2E 시도 중 **create 흐름에서 solver hang(9분)** 증상 보고. 진단 결과:

- 사용자 설정: `/settings` 에서 default provider 를 `codex-cli` 로 지정 + stageOverrides 비어있음
- 사용자 의도: 모든 stage 가 codex-cli 로 실행 (legacy 경로에서 그대로 동작했던 패턴)
- 실제 동작: 모든 stage 가 `claude-cli` 로 silently fallback → claude 응답 100~120초 → 사용자 hang 인식

증거:
- `data/jobs/4cbea6a1-2073-4da7-ac5b-45bcf1864433.json` (08:18 KST)
- `requestedProvider: "codex-cli"`, `provider: "codex-cli"`, `stageOverrides: {}`
- `providerTelemetry` 모든 stage: `requestedProvider: "claude-cli"`, `resolvedProvider: "claude-cli"`

회귀 메커니즘:
1. `orchestrator.ts:155-162` `getProviderForStage(stageKey, overrides, defaultProvider = "auto")` — 함수 시그니처 default 가 `"auto"` 로 hardcoded
2. Phase 4 sse.ts 통합 시 `runStageOrchestrator({ stageOverrides, ... })` 호출만 했고 사용자 선택 `body.provider` (=requestedProvider) 는 전달 안 함
3. → orchestrator 내부의 모든 `getProviderForStage(...)` 호출이 stageOverrides 미설정 stage 에 대해 `"auto"` 로 fallback → `claude-cli` adapter
4. legacy 경로 (이전 `runLegacyPromptJob`) 에선 `requestedProvider` 가 직접 적용돼 codex-cli 로 돌았음

**stage override 명시 사용자가 영향 안 받은 이유**: 각 stage 에 명시적 override 가 있으므로 default 무관. Phase 4 통합 후에도 동일 동작 유지.

**default provider 만 선택한 사용자가 영향받음**: stageOverrides 비어있어 모든 stage 가 default 로 fallback 해야 하는데, default 전달 누락으로 hardcoded "auto" = claude-cli 적용.

## 설계

### 1. `OrchestratorInput.defaultProvider` 필드 추가

`server/stages/orchestrator.ts`:

```ts
export interface OrchestratorInput {
  // ...existing fields
  /** sse.ts/followup route 가 사용자 body.provider 를 전달. 모든 stage 의 fallback default. */
  defaultProvider?: AIProviderId;
  // ...
}
```

### 2. `getProviderForStage` 호출 시 input.defaultProvider 전달

`orchestrator.ts` 내 모든 `getProviderForStage(stageKey, stageOverrides)` 호출을 다음으로 변경:

```ts
getProviderForStage(stageKey, stageOverrides, input.defaultProvider ?? "auto")
```

확인 위치 (grep 기준):
- `runReviewModeOrchestrator` 의 `reviewerAdapter` (line ~251)
- create extractor (line ~501)
- create solver (line ~561, ~624)
- create verifier (line ~623)

### 3. `sse.ts` 가 body.provider 를 defaultProvider 로 전달

`server/sse.ts` 의 `runStageOrchestrator({ ... })` 호출에 추가:

```ts
const orchResult = await runStageOrchestrator({
  // ...existing fields
  defaultProvider: requestedProvider,
  // ...
});
```

### 4. followup route 도 동일 패턴

`app/api/run/[jobId]/followup/route.ts` 의 `runStageOrchestrator({ ... })` 호출들도 동일하게 `defaultProvider: ...` 전달. followup 의 경우 job 의 저장된 `requestedProvider` 를 사용.

### 5. 테스트 추가

`server/stages/__tests__/orchestrator.pipeline.test.ts` 에 시나리오 추가:

- 시나리오 H: `defaultProvider: "codex-cli"` + stageOverrides 비어있음 → 각 stage adapter 가 codex-cli 로 resolve
- 시나리오 I: `defaultProvider: "codex-cli"` + stageOverrides 에 `create.solver: "claude-sdk"` → solver 만 claude-sdk, 나머지 codex-cli
- 시나리오 J: `defaultProvider` 미전달 → 기존 동작 유지 (auto = claude-cli)

## 체크리스트

- [ ] `OrchestratorInput.defaultProvider?: AIProviderId` 필드 추가
- [ ] orchestrator.ts 의 모든 `getProviderForStage(stageKey, stageOverrides)` 호출에 `input.defaultProvider` 전달 (grep 기준 5+ 곳)
- [ ] `sse.ts` 의 `runStageOrchestrator({ ... })` 호출에 `defaultProvider: requestedProvider` 추가
- [ ] `app/api/run/[jobId]/followup/route.ts` 의 `runStageOrchestrator({ ... })` 호출 2곳 (review/create followup) 에 `defaultProvider` 추가 (job 의 저장된 `requestedProvider` 사용)
- [ ] 테스트 시나리오 H/I/J 추가 — defaultProvider 전파 + override 우선순위 + 미전달 fallback
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] `cd ngd-studio && npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic` 통과

## 영향 범위

- **default provider 사용자**: 회귀 해결, 사용자 의도대로 동작 복원
- **stage override 사용자**: 영향 없음 (명시 override 가 default 보다 우선)
- **API 호환성**: `OrchestratorInput.defaultProvider` 는 optional → 기존 호출자 영향 없음
- **롤백**: 안전. orchestrator 내부 인자 추가 + 호출자 1줄 추가 패턴이라 부분 revert 가능

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic
```

수동 검증 (필수 — intervention_likely=true):
- [ ] `/settings` 에서 default provider = `codex-cli` 지정 + stageOverrides 비움 → create 처음~끝 1회 → 결과 job 의 `providerTelemetry` 모든 stage 가 `resolvedProvider: "codex-cli"` 인지 확인
- [ ] default = `auto` + stageOverrides 비움 → create 1회 → 모든 stage 가 `claude-cli` (기존 동작 유지)
- [ ] default = `codex-cli` + `create.solver = "claude-sdk"` 명시 → solver 만 claude-sdk, 나머지 codex-cli

## 후속

본 phase commit 후 **Phase 6 의 manual E2E 6 흐름 검증** 재시도 가능. Phase 6 frontmatter `depends_on: [5, 7]` 로 갱신됨.
