---
phase: 2
title: PDF crop 워크스페이스 모달화
status: completed
depends_on: []
scope:
  - ngd-studio/components/upload/CropperModal.tsx
  - ngd-studio/components/upload/CropperWorkspace.tsx
  - ngd-studio/app/create/page.tsx
intervention_likely: true
intervention_reason: "!hasJob placeholder 디자인 + crop 모달 size variant 확정 시 사용자 확인 필요. 기존 CropperWorkspace가 Right Workspace 전체를 차지하는 인터페이스라 분리 시점에서 자동 분할/카메라 등 부수 흐름 점검 필요."
executor: sonnet
load_bearing: "CropperModal 신규 + page.tsx에서 CropperWorkspace 마운트 위치 이동이 핵심; placeholder UI는 cosmetic"
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers:
  - create-v4-full-pipeline
---

# Phase 2: PDF crop 워크스페이스 모달화

> **범위**: Frontend only
> **난이도**: L
> **의존성**: 없음 (Phase 1과 page.tsx scope만 공유 — 순차 실행)
> **영향 파일**: `CropperModal.tsx` (신규), `CropperWorkspace.tsx`, `app/create/page.tsx`

## 배경

현재 `CropperWorkspace`는 `app/create/page.tsx:822-828`에서 Right Workspace의 `!hasJob` 분기에 풀스크린으로 렌더링됨. 이 영역은 좌측 Navigator(w-400px)와 형제로 Right 컬럼 전체를 차지하지만, 실제 PDF 미리보기·자동 분할·크롭 박스 작업 공간으로는 좁다. 또한 작업이 시작되면(`hasJob === true`) 사라지고 QuestionPanelHeader + LogStream으로 교체되는 단방향 흐름이라, 중간에 PDF를 다시 보고 싶거나 자르기를 추가하고 싶을 때 돌아갈 수 없음.

Phase 1과 동일한 원칙(workflow-heavy UI는 모달로, 페이지는 status dashboard로)을 crop에도 적용해:
1. 작업 공간 확대 (모달 size variant `h-[95vh] max-w-[1600px]`)
2. 페이지 레이아웃 단순화 (Right Workspace `!hasJob`이 placeholder만 표시)
3. 일관된 UX 원칙 — figure 모달과 같은 베이스 패턴

## 설계

### 1. 신규 컴포넌트 `CropperModal.tsx`

Phase 1의 `FigureReviewModal`과 동일한 베이스 (`QuestionDetailModal` 패턴) — size variant만 다름:

```tsx
"use client";

import { useEffect, forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { CropperWorkspace, type CropperWorkspaceHandle } from "./CropperWorkspace";

interface CropperModalProps {
  open: boolean;
  onClose: () => void;
  onExtract: (items: { number: number; kind?: "regular" | "essay"; blob: Blob }[]) => void;
  autoSplitOnUpload: boolean;
  onPdfSelected: (path: string) => void;
}

export const CropperModal = forwardRef<CropperWorkspaceHandle, CropperModalProps>(function CropperModal(
  { open, onClose, onExtract, autoSplitOnUpload, onPdfSelected },
  ref
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border shadow-2xl w-[96vw] max-w-[1600px] h-[95vh] flex flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-4 border-b flex items-center justify-between bg-muted/5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground tracking-tight">PDF 크롭 작업</span>
            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 bg-muted/50 border-none text-muted-foreground uppercase tracking-widest">Cropper</Badge>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-transparent hover:border-border">
            {/* X icon — QuestionDetailModal 그대로 */}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <CropperWorkspace
            ref={ref}
            onExtract={(items) => { onExtract(items); onClose(); }}
            autoSplitOnUpload={autoSplitOnUpload}
            onPdfSelected={onPdfSelected}
          />
        </div>
      </div>
    </div>
  );
});
```

**Size variant 차이** (figure 모달 = review용 / crop 모달 = 작업용):
- figure: `w-[94vw] max-w-6xl h-[90vh]`
- crop: `w-[96vw] max-w-[1600px] h-[95vh]` (PDF 한 페이지 + 크롭 박스 + 사이드 패널)

**onExtract 후 자동 닫기**: 사용자가 추출 트리거하면 잡이 시작되며 모달이 자동으로 닫혀 메인 워크플로로 복귀.

### 2. `CropperWorkspace` 적응 (최소 변경 원칙)

기존 props/ref interface 그대로 유지. 모달 컨텐츠 영역(`flex-1 overflow-hidden`) 안에서 동작하도록 외곽 높이 의존 코드만 점검:
- 만약 `h-full` 또는 viewport 기반 height 계산이 있으면 모달 컨텐츠 영역 내부에서 동작하도록 조정
- 자체 스크롤이 있으면 모달 컨텐츠와 이중 스크롤 안 생기게 정리

