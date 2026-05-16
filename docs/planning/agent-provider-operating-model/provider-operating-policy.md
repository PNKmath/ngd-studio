---
task: agent-provider-operating-model
phase: 4
title: Provider Operating Policy
created: 2026-05-16
---

# Provider 운영 정책

이 문서는 Claude Code, Codex, DeepSeek V4, `auto`의 책임 경계를 고정한다. 핵심 정책은 provider를 같은 종류의 실행자로 취급하지 않는 것이다. Claude/Codex는 로컬 CLI agent 실행자이고, DeepSeek V4는 schema-bound API model provider다.

## 정책 원칙

1. Provider는 "전체 job을 대신 처리하는 실행자"가 아니라 stage contract 안의 model capability로 다룬다.
2. 파일 읽기/쓰기, Bash 실행, HWPX ZIP/XML 수정, cache cleanup, retry orchestration은 서버 코드나 deterministic script runner가 소유한다.
3. Claude Code와 Codex는 기존 `.claude/skills` / `.claude/agents` workflow를 실행할 수 있지만, 장기적으로 이 의존은 줄인다.
4. DeepSeek V4는 repo edit agent 또는 HWPX direct editor로 사용하지 않는다.
5. `auto`는 전체 job fallback이 아니라 stage-aware recommendation이다.
6. 외부 API provider는 사용자 opt-in 또는 stage override 없이 자동 전송하지 않는다.

## Claude Code

허용 역할:

- 기존 `ngd-exam-create`, `ngd-exam-crop`, `ngd-exam-review` skill 실행
- `.claude/agents` 기반 extractor/solver/verifier/figure/builder/checker/reviewer orchestration
- 로컬 파일, Bash, HWPX script 실행이 필요한 legacy workflow 처리
- Codex/DeepSeek 결과의 독립 검증 또는 fallback 실행자

줄여야 할 의존 영역:

- resume parsing, cache cleanup, batch scheduling, retry loop
- `build_hwpx.py`, `fix_namespaces.py`, `validate.py` 실행 wrapping
- checker XML rule 검증
- review table insertion
- job telemetry와 stage status 기록

운영 의미:

- 현재 production-compatible 기본값이다.
- `auto`가 충분한 stage telemetry를 갖기 전까지 fallback 기본 provider는 Claude다.
- 단, Claude가 모든 deterministic 작업을 계속 수행하는 구조를 목표 상태로 보지 않는다.

## Codex

허용 역할:

- 로컬 Codex CLI provider로 Claude와 유사한 파일/tool 기반 workflow 실행
- 기존 `.claude/skills`와 `.claude/agents` 문서를 읽고 호환 실행
- Claude 실행 결과의 검증 provider 또는 대체 provider
- 코드/문서 변경 작업에서 로컬 repository context를 활용하는 agent

Claude와의 차이:

- SSE 호환은 `codex exec --json` 출력을 Claude event 형식으로 변환하는 adapter에 의존한다.
- `.claude` ecosystem은 원래 Claude 중심이므로 일부 skill/tool semantics가 완전히 같다고 가정하면 안 된다.
- Codex는 repo 작업과 코드 검토에는 강하지만, 기존 NGD skill의 모든 agent 호출 패턴을 1:1로 보장하는 provider로 취급하지 않는다.

줄여야 할 의존 영역:

- Claude와 동일하게 orchestration, deterministic runner, validation wrapper는 서버 코드로 빼야 한다.
- Codex를 장기 아키텍처의 "두 번째 전체 workflow executor"로 키우지 않는다.

## DeepSeek V4

허용 역할:

- `create.solver`: extracted problem JSON과 curriculum context를 받아 풀이 초안 생성
- `create.verifier`: extracted/solved JSON을 받아 pass/fail/feedback 판정
- `review.reviewer`: 직접 수정이 아닌 report draft 또는 추가 확인 후보 생성
- 조건부 `create.extractor`: 서버가 이미지 입력을 API payload로 안전하게 전달하고 schema validation을 붙인 뒤에만 후보

금지 영역:

