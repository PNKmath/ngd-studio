# DeepSeek V4 사용 전략 및 하네스 결정

Created: 2026-05-16

## 결론

현재 구현한 `deepseek-v4` provider는 **API 호출 배관 prototype**으로 둔다. 이 provider를 Claude/Codex CLI처럼 repo 파일을 직접 수정하는 agent로 확장하지 않는다.

다음 단계의 우선순위는 DeepSeek용 코드 수정 하네스가 아니라, NGD workflow를 agent prompt 중심 구조에서 **typed stage runner + deterministic code + bounded model call** 구조로 재분해하는 것이다.

DeepSeek V4는 다음 경우에만 사용한다.

- 입력과 출력이 JSON/text schema로 고정된 stage
- 파일 수정이 필요 없고, 서버 코드가 결과를 검증한 뒤 저장할 수 있는 stage
- 실패 시 같은 입력으로 재시도하거나 Claude/Codex fallback이 가능한 stage

DeepSeek V4를 사용하지 않을 곳:

- HWPX ZIP/XML 직접 수정
- 저장소 코드 수정
- 로컬 파일 탐색과 명령 실행이 필요한 workflow orchestration
- builder/checker처럼 deterministic script로 대체 가능한 작업

Studio 설정 UI에서는 이 정책을 사용자가 stage별로 판단하지 않게 한다. DeepSeek를 켜면 `AI_STAGE_KEYS`에 속한 모델 호출 단계 전체(`create.extractor`, `create.solver`, `create.verifier`, `review.reviewer`)에 적용하고, `builder`, `checker`, `cropper` 같은 deterministic 단계는 provider override 대상에서 제외한다.

## API 전제

DeepSeek 공식 API는 `deepseek-v4-flash`, `deepseek-v4-pro` chat completion model id를 문서화한다. 또한 function/tool call schema를 받을 수 있다. 다만 tool call 문서가 명시하듯, 실제 함수 실행 기능은 호출자 쪽에서 제공해야 한다. 즉 API model은 “어떤 tool을 호출하라”는 구조화된 출력을 만들 수 있지만, 파일 읽기/쓰기/명령 실행 권한을 자체적으로 갖지는 않는다.

참고:

- <https://api-docs.deepseek.com/api/create-chat-completion>
- <https://api-docs.deepseek.com/guides/tool_calls>

## 현재 구조의 문제

현재 Studio의 `/api/run`은 stage runner가 아니다. `lib/prompts.ts`가 다음과 같은 큰 지시를 만든 뒤 provider에 넘긴다.

- `Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`
- `Skill 도구로 "ngd-exam-review" 스킬을 호출해서 진행해.`

Claude/Codex CLI는 로컬 agent 환경, 파일 tool, Bash tool, `.claude/skills`, `.claude/agents`를 사용할 수 있으므로 이 방식이 동작한다. DeepSeek API는 이 실행 환경이 없으므로 같은 prompt를 받아도 workflow를 실제로 수행할 수 없다.

따라서 provider 선택 UI만 추가하는 방식은 충분하지 않다. 먼저 workflow를 앱 서버가 직접 실행하는 stage contract로 바꾸어야 한다.

## Stage별 재분류

| Stage | 현재 방식 | 코딩 대체 가능성 | 모델 필요성 | DeepSeek 후보 |
|---|---|---:|---:|---:|
| cropper | skill/agent 또는 기존 cropper 코드 | 높음 | 낮음 | 아니오 |
| create.extractor | 이미지 인식 agent | 중간 | 높음 | 예, vision/OCR contract 필요 |
| create.solver | 수학 풀이 agent | 낮음 | 높음 | 예 |
| create.verifier | 독립 검증 agent | 중간 | 중간~높음 | 예 |
| figure | crop + image generation | 중간 | 모델은 이미지 생성 쪽 | 아니오 |
| builder | `build_hwpx.py` + 후처리 script | 높음 | 낮음 | 아니오 |
| checker | HWPX XML 규칙 검수 agent | 높음 | 일부 semantic check만 중간 | 제한적 |
| review.reviewer | PDF/HWPX 비교 + 직접 수정 agent | 중간 | 중간 | 예, report 초안만 |

## 코딩으로 먼저 빼야 할 것

### 1. Orchestration

`ngd-exam-create` skill의 resume, cache cleanup, question batching, retry loop는 서버 코드로 옮긴다.

목표:

- `/api/run`이 mode별 runner를 직접 호출
- stage별 status/event를 서버가 직접 emit
- provider는 “한 stage의 순수 모델 호출”만 담당

### 2. Builder

`ngd-exam-builder` agent는 이미 `build_hwpx.py`, `fix_namespaces.py`, `validate.py`를 감싸고 있다. 이 stage는 agent가 아니라 서버 runner가 직접 실행해야 한다.

목표:

- `exam_data.json -> build_hwpx.py -> validate.py`
- 실패 유형 분석은 처음에는 deterministic error classifier로 제한
- agent fallback은 마지막 수단

### 3. Checker

오검/품질 검수 중 XML 규칙은 코드로 검증한다.

