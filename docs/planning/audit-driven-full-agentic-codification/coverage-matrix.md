# audit-driven-full-agentic-codification — Coverage Matrix

> **단일 referent**: 본 문서는 audit `docs/planning/agent-provider-operating-model/deterministic-code-candidates.md`의
> 전체 후보(A-E 그룹, 총 39행)를 행으로 갖고, 각 행에 현재 코드 상태와 본 task에서 cover하는 Phase를 기록한다.
> 후속 phase 작성자는 체크리스트 항목에 이 문서의 행 ID(예: "A1, B1, B2 cover 확인")를 인용해야 한다.

## 컬럼 설명

| 컬럼 | 설명 |
|------|------|
| 후보 ID | A1~A12, B1~B7, C1~C5, D1~D9, E1~E6 |
| 출처(audit 섹션) | audit doc의 섹션 + 줄 번호 |
| 현재 코드 상태 | Read/Grep으로 직접 확인한 상태. `코드화됨`/`agentic 잔존`/`부분 코드화` |
| 잔존 agentic 부분 | 아직 자연어/Claude 에이전트에 의존하는 부분 |
| cover Phase | 이 항목을 cover하는 Phase 번호 (없으면 out-of-scope) |
| 검증 방법 | 코드화 검증 명령 또는 방법 |

---

## Group A — 후보 요약 표 12개 (audit lines 14-27)

### A1 — resume parsing / downstream cleanup

- **출처**: audit doc line 16 (후보 요약), lines 35-36, 83-88 (cleanup_from_stage)
- **현재 상태**: `agentic 잔존` — `.claude/skills/ngd-exam-create/SKILL.md:43-169`에 자연어 + inline Python 예시(cleanup_from_stage, detect_resume_state). TS 코드 부재. resumeState.ts는 `determineStartStage`(자동 감지)와 `shouldRunStage`만 있음 — `parseResumeCommand` 문자열 파서 없음. cleanup 함수 없음.
- **잔존 agentic**: SKILL.md의 resume 13가지 명령 파싱 자연어 전체, cleanup_from_stage 로직 전체
- **본 task cover**: Phase 2 (resumeCommand.ts + cleanup.ts 신규)
- **검증**:
  ```bash
  grep -c "parseResumeCommand\|cleanupFromStage" ngd-studio/server/stages/resumeState.ts
  # expected: ≥2 (Phase 2 완료 후)
  ```
- **agentic→code 동치성**: SKILL.md:43-63의 13개 resume 명령을 fixture로 모아 `parseResumeCommand` 출력이 동일 구조의 ResumeCommand 객체를 반환하는지 unit test 검증. `cleanup_from_stage` inline Python의 파일 삭제 패턴(SKILL.md:88-128)이 TS 구현과 동일한 suffix 목록을 사용하는지 rule citation.

---

### A2 — cache scan / stage state detection

- **출처**: audit doc line 17 (후보 요약)
- **현재 상태**: `부분 코드화` — `server/stages/cache.ts:94-108` (`scanQuestionState`, `scanAll`) 존재. `server/stages/resumeState.ts:81-133` (`detectFromCache` private 함수)에 per-question 상태 감지 구현됨. 단, SKILL.md:130-143의 `detect_resume_state` Python 자연어도 병존.
- **잔존 agentic**: SKILL.md의 `detect_resume_state` 설명 문서(삭제 불필요하나 혼란 유발 가능)
- **본 task cover**: Phase 2 (cache scan TS 구현 완성도 검증 + SKILL.md 자연어 잔존 여부 확인)
- **검증**:
  ```bash
  grep -n "scanQuestionState\|scanAll" ngd-studio/server/stages/cache.ts
  # expected: 함수 정의 2개
  grep -c "detectFromCache\|detect_resume_state" ngd-studio/server/stages/resumeState.ts
  # expected: ≥1 (detectFromCache 구현 확인)
  ```
- **agentic→code 동치성**: `detectFromCache` 출력이 SKILL.md:130-143의 Python states 딕셔너리와 동일한 상태 분류(none/extracted/solved/verified)를 반환하는지 fixture-based 검증.

---

### A3 — batch scheduling / retry loop

- **출처**: audit doc line 18 (후보 요약), lines 39-40 (runBatches, applyVerifierRetry)
- **현재 상태**: `부분 코드화` — `server/stages/orchestrator.ts:73-99` (`runWithConcurrency`), `orchestrator.ts:105-124` (`semaphore`)로 동시성 제어 구현. Verifier retry loop `orchestrator.ts:391-493`. 단, `runBatches`/`applyVerifierRetry` 명칭의 독립 함수는 없음 — 모두 `processQuestion` 내부 인라인.
- **잔존 agentic**: SKILL.md의 배치 실행 자연어 설명
- **본 task cover**: Phase 3 (batch/retry 함수 구조 검증 + cleanupFromStage와 연동)
- **검증**:
  ```bash
  grep -n "runWithConcurrency\|semaphore\|EXTRACTOR_CONCURRENCY" ngd-studio/server/stages/orchestrator.ts
  # expected: 각 1개 이상
  ```
