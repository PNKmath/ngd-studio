---
phase: 6
title: reviewer mutation 분리
status: completed
depends_on: []
scope:
  - .claude/agents/ngd-exam-reviewer.md
  - ngd-studio/server/review/mutation.ts
  - ngd-studio/server/review/reviewTable.ts
  - ngd-studio/server/review/__tests__/mutation.test.ts
  - .claude/skills/ngd-exam-review/scripts/add_review_table.py
intervention_likely: true
intervention_reason: "reviewer agent 기존 동작이 분리되면서 .claude/agents 및 skill 호출 방식이 변경됨. 기존 오검 워크플로우 호환성 확인 필요."
---

# Phase 6: reviewer mutation 분리

> **범위**: Backend (reviewer pipeline)
> **난이도**: L
> **의존성**: 없음 (독립 진행 가능)
> **영향 파일**: `ngd-exam-reviewer.md` (agent definition), `server/review/*.ts` (신규), `add_review_table.py`

## 배경

현재 `ngd-exam-reviewer` agent는 두 일을 한꺼번에 한다 (`docs/planning/agent-provider-operating-model/deterministic-code-candidates.md:102`):

1. **판단**: 원본 PDF와 HWPX 비교 → 오타/누락/체크리스트 위반 후보 생성
2. **mutation**: HWPX ZIP/XML 직접 수정, 편집오검 내역표 기입, fix_namespaces/validate 실행

(1)은 LLM이 필요하지만 (2)는 결정적. 섞여 있어서:

- mutation 버그(잘못된 XML 치환)가 모델 한계처럼 보임
- DeepSeek 같은 저비용 provider를 issue draft에 쓸 수 없음 (ZIP-level mutation을 요구해서)
- 테스트 어려움

## 설계

### 1. 신규 TS 모듈

`ngd-studio/server/review/`:

- **`mutation.ts`** — `zipReplaceHwpxSection(hwpxPath, replacements: {file: string, newContent: string}[])` 등 ZIP-level mutation primitive.
- **`reviewTable.ts`** — `writeFixedReviewTableEntries(hwpxPath, entries)`: 22개 고정 항목 해당번호 기입. `runAddReviewTable(hwpxPath, extraItems | noIssues)`: `add_review_table.py` 실행 wrapper.
- **`postprocess.ts`** — `runReviewPostprocess(hwpxPath)`: review용 `fix_namespaces.py` + `validate.py` 실행.

### 2. reviewer agent 단순화

`.claude/agents/ngd-exam-reviewer.md`는 **issue draft 생성**만 담당:

```
입력: 원본 PDF + 작업 HWPX
출력: ReviewIssueDraft[] (JSON)
  - issue_type: typo | missing | checklist_violation
  - location: { file, xpath?, snippet }
  - suggested_fix?: string
  - rule_id?: string
```

기존 mutation 단계는 orchestrator(별도 TS runner)가 ReviewIssueDraft를 받아 mutation 모듈로 전달.

### 3. 새 orchestrator runner

`ngd-studio/server/stages/reviewRunner.ts` (신규 또는 기존 reviewer 호출 코드 리팩터):

```typescript
async function runReviewStage(input) {
  const drafts = await runReviewerAgent(input);  // LLM
  const { applied, failed } = await applyReviewMutations(input.hwpxPath, drafts);  // 코드
  await writeFixedReviewTableEntries(input.hwpxPath, applied);
  await runAddReviewTable(input.hwpxPath, applied.extras);
  await runReviewPostprocess(input.hwpxPath);
  return { applied, failed, drafts };
}
```

### 4. 호환성

기존 `/오검` 스킬 호출 사용자는 이전 흐름과 동일한 입력/출력 기대. 변경:

- LLM call 1회 (draft만) — 기존엔 LLM이 mutation까지 함
- mutation은 결정적 — 같은 PDF/HWPX 입력에 같은 출력 보장
- 실패한 mutation은 `failed` 리스트로 분리되어 사용자에게 보고

**intervention_likely=true 이유**: agent definition을 좁히면 기존에 reviewer가 "어떻게든 처리"하던 케이스가 mutation 모듈에서 실패할 수 있음. 사용자가 신규 흐름을 한 번 검증한 후 legacy를 retire하는 게 안전.

## 체크리스트

- [x] `ngd-studio/server/review/mutation.ts` — `zipReplaceHwpxSection`, `applyReviewMutations` 구현
- [x] `ngd-studio/server/review/reviewTable.ts` — `writeFixedReviewTableEntries`, `runAddReviewTable` wrapper
- [x] `ngd-studio/server/review/postprocess.ts` — `runReviewPostprocess`
- [x] `.claude/agents/ngd-exam-reviewer.md` — issue draft 생성만 하도록 재작성 + 출력 schema 정의
- [x] `ngd-studio/server/stages/reviewRunner.ts` — draft → mutation → table → postprocess orchestration
- [x] `server/review/__tests__/mutation.test.ts` — fixture HWPX로 mutation 정확성 검증
- [ ] 기존 오검 fixture 1개로 e2e: draft → mutation → 결과 HWPX가 기존 reviewer 출력과 동일/우월

