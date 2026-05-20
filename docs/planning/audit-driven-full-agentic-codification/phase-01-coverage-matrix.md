---
phase: 1
title: audit coverage 매트릭스 + 후보별 현재 코드 상태 정리
status: completed
depends_on: []
scope:
  - docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
e2e_triggers: []
intervention_likely: false
intervention_reason: ""
---

# Phase 1: audit coverage 매트릭스 + 후보별 현재 코드 상태 정리

> **범위**: 문서 only
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `coverage-matrix.md` (신규)

## 배경

본 task의 모든 후속 phase는 "audit doc의 어떤 후보를 어떻게 cover하는가"를 일관되게 추적해야 한다. 선행 task에서 phase 작성자가 audit doc 항목을 인용 없이 일부만 cover한 결과, 사후 검증 단계에 가서야 누락(endNote/lineBreak/vocabulary, R-09 text-side 등)이 발견됐다.

본 phase는 **매트릭스 문서를 단일 referent**로 만들어 후속 phase가 명시적으로 인용하게 한다.

## 설계

`docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md`를 다음 구조로 작성:

```markdown
# audit-driven-full-agentic-codification — Coverage Matrix

audit `docs/planning/agent-provider-operating-model/deterministic-code-candidates.md`의
12개 후보 + 부속 codify-candidate 함수 + checker XML rule list 전부를 행으로 갖고,
각 행에 다음 열을 기록:

| 후보 ID | 출처(audit 섹션) | 현재 코드 상태 | 잔존 agentic 부분 | 본 task에서 cover하는 Phase | 검증 방법 |
```

### 행 구성 (audit doc 분해)

**A. 후보 요약 표 12개** (audit lines 14-27):
- A1 resume parsing / cleanup
- A2 cache scan / stage state
- A3 batch scheduling / retry loop
- A4 verified JSON aggregation
- A5 figure processing
- A6 HWPX build runner (이미 코드화)
- A7 namespace fix (이미 코드화)
- A8 HWPX validation (이미 코드화)
- A9 checker XML rules
- A10 review table insertion (선행 task)
- A11 reviewer direct HWPX edits (선행 task partial)
- A12 provider telemetry (이미 코드화)

**B. Orchestration codify-candidate 함수 7개** (audit lines 35-41):
- B1 `parseResumeCommand`
- B2 `cleanupFromStage`
- B3 `detectQuestionStates`
- B4 `buildStagePlan`
- B5 `runBatches`
- B6 `applyVerifierRetry`
- B7 `aggregateVerifiedProblems`

**C. Builder runner codify-candidate 5개** (audit lines 51-55):
- C1 `runBuildHwpx`
- C2 `runFixNamespaces`
- C3 `runValidateHwpx`
- C4 `writeBuildStatus`
- C5 `classifyBuildError`

**D. Checker XML rule "즉시 코드화 가능" 9개** (audit lines 83-91):
- D1 `<hp:t>` 안 `hp:equation` 문자열
- D2 `<hp:t>` 연속 영문자
- D3 `<hp:script>` 연산자 공백
- D4 난이도 vocabulary
- D5 순열/조합 패턴
- D6 endNote 구조
- D7 XML well-formed + raw escape
- D8 section0 style/lineBreak/bold
- D9 중단원/과목/범위 vocabulary

**E. Reviewer 분리 6개** (audit lines 111-116):
- E1 `ReviewIssueDraft` model call
- E2 `ReviewIssueValidator` (rule 분류 + auto-fixable 판정)
- E3 `zipReplaceHwpxSection`
- E4 `writeFixedReviewTableEntries`
- E5 `runAddReviewTable`
- E6 `runReviewPostprocess`

총 39행. 각 행에 **agentic→code 동치성 증거** 열도 포함:
- 새로 코드화하는 행: 이전 agent 출력 sample(고정 fixture)과 코드 함수 출력 byte-level 또는 의미-level 일치 검증 방법 명시
- 이미 코드화된 행: 운영 데이터로 회귀 무결 입증 방법 명시 각 행마다:

```markdown
### A1 — resume parsing / downstream cleanup
- **출처**: audit doc line 16 (후보 요약), lines 35-36 (function spec)
- **현재 상태**: `.claude/skills/ngd-exam-create/SKILL.md` 자연어 + inline Python 예시. TS 코드 부재.
- **잔존 agentic**: skill 텍스트 전부 (Claude CLI legacy 경로)
- **본 task cover**: Phase 2 (resumeCommand.ts + cleanup.ts 신규)
- **검증**: `grep -ni "resume --q\|cleanupFromStage" .claude/skills/ngd-exam-create/SKILL.md` → 자연어 잔존 시 fail
- **agentic→code 동치성**: skill의 13개 resume 명령(`resume --q=3,7 --from=solver` 등) 각각을 fixture로 모은 뒤 `parseResumeCommand` 출력이 동일 구조의 ResumeCommand 객체를 만드는지 unit test로 검증. Skill 표(SKILL.md:43-63)가 ground truth.
- **현재 상태 근거 확인**: 본 phase에서 Read/Grep으로 직접 확인 후 기록
```

