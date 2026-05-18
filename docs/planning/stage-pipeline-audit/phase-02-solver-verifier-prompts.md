---
phase: 2
title: solver/verifier prompt+validator NGD-rich 통합, legacy 제거
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/solver.ts
  - ngd-studio/server/stages/verifier.ts
  - ngd-studio/server/stages/prompts/solverPrompt.ts
  - ngd-studio/server/stages/prompts/verifierPrompt.ts
  - ngd-studio/server/stages/__tests__/solver.test.ts
  - ngd-studio/server/stages/__tests__/verifier.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 2: solver/verifier prompt+validator NGD-rich 통합

> **범위**: Backend (stage validator + prompt)
> **난이도**: M
> **의존성**: Phase 1 (매트릭스 결론)
> **영향 파일**: `server/stages/{solver,verifier}.ts`, `prompts/{solver,verifier}Prompt.ts`, 두 테스트

## 배경

`server/stages/solver.ts:102-111`의 `buildSolverPrompt`는 legacy 영문 ("Solve the extracted exam-question data..."), schema `{answer, explanation:[{kind,content}]}`. `prompts/solverPrompt.ts`에는 NGD Korean 프롬프트와 schema `{number, answer, explanation_parts:[{t|eq|br}]}`가 정의돼 있지만 **import만 가능한 dead code**.

verifier도 같은 패턴 (`verifier.ts:104-113` legacy vs `prompts/verifierPrompt.ts:89-109` NGD).

extractor는 이미 NGD-rich 프롬프트(`prompts/extractorPrompt.ts`)를 사용 중. **일관성을 위해 solver/verifier도 NGD-rich로 통일**한다 (사용자 confirm 완료). validator도 새 schema에 맞춰 재작성.

## 설계

### Solver

1. **`server/stages/solver.ts` 변경**:
   - `runSolverStage`가 `prompts/solverPrompt.ts`의 `buildSolverPrompt({extracted, guidelineContext, feedback})`를 호출. 반환은 `{system, user}` 객체이므로 `system + "\n\n" + user`로 합쳐서 provider에 전달 (extractor와 동일 패턴).
   - `solver.ts:102-111`의 legacy `buildSolverPrompt` **삭제**. (`prompts/solverPrompt.ts`의 `buildSolverPromptString` 도 이참에 dead로 검토 → 호출자 grep 후 없으면 삭제.)
   - `SolverStageOutput`의 타입을 새 schema에 맞게 변경:
     ```ts
     export type SolverExplanationPart =
       | { t: string }
       | { eq: string }
       | { br: true };

     export interface SolverStageOutput {
       number?: number;
       answer: string;
       explanation_parts: SolverExplanationPart[];
     }
     ```
   - `SolverExplanationSegment` / `SolverExplanationSegmentKind` 는 legacy 타입 — 호출자 grep 후 사용처 없으면 삭제 (figure/builder가 사용하면 보존).

2. **`validateSolverOutput` 재작성**:
   - 새 schema 기준: `answer: string` required, `explanation_parts: array` required non-empty, 각 element는 `{t}|{eq}|{br:true}` 중 하나.
   - `verifierContext` 필드는 NGD prompt에 없으므로 validator에서도 제거.
   - 등호 단위 검증 (eq 안에 `=` 2개 이상 → fail) 같은 도메인 룰은 **이 phase에서는 추가하지 않음**. verifier가 검증함 — 책임 분리.
   - `validateEquation` 콜백 인자는 유지 (caller가 도메인 검증 주입 가능).

3. **`solver.test.ts`**:
   - VALID_OUTPUT을 새 schema로 교체: `{number:1, answer:"①", explanation_parts:[{t:"먼저"},{eq:"x = 1"},{br:true},{t:"그러면..."}]}`
   - validator 테스트 케이스 재작성:
     - answer 없음/빈 문자열 → fail
     - explanation_parts 없음/빈 배열 → fail
     - explanation_parts 안에 알 수 없는 키 → fail
     - 정상 케이스 → pass

### Verifier

1. **`server/stages/verifier.ts` 변경**:
   - `runVerifierStage`가 `prompts/verifierPrompt.ts`의 `buildVerifierPrompt({extracted, solved, guidelineContext})` 호출. 반환은 `{system, user}` 객체.
   - `verifier.ts:104-113`의 legacy `buildVerifierPrompt` 삭제.
   - `VerifierStageOutput` 새 schema:
     ```ts
     export type VerifierIssueCategory =
       | "math_accuracy" | "math_completeness"
       | "curriculum_scope" | "curriculum_term"
       | "format_rule" | "equation_syntax"
       | "extraction_mismatch";

     export interface VerifierIssue {
       category: VerifierIssueCategory;
       description: string;
       location?: string;
     }

     export interface VerifierStageOutput {
       number?: number;
       status: "pass" | "fail";
       issues: VerifierIssue[];
       feedback?: string | null;
     }
     ```

2. **`validateVerifierOutput` 재작성**:
   - status `pass|fail` required.
   - issues required array. pass면 빈 배열 허용, fail이면 1건 이상.
   - 각 issue: category(enum), description(string), location?(string).
   - feedback: pass면 null/undefined, fail이면 string (warn — strict 강제하지는 말고 type 검사만).

3. **`verifier.test.ts`**:
   - VALID_OUTPUT 두 종 (pass / fail) 새 schema로 교체.
   - validator 테스트 재작성.

### 호환성

