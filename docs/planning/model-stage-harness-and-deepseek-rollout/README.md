---
task: model-stage-harness-and-deepseek-rollout
created: 2026-05-16
---

# Model Stage Harness and DeepSeek Rollout

이 작업은 deterministic runner 이후 model-call stage를 typed harness로 감싸고, DeepSeek V4를 제한된 stage에 rollout하기 위한 계획이다.

DeepSeek는 repo/file editing agent로 확장하지 않는다. 서버가 input/output schema, validation, cache write, telemetry, fallback을 소유하고 provider는 bounded model call만 수행한다.

성공 기준:

- `create.verifier`를 시작점으로 model stage harness가 추가된다.
- provider별 prompt/input/output 변환이 stage contract 아래로 들어간다.
- JSON parsing, validation failure telemetry, retry/fallback 정책이 stage 단위로 기록된다.
- DeepSeek V4는 허용된 model stage에만 opt-in/override로 사용된다.
- builder/checker deterministic runner와 legacy prompt fallback은 유지된다.

관련 문서:

- [DeepSeek Strategy and Harness Decision](../deepseek-v4-provider-roadmap/strategy-and-harness-decision.md)
- [Provider Operating Policy](../agent-provider-operating-model/provider-operating-policy.md)
- [StageRunner Architecture Draft](../agent-provider-operating-model/stage-runner-architecture.md)