- repo 파일 수정
- HWPX ZIP/XML 직접 수정
- `build_hwpx.py`, `fix_namespaces.py`, `validate.py`, `add_review_table.py` 실행
- `.claude/skills` 또는 `.claude/agents` 호출
- PDF/HWPX 전체 파일을 임의 업로드하는 end-to-end workflow
- 자동 외부 API fallback
- cropper, figure, builder, checker deterministic rule runner 대체

운영 의미:

- DeepSeek V4 provider는 API 호출 배관 prototype으로 유지한다.
- 실제 product 적용은 `StageInput JSON -> provider adapter -> strict JSON output -> schema validation -> deterministic validators -> cache write -> telemetry` 흐름이 생긴 뒤 시작한다.
- DeepSeek가 반환한 결과는 서버가 저장하기 전에 반드시 schema validation과 stage validator를 통과해야 한다.

## `auto` 의미

현재 구현에서 `auto`는 `claude` alias다. 목표 정책에서 `auto`는 다음 조건을 만족하는 stage-aware recommendation이다.

- 추천 단위는 전체 job이 아니라 `AIStageKey`다.
- 명시적 stage override가 있으면 추천보다 우선한다.
- 외부 API가 정책상 막힌 stage에서는 DeepSeek를 추천하지 않는다.
- 최소 관측치가 없으면 Claude를 기본값으로 둔다.
- 실패율, 평균 실행 시간, 재시도율, 비용, downstream checker/reviewer 수정 필요 빈도를 근거로 추천한다.

`auto`는 provider fallback chain이 아니다. 실패한 provider를 자동으로 다른 vendor에 넘기는 정책은 별도 사용자 승인과 데이터 전송 정책이 있어야 한다.

## Retry / fallback 소유권

서버 코드가 소유해야 하는 것:

- provider attempt count
- retry 가능 여부
- telemetry 기록
- external API policy check
- fallback provider 선택 여부
- stage output schema validation
- deterministic validator 실행

Provider가 소유하지 않는 것:

- 다른 provider로 fallback 결정
- 파일 cleanup
- stage 상태 확정
- HWPX mutation 적용
- job cache write finalization

현재 `MAX_PROVIDER_ATTEMPTS=3`은 같은 provider 재시도 정책이다. 향후 cross-provider fallback은 stage별 정책과 사용자 opt-in이 생기기 전까지 도입하지 않는다.

## 외부 API 전송 정책

사용자 정책 결정에 따라 DeepSeek V4, Gemini 등 외부 API provider에는 workflow에 필요한 입력 전체를 전송할 수 있다. 여기에는 PDF, HWPX, PNG/JPG 문제 이미지, 추출 JSON, 해설 JSON, 학교/시험 메타데이터가 포함된다.

단, "전송 가능"은 "아무 stage에서나 자동 전송"을 뜻하지 않는다.

- 외부 API 호출은 stage contract 안에서만 수행한다.
- 사용자가 명시적으로 선택한 provider 또는 stage override를 우선한다.
- `auto`가 외부 API provider를 고르는 경우에도 stage-aware recommendation, telemetry, policy gate를 거친다.
- provider가 파일을 직접 수정하지 않는다. 서버가 API 응답을 검증한 뒤 저장/수정한다.
- API 요청/응답 로그는 stage output schema와 telemetry 중심으로 보관한다. 원문 prompt/응답 전문 보관 여부는 별도 logging 설정으로 다룬다.

## 구현에 반영할 결정

- `deepseek-v4`를 기본 provider 선택지로 노출하지 않는다. stage override와 향후 stage-aware recommendation에 제한적으로 남긴다.
- DeepSeek가 허용되지 않은 stage는 adapter에서 즉시 거부한다.
- `auto` UI 문구는 "현재 Claude, 향후 stage-aware recommendation"으로 유지한다.
- stage runner 도입 전까지 `/api/run`의 provider override는 legacy 전체 prompt provider 선택이라는 한계를 문서화한다.
- 다음 구현 task는 DeepSeek repo edit harness가 아니라 StageRunner foundation, deterministic builder/checker runner, verifier/solver model harness 순서로 나눈다.