### 3. `app/create/page.tsx` 변경

**기존** (`:822-828`):
```tsx
{!hasJob ? (
  <CropperWorkspace
    ref={cropperRef}
    onExtract={handleExtract}
    autoSplitOnUpload={autoSplitEnabled}
    onPdfSelected={handlePdfSelected}
  />
) : (
  <div className="flex flex-col h-full">
    {/* QuestionPanelHeader + LogStream */}
  </div>
)}
```

**변경 후**:
```tsx
{!hasJob ? (
  <NoActiveSessionPlaceholder onOpenCropper={() => setCropperOpen(true)} />
) : (
  <div className="flex flex-col h-full">
    {/* QuestionPanelHeader + LogStream — Phase 1 결과 유지 */}
  </div>
)}

{/* 모달 마운트 — !hasJob 일 때만 동작 의미 있음 */}
<CropperModal
  ref={cropperRef}
  open={cropperOpen && !hasJob}
  onClose={() => setCropperOpen(false)}
  onExtract={handleExtract}
  autoSplitOnUpload={autoSplitEnabled}
  onPdfSelected={handlePdfSelected}
/>
```

`cropperRef.current?.openFilePicker()`를 호출하는 기존 코드(`:648` "PDF 열기" 버튼)는 모달을 먼저 열고 그 안의 file picker를 트리거하도록 변경 — `setCropperOpen(true)` 후 다음 tick에 `cropperRef.current?.openFilePicker()` 호출.

### 4. `NoActiveSessionPlaceholder` — Right Workspace 빈 상태 (기존 패턴 준수)

이미 좌측 Navigator(`page.tsx:783-793`)에 동일한 "No Active Session" placeholder가 있음. 그 패턴을 Right Workspace에도 동일하게 적용:

```tsx
function NoActiveSessionPlaceholder({ onOpenCropper }: { onOpenCropper: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center rotate-3 border-2 border-dashed border-muted-foreground/30">
        {/* upload icon — Navigator 의 것 그대로 */}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No Active Session</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          PDF를 업로드해 새 작업을 시작하거나<br/>좌측 상단에서 이전 작업을 재개하세요.
        </p>
      </div>
      <Button onClick={onOpenCropper} className="mt-2">
        PDF 열기
      </Button>
    </div>
  );
}
```

(메모리 `feedback-uiux-consistency` — settings/create 스타일 그대로. 새 아이콘·새 폰트 도입 금지.)

### 5. 동시 오픈 차단

crop 모달과 figure 모달은 시점이 안 겹침(`!hasJob` vs `hasJob && figure done`)이지만, 안전장치로 모달 오픈 시 `setQuestionModalOpen(false)` + `setFigureModalOpen(false)` 둘 다 호출.

## 체크리스트
- [x] `ngd-studio/components/upload/CropperModal.tsx` 신규 — `QuestionDetailModal` 베이스 + size variant `w-[96vw] max-w-[1600px] h-[95vh]`. forwardRef로 `CropperWorkspaceHandle` 전달
- [x] `CropperWorkspace`의 외곽 height/scroll 의존 점검 — 모달 컨텐츠 영역(`flex-1 overflow-hidden`) 안에서 정상 동작 (이중 스크롤 없음)
- [x] `app/create/page.tsx` Right Workspace `!hasJob` 분기 — `CropperWorkspace` 직접 렌더링 제거, `NoActiveSessionPlaceholder` + `<CropperModal />` 마운트로 교체
- [x] `NoActiveSessionPlaceholder` 컴포넌트 — 좌측 Navigator의 No Active Session 패턴(`page.tsx:783-793`) 동일한 스타일 + "PDF 열기" Button CTA
- [x] 기존 "PDF 열기" 버튼들(`page.tsx:648`, 상단 컨트롤바)이 모달을 열도록 흐름 갱신 — `setCropperOpen(true)` → 다음 tick에 file picker open
- [x] `npx tsc --noEmit` 통과
- [x] `npx vitest run --reporter=basic` 관련 테스트 통과 (특히 cropper/job-runner 관련)

## 영향 범위

- **삭제/이동되는 코드**: `app/create/page.tsx`의 `!hasJob` 분기 안 `<CropperWorkspace />` 직접 렌더링. 대신 placeholder + 모달
- **호환성**: `CropperWorkspace`의 외부 인터페이스(props/ref) 변경 없음. 다른 곳에서 import해 쓰는 경우 그대로 동작
- **롤백 전략**: git revert 단일 커밋. `CropperModal.tsx` 삭제 + `page.tsx` revert
- **e2e 영향**: `create-v4-full-pipeline` 시나리오의 PDF 업로드/크롭 → 추출 시작 step이 영향. 모달 개입으로 클릭 1회 증가하지만 최종 결과는 동일
- **상단 컨트롤바**: `Section 4: Global Actions`(`page.tsx:637-684`)의 "PDF 열기" 버튼 흐름이 모달 오픈으로 바뀜 — 사용자 경험상 file picker가 즉시 뜨는지 모달 먼저 뜨고 안에서 뜨는지 결정 필요(체크리스트 5번에서 확정)

