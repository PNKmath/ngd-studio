---
task: agent-provider-operating-model
phase: 3
title: Deterministic Code Candidates
created: 2026-05-16
---

# Deterministic Code 후보 분리

Provider 선택을 단순하게 만들려면 "모델이 판단해야 하는 일"과 "서버/스크립트가 결정적으로 실행해야 하는 일"을 분리해야 한다. 현재 workflow는 agent 문서 안에 코드로 옮길 수 있는 orchestration, file mutation, validation, retry loop가 많이 들어 있다.

## 후보 요약

| 후보 | 현재 위치 | 필요한 입력 | 성공/실패 판정 | 코드화 난이도 | agent fallback |
|---|---|---|---|---|---|
| resume parsing / downstream cleanup | `.claude/skills/ngd-exam-create/SKILL.md` | `resumeFrom`, question nums, `.v3cache` 상태 | 삭제 대상 정확성, 남은 파일 상태 | S | 불필요 |
| cache scan / stage state detection | `ngd-exam-create` skill | question count, `.v3cache/qN_*.json` | 문제별 state map 생성 | S | 불필요 |
| batch scheduling / retry loop | `ngd-exam-create` skill | question list, stage config, verifier feedback | pass/fail/manual_review count | M | verifier/solver 자체는 필요 |
| verified JSON aggregation | `ngd-exam-create` skill | all `qN_verified.json`, exam meta | `exam_data.json` 생성, count match | S | 불필요 |
| figure processing | `figure_processor.py`, `ngd-exam-figure` | `exam_data.json`, images, Gemini key | `figure_status.json`, final image paths | M | crop 보정이 애매할 때만 |
| HWPX build runner | `build_hwpx.py`, `ngd-exam-builder` | `exam_data.json`, template, output dir | `HWPX written`, output exists | S/M | 실패 원인 분석 시만 |
| namespace fix | `fix_namespaces.py` | hwpx path | exit 0, XML prefix normalize | S | 불필요 |
| HWPX validation/fix | `validate.py` | hwpx path, `--fix` option | exit 0 or structured errors | S/M | 불필요 |
| checker XML rules | `ngd-exam-checker.md` | hwpx section XML, guidelines, unit classification | rule issue list | M | 애매한 수학/내용 판단만 |
| review table insertion | `add_review_table.py` | hwpx path, review items | second table present | S | 불필요 |
| reviewer direct HWPX edits | `ngd-exam-reviewer.md` | PDF-derived issue list, hwpx XML | replacements applied, table entries written | M/L | issue 판단은 필요, mutation은 코드 |
| provider telemetry | `server/sse.ts`, `lib/ai/retry.ts` | provider run result | attempt entries persisted | S | 불필요 |

## Orchestration / Cache / Batching / Retry

현재 `ngd-exam-create` skill은 resume 문자열 파싱, cleanup, 문제별 상태 스캔, batch 실행, solver/verifier retry를 모두 자연어 지시와 inline Python 예시로 관리한다.

코드화 후보:

- `parseResumeCommand(prompt | meta)`: `resume --q=3,7 --from=solver` 같은 문자열을 구조화한다.
- `cleanupFromStage(questionNums, fromStage)`: `_extracted`, `_solved`, `_verified`, figure outputs, `figure_status.json` 삭제를 deterministic하게 수행한다.
- `detectQuestionStates(totalQuestions)`: `none`, `extracted`, `solved`, `verified` 상태를 반환한다.
- `buildStagePlan(resumeCommand, states)`: 다음 실행해야 할 per-question stage 목록을 만든다.
- `runBatches(stagePlan, concurrency=8)`: extractor/solver/verifier 호출 단위를 batch로 묶는다.
- `applyVerifierRetry(problem, maxAttempts=3)`: verifier fail feedback을 solver에 넘겨 재시도하고, 3회 실패 시 `manual_review`로 고정한다.
- `aggregateVerifiedProblems(totalQuestions, meta)`: 모든 `qN_verified.json`을 `exam_data.json`으로 합친다.

agent fallback은 model stage 자체에는 필요하지만, orchestration 함수에는 필요 없다. 실패는 파일 없음, schema invalid, provider error 같은 typed error로 올려야 한다.

## Builder runner 범위

현행 builder agent는 `build_hwpx.py` 실행, 실패 유형 판단, source agent 재호출, fallback builder 사용, 후처리를 담당한다. 이 중 정상 경로는 서버 runner로 옮기기 쉽다.

코드화 후보:

- `runBuildHwpx(examDataPath, outputDir)`: `build_hwpx.py` 실행, stdout에서 output path 추출
- `runFixNamespaces(hwpxPath)`: `.claude/skills/ngd-exam-create/scripts/fix_namespaces.py`
- `runValidateHwpx(hwpxPath, fix=true)`: `.claude/skills/ngd-exam-create/scripts/validate.py --fix`
- `writeBuildStatus(status)`: running, retrying, fallback, success, failed 상태 JSON 기록
- `classifyBuildError(stderr/stdout)`: 데이터 문제와 script 문제를 heuristic으로 분류

