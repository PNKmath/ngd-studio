---
phase: 2
title: orchestrator 이벤트 emit을 canonical name으로 변경
status: pending
depends_on: [1]
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/__tests__/orchestrator.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 2: orchestrator 이벤트 emit을 canonical name으로 변경

> **범위**: Backend (orchestrator + 테스트)
> **난이도**: S
> **의존성**: Phase 1 (canonical namespace)
> **영향 파일**: `ngd-studio/server/stages/orchestrator.ts`

## 배경

orchestrator는 `stageEvent("create.extractor", "running")` 같은 호출을 통해 AI provider 키를 그대로 SSE로 흘려보내고 있다. useJobRunner의 `updateStage("create.extractor", ...)`가 store의 6개 canonical stage(extractor/solver/verifier/figure/builder/checker)와 매치 안 돼 PipelineView가 갱신 안 됨.

orchestrator 측에서 emit 시점에 Phase 1의 `aiStageToPipeline` 매핑을 사용해 canonical name으로 emit한다.

## 설계

`server/stages/orchestrator.ts`에서 다음 호출 site를 모두 canonical name으로 변환:

| 현재 (라인 추정) | 변경 후 |
|---|---|
| `send(stageEvent("create.extractor", "running"))` | `send(stageEvent("extractor", "running"))` |
| `send(stageEvent("create.extractor", "failed", ...))` | `send(stageEvent("extractor", "failed", ...))` |
| `send(stageEvent("create.extractor", "done", ...))` | `send(stageEvent("extractor", "done", ...))` |
| `send(progressEvent("create.extractor", n))` | `send(progressEvent("extractor", n))` |
| `send(logEvent("create.extractor", ...))` | `send(logEvent("extractor", ...))` |
| `send(stageEvent("create.solver", ...))` | `send(stageEvent("solver", ...))` |
| `send(progressEvent("create.solver", ...))` | `send(progressEvent("solver", ...))` |
| `send(stageEvent("create.verifier", ...))` | `send(stageEvent("verifier", ...))` |
| `send(progressEvent("create.verifier", ...))` | `send(progressEvent("verifier", ...))` |

figure/builder/checker는 이미 bare name이라 변경 없음.

**provider 호출 시 `stageKey: "create.extractor"`**는 그대로 유지 — 그건 AI provider 선택용 key namespace이고 SSE event name과는 분리된 개념. orchestrator 내부에서만 사용하며 외부 emit과 분리.

### 직접 변환 vs 매핑 함수 사용

가장 간단한 방법은 호출 site에서 직접 bare name을 박는 것. 하지만 `aiStageToPipeline`을 import해서 호출 site에서 한 번 변환 변수를 만들면 향후 confused가 줄어든다:

```ts
// orchestrator 안에서
const EXTRACTOR_STAGE: PipelineStageName = aiStageToPipeline("create.extractor")!;
const SOLVER_STAGE: PipelineStageName = aiStageToPipeline("create.solver")!;
const VERIFIER_STAGE: PipelineStageName = aiStageToPipeline("create.verifier")!;
```

또는 단순 상수 직접 표기. 가독성 차이만 있으므로 worker 판단에 맡김.

### 테스트 갱신

`server/stages/__tests__/orchestrator.test.ts`와 `orchestrator.integration.test.ts`에서 SSE event를 검사하는 부분의 stage name도 "create.extractor" → "extractor" 등으로 갱신. event.data.name 비교 assertion이 있을 가능성 높음.

## 체크리스트

- [ ] orchestrator.ts의 모든 `stageEvent`/`progressEvent`/`logEvent` 호출에서 stage name 인자를 canonical name으로 변경 (extractor/solver/verifier)
- [ ] provider 호출 시 `stageKey: "create.*"` 형태의 AI provider 인자는 **변경 없이 유지**
- [ ] orchestrator.test.ts의 event name 검사 부분 갱신
- [ ] orchestrator.integration.test.ts의 event name 검사 부분 갱신
- [ ] `cd ngd-studio && npx tsc --noEmit && npx vitest run server/stages/__tests__/orchestrator.test.ts server/stages/__tests__/orchestrator.integration.test.ts --reporter=basic` 전부 pass

## 영향 범위

- orchestrator가 emit하는 SSE event의 `data.name` 값이 6개 canonical name으로 통일.
- 클라이언트(useJobRunner) 측 매칭 정상화 → PipelineView가 stage 상태를 갱신하기 시작.
- AI provider 선택 키(create.*)는 그대로이므로 settings UI/recommendation 영향 없음.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/orchestrator.test.ts server/stages/__tests__/orchestrator.integration.test.ts --reporter=basic
```