- **agentic→code 동치성**: SKILL.md의 8문제 배치 병렬 실행 설명과 `runWithConcurrency(limit, items, worker)` 시그니처 비교 + `EXTRACTOR_CONCURRENCY=4` 설정 확인.

---

### A4 — verified JSON aggregation

- **출처**: audit doc line 19 (후보 요약), line 41 (aggregateVerifiedProblems)
- **현재 상태**: `코드화됨` — `server/stages/examData.ts:47-72` (`buildExamDataJson`)이 `qN_verified.json` → `qN_solved.json` → `qN.json` 우선순위로 병합 후 `exam_data.json` 생성. `orchestrator.ts:571-589`에서 호출.
- **잔존 agentic**: 없음 (신규 코드 경로에서 완전 deterministic)
- **본 task cover**: Phase 3 (A4 커버 검증)
- **검증**:
  ```bash
  grep -n "buildExamDataJson\|readQuestionWithFallback" ngd-studio/server/stages/examData.ts
  # expected: 함수 정의 확인
  ```
- **agentic→code 동치성**: `buildExamDataJson` 출력이 audit doc line 19의 "count match" 조건(questionNumbers.length === problems.length) 충족하는지 unit test (`examData.test.ts`) 확인.

---

### A5 — figure processing

- **출처**: audit doc line 20 (후보 요약)
- **현재 상태**: `부분 코드화` — `orchestrator.ts:732-778` (`runFigureStage`)가 `figure_processor.py`를 subprocess로 실행. 단, `figure_processor.py`(루트 위치)는 Python+agent 혼재: Gemini API 호출(`generate_with_gemini`), `--no-regen` flag 지원. figure_status.json은 Python이 작성.
- **잔존 agentic**: Python script 내 Gemini API 직접 호출, crop 보정 판단 일부
- **본 task cover**: Phase 4 (figure pipeline 분리 — figure_processor.py TS runner 강화)
- **검증**:
  ```bash
  grep -n "runFigureStage\|figure_processor" ngd-studio/server/stages/orchestrator.ts
  # expected: 두 패턴 모두 등장
  find . -name "figure_processor.py" -not -path "*/node_modules/*"
  # expected: 루트에 존재
  ```
- **agentic→code 동치성**: `figure_processor.py` 실행 전후 `figure_status.json` 스키마가 orchestrator 기대치와 일치하는지 shadow-run으로 검증.

---

### A6 — HWPX build runner

- **출처**: audit doc line 21 (후보 요약)
- **현재 상태**: `코드화됨` — `server/stages/builder.ts:53-138` (`runBuilderStage`)가 `build_hwpx.py` → `fix_namespaces.py` → `validate.py --fix` 순으로 subprocess 실행. `build_status.json` 코드 작성(`builder.ts:193-200`).
- **잔존 agentic**: 없음 (정상 경로는 완전 deterministic)
- **본 task cover**: Phase 2 이미 완료 (선행 task에서 구현됨) — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "runBuilderStage\|writeBuildStatus" ngd-studio/server/stages/builder.ts
  # expected: 각 함수 정의 확인
  ```
- **agentic→code 동치성**: `builder.test.ts`의 unit test가 `HWPX written:` stdout 파싱과 exit 0 판정을 검증.

---

### A7 — namespace fix

- **출처**: audit doc line 22 (후보 요약)
- **현재 상태**: `코드화됨` — `builder.ts:83-90`에서 `scripts.fixNamespaces` (`resources/hwpx_scripts/fix_namespaces.py`)를 subprocess로 실행. review 경로는 `postprocess.ts:60-67`.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "fixNamespaces\|fix_namespaces" ngd-studio/server/stages/builder.ts
  # expected: 인용 확인
  grep -n "fixNamespaces\|fix_namespaces" ngd-studio/server/review/postprocess.ts
  # expected: 인용 확인
  ```
- **agentic→code 동치성**: rule citation — builder.ts의 `resolveBuilderScripts`가 `resources/hwpx_scripts/fix_namespaces.py`를 정확히 가리키는지 경로 확인.

---

### A8 — HWPX validation/fix