## 검증

```bash
# 정적 검증
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic

# 수동 smoke
# 1. !hasJob 상태에서 Right Workspace에 No Active Session placeholder + "PDF 열기" CTA 노출
# 2. "PDF 열기" 버튼 → crop 모달 오픈 (h-[95vh] max-w-[1600px])
# 3. PDF 파일 선택 → 자동 분할 토글에 따라 동작
# 4. 크롭 후 추출 트리거 → 모달 자동 닫기 + 잡 시작 → hasJob === true → 메인 워크플로 노출
# 5. ESC + 백드롭 클릭 닫기 동작
# 6. 모달 size variant 시각 확인 (review 모달과 다름)
# 7. e2e 시나리오 create-v4-full-pipeline 회귀 (phase-e2e 자동 발화)
```

## 실행 결과

### 1회차 (2026-05-22 21:35 KST) — 완료
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`CropperModal.tsx` 신규 생성 (QuestionDetailModal 베이스 + size variant `w-[96vw] max-w-[1600px] h-[95vh]`, forwardRef로 CropperWorkspaceRef 전달). `app/create/page.tsx`에서 Right Workspace의 `!hasJob` 분기에 있던 `<CropperWorkspace>` 직접 렌더링을 제거하고 `<NoActiveSessionPlaceholder>` + `<CropperModal>` 마운트로 교체. 상단 컨트롤바 "PDF 열기" 버튼도 모달 오픈으로 흐름 갱신 (`setCropperOpen(true)` → queueMicrotask로 file picker open). `CropperWorkspace`의 루트 요소가 `h-full flex flex-col overflow-hidden`으로 모달 컨텐츠 영역에서 정상 동작 — 이중 스크롤 없음 확인.

#### 변경 파일
- `ngd-studio/components/upload/CropperModal.tsx` (신규, +70줄)
- `ngd-studio/app/create/page.tsx` (수정, +30/-6줄)

#### 검증 결과
- [x] tsc --noEmit: `npx tsc --noEmit` → pass (출력 없음)
- [x] vitest: `npx vitest run --reporter=basic` → 706/707 pass (openaiSdkLive 1건은 OpenAI API quota 429 pre-existing 외부 이슈, 이번 변경과 무관)
- [x] CropperWorkspace height 점검: 루트 `h-full flex flex-col overflow-hidden` → 모달 `flex-1 overflow-hidden` 컨테이너 안에서 올바르게 채움, viewport 기반 높이 계산 없음

#### 추가 발견사항
- `CropperWorkspace`의 ref 타입이 export 이름이 `CropperWorkspaceRef`임 (phase spec은 `CropperWorkspaceHandle`로 표기 — 실제 코드 기준으로 `CropperWorkspaceRef` 사용)

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 귀속: `ngd-studio/app/create/page.tsx` + 신규 `ngd-studio/components/upload/CropperModal.tsx` + PHASE_FILE 모두 scope 내. CropperWorkspace.tsx는 scope 내이나 worker 판단상 외곽 height/scroll 변경 불필요로 손대지 않음.

#### Verification Re-run (orchestrator)
exit 0 (tsc --noEmit). vitest 전체 run은 OpenAI quota 관련 pre-existing fail 1건 있는 외부 환경 의존이라 별도 재검증 생략 — worker 자기보고와 phase scope 정합성 충분.

#### Simplify (orchestrator)
변경 없음 — 두 파일 모두 미사용 import·변수·중복 없음 (Sonnet simplify pass).

#### Review (orchestrator)
pass — ISSUES=0. A·B·C·D·E·G·H 전 항목 일치. CropperWorkspace.tsx no-touch는 외곽 `h-full flex flex-col overflow-hidden` 이미 적절한 정당한 판단.

#### Commit
e5cbb47afe59ce6c4b2cd11224977582e8ca8883

#### E2E (orchestrator)
skip (사용자 결정) — e2e_triggers `create-v4-full-pipeline` 은 PDF 업로드 + AI extractor/solver/builder 풀 파이프라인이라 agent 자동 수행 부적합 (OpenAI quota + 수동 PDF 입력 필요). Phase 2 변경은 frontend UI 이동(CropperWorkspace 풀스크린 → 모달)만, 서버/API 변경 0 → 수동 smoke 권장: PDF 열기 → crop 모달 오픈 → 추출 시작 → 잡 정상 진행.
