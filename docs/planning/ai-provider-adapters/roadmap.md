# AI provider adapters roadmap

## 2차: DeepSeek V4 API provider

DeepSeek V4는 CLI agent가 아니라 외부 API provider로 다룬다. 1차 provider layer처럼 전체 HWPX 생성 workflow를 바로 대체하지 않고, 데이터 전송 범위가 작고 검증 가능한 단계부터 적용한다.

우선 후보:

- `review.reviewer`: 오검 리포트 JSON 초안 생성 또는 기존 리포트 보정
- `create.extractor`: 추출 JSON의 구조적 오류 보정
- `create.verifier`: 해설 검증 결과의 consistency check

명시적 제외:

- 원본 PDF 전체 업로드 기반 end-to-end 생성
- HWPX 원본/완성본 전체 업로드
- 문제 이미지 원본 일괄 전송
- 사용자가 선택하지 않은 자동 외부 API fallback

환경 변수 placeholder:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_API_BASE_URL`
- `DEEPSEEK_MODEL`

## 외부 API 전송 정책 결정 항목

DeepSeek V4, Gemini, 기타 외부 API provider 구현 전 아래 항목을 먼저 확정해야 한다.

- 어떤 파일 유형을 외부 API로 보낼 수 있는지: PDF, HWPX, PNG/JPG, 추출 JSON, 해설 JSON
- 문제 이미지와 학교/시험 메타데이터를 민감 정보로 볼지 여부
- 사용자별 opt-in UI와 작업별 override 필요 여부
- 외부 API 요청/응답 로그 보관 범위와 보관 기간
- 실패 시 같은 외부 provider 재시도 허용 여부와 최대 횟수
- 외부 provider 결과를 로컬 Claude/Codex checker로 재검증할지 여부

정책이 확정되기 전에는 DeepSeek V4를 UI에 노출하거나 실행 가능한 provider로 등록하지 않는다.

## 3차: 자동 추천 + 단계별 엔진 선택

현재 1차 설정은 작업 전체 기본 provider만 가진다.

```ts
{
  defaultProvider: "auto" | "claude" | "codex"
}
```

3차에서는 작업 전체 기본 provider와 stage override를 분리한다.

```ts
{
  defaultProvider: "auto" | "claude" | "codex" | "deepseek-v4",
  stageOverrides: {
    "create.extractor"?: "auto" | "claude" | "codex" | "deepseek-v4",
    "create.solver"?: "auto" | "claude" | "codex" | "deepseek-v4",
    "create.verifier"?: "auto" | "claude" | "codex" | "deepseek-v4",
    "review.reviewer"?: "auto" | "claude" | "codex" | "deepseek-v4"
  }
}
```

자동 추천은 바로 모델 선택 로직을 하드코딩하지 않는다. 먼저 provider별 품질/속도/비용 데이터를 작업 로그에 남긴 뒤, 충분한 관측치가 쌓인 stage부터 추천 규칙을 도입한다.

초기 추천 기준:

- 실패율
- 평균 실행 시간
- 재시도 발생률
- checker/reviewer 수정 필요 빈도
- 외부 API 비용

## 구현 순서

1. 외부 API 전송 정책을 문서로 확정한다.
2. DeepSeek V4를 UI에 숨긴 상태로 제한 stage provider adapter만 추가한다.
3. stage override 데이터 구조와 job metadata 기록을 추가한다.
4. 설정 화면에 stage override UI를 추가한다.
5. provider별 실행 결과 telemetry를 축적한다.
6. `auto` 추천 규칙을 stage 단위로 도입한다.