- **출처**: audit doc line 23 (후보 요약)
- **현재 상태**: `코드화됨` — `builder.ts:92-99`에서 `scripts.validateHwpx` (`resources/hwpx_scripts/validate.py --fix`)를 실행. review 경로는 `postprocess.ts:71-78`.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "validateHwpx\|validate.py" ngd-studio/server/stages/builder.ts
  # expected: 인용 확인
  ```
- **agentic→code 동치성**: rule citation — `--fix` flag가 subprocess args에 전달되는지 `builder.ts:97` 확인.

---

### A9 — checker XML rules

- **출처**: audit doc line 24 (후보 요약), lines 82-91 (즉시 코드화 가능 9개)
- **현재 상태**: `부분 코드화` — `server/stages/checker.ts`에 7개 규칙 구현됨(`RULES` map). 구현됨: xml.well_formed, xml.raw_escape, text.raw_equation_xml, text.english_word, text.difficulty_vocabulary, equation.run_on, equation.permutation_combination. **미구현**: endNote 구조(D6), section0 style/lineBreak/bold(D8), 중단원/과목/범위 vocabulary(D9).
- **잔존 agentic**: checker agent가 endNote, lineBreak, bold, vocabulary 3개는 여전히 담당
- **본 task cover**: Phase 5 (D6, D8, D9 추가 구현)
- **검증**:
  ```bash
  grep -cE "endNote|lineBreak|bold.*check|vocabulary.*check" ngd-studio/server/stages/checker.ts
  # expected: ≥3 (Phase 5 완료 후)
  ```
- **agentic→code 동치성**: audit doc lines 83-91의 9개 rule 각각이 `checker.ts` RULES map에 ruleId로 존재하는지 rule citation.

---

### A10 — review table insertion

- **출처**: audit doc line 25 (후보 요약)
- **현재 상태**: `코드화됨` — `server/review/reviewTable.ts:64-96` (`writeFixedReviewTableEntries`), `runAddReviewTable:180-217`. `server/stages/reviewRunner.ts`에서 조합 호출.
- **잔존 agentic**: 없음 (add_review_table.py subprocess 호출은 deterministic)
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "writeFixedReviewTableEntries\|runAddReviewTable" ngd-studio/server/review/reviewTable.ts
  # expected: 각 함수 정의 확인
  ```
- **agentic→code 동치성**: `mutation.test.ts`의 `zipReplaceHwpxSection` unit test + review postprocess 경로 검증.

---

### A11 — reviewer direct HWPX edits

- **출처**: audit doc line 26 (후보 요약)
- **현재 상태**: `부분 코드화` — `server/review/mutation.ts:76-124` (`zipReplaceHwpxSection`), `applyReviewMutations` 구현됨. 단, `ReviewIssueValidator`(issue 분류 + auto-fixable 판정)는 미구현.
- **잔존 agentic**: ngd-exam-reviewer agent가 PDF-HWPX 비교 판단 + issue type 분류 담당
- **본 task cover**: Phase 7 (ReviewIssueValidator 구현 + reviewer auto-validator 강화)
- **검증**:
  ```bash
  grep -n "ReviewIssueValidator\|ReviewIssueDraft" ngd-studio/server/review/mutation.ts
  # expected: ReviewIssueDraft 타입 정의 확인
  grep -rn "ReviewIssueValidator" ngd-studio/server/
  # expected: Phase 7 완료 후 ≥1 결과
  ```
- **agentic→code 동치성**: `ReviewIssueDraft` 타입이 reviewer agent 출력 JSON 스키마와 1:1 대응하는지 schema fixture로 검증.

---

### A12 — provider telemetry

