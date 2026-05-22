---
phase: 1
title: UX 묶음 (crop 모달 폭 + PDF 열기 정리 + 편집 패턴 + 풀이탭 편집)
status: completed
depends_on: []
scope:
  - ngd-studio/components/upload/CropperModal.tsx
  - ngd-studio/app/create/page.tsx
  - ngd-studio/components/results/question-result/ExtractionEditor.tsx
  - ngd-studio/components/results/question-result/SolutionEditor.tsx
  - ngd-studio/components/results/question-result/QuestionDetailModal.tsx
  - ngd-studio/components/results/question-result/QuestionDetail.tsx
  - ngd-studio/app/api/solver-json/route.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 1: UX 묶음 (crop 모달 폭 + PDF 열기 정리 + 편집 패턴 + 풀이탭 편집)

> **범위**: Frontend only
> **난이도**: L (체크리스트 7항목)
> **의존성**: 없음 (Phase 2 와 page.tsx scope 만 공유 → 순차 실행)
> **영향 파일**: `CropperModal.tsx`, `app/create/page.tsx`, `ExtractionEditor.tsx`, `SolutionEditor.tsx`(신규), `QuestionDetailModal.tsx`

## 배경

직전 `create-figure-result-modal` task 완료 후 사용자 시험 사용 중 발견된 UX 항목 6건 통합:

1. **crop 모달 폭 과함**: Phase 2(직전) 에서 `max-w-[1600px]` 로 잡았으나 시험지가 세로 비율이라 너비 60% 정도로 충분.
2. **"PDF 열기" 진입점 중복**: `ngd-studio/app/create/page.tsx:139`(NoActiveSessionPlaceholder) + `:647`(우측 하단 워크플로 영역) + 상단 글로벌 actions → 세 군데. 사용자: 우측 하단 제거 결정.
3. **placeholder 안내 멘트**: `app/create/page.tsx:135` "좌측 상단에서 이전 작업을 재개하세요" → 실제 navigator 위치가 우측 상단으로 바뀐 만큼 "우측 상단" 으로 수정.
4. **추출 결과 탭이 항상 편집 모드**: `ExtractionEditor.tsx` 가 마운트되자마자 textarea + 저장 버튼 노출. 사용자가 잘못 누를 위험 + 풀이 탭과 일관성 부재. read-only 기본 + "추출 결과 편집" 버튼으로 토글.
5. **저장 버튼 활성화 조건**: 이미 `dirty` state + `JSON.parse` try-catch (`ExtractionEditor.tsx:32, :58-68`) 존재. 단 활성화 조건이 `dirty` 단독 — JSON 파싱 가능 여부도 함께 보고 활성/비활성. null/형식 불일치 시 disabled + 인라인 에러 미리 표시.
6. **"풀이부터 재실행" 버튼 중복**: `ExtractionEditor.tsx:244` 의 `handleRerunFromSolver` (`:41`). 외부 actions 버튼과 기능 중복 → 제거.
7. **풀이 및 해설 탭 read-only only**: 현재 풀이/해설은 편집 불가. ExtractionEditor 와 동일 패턴의 `SolutionEditor` 신규 — "풀이 및 해설 편집" 버튼 → 편집 → "풀이 및 해설 저장" 버튼(dirty + JSON valid 시 활성화).

## 설계

### 1. CropperModal 폭 축소

`ngd-studio/components/upload/CropperModal.tsx:34` 부근:

```tsx
// 변경 전
className="bg-background border border-border shadow-2xl w-[96vw] max-w-[1600px] h-[95vh] flex flex-col overflow-hidden rounded-2xl"
// 변경 후
className="bg-background border border-border shadow-2xl w-[96vw] max-w-[1000px] h-[95vh] flex flex-col overflow-hidden rounded-2xl"
```

`h-[95vh]` 유지. 시험지 세로 비율이라 폭은 절반 가까이 줄여도 PDF 미리보기 충분.

### 2. "PDF 열기" 진입점 정리

`app/create/page.tsx` 의 PDF 열기 텍스트 출현 위치 (확인됨):
- `:139` — `NoActiveSessionPlaceholder` 내부 CTA (유지)
- `:647` — 우측 하단 워크플로 영역 (제거 대상)

`:647` 부근의 Button 블록과 onClick 핸들러를 제거. 동일 액션이 placeholder + 상단 글로벌 actions 에 이미 있어 노이즈.

상단 글로벌 actions(`Section 4: Global Actions`, `:637-684` 부근)의 "PDF 열기" 는 잡 중에도 새 PDF 로 전환할 수 있는 진입점이므로 유지.

### 3. NoActiveSessionPlaceholder 안내 멘트

`app/create/page.tsx:135`:

