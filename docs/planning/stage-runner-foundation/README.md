---
task: stage-runner-foundation
created: 2026-05-16
---

# Stage Runner Foundation

이 작업은 기존 `/api/run -> prompt builder -> AIProviderAdapter` 흐름을 유지하면서, 후속 deterministic builder/checker runner와 schema-bound model stage harness가 붙을 수 있는 서버 측 기반을 만든다.

목표는 workflow 실행 책임을 점진적으로 provider prompt에서 서버 runner로 옮기는 것이다. 이번 task에서는 실제 builder/checker/DeepSeek stage 이관을 하지 않는다. SQLite도 도입하지 않는다. 기존 파일 기반 job/cache 구조를 helper로 감싸고, stage 타입, SSE event helper, telemetry foundation, legacy job wrapper를 추가한다.

성공 기준:

- 기존 create/resume/crop/review prompt-based workflow가 유지된다.
- `StageRunner`, `StageRunContext`, `StageResult` 타입 기반이 생긴다.
- 파일 기반 `JobStore` / `StageCache` helper가 생긴다.
- server-runner용 SSE event helper와 telemetry foundation이 생긴다.
- `/api/run`에 새 stage runner path를 붙일 확장 지점이 생긴다.
- SQLite 또는 새 DB 의존성은 도입하지 않는다.

## 완료 요약

- Legacy prompt workflow는 유지했고, `/api/run`은 `runLegacyPromptJob()` wrapper를 통해 기존 provider 실행 경로를 감싼다.
- 새 foundation은 stage type, file-backed job/cache helper, SSE event helper, stage telemetry helper로 제한했다.
- builder/checker/DeepSeek stage 이관은 이번 task에서 수행하지 않았다.
- 다음 추천 task: `deterministic-builder-runner`.

관련 문서:

- [StageRunner Architecture Draft](../agent-provider-operating-model/stage-runner-architecture.md)
- [Implementation Roadmap](../agent-provider-operating-model/implementation-roadmap.md)
- [Provider Operating Policy](../agent-provider-operating-model/provider-operating-policy.md)