- **출처**: audit doc line 27 (후보 요약)
- **현재 상태**: `코드화됨` — `lib/ai/retry.ts:23-40` (`ProviderTelemetryEntry` interface), `createProviderTelemetryEntry:64`. `orchestrator.ts`에서 각 stage별 telemetry push. `server/sse.ts`에 SSE 이벤트 전송.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "createProviderTelemetryEntry\|ProviderTelemetryEntry" ngd-studio/lib/ai/retry.ts
  # expected: interface + function 각 1개
  ```
- **agentic→code 동치성**: rule citation — `orchestrator.ts`의 모든 stage에 `providerTelemetry.push(createProviderTelemetryEntry(...))` 호출 존재하는지 grep.

---

## Group B — Orchestration codify-candidate 함수 7개 (audit lines 35-41)

### B1 — `parseResumeCommand`

- **출처**: audit doc line 35
- **현재 상태**: `agentic 잔존` — SKILL.md:43-63에 자연어 표로 정의. TS 구현 없음. `resumeState.ts`의 `normalizeResumeName`은 stage 이름 정규화만 수행 (문자열 파서 아님).
- **잔존 agentic**: SKILL.md resume 명령 파싱 전체
- **본 task cover**: Phase 2
- **검증**:
  ```bash
  grep -n "parseResumeCommand" ngd-studio/server/stages/resumeState.ts
  # expected: ≥1 (Phase 2 완료 후)
  grep -n "parseResumeCommand" ngd-studio/server/stages/__tests__/orchestrator.test.ts
  # expected: unit test 존재 (Phase 2 완료 후)
  ```
- **agentic→code 동치성**: SKILL.md:43-63의 13개 resume 명령 각각을 fixture로 unit test. `resume --q=3,7 --from=solver` → `{ questionNums: [3,7], fromStage: "solver" }` 형태 검증.

---

### B2 — `cleanupFromStage`

- **출처**: audit doc line 36
- **현재 상태**: `agentic 잔존` — SKILL.md:88-128에 inline Python. TS 구현 없음.
- **잔존 agentic**: cleanup_from_stage Python 전체
- **본 task cover**: Phase 2
- **검증**:
  ```bash
  grep -n "cleanupFromStage" ngd-studio/server/stages/resumeState.ts
  # expected: ≥1 (Phase 2 완료 후)
  ```
- **agentic→code 동치성**: SKILL.md:91-98의 `stage_files` 딕셔너리(suffix 목록)와 TS 구현의 suffix 목록이 동일한지 fixture-based 비교. `from_stage='verifier'` → `['_verified.json']` 삭제.

---

### B3 — `detectQuestionStates`

- **출처**: audit doc line 37
- **현재 상태**: `코드화됨` — `server/stages/cache.ts:94-108` (`scanQuestionState`, `scanAll`). none/extracted/solved/verified 4상태 반환. `resumeState.ts:81-133`의 `detectFromCache`에서 활용.
- **잔존 agentic**: 없음 (캐시 스캔은 deterministic)
- **본 task cover**: Phase 2 (검증 + SKILL.md 자연어 제거 확인)
- **검증**:
  ```bash
  grep -n "scanQuestionState\|QuestionCacheState" ngd-studio/server/stages/cache.ts
  # expected: interface + method 각 1개
  ```
- **agentic→code 동치성**: `cache.test.ts` 또는 orchestrator.test.ts의 scanQuestionState fixture 검증. SKILL.md:130-143 Python과 동일한 4상태 분류 확인.

---

### B4 — `buildStagePlan`

- **출처**: audit doc line 38
- **현재 상태**: `부분 코드화` — `resumeState.ts:48-63` (`determineStartStage`)가 startStage + targetQuestions 반환. 단, `buildStagePlan`이라는 독립 함수는 없음. per-question skip 로직은 `orchestrator.ts:261-276`에 인라인.
- **잔존 agentic**: SKILL.md의 단계 계획 자연어 설명
- **본 task cover**: Phase 3 (buildStagePlan 독립 함수화 또는 현재 구현 cover로 인정)
- **검증**:
  ```bash
  grep -n "determineStartStage\|buildStagePlan\|startStage" ngd-studio/server/stages/resumeState.ts
  # expected: determineStartStage 함수 존재
  ```
- **agentic→code 동치성**: `resumeState.ts`의 `determineStartStage` 출력이 SKILL.md:145-169의 자동 resume 로직과 동일한 결과를 내는지 fixture-based unit test.

---

### B5 — `runBatches`

- **출처**: audit doc line 39
- **현재 상태**: `부분 코드화` — `orchestrator.ts:73-99` (`runWithConcurrency`), `semaphore:105-124`. concurrency limit 제어 구현됨. 단, `runBatches`라는 독립 함수 없음 — `Promise.all(pipelineQuestions.map(processQuestion))` 인라인.
- **잔존 agentic**: SKILL.md의 8문제 배치 실행 자연어
- **본 task cover**: Phase 3
- **검증**:
  ```bash
  grep -n "runWithConcurrency\|EXTRACTOR_CONCURRENCY\|SOLVER_CONCURRENCY" ngd-studio/server/stages/orchestrator.ts
  # expected: 3개 모두 존재
  ```
- **agentic→code 동치성**: `runWithConcurrency(4, items, worker)` 호출이 audit doc의 "concurrency=8" (extractor 4, solver 6, verifier 6으로 분리) 사양과 어떻게 대응하는지 rule citation.

---

### B6 — `applyVerifierRetry`

- **출처**: audit doc line 40
- **현재 상태**: `부분 코드화` — `orchestrator.ts:391-493`에 verifier retry loop 인라인 구현. MAX_ATTEMPTS=3. verifier fail 시 solver 재호출 로직 포함. 단, `applyVerifierRetry`라는 독립 함수 없음.
- **잔존 agentic**: 없음 (retry 로직 자체는 deterministic)
- **본 task cover**: Phase 3 (함수화 또는 현재 구현 cover로 인정)
- **검증**:
  ```bash
  grep -n "MAX_ATTEMPTS\|attempt >= MAX_ATTEMPTS\|verifier.*retry" ngd-studio/server/stages/orchestrator.ts
  # expected: MAX_ATTEMPTS=3 + retry 로직
  ```
- **agentic→code 동치성**: audit doc line 40의 "3회 실패 시 manual_review로 고정" 동작이 orchestrator.ts에서 어떻게 구현됐는지 rule citation. (현재: 3회 실패 후 partial result 허용, manual_review 상태는 verifier output schema에서 처리)

---

### B7 — `aggregateVerifiedProblems`

- **출처**: audit doc line 41
- **현재 상태**: `코드화됨` — `server/stages/examData.ts:47-72` (`buildExamDataJson`). priority: verified > solved > extracted. exam_data.json 생성.
- **잔존 agentic**: 없음
- **본 task cover**: Phase 3 (A4와 동일 — 검증 확인)
- **검증**:
  ```bash
  grep -n "buildExamDataJson\|verifierResultPath\|solverResultPath" ngd-studio/server/stages/examData.ts
  # expected: 함수 + 우선순위 읽기 확인
  ```
- **agentic→code 동치성**: `examData.test.ts`에서 verified-only, solved-fallback, extracted-fallback 3케이스 fixture 테스트 존재 여부 확인.

---

## Group C — Builder runner codify-candidate 5개 (audit lines 51-55)

### C1 — `runBuildHwpx`

- **출처**: audit doc line 51
- **현재 상태**: `코드화됨` — `server/stages/builder.ts:71-81`에 `build_hwpx.py examDataPath outputDir` subprocess 실행. stdout에서 `HWPX written:` 경로 추출(`builder.ts:152-155`).
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "buildHwpx\|HWPX written" ngd-studio/server/stages/builder.ts
  # expected: script 경로 + stdout 파싱 확인
  ```