정상 성공 판정:

- process exit 0
- `HWPX written:` 또는 명시 output path 존재
- `fix_namespaces.py` exit 0
- `validate.py --fix` exit 0

agent fallback 필요 조건:

- 특정 problem/field를 가리키는 데이터 오류가 있고 어느 model stage가 원인인지 판단해야 할 때
- script bug인지 data bug인지 heuristic으로 확정할 수 없을 때
- fallback builder가 필요한 legacy 문서 생성 판단

agent fallback 불필요 조건:

- namespace fix
- HWPX zip validity check
- content.hpf manifest check
- zOrder/cellAddr/script escaping 자동 수정

## Checker XML rule 코드화 후보

`ngd-exam-checker.md`의 10개 체크 중 상당수는 XML rule로 바로 코드화할 수 있다.

즉시 코드화 가능:

- `<hp:t>` 안에 `hp:equation` 또는 `hp:script` 문자열이 들어간 점수 수식 분리 오류
- `<hp:t>`의 연속 영문자 탐지
- `<hp:script>` 연산자 공백 패턴 탐지
- 난이도 값이 `하/중/상/킬` 중 하나인지 확인
- 순열/조합 금지 패턴(`nCr`, `_n C _r`, LSUB 등) 탐지
- endNote 구조: suffixChar, autoNum, number 순서, `[정답]` 존재
- XML well-formedness, raw `<`, `>`, `&` escape 검사
- `section0.xml` style count / lineBreak / bold 속성 같은 형식 검사
- 중단원/과목/범위 vocabulary check

부분 코드화 + agent 판단 필요:

- 해설 완성도와 논리적 풀이 충분성
- 조건/보기/증명틀이 시각적으로 맞는지
- 원본 PDF와 HWPX 내용 누락 비교
- 그림 품질과 라벨 누락 판단

후속 구현은 deterministic rule result를 먼저 만들고, agent는 unresolved/ambiguous item만 받는 구조가 적합하다.

## Reviewer 분리

`review.reviewer`는 두 일이 섞여 있다.

1. 원본 PDF와 HWPX를 비교해 수정 후보를 찾는 판단
2. HWPX ZIP/XML을 직접 수정하고 편집오검 내역표를 작성하는 mutation

분리 후보:

- `ReviewIssueDraft` model call: 오타/누락/체크리스트 위반 후보 생성
- `ReviewIssueValidator`: issue가 어느 rule인지, 자동 수정 가능한지 분류
- `zipReplaceHwpxSection(hwpxPath, replacements)`: XML 문자열 치환만 수행
- `writeFixedReviewTableEntries(hwpxPath, entries)`: 22개 고정 항목 해당번호 기입
- `runAddReviewTable(hwpxPath, extraItems | noIssues)`: `add_review_table.py` 실행
- `runReviewPostprocess(hwpxPath)`: review용 `fix_namespaces.py`와 validation 실행

DeepSeek는 `ReviewIssueDraft`에는 후보가 될 수 있지만, ZIP-level mutation과 review table insertion에는 쓸 수 없다.

## Agent fallback 기준

agent fallback이 필요 없는 경우:

- 파일 존재/삭제/이동
- JSON schema validation
- verified aggregation
- `build_hwpx.py` 실행
- `fix_namespaces.py`
- `validate.py`
- `add_review_table.py`
- checker의 정규식/XML 기반 rule
- telemetry 기록

agent fallback이 필요한 경우:

- extractor/solver/verifier 같은 실제 model reasoning stage
- build 실패 원인이 data quality인지 script bug인지 애매한 경우
- checker rule은 실패했지만 자동 수정안이 명확하지 않은 경우
- review에서 PDF 원문과 HWPX 내용 차이를 해석해야 하는 경우
- figure crop 영역이 부정확해서 사람이 보는 수준의 판단이 필요한 경우

## 구현 우선순위 Top 3

1. **Stage orchestration foundation**
   - resume parsing, state scan, cleanup, batch plan, telemetry를 TypeScript runner로 분리한다.
   - 이유: 모든 provider 정책의 기반이며 DeepSeek bounded stage 호출도 여기에 얹힌다.

2. **Deterministic builder runner**
   - `build_hwpx.py` → `fix_namespaces.py` → `validate.py --fix`를 서버 runner로 고정하고 `build_status.json`을 코드가 쓴다.
   - 이유: 모델이 할 필요 없는 고위험 파일 생성 경로를 줄이고, 실패 판정이 명확하다.

3. **Checker XML rule runner**
   - `ngd-exam-checker`의 기계적 rule을 코드로 옮겨 structured issue list를 만든다.
   - 이유: HWPX 품질 회귀를 deterministic하게 잡고, agent 검토 범위를 애매한 항목으로 줄인다.

그 다음 후보는 `add_review_table.py`를 포함한 review mutation runner다. 이 작업은 HWPX 직접 수정과 report draft 분리가 선행되어야 하므로 Top 3 이후가 안전하다.