```tsx
// 변경 전
PDF를 업로드해 새 작업을 시작하거나<br />좌측 상단에서 이전 작업을 재개하세요.
// 변경 후
PDF를 업로드해 새 작업을 시작하거나<br />우측 상단에서 이전 작업을 재개하세요.
```

### 4. ExtractionEditor read-only 기본 + 편집 토글

현재 `ExtractionEditor.tsx` 는 `useState` 로 partsText/choicesText/conditionBoxText/dataTableText/cropText 5개의 textarea 와 저장 버튼을 항상 노출. 이를 다음으로 변경:

- 신규 state: `const [editMode, setEditMode] = useState(false);`
- `editMode === false` 일 때:
  - 각 필드(parts/choices/condition_box/data_table/crop_ratio) 의 **read-only 렌더링**. JSON.stringify 결과를 `<pre className="...">` 으로 표시. 풀이/해설 탭(`SolutionRenderer` 또는 동등 컴포넌트) 의 read-only 시각 패턴과 통일.
  - 상단에 **"추출 결과 편집" 버튼** 1개. 클릭 시 `setEditMode(true)`.
- `editMode === true` 일 때:
  - 기존 textarea + 저장 UI 노출.
  - 상단에 **"편집 취소" 버튼** 추가 (초기 `initial` 값으로 state reset + `setEditMode(false)`).
  - 저장 성공 시 (`onSaved` 콜백 후) `setEditMode(false)` 로 read-only 복귀.

read-only 컴포넌트는 별도 추출하지 말고 ExtractionEditor 내부 분기로 유지 (스펙 없는 추상화 금지).

### 5. 저장 버튼 활성화 — dirty + JSON 형식 valid 양쪽

현재 `:234` 의 "이 문제 저장" 활성화 조건:
```tsx
disabled={!dirty || saving}
```

변경:
```tsx
const isValid = useMemo(() => {
  try {
    JSON.parse(partsText);
    if (choicesText.trim()) JSON.parse(choicesText);
    if (conditionBoxText.trim()) JSON.parse(conditionBoxText);
    if (dataTableText.trim()) JSON.parse(dataTableText);
    if (cropText.trim()) JSON.parse(cropText);
    return true;
  } catch {
    return false;
  }
}, [partsText, choicesText, conditionBoxText, dataTableText, cropText]);

// 버튼
disabled={!dirty || !isValid || saving}
```

검증 실패 시 인라인 에러 미리 표시 (실시간):
```tsx
{!isValid && dirty && (
  <p className="text-xs text-destructive">JSON 형식 오류 — 저장 불가</p>
)}
```

`handleSave` 안의 기존 try-catch (`:58-68`) 는 유지 (이중 안전망).

### 6. "풀이부터 재실행" 버튼 제거

`ExtractionEditor.tsx:244` 의 `Button` 블록 삭제 + `handleRerunFromSolver` 함수(`:41-47`) + 관련 `rerunning` state(`:33`) + `sendResumeAction` import 제거.

외부 actions 버튼(`QuestionDetailModal` 의 footer 영역에 있는 stage별 재시작 메뉴) 이 동일 기능 제공.

### 7. SolutionEditor 신규 — 풀이/해설 탭 편집

