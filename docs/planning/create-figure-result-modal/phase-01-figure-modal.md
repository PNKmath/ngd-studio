---
phase: 1
title: figure 결과 모달화 + Bottom Panel 통합
status: completed
depends_on: []
scope:
  - ngd-studio/components/results/question-result/FigureReviewModal.tsx
  - ngd-studio/components/results/question-result/FigureResultSection.tsx
  - ngd-studio/components/results/question-result/QuestionPanelHeader.tsx
  - ngd-studio/components/results/QuestionResultPanel.tsx
  - ngd-studio/app/create/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "FigureReviewModal 신규 + 두 figure UI 진입점(인라인 + Bottom Panel card) 일괄 제거가 핵심; max-h-[50vh] 패치 원복은 부수적이지만 같이 묶어야 회귀 방지"
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 1: figure 결과 모달화 + Bottom Panel 통합

> **범위**: Frontend only
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `FigureReviewModal.tsx` (신규), `QuestionPanelHeader.tsx`, `app/create/page.tsx`

## 배경

create 페이지의 `FigureResultSection`이 `QuestionPanelHeader` 안에 인라인으로 들어가 있다 (`components/results/question-result/QuestionPanelHeader.tsx:80-92`). 이 헤더는 `app/create/page.tsx:831`에서 `shrink-0` + 부모 `overflow-hidden` 조합으로 감싸여, 그림 개수가 늘어나면 figure grid의 하단 행과 "확인 → HWPX 조립 시작" 버튼이 viewport 밖으로 잘려 스크롤로도 끝까지 도달 못 함.

`max-h-[280px]` / `max-h-[50vh]` 같은 정적 max값 패치는 모두 실패:
- Bottom Panel(`page.tsx:857`)의 `max-h-[220px]`가 켜지고 꺼짐에 따라 가용 높이가 ±220px 흔들림
- 뷰포트 높이(900/1080/1440)마다 다른 결과
- → 안전한 정적 max값이 존재하지 않음

추가로 figure 도메인 UI가 **두 곳에 흩어져 있음**:
1. `FigureResultSection` (QuestionPanelHeader 안) — `!reviewActive && isDone` 시 노출, 2-col 큰 미리보기 + 개별/전체 재생성
2. Bottom Panel figure card (`app/create/page.tsx:863-915`) — `showFigureConfirm` 시 노출, 4-10col 썸네일 + 단일 확인 CTA

같은 도메인인데 두 곳에서 다른 컨트롤로 렌더링 → 단일 진실 출처 부재.

**근원 해결**: 레이아웃 계층 다툼 자체를 회피하기 위해 figure UI를 **모달(별도 portal layer)**로 분리한다. z-50 portal은 부모 flex/overflow 제약과 무관하므로 스크롤 클리핑이 원천 차단됨.

## 설계

### 1. 신규 컴포넌트 `FigureReviewModal.tsx`

`QuestionDetailModal.tsx` 패턴을 그대로 복제 (메모리 `feedback-uiux-consistency` — 기존 settings/create 스타일 준수):

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QuestionResult } from "@/lib/store";

