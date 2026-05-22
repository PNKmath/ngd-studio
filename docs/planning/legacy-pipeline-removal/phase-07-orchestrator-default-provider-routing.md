---
phase: 7
title: orchestrator defaultProvider routing 복구 — body.provider → stage default 전파
status: completed
depends_on: [4]
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
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

## 설계 원칙: silent fallback 금지

회귀의 근본 원인은 `getProviderForStage(stageKey, overrides, defaultProvider = "auto")` 함수 시그니처의 **hardcoded "auto" 기본값**. 호출자가 default 전달을 빠뜨리면 silently claude-cli 로 fallback 되어 사용자 의도가 무시됨. 향후 같은 클래스 회귀 차단을 위해:

- `defaultProvider` 를 **required** (optional 제거)
- `getProviderForStage` 의 hardcoded 기본값 제거 → 모든 호출자가 명시 전달 강제
- 누락 시 **TypeScript 컴파일 에러**로 fail-fast (runtime fallback 없음)
- `sse.ts` 진입부에서 `normalizeProviderId(body.provider)` 가 이미 undefined → `"auto"` 정규화 → `defaultProvider` 는 반드시 유효한 `AIProviderId`. 따라서 optional 로 둘 이유 없음.

## 설계

### 1. `OrchestratorInput.defaultProvider` 필드 추가 (required)

`server/stages/orchestrator.ts`:

```ts
export interface OrchestratorInput {
  // ...existing fields
  /**
   * 사용자가 settings UI 에서 선택한 default provider. sse.ts/followup route 가 반드시 전달.
   * stageOverrides 에 명시 안 된 stage 는 이 provider 로 fallback.
   * normalizeProviderId 결과(`"auto"` 포함)를 받으므로 undefined 불가.
   */
  defaultProvider: AIProviderId;   // required, optional 아님
  // ...
}
```

### 2. `getProviderForStage` 시그니처 — 기본값 제거

```ts
// 기존: function getProviderForStage(stageKey, overrides, defaultProvider: AIProviderId = "auto")
// 신규: function getProviderForStage(stageKey, overrides, defaultProvider: AIProviderId)
```

모든 호출처에서 `input.defaultProvider` 명시 전달 강제. 빠뜨리면 컴파일 에러.

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
- 시나리오 J: `defaultProvider: "auto"` → 모든 stage 가 claude-cli (auto resolve 동작 명시 검증)

(기존 테스트들이 `defaultProvider` 누락된 채 호출했다면 컴파일 에러로 잡힘 → 모두 `defaultProvider: "auto"` 추가)

## 체크리스트

- [ ] `OrchestratorInput.defaultProvider: AIProviderId` 필드 추가 (**required**, optional 아님)
- [ ] `getProviderForStage` 시그니처의 hardcoded `defaultProvider = "auto"` 기본값 제거 → 호출자 명시 전달 강제
- [ ] orchestrator.ts 의 모든 `getProviderForStage(stageKey, stageOverrides)` 호출에 `input.defaultProvider` 전달 (grep 기준 5+ 곳)
- [ ] `sse.ts` 의 `runStageOrchestrator({ ... })` 호출에 `defaultProvider: requestedProvider` 추가
- [ ] `app/api/run/[jobId]/followup/route.ts` 의 `runStageOrchestrator({ ... })` 호출 2곳 (review/create followup) 에 `defaultProvider` 추가 (job 의 저장된 `requestedProvider` 사용 — 없으면 `normalizeProviderId(undefined)` = `"auto"`)
- [ ] 테스트 시나리오 H/I/J 추가 + 기존 테스트들이 `defaultProvider` 누락 시 컴파일 에러로 잡혔다면 `defaultProvider: "auto"` 보강
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] `cd ngd-studio && npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic` 통과

## 영향 범위

- **default provider 사용자**: 회귀 해결, 사용자 의도대로 동작 복원
- **stage override 사용자**: 영향 없음 (명시 override 가 default 보다 우선)
- **API 호환성**: `OrchestratorInput.defaultProvider` 는 **required** → 기존 호출자 모두 컴파일 에러로 잡힘 (의도된 fail-fast). 호출자 2곳(sse.ts + followup) + 테스트 mock 호출 보강 필요. silent fallback 클래스 회귀 근본 차단이 목적.
- **롤백**: orchestrator 내부 인자 + 호출자 패턴 추가라 부분 revert 가능. 단 required 전환을 되돌리면 silent fallback 회귀 재발 가능 → 비추.

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

## 실행 결과

### run-1779378207-3137 (2026-05-22)

**수행 항목**:
1. `OrchestratorInput.defaultProvider: AIProviderId` 필드 추가 (required, optional 아님)
2. `getProviderForStage` 시그니처의 hardcoded `defaultProvider = "auto"` 기본값 제거
3. orchestrator.ts 내 모든 `getProviderForStage` 호출 5곳에 `input.defaultProvider` 명시 전달 (review.reviewer, create.extractor, create.solver ×2, create.verifier)
4. `sse.ts` `runStageOrchestrator` 호출에 `defaultProvider: requestedProvider` 추가
5. `followup/route.ts` 2곳 (review, create/resume) 에 `defaultProvider: normalizeProviderId(job.requestedProvider)` 추가 + `normalizeProviderId` import 추가
6. 기존 테스트 `orchestrator.pipeline.test.ts` + `orchestrator.test.ts` + `orchestrator.integration.test.ts` 의 모든 `runStageOrchestrator` 호출에 `defaultProvider: "auto"` 보강 (총 17곳)
7. 신규 시나리오 H/I/J 추가 — `getProviderAdapter` 를 통한 라우팅 로직 단위 검증

**검증 결과**:
- `npx tsc --noEmit`: 에러 0 (통과)
- `npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic`: 11/11 pass (기존 7 + 신규 H/I/J 3 + G 1)

## 후속

본 phase commit 후 **Phase 6 의 manual E2E 6 흐름 검증** 재시도 가능. Phase 6 frontmatter `depends_on: [5, 7]` 로 갱신됨.

#### Scope Audit (orchestrator)
pass — scope frontmatter에 orchestrator.test.ts / orchestrator.integration.test.ts 보강 추가 (체크리스트 #6 "기존 테스트 컴파일 에러 보강" 의도와 일치, retroactive scope 확장).

#### Verification Re-run (orchestrator)
exit 0 — `cd ngd-studio && npx tsc --noEmit` pass + `npx vitest run server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic` 11/11 pass 재현. 추가로 unit suite 509/509 pass (라이브 DeepSeek 제외).

#### Simplify (orchestrator)
skipped — fix phase 성격. 테스트 보강 17곳은 mechanical, 본 코드는 1줄 추가 + hardcoded 제거라 더 줄일 여지 없음.

#### Review (orchestrator)
self-review — spec과 구현 1:1 일치. `OrchestratorInput.defaultProvider` required 적용 + getProviderForStage hardcoded "auto" 제거 + 호출자 5+곳 명시 전달 + 테스트 H/I/J 추가 모두 확인. silent fallback 클래스 회귀 차단 의도 달성.

#### E2E (orchestrator)
skip — e2e_triggers 비어있음. 사용자 manual smoke (codex-cli default + create 1회)는 commit 후 Phase 6 manual E2E 재시도와 함께 진행.