- **agentic→code 동치성**: rule citation — `resolveBuilderScripts().buildHwpx`가 `build_hwpx.py`를 정확히 가리키고 args 순서가 `(examDataPath, outputDir)` 맞는지 확인.

---

### C2 — `runFixNamespaces`

- **출처**: audit doc line 52
- **현재 상태**: `코드화됨` — `builder.ts:83-90`에서 `scripts.fixNamespaces` 실행. `resolveBuilderScripts().fixNamespaces`는 `resources/hwpx_scripts/fix_namespaces.py`.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "fixNamespaces\|fix_namespaces.py" ngd-studio/server/stages/builder.ts
  # expected: resolveBuilderScripts + subprocess args 확인
  ```
- **agentic→code 동치성**: rule citation — `builder.ts:147`의 `fixNamespaces: path.join(baseDir, "resources", "hwpx_scripts", "fix_namespaces.py")` 경로 일치 확인.

---

### C3 — `runValidateHwpx`

- **출처**: audit doc line 53
- **현재 상태**: `코드화됨` — `builder.ts:92-99`에서 `scripts.validateHwpx hwpxPath --fix` 실행. `resolveBuilderScripts().validateHwpx`는 `resources/hwpx_scripts/validate.py`.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "validateHwpx\|validate.py.*--fix" ngd-studio/server/stages/builder.ts
  # expected: --fix flag 포함 확인
  ```
- **agentic→code 동치성**: rule citation — `builder.ts:97`의 args에 `"--fix"` 포함 확인.

---

### C4 — `writeBuildStatus`

- **출처**: audit doc line 54
- **현재 상태**: `코드화됨` — `builder.ts:193-200` (`writeBuildStatus` private function). running/completed/failed 상태 JSON 기록. stage 시작·종료·실패 각각 호출됨.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "writeBuildStatus\|build_status.json" ngd-studio/server/stages/builder.ts
  # expected: 함수 정의 + 3회 호출 확인
  ```
- **agentic→code 동치성**: rule citation — `BuildStatusFile` interface의 `status` 값이 audit doc line 54의 "running, retrying, fallback, success, failed" 중 코드화된 것(`running/completed/failed`) 확인.

---

### C5 — `classifyBuildError`

- **출처**: audit doc line 55
- **현재 상태**: `agentic 잔존` — `builder.ts:202-217`의 `normalizeBuilderError`는 StageError 정규화만 수행. data 문제 vs script 문제 heuristic 분류 없음. audit doc의 `classifyBuildError` 함수 미구현.
- **잔존 agentic**: 빌드 실패 원인 판단은 에이전트에 위임 (현재 orchestrator는 단순 fail 반환)
- **본 task cover**: Phase 4 (agent fallback 조건이 명확한 경우 heuristic 추가)
- **검증**:
  ```bash
  grep -n "classifyBuildError\|data.*bug\|script.*bug\|heuristic" ngd-studio/server/stages/builder.ts
  # expected: ≥1 (Phase 4 완료 후)
  ```
- **agentic→code 동치성**: audit doc lines 64-76의 "agent fallback 불필요 조건" 4개(namespace fix, ZIP validity, content.hpf, escaping)가 코드 경로에서 자동 처리되는지 rule citation.

---

## Group D — Checker XML rule "즉시 코드화 가능" 9개 (audit lines 83-91)

### D1 — `<hp:t>` 안 `hp:equation` 문자열 분리 오류

- **출처**: audit doc line 83
- **현재 상태**: `코드화됨` — `checker.ts:302-316` (`checkRawEquationXml`), ruleId `text.raw_equation_xml`.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "raw_equation_xml\|checkRawEquationXml" ngd-studio/server/stages/checker.ts
  # expected: 함수 + ruleId 확인
  ```
