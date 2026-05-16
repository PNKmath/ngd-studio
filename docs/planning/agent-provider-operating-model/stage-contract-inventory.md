---
task: agent-provider-operating-model
phase: 2
title: Stage Contract Inventory
created: 2026-05-16
---

# Stage Contract 인벤토리

이 문서는 현행 UI stage, skill/agent stage, provider override stage key를 분리하고, 후속 `StageRunner` 설계에 필요한 최소 input/output contract 후보를 정리한다.

## Stage 이름 체계 차이

현재 stage 이름은 세 층에 나뉘어 있다.

| 층 | 위치 | stage 이름 | 의미 |
|---|---|---|---|
| UI pipeline | `ngd-studio/lib/store.ts` | `cleaned`, `extractor`, `review_extract`, `solver`, `verifier`, `figure`, `builder`, `checker`, `cropper`, `reviewer` | 화면 표시와 progress 상태 |
| SSE 감지 | `ngd-studio/lib/claude.ts` | `extractor`, `solver`, `verifier`, `figure`, `builder`, `checker`, `reviewer`, `cropper` | CLI text/tool event에서 추론한 실행 stage |
| AI provider override | `ngd-studio/lib/ai/types.ts`, `settings.ts` | `create.extractor`, `create.solver`, `create.verifier`, `review.reviewer` | provider 선택/telemetry key |
| Skill workflow | `.claude/skills/ngd-exam-create/SKILL.md` | cleaned, extractor, review_extract, solver, verifier, figure, builder, checker | 실제 파일 cleanup, batch, resume orchestration |

후속 operating model에서는 UI stage 이름을 그대로 provider key로 쓰면 안 된다. UI stage는 화면 단위이고, provider key는 schema-bound model call 단위여야 한다.

## Stage별 Contract 후보

| Stage key | 현행 owner | 입력 | 출력 | side effect | validator 후보 | provider 후보 |
|---|---|---|---|---|---|---|
| `cropper` | `ngd-exam-crop` skill, `workspaces/crop/gemini_crop.py` | PDF path, output dir | `question_images/qNN.png`, `crop_results.json` | PDF rasterize, Gemini Vision call, image files write | 파일 존재, 번호 연속성, bbox bounds, 이미지 크기 | Claude/Codex는 orchestration 가능. DeepSeek는 불가 |
| `create.cleaned` | `ngd-exam-create` skill | uploaded/cropped question images | cleaned image set 후보 | cache/image cleanup | 입력 이미지 존재, count 일치 | deterministic script 후보. model provider 불필요 |
| `create.extractor` | `ngd-exam-extractor` agent | question image, exam meta, unit classification, guidelines | `qN_extracted.json`, `[EXTRACTION_REVIEW]` item | per-question JSON write | JSON schema, required fields, HWP equation lint, subtopic vocabulary | Claude/Codex 가능. DeepSeek는 image input과 schema wrapper가 생긴 뒤 bounded call로 가능 |
| `create.review_extract` | frontend + `ngd-exam-create` skill | `qN_extracted.json` list, user edits | edited `qN_extracted.json` | frontend file update, downstream cleanup on resume | schema validation after edit | model provider 대상 아님 |
| `create.solver` | `ngd-exam-solver` agent | `qN_extracted.json`, subject context, previous feedback | `qN_solved.json` | per-question JSON write | answer exists, `explanation_parts` schema, equation lint, no run-on equation | Claude/Codex 가능. DeepSeek는 text/schema bounded call 가능 |
| `create.verifier` | `ngd-exam-verifier` agent | question image, `qN_extracted.json`, `qN_solved.json`, subject context | `qN_verified.json` with pass/fail/issues/feedback | per-question JSON write, solver retry signal | verifier result schema, pass/fail enum, feedback required on fail | Claude/Codex 가능. DeepSeek는 bounded judge call 가능 |
| `create.aggregate` | `ngd-exam-create` skill | all `qN_verified.json`, exam meta | `.v3cache/exam_data.json` | JSON aggregation | count match, number order, required top-level fields | deterministic server/script 후보 |
| `figure` | `ngd-exam-figure` agent or `figure_processor.py` | `exam_data.json`, question images/PDF refs, Gemini key | `outputs/images/probN_final.png`, updated `exam_data.json`, `figure_status.json` | image crop, external image generation, watermark, JSON update | final image exists, referenced path exists, failed list empty | Claude/Codex orchestration 가능. DeepSeek 불가 |
| `builder` | `ngd-exam-builder` agent, `build_hwpx.py`, fix/validate scripts | `exam_data.json`, HWPX template, output dir | final HWPX, `build_status.json` | HWPX zip/XML write, retry source agents, fallback | script exit, HWPX zip validity, namespace validation | deterministic runner 우선. Claude/Codex는 fallback analysis. DeepSeek 불가 |
| `checker` | `ngd-exam-checker` agent | final HWPX, guidelines, unit classification | quality report, possible fix instructions | HWPX unzip/read, XML checks | rule check results, issue categories | deterministic rule runner 우선. Claude/Codex for ambiguous review. DeepSeek 불가 |
| `review.reviewer` | `ngd-exam-reviewer` agent, `ngd-exam-review` skill | original PDF, working HWPX, checklist/guidelines | modified HWPX, review table entries, report | PDF image read, ZIP-level XML string replace, namespace fix | HWPX zip validity, table presence, changed-file audit | Claude/Codex 가능. DeepSeek는 report draft only, direct edit 불가 |