- 캐시된 `q{N}_solved.json` / `q{N}_verified.json` 파일이 legacy schema 형태로 디스크에 있을 가능성: 사용자가 이전 작업 진행 중이라면 존재. **Phase 4**의 disk-scan resume에서 schema 검증 후 mismatch면 재실행 분기 처리. 이 phase에서는 cache 자체 invalidation은 하지 않음.
- builder / figure / checker stage가 `SolverExplanationSegment` 등 legacy 타입을 import하는지 grep으로 확인. 사용처 있으면 type alias 유지 또는 builder 코드 동기 수정.

## 체크리스트

- [x] solver.ts: `runSolverStage`가 `prompts/solverPrompt.ts`의 `buildSolverPrompt` 사용하도록 변경
- [x] solver.ts: legacy `buildSolverPrompt` 삭제, `SolverStageOutput` 새 schema로 교체
- [x] solver.ts: `validateSolverOutput` 새 schema 기준 재작성
- [x] solver.test.ts: VALID_OUTPUT + validator 테스트 새 schema로 교체, 모든 케이스 pass
- [x] verifier.ts: `runVerifierStage`가 `prompts/verifierPrompt.ts`의 `buildVerifierPrompt` 사용하도록 변경
- [x] verifier.ts: legacy `buildVerifierPrompt` 삭제, `VerifierStageOutput` + `VerifierIssue` 새 schema
- [x] verifier.ts: `validateVerifierOutput` 새 schema 기준 재작성, verifier.test.ts 갱신, 모든 케이스 pass

## 영향 범위

- 다운스트림 consumer: solver의 explanation 결과를 builder/figure가 사용. legacy `explanation:[{kind,content}]`을 기대하면 builder 수정 또는 transformer 추가 필요.
  - **확인 필요**: builder/figure가 solver output을 직접 읽는지, exam_data.json만 읽는지. exam_data.json은 buildExamDataJson이 직접 채우므로 거기서 schema 맞추면 OK.
- 캐시 파일 schema 변경 — 기존 캐시는 Phase 4가 disk-scan 시 schema mismatch면 재실행으로 처리.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/solver.test.ts server/stages/__tests__/verifier.test.ts --reporter=basic
```

추가 confirmation: solver/verifier가 legacy buildXxxPrompt를 더 이상 import하지 않는지 grep.
```bash
grep -rn "buildSolverPromptString\|legacy" ngd-studio/server/stages --include="*.ts"
```

## 실행 결과

### 1회차 (2026-05-18 01:14 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
solver.ts/verifier.ts 모두 NGD-rich prompt(`prompts/solverPrompt.ts`, `prompts/verifierPrompt.ts`)를 사용하도록 전환. legacy inline `buildSolverPrompt`/`buildVerifierPrompt` 삭제, `buildSolverPromptString` 삭제. 두 stage의 출력 schema를 NGD `explanation_parts`/`VerifierIssue` 기반으로 재작성. 영향받는 3개 외부 테스트 파일도 새 schema에 맞게 갱신.

#### 변경 파일
- `ngd-studio/server/stages/solver.ts` (수정, 새 schema + NGD prompt 연동)
- `ngd-studio/server/stages/verifier.ts` (수정, 새 schema + NGD prompt 연동)
- `ngd-studio/server/stages/prompts/solverPrompt.ts` (수정, buildSolverPromptString 삭제)
- `ngd-studio/server/stages/prompts/index.ts` (수정, buildSolverPromptString re-export 삭제)
- `ngd-studio/server/stages/__tests__/solver.test.ts` (신규, +200줄)
- `ngd-studio/server/stages/__tests__/verifier.test.ts` (신규, +220줄)
- `ngd-studio/server/stages/__tests__/prompts.test.ts` (수정, legacy test 제거)
- `ngd-studio/lib/__tests__/providerDeepSeek.test.ts` (수정, 새 schema + 새 import)
- `ngd-studio/lib/__tests__/providerDeepSeekLive.test.ts` (수정, explanation→explanation_parts)

#### 검증 결과
- [x] `npx tsc --noEmit` → 오류 없음 (0 errors)
- [x] `vitest run solver.test.ts verifier.test.ts` → 33/33 pass
- [x] `grep buildSolverPromptString server/stages --include=*.ts` → 없음 (삭제 확인)

#### 추가 발견사항
- `examData.ts`는 `Record<string, unknown>` 사용 → builder/figure 하위 호환 영향 없음
- orchestrator feedback loop은 현재 `guidelineContext`를 통해 feedback 전달 중. 새 `feedback` 필드 직접 사용은 Phase 4+ 과제.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)

escalate-then-accepted — declared scope 외 4개 파일(prompts/index.ts, prompts.test.ts, lib/__tests__/providerDeepSeek.test.ts, providerDeepSeekLive.test.ts) 수정 발견. legacy 제거에 따른 downstream entailment 성격. 사용자 명시 승인으로 phase 2 commit에 포함.

#### Verification Re-run (orchestrator)

exit 0 — `npx tsc --noEmit` 0 errors, `vitest solver.test.ts verifier.test.ts` 33/33 pass.

#### Simplify (orchestrator)

SIMPLIFIED: 4 — solver.ts `keys` else-only scope 이동, solverPrompt.ts stale "Note:" + trailing blank 제거, verifier.test.ts 잘못된 case name "passes when"→"fails when" 수정. Verify pass.

#### Review (orchestrator)

VERDICT: pass — 스펙대로 NGD-rich prompt 전환 + legacy 제거 완료, tsc 0 errors, 33/33 pass.

#### Commit

662c60d