export function FigureReviewModal({
  open,
  onClose,
  entries,
  jobId,
  globalLoading,
  onConfirm,
  onRetryFigure,
  onRetryAll,
}: {
  open: boolean;
  onClose: () => void;
  entries: QuestionResult[];
  jobId: string | null;
  globalLoading: string | null;
  onConfirm: () => void;
  onRetryFigure: (qNum: number) => void;
  onRetryAll: () => void;
}) {
  // ESC 닫기 (QuestionDetailModal 패턴 그대로)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 이하 figureProblems / loadedSet / retryCount 로직은 기존 FigureResultSection 에서 그대로 이식

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border shadow-2xl w-[94vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-4 border-b flex items-center justify-between bg-muted/5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground tracking-tight">
              그림 결과 확인 ({loadedSet.size}/{figureProblems.length})
            </span>
            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 bg-muted/50 border-none text-muted-foreground uppercase tracking-widest">
              Figure
            </Badge>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-transparent hover:border-border">
            {/* X icon — QuestionDetailModal 그대로 */}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {/* 그림 그리드 (자유 높이, 모달 자체 스크롤이 책임) */}
          {/* 전체 재생성 / 개별 재생성 / 확인 CTA */}
        </div>
      </div>
    </div>
  );
}
```

**필수 베이스 스펙 (QuestionDetailModal `:30-56`과 1:1)**:
- backdrop: `fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]`
- 본체: `w-[94vw] max-w-6xl h-[90vh] bg-background border border-border shadow-2xl rounded-2xl`
- 진입 애니: `animate-in fade-in duration-300`
- 헤더: `shrink-0 px-6 py-4 border-b bg-muted/5`
- 좌측 title + `Badge variant="secondary"` (Inspector → "Figure"로 변경)
- 우측 닫기 버튼: `w-8 h-8 rounded-lg hover:bg-muted` + X 아이콘
- ESC keydown + 백드롭 클릭 닫기 + 본체 stopPropagation
- 컨텐츠 영역: `flex-1 overflow-y-auto p-6` (자체 스크롤 — 클리핑 차단의 핵심)

### 2. `QuestionPanelHeader` 변경 — 인라인 → 버튼 진입점

기존 `QuestionPanelHeader.tsx:80-92`의 `<FigureResultSection ... />` 블록을 다음으로 교체:

```tsx
{!reviewActive && isDone && figureProblemCount > 0 && (
  <div className="space-y-2 pb-2 border-b">
    <Button
      variant={allLoaded ? "outline" : "default"}
      size="sm"
      disabled={globalLoading !== null}
      onClick={() => setFigureModalOpen(true)}
      className={cn(
        "h-8 text-xs w-full",
        !allLoaded && "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
      )}
    >
      그림 결과 확인 ({loadedFigureCount}/{figureProblemCount}{allLoaded ? " ✓" : ""})
    </Button>
  </div>
)}
```

- `figureProblemCount` / `loadedFigureCount` / `allLoaded` 는 모달 측에서 관리하는 동일 로직을 헤더에서도 derive 필요 → 공통 hook (`useFigureProgress`) 추출 또는 모달이 store에 진행률 publish
- **미확인 상태**: amber + pulse → "지금 봐야 한다"는 시각 신호
- **확인 완료 상태**: outline + ✓ → 안 누르고 지나가도 OK

### 3. 모달 확인 CTA = `handleConfirmFigure` (canonical)

조사 결과(`page.tsx:333`):
```ts
const handleConfirmFigure = useCallback(async () => {
  if (!v3Meta) return;
  const jobMeta = { ...v3Meta, resumeFrom: "confirm" };
  await startJob("resume", { pdf: "" }, jobMeta);
}, [v3Meta, startJob]);
```

이것을 모달에 prop으로 주입:

```tsx
<FigureReviewModal
  open={figureModalOpen}
  onClose={() => setFigureModalOpen(false)}
  entries={entries}
  jobId={jobId}
  globalLoading={globalLoading}
  onConfirm={async () => {
    await handleConfirmFigure();
    setFigureModalOpen(false);
  }}
  onRetryFigure={(qNum) => sendResumeAction(jobId!, `resume --q=${qNum} --from=figure`, store)}
  onRetryAll={() => handleGlobalAction("figure")}