코드화 가능한 항목:

- 통수식
- rm체 패턴
- `cdots`, `therefore`, 괄호, 쉼표 규칙
- bold 제거
- lineBreak/shift+enter
- style/spacing 계열 일부

모델은 “원본과 의미 비교”처럼 deterministic rule로 어려운 항목에만 쓴다.

### 4. Review Table Write

편집오검 내역표 삽입은 이미 script가 있다. reviewer agent가 직접 XML을 만지는 대신 서버 runner가 script를 호출하고 결과만 검증한다.

## DeepSeek V4 권장 사용처

### 1순위: `create.verifier`

입력:

- extracted JSON
- solved JSON
- guideline snippets
- optional 원본 문제 OCR/text 또는 image-derived text

출력:

```json
{
  "status": "pass",
  "issues": [],
  "feedback": null
}
```

장점:

- 출력 schema가 작다.
- 실패해도 원본 데이터를 손상시키지 않는다.
- Claude/Codex 또는 deterministic checker와 교차검증하기 쉽다.

### 2순위: `create.solver`

입력:

- extracted problem JSON
- curriculum context
- answer/explanation schema

출력:

```json
{
  "number": 1,
  "answer": "②",
  "explanation_parts": []
}
```

장점:

- 텍스트/수식 reasoning이 핵심이라 API model에 맞다.
- verifier로 품질을 막을 수 있다.

주의:

- HWP equation syntax validator가 필요하다.
- 수학 오답률 telemetry가 쌓이기 전까지 자동 추천하면 안 된다.

### 3순위: `review.reviewer` report draft

DeepSeek가 HWPX를 직접 수정하지 않는다. 원본/작업본에서 서버가 추출한 비교용 text/XML summary를 받고, 수정 후보 report만 생성한다.

서버가 할 일:

- PDF/HWPX text extraction
- rule-based checklist
- patch 가능 여부 판단
- 실제 HWPX 수정

DeepSeek가 할 일:

- 애매한 의미 차이 설명
- 추가 확인 필요 항목 분류
- 수정 후보 문장 제안

### 조건부: `create.extractor`

DeepSeek API의 실제 이미지 입력 지원 여부가 명확히 확인되기 전까지 extractor 후보에서 낮춘다. 이미지 입력이 안정적으로 지원되지 않으면 extractor는 Claude/vision model 또는 별도 OCR 파이프라인을 사용한다.

제품 설정에서는 extractor도 `AI_STAGE_KEYS`의 모델 호출 단계로 함께 허용한다. 실제 rollout은 `extractor-vision-contract`에서 이미지/OCR 입력 형태와 validation 실패 fallback을 확정한 뒤 품질 telemetry로 판단한다.

## 하네스 결정

### 만들지 않을 것: repo edit harness

DeepSeek에게 repo 파일 수정 권한을 주는 하네스는 만들지 않는다.

이유:

- 현재 제품 목표는 시험지 workflow 실행이지 범용 coding agent가 아니다.
- 파일 수정 권한을 주려면 diff parser, sandbox, allowlist, test loop, rollback, audit log가 필요하다.
- Claude/Codex CLI가 이미 이 역할을 수행한다.

### 만들 것: stage model harness

DeepSeek용 하네스는 다음 범위로 제한한다.

```text
StageInput JSON
  -> provider adapter
  -> strict JSON/tool-call output
  -> zod/schema validation
  -> deterministic validators
  -> cache write
  -> telemetry
  -> fallback/retry
```

필수 구성:

- stage별 input/output TypeScript schema
- provider별 prompt builder
- JSON parsing 및 schema validation
- stage output file writer
- deterministic validator
- provider retry/fallback policy
- telemetry: latency, fail rate, retry, validation failure, correction-required count

## 권장 실행 순서

1. 현재 `deepseek-v4` provider UI/registry 작업을 “prototype plumbing”으로 재라벨링한다.
2. `StageRunner` 인터페이스를 추가한다.
3. `builder`와 `checker`의 deterministic 부분을 서버 코드로 옮긴다.
4. `create.verifier`를 첫 DeepSeek stage harness로 구현한다.
5. 검증 telemetry가 안정화되면 `create.solver`를 추가한다.
6. `review.reviewer`는 HWPX 직접 수정이 아니라 report draft 생성으로 제한한다.

## 당장 수정해야 할 이전 roadmap 해석

기존 `deepseek-v4-provider-roadmap`은 provider 배관으로는 유효하지만, “실제 workflow 대체” 계획으로는 부족하다. 특히 다음 표현은 재해석해야 한다.

- “stage override”는 지금처럼 전체 prompt provider를 바꾸는 뜻이 아니라, typed stage runner 안의 model call provider를 바꾸는 뜻이어야 한다.
- “DeepSeek adapter”는 파일 작업 agent가 아니라 schema-bound model call adapter여야 한다.
- “auto recommendation”은 전체 job provider 추천이 아니라 stage contract별 추천이어야 한다.

따라서 다음 구현 phase는 DeepSeek 기능 확대가 아니라 workflow 해체와 stage contract 도입이어야 한다.
