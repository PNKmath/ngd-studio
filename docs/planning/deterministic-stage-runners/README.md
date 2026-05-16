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

## 구현 결과

- `server/stages/commands.ts`: deterministic command runner와 `StageError` 변환 helper.
- `server/stages/builder.ts`: `build_hwpx.py -> fix_namespaces.py -> validate.py --fix` 실행 runner와 `build_status.json` 기록.
- `server/stages/checker.ts`: HWPX `Contents/section0.xml` 또는 section XML 입력을 대상으로 한 deterministic XML/string rule runner.
- `server/sse.ts`: `resumeFrom === "builder" | "confirm"` 및 `resumeFrom === "checker"` opt-in 경로에 deterministic runner를 먼저 실행하고, 실패 시 legacy builder/checker prompt workflow로 fallback.
- `lib/__tests__/stageFoundation.test.ts`: command, builder, checker focused coverage.

이번 task는 builder/checker deterministic runner까지만 다뤘다. Extractor/solver/verifier model stage harness와 DeepSeek rollout은 후속 작업으로 남긴다.

다음 추천 task: `model-stage-harness-and-deepseek-rollout`.

관련 문서:

- [StageRunner Foundation](../stage-runner-foundation/README.md)
- [Deterministic Code Candidates](../agent-provider-operating-model/deterministic-code-candidates.md)
- [StageRunner Architecture Draft](../agent-provider-operating-model/stage-runner-architecture.md)