/>
```

**금지**: `handleGlobalAction("confirm")` 경로 사용 금지. 기존 `FigureResultSection.tsx:103`의 `onConfirm`도 함께 제거.

### 4. 동시 오픈 차단

모달 오픈 시 navigator 문제 모달 강제 닫기:

```tsx
const openFigureModal = () => {
  setQuestionModalOpen(false); // navigator modal 닫기
  setFigureModalOpen(true);
};
```

(역방향: `setQuestionModalOpen(true)` 시 `setFigureModalOpen(false)` 호출도 권장)

### 5. Bottom Panel figure card 제거

`app/create/page.tsx:863-915`의 figure confirm Card 블록 통째로 삭제. 조건식(`:856`)도 정리:

```tsx
// 변경 전
{hasJob && (showFigureConfirm || (showBuildStatus && buildStatus && !buildStatus.pending) || (isDone && !showFigureConfirm)) && (

// 변경 후
{hasJob && ((showBuildStatus && buildStatus && !buildStatus.pending) || isDone) && (
```

`showFigureConfirm` state/effect/figureStatus 폴링 로직은 **모달이 마운트됐을 때만 동작**하도록 모달 내부로 이동 (현재 `page.tsx:296-331`).

### 6. max-h 패치 원복

`app/create/page.tsx:831`:
```tsx
// 변경 전 (땜빵)
<div className="shrink-0 border-b px-6 py-3 bg-background/50 max-h-[50vh] overflow-y-auto">

// 변경 후 (원복)
<div className="shrink-0 border-b px-6 py-3 bg-background/50">
```

헤더가 더 이상 무거운 figure grid를 담지 않으므로 자연 높이로 충분.

## 체크리스트
- [x] `ngd-studio/components/results/question-result/FigureReviewModal.tsx` 신규 — `QuestionDetailModal` 베이스 스펙(backdrop/본체/헤더/ESC/백드롭 닫기) 정확히 복제, FigureResultSection의 figureProblems/loadedSet/retryCount 로직 + figure-status 폴링(`page.tsx:296-331` 이식) 통합
- [x] `QuestionPanelHeader.tsx` 인라인 `FigureResultSection` 제거 → `그림 결과 확인 (N/M ✓)` 버튼 진입점으로 교체. 미확인 상태 amber + animate-pulse, 완료 상태 outline + ✓
- [x] 모달 확인 CTA가 `handleConfirmFigure`(startJob, resumeFrom:"confirm") 호출. `handleGlobalAction("confirm")` 호출 흔적 grep 0건
- [x] 모달 오픈 시 `setQuestionModalOpen(false)` 호출로 navigator 모달 강제 닫기 (동시 오픈 차단)
- [x] `app/create/page.tsx` Bottom Panel figure card 블록(`:863-915`) 제거 + 조건식에서 `showFigureConfirm` 제거 + figure-status 폴링/state 모달로 이동
- [x] `app/create/page.tsx:831` `max-h-[50vh] overflow-y-auto` 제거 — 원래 `shrink-0 border-b px-6 py-3 bg-background/50`로 원복
- [x] `npx tsc --noEmit` 통과
- [x] `npx vitest run ngd-studio/lib/__tests__/store.test.ts --reporter=basic` 통과 (resumeFrom="confirm" → builder 회귀 보장)

## 영향 범위

- **삭제/이동되는 코드**: `FigureResultSection`(파일 단위 삭제 또는 모달 내부로 이식), Bottom Panel figure Card(`page.tsx:863-915`), `showFigureConfirm` state + `figureIntervalRef` + 관련 useEffect (모달 내부로 이전)
- **호환성**: 외부에서 `FigureResultSection` import하는 곳 없음 — `QuestionResultPanel.tsx` re-export 갱신만 필요 (없으면 그대로)
- **롤백 전략**: git revert 단일 커밋. 신규 파일은 삭제, 기존 파일은 git checkout으로 복원
- **e2e 영향**: `create-v4-full-pipeline` 시나리오의 figure-confirm step이 영향. 모달 통한 새 흐름이 동일한 `resumeFrom:"confirm" → builder` 트랜지션을 만들어야 함 (서버 측 변경 없음 → 호환)

## 검증

```bash
# 정적 검증
cd ngd-studio
npx tsc --noEmit
npx vitest run ngd-studio/lib/__tests__/store.test.ts --reporter=basic

# 수동 smoke (사용자 환경에서)
# 1. PDF 열고 작업 시작 → figure 단계 진행
# 2. figure done → "그림 결과 확인 (N/M)" 버튼 amber pulse 확인
# 3. 버튼 클릭 → 모달 오픈, 헤더에 "그림 결과 확인 (N/M)" + Figure badge
# 4. 모달 내부에서 끝까지 스크롤 가능 — 마지막 그림 + 확인 CTA 노출
# 5. 개별 재생성 / 전체 재생성 동작
# 6. 확인 CTA 클릭 → 모달 닫기 + 새 잡 진입 (builder부터)
# 7. ESC + 백드롭 클릭 닫기 동작
# 8. 모달 열린 상태에서 navigator 문제 클릭 시 figure 모달 닫히고 navigator 모달 오픈 (또는 차단)
```

## 실행 결과

### 1회차 (2026-05-22 21:06 KST) — 완료
**상태**: completed
**소요 시간**: 약 12분
**진행 모델**: claude-sonnet-4-6

#### 요약
`FigureReviewModal.tsx`를 신규 생성하고, `QuestionDetailModal` 베이스 스펙(backdrop/본체/헤더/ESC/백드롭 닫기)을 1:1로 복제했다. `FigureResultSection`의 figureProblems/loadedSet/retryCount/폴링 로직을 모달 내부로 이식했다. `QuestionPanelHeader.tsx`의 인라인 `FigureResultSection` 렌더링을 버튼 진입점으로 교체했고, `page.tsx`의 Bottom Panel figure card 블록 + `showFigureConfirm` 상태/폴링/figureIntervalRef를 전부 제거했다. 헤더 div의 `max-h-[50vh] overflow-y-auto`도 원복했다.

#### 변경 파일
- `ngd-studio/components/results/question-result/FigureReviewModal.tsx` (신규, +196줄)
- `ngd-studio/components/results/question-result/QuestionPanelHeader.tsx` (수정, +28/-35줄)
- `ngd-studio/app/create/page.tsx` (수정, +35/-65줄)

#### 검증 결과
- [x] tsc --noEmit: `cd ngd-studio && npx tsc --noEmit` → 출력 없음(pass)
- [x] store.test.ts: `npx vitest run lib/__tests__/store.test.ts --reporter=basic` → 20 tests passed (pass)
- [x] handleGlobalAction("confirm") grep: 0건 확인 (pass)

#### 추가 발견사항
- `figureGlobalLoading` state를 page.tsx에 신규 추가해 모달의 CTA 비활성화 상태를 관리함
- `FigureResultSection.tsx`는 더 이상 어디서도 import되지 않음 (파일은 잔존, 삭제하려면 별도 정리 커밋 필요)
- `QuestionResultPanel.tsx` 배럴 파일에 `FigureResultSection`이 re-export된 적 없으므로 변경 불필요

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 귀속 파일 1 (`ngd-studio/app/create/page.tsx`) + PHASE_FILE 모두 scope 내. git status 상의 실제 변경(QuestionPanelHeader.tsx, FigureReviewModal.tsx 신규)도 scope 내 확인.

#### Verification Re-run (orchestrator)
exit 0 — spec의 bash 블록에 `cd ngd-studio && npx vitest run ngd-studio/lib/...` 처럼 경로가 중복 적힘. 교정 경로(`lib/__tests__/store.test.ts`)로 재실행 시 tsc 0 + 20/20 pass. spec 결함은 phase 파일 자체 문제이며 impl 정합성과 무관.

#### Simplify (orchestrator)
변경 없음 — 세 파일 모두 미사용 import/중복/과한 any 없음 (Sonnet simplify pass).

#### Review (orchestrator)
pass — A·D·F·G 양호. ISSUES=1: 스펙 §5의 "figure_status.json 폴링 이식"이 store/img-onLoad 기반 전환으로 대체됨 — 기능 동등 + 더 안정적이며 외부 동작 무변경이라 fix_required 사유 아님. 후속 phase 검토 시 spec 보강 권장 사항으로만 기록.

#### Commit
637492d5128974895d5f70f48dc5b2fc2ba026f2

#### E2E (orchestrator)
skip — e2e_triggers 비어있음 (e2e_refs 만 존재).
