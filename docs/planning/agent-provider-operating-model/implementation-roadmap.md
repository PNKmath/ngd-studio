---
task: agent-provider-operating-model
phase: 6
title: Implementation Roadmap
created: 2026-05-16
---

# 구현 Roadmap

이 roadmap은 기존 DeepSeek V4 provider 작업을 "API 호출 배관 prototype plumbing"으로 재라벨링하고, 실제 workflow 대체를 위한 다음 구현 task를 작게 나눈다.

## 현재 위치

완료된 의미:

- `claude`, `codex`, `deepseek-v4` provider id와 registry/settings/UI/telemetry prototype이 생겼다.
- DeepSeek V4 adapter는 API 호출 배관을 검증하는 prototype이다.
- stage override UI는 목표 구조의 전 단계로 유효하다.

아직 완료되지 않은 의미:

- `/api/run`은 아직 typed stage runner가 아니다.
- stage override는 아직 전체 prompt provider 선택에 가깝다.
- DeepSeek는 아직 schema-bound stage model harness로 연결되지 않았다.
- builder/checker/review mutation은 아직 server deterministic runner가 아니다.

사용자 정책:

- 외부 API provider에는 workflow에 필요한 입력 전체를 전송할 수 있다.
- 단, provider가 파일을 직접 수정하지 않고 서버가 schema validation과 deterministic validation 후 저장한다.

## 다음 task 후보

### 1. `stage-runner-foundation`

목표:

- `StageRunner<Input, Output>`와 `StageRunContext` 타입을 추가한다.
- `/api/run`에서 legacy prompt workflow와 stage runner path를 공존시킨다.
- SSE event emission, job metadata write, provider telemetry sink를 runner 책임으로 옮길 기반을 만든다.

선행 조건:

- `stage-runner-architecture.md` 승인
- 기존 `/api/run` legacy path 유지

제외 범위:

- DeepSeek stage harness 구현
- builder/checker rule 전체 이관
- UI redesign

검증 기준:

- 기존 create/resume/crop/review path가 깨지지 않는다.
- unit test로 stage plan/context/event helper를 검증한다.
- `pnpm test` 또는 관련 focused test 통과

추천: 바로 다음 `/phase-init` 대상.

### 2. `deterministic-builder-runner`

목표:

- `build_hwpx.py -> fix_namespaces.py -> validate.py --fix`를 server runner로 감싼다.
- `build_status.json`과 output HWPX path를 서버가 확정한다.
- builder agent는 fallback/error analysis로만 남긴다.

선행 조건:

- `stage-runner-foundation`
- `ExamData` schema 최소 정의

제외 범위:

- `build_hwpx.py` 내부 대규모 refactor
- solver/extractor 재호출 자동 복구
- checker 전체 구현

검증 기준:

- fixture `exam_data.json`으로 HWPX 생성
- namespace fix와 validate exit 0
- failure case에서 structured `BuildResult` 반환

### 3. `deterministic-checker-rules`

목표:

- `ngd-exam-checker`의 XML 기반 rule을 TypeScript 또는 Python runner로 분리한다.
- HWPX unzip/read, section XML 검사, issue list schema를 만든다.
- agent checker는 ambiguous issue review로 축소한다.

선행 조건:

- `stage-runner-foundation`
- sample HWPX fixtures

제외 범위:

- 원본 PDF와 의미 비교
- 수학 풀이 정합성 판단
- 자동 XML 수정 전체

검증 기준:

- rule별 fixture pass/fail test
- issue severity/category/question number 구조화
- 기존 checker 문서의 기계적 rule 1차 subset 커버

### 4. `verifier-model-harness`

목표:

- `create.verifier`를 첫 `StageModelProvider` stage로 구현한다.
- Claude/Codex/DeepSeek provider별 prompt builder와 strict JSON output parser를 붙인다.
- verifier output schema와 deterministic validator를 적용한다.

선행 조건:

- `stage-runner-foundation`
- `VerifierResult` schema
- provider policy gate

제외 범위:

- solver generation
- image extraction
- HWPX mutation

검증 기준:

- pass/fail/feedback schema validation
- DeepSeek API가 실패하거나 invalid JSON을 반환할 때 retry/telemetry 기록
- 외부 API 전체 전송 허용 정책이 있어도 stage contract 밖 파일 수정은 불가

### 5. `solver-model-harness`

목표:

- `create.solver`를 schema-bound model stage로 구현한다.
- extracted problem JSON과 curriculum context를 provider에 전달하고 `SolvedProblem`을 받는다.
- verifier stage와 연결해 자동 재시도 정책을 둔다.

선행 조건:

- `verifier-model-harness`
- HWP equation lint validator

제외 범위:

- extractor
- final HWPX build
- checker semantic review

검증 기준:

- `explanation_parts` schema와 equation lint 통과
- verifier fail feedback이 solver retry로 전달
- attempt/latency/failure telemetry 기록

### 6. `review-report-draft-harness`

목표:

- `review.reviewer`를 직접 수정 stage와 report draft stage로 분리한다.
- DeepSeek/Codex/Claude가 생성하는 것은 수정 후보 report이며, HWPX mutation은 서버 runner가 적용한다.
- `add_review_table.py` 실행을 server runner로 감싼다.

선행 조건:

- `stage-runner-foundation`
- review issue schema
- HWPX zip replace helper

제외 범위:

- PDF visual diff 완전 자동화
- 모든 review item 자동 수정
- HWPX parser 대체

검증 기준:

- report draft schema validation
- 자동 수정 가능한 item만 patch 적용
- review table presence 검증

## 추천 실행 순서

1. `stage-runner-foundation`
2. `deterministic-builder-runner`
3. `deterministic-checker-rules`
4. `verifier-model-harness`
5. `solver-model-harness`
6. `review-report-draft-harness`

이 순서가 안전한 이유는 먼저 파일/runner/telemetry 소유권을 서버로 가져온 뒤, API model provider를 작은 stage에 붙이기 때문이다.

## 기존 roadmap 해석 보정

- `deepseek-v4-provider-roadmap`은 provider 배관 prototype으로 유지한다.
- `ai-provider-adapters`의 stage override는 typed stage runner 도입 후에 진짜 의미를 가진다.
- DeepSeek 적용 확대는 repo edit harness가 아니라 stage model harness로만 진행한다.
- API 전송은 전체 가능하지만, 파일 수정과 workflow orchestration은 서버가 소유한다.