- **agentic→code 동치성**: `checker.test.ts`에서 `<hp:t>&lt;hp:equation&gt;</hp:t>` 입력 → `text.raw_equation_xml` issue 반환 fixture 확인.

---

### D2 — `<hp:t>` 연속 영문자 탐지

- **출처**: audit doc line 84
- **현재 상태**: `코드화됨` — `checker.ts:318-332` (`checkEnglishWords`), ruleId `text.english_word`. 3글자 이상 연속 영문자 감지.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "english_word\|checkEnglishWords" ngd-studio/server/stages/checker.ts
  # expected: 함수 + ruleId 확인
  ```
- **agentic→code 동치성**: rule citation — `[A-Za-z]{3,}` 패턴이 audit doc "연속 영문자 탐지" 사양과 일치하는지 확인.

---

### D3 — `<hp:script>` 연산자 공백 패턴 탐지

- **출처**: audit doc line 85
- **현재 상태**: `부분 코드화` — `checker.ts`에 `equation.run_on` 규칙 있으나 "연산자 공백 패턴"(예: `a +b` 대신 `a + b`) 탐지 규칙은 없음. run-on 감지는 등호 개수 기반이지 공백 패턴 아님.
- **잔존 agentic**: 연산자 공백 규칙 에이전트 담당
- **본 task cover**: Phase 5 (연산자 공백 패턴 detector 추가)
- **검증**:
  ```bash
  grep -n "operator.*space\|space.*operator\|equation.*space" ngd-studio/server/stages/checker.ts
  # expected: ≥1 (Phase 5 완료 후)
  ```
- **agentic→code 동치성**: audit doc line 85의 "연산자 공백 패턴"을 정규식으로 표현하는 fixture 2-3개 작성 후 규칙 출력 비교.

---

### D4 — 난이도 vocabulary

- **출처**: audit doc line 86
- **현재 상태**: `코드화됨` — `checker.ts:334-350` (`checkDifficultyVocabulary`), ruleId `text.difficulty_vocabulary`. ALLOWED_DIFFICULTIES = {"하","중","상","킬"}.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "difficulty_vocabulary\|ALLOWED_DIFFICULTIES" ngd-studio/server/stages/checker.ts
  # expected: Set 정의 + 함수 확인
  ```
- **agentic→code 동치성**: `checker.test.ts`에서 `[난이도] 보통` → error, `[난이도] 상` → ok fixture 확인.

---

### D5 — 순열/조합 금지 패턴

- **출처**: audit doc line 87
- **현재 상태**: `코드화됨` — `checker.ts:370-386` (`checkPermutationCombination`), ruleId `equation.permutation_combination`. `nCr`, `LSUB`, `_n C _r` 등 금지 패턴.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "permutation_combination\|checkPermutationCombination" ngd-studio/server/stages/checker.ts
  # expected: 함수 + forbidden 패턴 확인
  ```
- **agentic→code 동치성**: rule citation — `forbidden` 정규식에 audit doc line 87의 `nCr`, `_n C _r`, `LSUB` 모두 포함 확인.

---

### D6 — endNote 구조

- **출처**: audit doc line 88
- **현재 상태**: `agentic 잔존` — `checker.ts`에 endNote 구조 검사 없음. suffixChar, autoNum, number 순서, `[정답]` 존재 여부 모두 미구현.
- **잔존 agentic**: checker agent 담당
- **본 task cover**: Phase 5 (endNote 구조 detector 신규 구현)
- **검증**:
  ```bash
  grep -n "endNote\|suffixChar\|autoNum\|checkEndNote" ngd-studio/server/stages/checker.ts
  # expected: ≥1 (Phase 5 완료 후)
  ```
- **agentic→code 동치성**: HWPX endNote XML 샘플 fixture 작성 후 구조 순서(suffixChar → autoNum → number → `[정답]`) 검증.

---

### D7 — XML well-formed + raw escape 검사

- **출처**: audit doc line 89
- **현재 상태**: `코드화됨` — `checker.ts:248-283` (`checkXmlWellFormed`, ruleId `xml.well_formed`), `checker.ts:285-299` (`checkRawEscapes`, ruleId `xml.raw_escape`).
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "xml.well_formed\|xml.raw_escape\|checkXmlWellFormed\|checkRawEscapes" ngd-studio/server/stages/checker.ts
  # expected: 2개 ruleId + 2개 함수
  ```
