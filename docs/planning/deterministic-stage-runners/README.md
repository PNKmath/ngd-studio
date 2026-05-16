---
task: deterministic-stage-runners
created: 2026-05-16
---

# Deterministic Stage Runners

이 작업은 `stage-runner-foundation` 위에 builder/checker의 deterministic 실행 경로를 얹는다. 목표는 모델이 할 필요 없는 HWPX build, namespace fix, validation, XML rule check를 서버 runner가 직접 수행하도록 분리하는 것이다.

이번 task에서는 extractor/solver/verifier 같은 model stage harness와 DeepSeek rollout을 다루지 않는다. 기존 legacy prompt workflow는 fallback으로 유지한다.

성공 기준:

- `builder` stage가 `StageRunner` 형태로 실행되고 `build_status.json`과 SSE event를 서버가 기록한다.
- `checker` stage의 XML rule subset이 deterministic issue list를 생성한다.
- `/api/run` 또는 legacy wrapper 주변에 deterministic runner를 붙일 확장 지점이 생긴다.
- 실패 시 기존 builder/checker agent fallback 경로가 제거되지 않는다.
- focused Vitest와 TypeScript 검증이 통과한다.

관련 문서:

- [StageRunner Foundation](../stage-runner-foundation/README.md)
- [Deterministic Code Candidates](../agent-provider-operating-model/deterministic-code-candidates.md)
- [StageRunner Architecture Draft](../agent-provider-operating-model/stage-runner-architecture.md)