## JSON 입출력 후보

### `create.extractor`

Input 후보:

- `questionNumber`
- `questionImagePath`
- `examMeta`: school, grade, subject, semester, examType, range
- `unitClassificationVersion`
- `guidelineRefs`

Output 후보:

- `number`
- `type`: `choice` 또는 `essay`
- `points`
- `subtopic`
- `difficulty`: `하`/`중`/`상`/`킬`
- `parts`: `{ t }`, `{ eq }`, `{ br }` 기반 문제 본문
- `choices`
- `answer`
- `condition_box`, `data_table`, `has_figure`, `figure_info`
- `unclear`

필수 validator:

- 번호와 파일명 일치
- `subtopic`이 단원분류표에 존재
- HWP 수식 문자열 lint
- 선택형이면 choices 개수와 answer 범위 검증

### `create.solver`

Input 후보:

- extractor output
- subject context: current subtopic, prerequisite topics
- previous verifier feedback

Output 후보:

- extractor output의 보존 필드
- `explanation_parts`
- normalized `answer`
- solver notes

필수 validator:

- `explanation_parts` 배열 schema
- 통수식 금지
- 수식 연산자 공백 lint
- 정답 필드 존재

### `create.verifier`

Input 후보:

- question image path
- extractor output
- solver output
- subject context

Output 후보:

- `number`
- `status`: `pass` 또는 `fail`
- `issues`
- `feedback`
- 최종 merged problem payload 후보

필수 validator:

- `status=fail`이면 feedback 필수
- pass 결과만 aggregate 가능
- verifier가 본 extractor/solver version hash 기록

## 파일 수정 책임 분리

`builder`, `checker`, `review.reviewer`는 model response만으로 끝나는 stage가 아니다.

- `builder`: `build_hwpx.py` 실행과 HWPX 생성이 핵심이다. 모델은 실패 원인 분석과 fallback 판단에는 쓸 수 있지만, 정상 경로는 deterministic runner가 맡아야 한다.
- `checker`: 10개 이상 XML rule check는 deterministic rule runner로 분리해야 한다. 모델은 애매한 수학/레이아웃 판단 보조에 한정한다.
- `review.reviewer`: 원본 PDF와 HWPX를 비교하고 HWPX를 직접 수정한다. 이 stage는 ZIP-level 문자열 치환, review table 작성, namespace fix까지 포함하므로 API model provider가 직접 수행할 수 없다.

## DeepSeek 가능/불가능 경계

DeepSeek 가능 후보:

- `create.solver`: text JSON input과 schema output으로 감쌀 수 있다.
- `create.verifier`: judge prompt와 pass/fail schema로 감쌀 수 있다.
- `review.reviewer`: 직접 수정이 아니라 "review issue draft" 또는 "추가 확인 후보" 생성만 가능하다.
- `create.extractor`: 현재는 이미지/file read가 없어서 불가에 가깝다. 서버가 이미지를 API payload로 넘기고 output schema를 강제할 때만 후보가 된다.

DeepSeek 불가능 영역:

- `cropper`: PDF rasterize, image crop, 파일 저장 필요
- `create.cleaned`, `create.aggregate`: deterministic file orchestration
- `figure`: image crop, Gemini image generation, 파일 업데이트 필요
- `builder`: HWPX zip/XML 생성과 script 실행 필요
- `checker`: HWPX unzip/XML rule check와 파일 경로 접근 필요
- `review.reviewer` 직접 수정: HWPX ZIP-level edit 필요

## StageRunner 설계에 필요한 최소 schema 목록

1. `StageRunContext`: jobId, mode, cwd, input root, output root, provider selection, telemetry sink
2. `QuestionImageRef`: questionNumber, imagePath, optional crop metadata
3. `ExamMeta`: school, grade, subject, semester, examType, range, questionCount
4. `ExtractedProblem`: extractor output schema
5. `SolvedProblem`: solver output schema
6. `VerifierResult`: pass/fail/issues/feedback와 merged problem 후보
7. `ExamData`: builder 입력용 aggregated payload
8. `FigureResult`: generated image paths, failures, updated problem refs
9. `BuildResult`: hwpxPath, retried agents, fallback flag, validation summary
10. `CheckResult`: deterministic rule issues, severity, related question numbers
11. `ReviewResult`: direct edits, review table entries, unresolved questions
12. `ProviderTelemetry`: stageKey, requestedProvider, resolvedProvider, attempt, status, elapsedMs, retry, cost