- **agentic→code 동치성**: `checker.test.ts`에서 unclosed tag → `xml.well_formed` error, unescaped `<` in hp:script → `xml.raw_escape` error fixture 확인.

---

### D8 — section0 style/lineBreak/bold 속성 검사

- **출처**: audit doc line 90
- **현재 상태**: `agentic 잔존` — `checker.ts`에 style count, lineBreak, bold 속성 검사 없음. CLAUDE.md의 "F6 스타일: 바탕글 1개만", "정답 bold 금지" 규칙이 코드화되지 않음.
- **잔존 agentic**: checker agent 담당
- **본 task cover**: Phase 5 (style count / lineBreak / bold detector 추가)
- **검증**:
  ```bash
  grep -n "lineBreak\|bold\|styleCount\|checkSection\|checkBold" ngd-studio/server/stages/checker.ts
  # expected: ≥1 (Phase 5 완료 후)
  ```
- **agentic→code 동치성**: section0.xml fixture에서 bold 속성 있는 셀 → `section0.bold` error, 바탕글 스타일 2개 이상 → `section0.style_count` error 검증.

---

### D9 — 중단원/과목/범위 vocabulary check

- **출처**: audit doc line 91
- **현재 상태**: `agentic 잔존` — `.claude/data/unit_classification.json`은 존재하나 `checker.ts`에서 vocabulary 검증 로직 없음.
- **잔존 agentic**: checker agent가 unit_classification.json 참조하여 판단
- **본 task cover**: Phase 5 (unit_classification.json 로드 + vocabulary detector 추가)
- **검증**:
  ```bash
  grep -n "unit_classification\|vocabulary.*unit\|checkVocabulary" ngd-studio/server/stages/checker.ts
  # expected: ≥1 (Phase 5 완료 후)
  find . -name "unit_classification.json" -not -path "*/node_modules/*"
  # expected: .claude/data/unit_classification.json 존재 확인
  ```
- **agentic→code 동치성**: unit_classification.json의 과목 목록에서 fixture 2개(유효/무효 vocabulary) 추출 후 코드 출력 검증.

---

## Group E — Reviewer 분리 6개 (audit lines 111-116)

### E1 — `ReviewIssueDraft` model call

- **출처**: audit doc line 111
- **현재 상태**: `부분 코드화` — `server/review/mutation.ts:33-59`에 `ReviewIssueDraft` 타입 정의됨. 단, model call 자체(LLM 호출로 draft 생성)는 ngd-exam-reviewer agent가 담당. `reviewRunner.ts:46`의 `runReviewerAgent` 콜백이 이 역할.
- **잔존 agentic**: reviewer agent의 PDF-HWPX 비교 판단 + draft 생성
- **본 task cover**: Phase 7 (ReviewIssueDraft 타입 강화 + auto-validator 구조)
- **검증**:
  ```bash
  grep -n "ReviewIssueDraft" ngd-studio/server/review/mutation.ts
  # expected: interface 정의
  grep -n "runReviewerAgent" ngd-studio/server/stages/reviewRunner.ts
  # expected: 콜백 타입 정의
  ```
- **agentic→code 동치성**: `ReviewIssueDraft` 타입 스키마가 reviewer agent 출력 JSON과 동일한지 agent output sample → TypeScript parse 검증.

---

### E2 — `ReviewIssueValidator` (rule 분류 + auto-fixable 판정)

- **출처**: audit doc line 112
- **현재 상태**: `agentic 잔존` — `ReviewIssueValidator` 구현 없음. issue type 분류(`typo`/`missing`/`checklist_violation`)는 `ReviewIssueDraft.issue_type`으로 agent가 채우며, auto-fixable 판정 로직 없음.
- **잔존 agentic**: reviewer agent가 issue 분류 + auto-fixable 판단
- **본 task cover**: Phase 7
- **검증**:
  ```bash
  grep -rn "ReviewIssueValidator\|isAutoFixable\|auto.fixable" ngd-studio/server/
  # expected: ≥1 (Phase 7 완료 후)
  ```
- **agentic→code 동치성**: `ReviewIssueDraft.issue_type === "typo" && suggested_fix !== undefined` → auto-fixable 판정 규칙을 fixture-based 검증.

---

### E3 — `zipReplaceHwpxSection`