신규 파일 `ngd-studio/components/results/question-result/SolutionEditor.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useJobStore } from "@/lib/store";

export function SolutionEditor({
  qNum,
  initial,
  onSaved,
}: {
  qNum: number;
  initial: Record<string, unknown>; // 풀이/해설 JSON (실제 필드는 worker 가 데이터 구조 grep 후 확정)
  onSaved: (updated: Record<string, unknown>) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => {
    try { JSON.parse(text); return true; } catch { return false; }
  }, [text]);

  const handleSave = useCallback(async () => {
    if (!dirty || !isValid || saving) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(text);
      const res = await fetch(`/api/solver-json?q=${qNum}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      onSaved(parsed);
      setDirty(false);
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [dirty, isValid, saving, text, qNum, onSaved]);

  if (!editMode) {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
          풀이 및 해설 편집
        </Button>
        <pre className="text-xs p-3 bg-muted/30 rounded border overflow-x-auto">
          {JSON.stringify(initial, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { setText(JSON.stringify(initial, null, 2)); setDirty(false); setEditMode(false); }}>
          편집 취소
        </Button>
        <Button size="sm" disabled={!dirty || !isValid || saving} onClick={handleSave}>
          {saving ? "저장 중…" : "풀이 및 해설 저장"}
        </Button>
      </div>
      {!isValid && dirty && (
        <p className="text-xs text-destructive">JSON 형식 오류 — 저장 불가</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true); }}
        className="w-full h-64 font-mono text-xs p-3 bg-background border rounded"
        spellCheck={false}
      />
    </div>
  );
}
```

**주의 — 검증 필요**:
- 풀이/해설 데이터의 실제 필드 구조 + 저장 API 경로 (`/api/solver-json?q=N` 가 맞는지 또는 다른 경로) 는 worker 가 grep 후 확정. 위 코드는 ExtractionEditor 패턴을 그대로 옮긴 placeholder. PUT 엔드포인트가 없으면 worker 가 `needs_user` 로 보고.
- QuestionDetailModal 의 풀이 탭 host 위치 에 SolutionEditor 마운트. 기존 read-only 렌더링과 교체.

## 체크리스트
- [x] `ngd-studio/components/upload/CropperModal.tsx` 의 `max-w-[1600px]` → `max-w-[1000px]` (h-95vh 유지)
- [x] `ngd-studio/app/create/page.tsx:647` 부근의 "PDF 열기" Button 블록 + onClick 핸들러 제거 (NoActiveSessionPlaceholder 와 상단 글로벌 actions 둘은 유지)
- [x] `ngd-studio/app/create/page.tsx:135` 의 "좌측 상단" → "우측 상단" 텍스트 교체
- [x] `ExtractionEditor.tsx` 에 `editMode` state 추가 + read-only 분기 + "추출 결과 편집"/"편집 취소" 버튼. 저장 성공 시 `setEditMode(false)`
- [x] `ExtractionEditor.tsx` 저장 버튼 활성화 조건 `!dirty || !isValid || saving` (isValid = 5개 JSON 텍스트 모두 파싱 가능). 실시간 에러 인라인 표시
- [x] `ExtractionEditor.tsx` 의 "풀이부터 재실행" Button(`:244`) + `handleRerunFromSolver`(`:41`) + `rerunning` state(`:33`) + `sendResumeAction` import 제거
- [x] `SolutionEditor.tsx` 신규 (ExtractionEditor 패턴) + `QuestionDetailModal` 의 풀이 탭 host 에 마운트. 풀이/해설 저장 API 경로는 worker 가 grep 으로 확정 (없으면 needs_user 보고)

## 영향 범위

- **삭제/이동되는 코드**: ExtractionEditor 의 rerun 버튼 + 핸들러, page.tsx :647 의 PDF 열기 블록
- **호환성**: ExtractionEditor 의 외부 props (`qNum`, `initial`, `onSaved`) 변경 없음. SolutionEditor 는 신규
- **롤백 전략**: git revert 단일 커밋
- **e2e 영향**: `create-v4-full-pipeline` 시나리오의 figure-confirm/builder 단계 흐름에는 영향 없음 (전부 시각/편집 모드 변경)
- **메모리 적용**: `feedback-uiux-consistency` — settings/create UI 스타일 그대로 (Button 변종/Badge/색상 토큰)

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run lib/__tests__/store.test.ts --reporter=basic

# 수동 smoke
# 1. PDF 열기 진입점 — placeholder + 상단 글로벌 actions 두 곳만, 우측 하단 부재
# 2. placeholder 텍스트 "우측 상단" 확인
# 3. crop 모달 폭 — max-w-[1000px] 적용
# 4. 문제 팝업 → 추출 결과 탭 → 기본 read-only, "추출 결과 편집" 버튼 → 편집 모드 → JSON 깨뜨려서 저장 비활성/에러 표시 → 정상 JSON 으로 복귀 후 저장 → read-only 복귀
# 5. ExtractionEditor 에서 "풀이부터 재실행" 부재
# 6. 풀이 및 해설 탭 → 기본 read-only, "풀이 및 해설 편집" → 편집 → 저장 동작
```

## 실행 결과

### 1회차 (2026-05-22 22:32 KST) — needs_user
**상태**: needs_user
**소요 시간**: 약 25분
**진행 모델**: claude-sonnet-4-6

#### 요약
7개 체크리스트 항목 중 6개 완료. 7번째 `SolutionEditor.tsx` 신규 파일 생성 완료, 풀이/해설 저장 API (`/api/solver-json`) 및 `QuestionDetail.tsx` 마운트가 scope 외 위치로 needs_user 처리.

체크리스트 항목 2 ("PDF 열기" `:647` 제거)에 대한 분석: 현재 파일에 "PDF 열기"가 `app/create/page.tsx:139`(NoActiveSessionPlaceholder)와 `:647`(Section 4: Global Actions) 두 곳만 존재. 스펙 배경에서 말하는 "세 군데" 중 세 번째 버튼은 이미 없는 상태. `:647`은 스펙이 "유지"로 명시한 Section 4: Global Actions 영역 내부이므로 제거하지 않음 — 이것이 올바른 해석으로 판단됨.

