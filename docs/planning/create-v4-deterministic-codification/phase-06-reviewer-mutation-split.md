---
phase: 6
title: reviewer mutation 분리
status: pending
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

- [ ] `ngd-studio/server/review/mutation.ts` — `zipReplaceHwpxSection`, `applyReviewMutations` 구현
- [ ] `ngd-studio/server/review/reviewTable.ts` — `writeFixedReviewTableEntries`, `runAddReviewTable` wrapper
- [ ] `ngd-studio/server/review/postprocess.ts` — `runReviewPostprocess`
- [ ] `.claude/agents/ngd-exam-reviewer.md` — issue draft 생성만 하도록 재작성 + 출력 schema 정의
- [ ] `ngd-studio/server/stages/reviewRunner.ts` — draft → mutation → table → postprocess orchestration
- [ ] `server/review/__tests__/mutation.test.ts` — fixture HWPX로 mutation 정확성 검증
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