- **출처**: audit doc line 113
- **현재 상태**: `코드화됨` — `server/review/mutation.ts:76-124` (`zipReplaceHwpxSection`). ZIP entry별 문자열 치환, tmp swap, 첫 occurrence 치환.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "zipReplaceHwpxSection" ngd-studio/server/review/mutation.ts
  # expected: 함수 정의
  ```
- **agentic→code 동치성**: `mutation.test.ts`에서 snippet 치환 + snippet 미발견 throw 2케이스 fixture 확인.

---

### E4 — `writeFixedReviewTableEntries`

- **출처**: audit doc line 114
- **현재 상태**: `코드화됨` — `server/review/reviewTable.ts:64-96` (`writeFixedReviewTableEntries`). 22개 항목 해당번호 기입.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "writeFixedReviewTableEntries" ngd-studio/server/review/reviewTable.ts
  # expected: 함수 정의
  ```
- **agentic→code 동치성**: rule citation — `setFixedTableCell(xml, itemNumber, value)` 내부 로직이 "편집오검" 테이블의 3번째 셀(colAddr="2")을 정확히 수정하는지 XML fixture 검증.

---

### E5 — `runAddReviewTable`

- **출처**: audit doc line 115
- **현재 상태**: `코드화됨` — `server/review/reviewTable.ts:180-217` (`runAddReviewTable`). `add_review_table.py` subprocess 호출, `--no-issues` flag 지원.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "runAddReviewTable\|add_review_table.py" ngd-studio/server/review/reviewTable.ts
  # expected: 함수 + script path 확인
  ```
- **agentic→code 동치성**: rule citation — `--no-issues` flag 경로와 extraItems 있는 경우 경로가 audit doc line 25의 "second table present" 조건을 만족하는지 확인.

---

### E6 — `runReviewPostprocess`

- **출처**: audit doc line 116
- **현재 상태**: `코드화됨` — `server/review/postprocess.ts:44-82` (`runReviewPostprocess`). `fix_namespaces.py` → `validate.py --fix` 순 실행.
- **잔존 agentic**: 없음
- **본 task cover**: 선행 task 완료 — Phase 8에서 최종 cover 확인
- **검증**:
  ```bash
  grep -n "runReviewPostprocess" ngd-studio/server/review/postprocess.ts
  # expected: 함수 정의
  ```
- **agentic→code 동치성**: rule citation — `postprocess.ts:55-58`의 fix_namespaces.py 경로가 `.claude/skills/ngd-exam-review/scripts/fix_namespaces.py`를 정확히 가리키는지 확인.

---

## 전체 Cover 진행률 요약 표

> **Phase 8 검증 기준**: 모든 행이 "covered" 상태여야 Phase 8 통과.
> 현재 상태는 task 시작 기준(2026-05-20). Phase 진행 후 Phase 8에서 최종 갱신.

| 그룹 | 총 행 | 코드화됨 (선행 task) | 부분 코드화 | agentic 잔존 | 본 task 완료 후 목표 |
|------|-------|---------------------|-------------|-------------|---------------------|
| A (audit 12개) | 12 | 6 (A6,A7,A8,A10,A12 + A4 포함) | 3 (A3,A5,A9) | 3 (A1,A2,A11) | 12/12 |
| B (Orch 7개) | 7 | 2 (B3,B7) | 3 (B4,B5,B6) | 2 (B1,B2) | 7/7 |
| C (Builder 5개) | 5 | 4 (C1,C2,C3,C4) | 0 | 1 (C5) | 5/5 |
| D (Checker 9개) | 9 | 5 (D1,D2,D4,D5,D7) | 1 (D3) | 3 (D6,D8,D9) | 9/9 |
| E (Reviewer 6개) | 6 | 4 (E3,E4,E5,E6) | 1 (E1) | 1 (E2) | 6/6 |
| **합계** | **39** | **21** | **8** | **10** | **39/39** |

### Phase별 cover 매핑

| Phase | Cover 대상 행 | 설명 |
|-------|--------------|------|
| Phase 1 | (본 문서 생성) | Coverage matrix 수립 |
| Phase 2 | A1, A2, B1, B2, B3 | resume parsing / cleanup / state detection |
| Phase 3 | A3, A4, B4, B5, B6, B7 | batch scheduling / retry / aggregation |
| Phase 4 | A5, C5 | figure pipeline 분리 / classifyBuildError |
| Phase 5 | A9(D3,D6,D8,D9), D3, D6, D8, D9 | checker 추가 4개 rule |
| Phase 6 | (R-07, R-10 parity — 본 매트릭스 외 별도) | equation codify |
| Phase 7 | A11, E1, E2 | reviewer auto-validators |
| Phase 8 | 전체 39행 | 최종 cover 확인 + 진행률 100% 검증 |