## 영향 범위

- reviewer agent 사용 측(`ngd-exam-review` skill, UI 오검 페이지) 인터페이스 변경 가능성 — 확인 필요.
- 기존 `add_review_table.py` 호출 흔적 (`grep`으로 검사)을 wrapper로 교체.
- LLM 비용 감소 (draft만), 결정성 ↑.

## 검증

```bash
cd ngd-studio
pnpm tsc --noEmit
pnpm test server/review/__tests__/

# e2e (수동)
# 기존 오검 fixture로 reviewRunner 호출, 결과 HWPX validate.py 통과 확인
python3 resources/hwpx_scripts/validate.py <reviewed.hwpx> --fix
```

**사용자 확인 포인트**: 기존 reviewer agent가 했던 mutation 케이스 중 새 모듈로 옮기기 모호한 것(예: LLM이 ad-hoc XML 생성하던 케이스)이 있다면 사용자와 함께 결정.

---

## 실행 기록

### 1회차 (2026-05-20 08:51 KST) — completed

**상태**: completed
**소요 시간**: 약 12분
**진행 모델**: claude-sonnet-4-6

#### 요약

`server/review/` 신규 디렉터리에 mutation/reviewTable/postprocess 3개 모듈 + reviewRunner orchestrator를 생성했다. ngd-exam-reviewer.md를 issue-draft-only로 재작성하고, JSZip 기반 fixture HWPX로 8개 단위 테스트를 작성하여 전부 통과했다. tsc --noEmit도 0 오류. e2e(실제 HWPX 파일)는 오검 실운영 시 수동 검증 필요.

#### 변경 파일

- `ngd-studio/server/review/mutation.ts` (신규, +148줄) — `zipReplaceHwpxSection`, `applyReviewMutations`
- `ngd-studio/server/review/reviewTable.ts` (신규, +175줄) — `writeFixedReviewTableEntries`, `runAddReviewTable`
- `ngd-studio/server/review/postprocess.ts` (신규, +82줄) — `runReviewPostprocess`
- `ngd-studio/server/stages/reviewRunner.ts` (신규, +122줄) — LLM → mutation → table → postprocess orchestrator
- `ngd-studio/server/review/__tests__/mutation.test.ts` (신규, +178줄) — 8개 단위 테스트
- `.claude/agents/ngd-exam-reviewer.md` (수정) — issue draft 전용으로 재작성, `Write/Edit` 도구 제거
- `ngd-studio/vitest.config.ts` (수정) — `server/review/__tests__/` include 추가

#### 검증 결과

- [x] `npx tsc --noEmit`: 0 오류 (exit 0)
- [x] `npx vitest run server/review/__tests__/mutation.test.ts --reporter=basic`: 8/8 통과 (30ms)
- [x] 기존 테스트 회귀 없음: 412 passed (2 pre-existing failures: live API + orchestrator timeout)

#### 추가 발견사항

- e2e 항목(체크리스트 7번째)은 실제 오검 HWPX fixture가 없어 자동 검증 불가. 첫 오검 실운영 시 `reviewRunner`를 호출하고 `validate.py` exit 0 확인으로 대체한다.
- `writeFixedReviewTableEntries`의 3rd-cell 탐색 로직은 정규식 대신 단순 indexOf 계산을 사용하므로 idempotent하고 XML 파서 불필요.

#### 질문 / 결정 사항

- reviewer agent가 "어떻게든 처리"했던 케이스(LLM이 ad-hoc XML 블록 전체를 생성하던 경우)는 `suggested_fix`에 XML fragment 전체를 담는 것으로 처리 가능하나, 첫 실운영에서 케이스별로 검증 권장.
- `runAddReviewTable`의 scriptPath default는 `__dirname` 기반 repo-root 추론을 사용. 빌드 번들 시 경로가 달라질 수 있으므로 UI 오검 페이지에서 호출 시 `scriptPath`를 명시적으로 주입하도록 처리 필요.

#### Scope Audit (orchestrator)

pass (사용자 사전 승인) — frontmatter scope에 추가로 spec body §설계 명시 파일(postprocess.ts, reviewRunner.ts) + vitest.config.ts include 1줄 수정 포함. 사용자 확인 절차로 정당화.

#### Verification Re-run (orchestrator)

exit 0 — pnpm tsc --noEmit 0 errors, server/review/__tests__/mutation.test.ts 8/8 pass.

#### Simplify (orchestrator)

3 files, 5 edits — mutation.ts(err 추출 평탄화), reviewTable.ts(option chain), reviewRunner.ts(Set 타입 단순화), postprocess.ts(미사용 resolveReviewPostprocessScripts 인라인화). 검증 재실행 pass.

#### Review (orchestrator)

pass — A~I 전부 OK. e2e 7번 항목은 fixture 부재로 수동 검증 정당, scope 확장은 사용자 승인. 1개 비-차단 노트: buildFixedTableEntries의 문제번호 "확인" 하드코딩은 ReviewIssueDraft 인터페이스 한계로 차기 iteration 이슈.