이미 코드화된 행(A6/A7/A8/A12 등)은 "covered" 상태로 표시하되, 코드 경로(파일:라인) 인용 필수.

**agentic→code 동치성 정책**: 각 행마다 코드화된 함수가 이전 agentic 동작과 의미적으로 동일함을 입증하는 방법 1개 이상 명시. 형식:
- **fixture-based parity**: 이전 agent가 처리하던 입력 sample → 코드 함수 출력 비교 (선호)
- **shadow-run**: 운영 데이터를 양쪽 경로로 동시에 돌려 diff 0 확인
- **rule citation**: 자연어 규칙을 1:1 대응하는 코드 path가 있다는 grep+Read 증거

## 체크리스트

- [x] `coverage-matrix.md` 신규 생성 — 위 5개 그룹(A/B/C/D/E) 39행 헤더 작성
- [x] 각 행마다 Read/Grep으로 현재 코드 상태 직접 확인 + 인용 (음성 추측 금지)
- [x] 각 행에 "본 task cover"가 어느 Phase인지 명시 (Phase 2~7)
- [x] 각 행에 **agentic→code 동치성 검증 방법** 명시 (fixture-based / shadow-run / rule citation 중 1개 이상)
- [x] 검증 명령(grep/find) 행마다 1개 이상 첨부 — `/phase-run` 검증 단계 자동 실행 가능 형식
- [x] 매트릭스 마지막에 "전체 cover 진행률" 요약 표 추가 (Phase 8이 100% 확인용으로 사용)

## 영향 범위

- 문서 only. 코드 변경 없음.
- 후속 모든 phase의 `## 체크리스트` 항목이 본 매트릭스의 행 ID를 인용 (예: "A1, B1, B2 cover 확인").
- 매트릭스의 "현재 코드 상태" 열은 phase 진행 중 갱신되지 않음 — phase 8에서 최종 cover 상태로 갱신.

## 검증

```bash
# 파일 존재 + 5개 그룹 헤더 모두 있음
test -f docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md

# 39행 충족
grep -cE "^### [A-E][0-9]" docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
# expected: 39

# 각 행에 "본 task cover" 명시
grep -c "본 task cover" docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
# expected: 39

# audit doc 12개 후보 모두 인용
grep -cE "^### A[0-9]" docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
# expected: 12
```

## 실행 결과

### 1회차 (2026-05-20 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
audit doc의 5개 그룹(A/B/C/D/E) 39행을 모두 포함하는 `coverage-matrix.md`를 신규 생성함. 각 행마다 실제 코드 Read/Grep으로 현재 상태를 직접 확인 후 기록. 선행 task에서 구현된 항목 21개(코드화됨), 부분 구현 8개, agentic 잔존 10개로 분류. 각 행에 본 task Phase 매핑, agentic→code 동치성 검증 방법, grep 검증 명령 첨부.

#### 변경 파일
- `docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md` (신규, +약 350줄)
- `docs/planning/audit-driven-full-agentic-codification/phase-01-coverage-matrix.md` (수정, 체크리스트 6/6 완료 + 실행 결과 추가)

#### 검증 결과
- [x] 파일 존재: `test -f coverage-matrix.md` → pass
- [x] 39행 충족: `grep -cE "^### [A-E][0-9]"` → 39
- [x] "본 task cover" 39개: `grep -c "본 task cover"` → 39
- [x] A그룹 12개: `grep -cE "^### A[0-9]"` → 12

#### 추가 발견사항
- A9(checker) 현재 7개 규칙 구현됨, 미구현은 D3(연산자 공백), D6(endNote), D8(lineBreak/bold), D9(vocabulary) 4개 — Phase 5에서 cover 예정
- C5(`classifyBuildError`) 미구현 — `normalizeBuilderError`만 있고 heuristic 분류 없음
- B1~B2(parseResumeCommand, cleanupFromStage) 완전 agentic 잔존 — Phase 2 최우선

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (phase-01-coverage-matrix.md self + coverage-matrix.md)

#### Verification Re-run (orchestrator)
exit 0 — 39/39/12 모두 일치, worker `VERIFICATION: pass` 와 동일.

#### Simplify (orchestrator)
skipped — 문서 only phase (markdown). 코드 정리 대상 없음.

#### Review (orchestrator)
pass — ISSUES: 0. 39행/체크 일치/scope 준수.

#### Commit
`7e1cf48` — docs(audit-coverage): Phase 1 — coverage matrix 39행 신규 생성

#### E2E (orchestrator)
skip — no e2e_triggers