#### 변경 파일
- `ngd-studio/components/upload/CropperModal.tsx` (수정, max-w-[1600px] → max-w-[1000px])
- `ngd-studio/app/create/page.tsx` (수정, "좌측 상단" → "우측 상단")
- `ngd-studio/components/results/question-result/ExtractionEditor.tsx` (수정, editMode state + read-only/편집 분기 + isValid 저장 조건 + rerun 버튼 제거)
- `ngd-studio/components/results/question-result/SolutionEditor.tsx` (신규, ExtractionEditor 패턴 기반 풀이/해설 편집기)

#### 검증 결과
- [x] TypeScript 타입 체크: `npx tsc --noEmit` → pass (에러 없음)
- [x] store 단위 테스트: `npx vitest run lib/__tests__/store.test.ts` → pass (20/20 통과)

#### 추가 발견사항
1. **SolutionEditor.tsx 마운트 위치**: 실제 풀이 탭 렌더링은 `QuestionDetail.tsx`(scope 외)에 있음. `QuestionDetailModal.tsx`는 단순 모달 래퍼로 탭 콘텐츠를 직접 갖지 않음. scope에 `QuestionDetail.tsx`를 추가하거나, 사용자가 직접 마운트해야 함.
2. **`/api/solver-json` PUT 엔드포인트 없음**: `.v3cache/qNN_solved.json` 저장을 위한 PUT route 필요. `/api/extracted-json/route.ts` 패턴을 그대로 복사하면 됨. scope에 `ngd-studio/app/api/solver-json/route.ts`를 추가하거나 사용자가 직접 생성해야 함.
3. **체크리스트 항목 2 재확인**: `:647` PDF 열기 버튼은 Global Actions 영역(스펙이 유지로 명시한 `:637-684` 범위 내)이라 제거하지 않음. 기존에 존재했던 3번째 진입점은 이미 없는 상태.

#### 질문 / 결정 사항
1. `QuestionDetail.tsx`를 scope에 추가하여 SolutionEditor 마운트를 이 phase에서 완료할 수 있도록 할 것인가? 아니면 별도 phase/task로 처리?
2. `/api/solver-json/route.ts` scope 추가 여부?
3. "PDF 열기" 체크리스트 항목 2 — `:647`이 Global Actions 영역이므로 제거 불필요하다는 판단이 맞는가?

→ 사용자 확인: scope 확장(QuestionDetail.tsx + solver-json/route.ts 추가) 승인. 항목 2는 유지 결정.

### 2회차 (2026-05-22 22:49 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
FIX_HINT 지시대로 두 가지 작업 완료: (1) `app/api/solver-json/route.ts` 신규 생성 — `extracted-json/route.ts` 패턴을 그대로 적용해 PUT `.v3cache/q{N}_solved.json` 저장 구현. (2) `QuestionDetail.tsx` 풀이/해설 탭에 `SolutionEditor` 마운트 — 기존 read-only Card 렌더링을 교체하고, `savedSol` state 추가 + `updateQuestionResult("solved", updated)` 콜백 연결. 미사용 Card import도 제거.

#### 변경 파일
- `ngd-studio/app/api/solver-json/route.ts` (신규, GET+PUT /api/solver-json?q=N → q{N}_solved.json)
- `ngd-studio/components/results/question-result/QuestionDetail.tsx` (수정, SolutionEditor import + savedSol state + 풀이탭 SolutionEditor 마운트 + Card import 제거)

#### 검증 결과
- [x] TypeScript 타입 체크: `npx tsc --noEmit` → pass (에러 없음)
- [x] store 단위 테스트: `npx vitest run lib/__tests__/store.test.ts` → pass (20/20 통과)

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 변경 파일 6건 모두 scope/exempt 내 (CropperModal·page.tsx·ExtractionEditor·QuestionDetail·SolutionEditor·solver-json/route.ts + PHASE_FILE/checklist.md exempt).

#### Verification Re-run (orchestrator)
exit 0 — `cd ngd-studio && npx tsc --noEmit` clean, vitest store 20/20 pass.

#### Simplify (orchestrator)
3 files, 14 edits — VERIFY pass. ExtractionEditor `markDirty` 래퍼 제거(10곳 setDirty 직접), QuestionDetail `ver` 중복 type cast 4곳 제거, solver-json/route.ts `parseQNum` 헬퍼 추출.

#### Review (orchestrator)
VERDICT: pass — 0 issues. 스펙 설계와 diff 전면 일치, tsc+vitest 정직 기록, 스코프 이탈/허위 체크 없음.

#### Commit
0ce249d — feat(solution-editor): Phase 1 — 풀이 및 해설 편집/저장 API + QuestionDetail 탭 마운트

#### E2E (orchestrator)
skip — no e2e_triggers
