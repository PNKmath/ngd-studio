---
task: model-stage-harness-and-deepseek-rollout
created: 2026-05-16
---

# Model Stage Harness and DeepSeek Rollout

이 작업은 deterministic runner 이후 model-call stage를 typed harness로 감싸고, DeepSeek V4를 `AI_STAGE_KEYS`에 속한 모델 호출 단계 전체에 rollout하기 위한 계획이다.

DeepSeek는 repo/file editing agent로 확장하지 않는다. 서버가 input/output schema, validation, cache write, telemetry, fallback을 소유하고 provider는 bounded model call만 수행한다. `builder`, `checker`, `cropper`처럼 파일 생성/검증/좌표 적용을 직접 수행하는 deterministic 단계는 provider 선택 대상이 아니다.

## Rollout 기준

DeepSeek 허용 범위:

- `create.extractor`
- `create.solver`
- `create.verifier`
- `review.reviewer`

DeepSeek 비허용 범위:

- `cropper`: PDF/이미지 좌표와 crop 산출물은 서버/로컬 코드가 처리한다.
- `builder`: HWPX 생성, namespace fix, validate는 deterministic runner가 처리한다.
- `checker`: HWPX XML rule 검증은 deterministic checker가 먼저 처리한다.
- `figure`: 이미지 생성/후처리 workflow는 별도 provider contract가 필요하다.

후속 후보:

- `review-report-draft-stage`: DeepSeek가 HWPX를 직접 수정하지 않고 review report 초안 JSON만 생성한다.
- `extractor-vision-contract`: extractor에 vision/OCR 입력 계약을 추가해 이미지 입력 안정성을 검증한다.

성공 기준:

- `create.verifier`를 시작점으로 model stage harness가 추가된다.
- provider별 prompt/input/output 변환이 stage contract 아래로 들어간다.
- JSON parsing, validation failure telemetry, retry/fallback 정책이 stage 단위로 기록된다.
- DeepSeek V4는 `AI_STAGE_KEYS`의 model-call stage 전체에 opt-in/override로 사용된다.
- builder/checker deterministic runner와 legacy prompt fallback은 유지된다.

관련 문서:

- [DeepSeek Strategy and Harness Decision](../deepseek-v4-provider-roadmap/strategy-and-harness-decision.md)
- [Provider Operating Policy](../agent-provider-operating-model/provider-operating-policy.md)
- [StageRunner Architecture Draft](../agent-provider-operating-model/stage-runner-architecture.md)
