---
phase: 3
title: 박스 인터랙션 캔버스 컴포넌트
status: completed
depends_on: [2]
scope:
  - ngd-studio/components/cropper/PdfPageCanvas.tsx
  - ngd-studio/components/cropper/CropBoxLayer.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: 박스 인터랙션 캔버스 컴포넌트

> **범위**: Frontend (UI 컴포넌트만, 페이지/라우팅 없음)
> **난이도**: M
> **의존성**: Phase 2 (`lib/cropper/types.ts`, `lib/cropper/coords.ts`)
> **영향 파일**: `ngd-studio/components/cropper/` (신규 디렉터리)

## 배경

cropper의 핵심 UX. 사용자가 PDF 페이지 이미지 위에서:
- 빈 공간 드래그 → 새 박스 생성
- 박스 본체 드래그 → 이동
- 8개 핸들 → 리사이즈 (코너 4 + 변 4)
- 클릭 → 선택
- Delete/Backspace → 선택 박스 삭제
- 번호 라벨이 박스 좌상단에 표시

이 컴포넌트는 **자체 상태를 가지지 않는다** — 박스 배열은 부모(Phase 4의 워크스페이스)가 관리하고 props로 내려준다. controlled component 패턴.

## 설계

### `components/cropper/PdfPageCanvas.tsx`

페이지 한 장 단위 컨테이너. PNG 이미지 + 위에 `CropBoxLayer` 오버레이.

```tsx
interface PdfPageCanvasProps {
  pageImageUrl: string;       // /api/pdf-preview 결과 blob URL
  pageIndex: number;
  imageWidth: number;         // 실제 PNG 픽셀 폭 (Phase 1의 page0Width)
  imageHeight: number;
  boxes: CropBox[];           // 이 페이지의 박스만 (부모가 필터링)
  selectedBoxId: string | null;
  onBoxesChange: (boxes: CropBox[]) => void;  // 이 페이지의 박스 전체 (CRUD 결과)
  onSelectBox: (id: string | null) => void;
}
```

- 이미지는 컨테이너 너비에 fit (max-width 기준 비율 유지)
- `displayWidth`, `displayHeight`는 ResizeObserver로 추적 → `lib/cropper/coords.ts`의 `screenToImage`에 전달
- 이미지 위 absolute로 `<CropBoxLayer />` 깔기

### `components/cropper/CropBoxLayer.tsx`

SVG 오버레이로 박스를 그리고 마우스 이벤트 처리.

내부 상태:
- `dragState`: `{ mode: 'create' | 'move' | 'resize-N' | 'resize-NE' ... ; startX, startY; originalBox? }`

이벤트:
- `onMouseDown` 빈 공간 → create 모드, 새 박스 id=crypto.randomUUID() 추가, drag로 w/h 확장
- `onMouseDown` 박스 본체 → move 모드, 해당 박스 선택
- `onMouseDown` 핸들 → resize 모드 (어느 핸들인지 data-attr로 식별)
- `onMouseMove` → drag 진행 (`normalizeBox`, `clampBox` 적용해 부모에 반영)
- `onMouseUp` → drag 종료, 너무 작은 박스(w<5 || h<5)는 자동 삭제
- `onKeyDown` (컨테이너 tabIndex=0) Delete/Backspace → 선택 박스 삭제

박스 렌더:
- `<rect>` 본체 (stroke 2px primary, fill rgba(0,0,255,0.08))
- 선택 시 stroke 3px, 8개 핸들 표시 (`<circle r=6>` × 8)
- `<text>` 좌상단 번호 라벨 (배경 사각형 + 흰 글자)

좌표 변환은 모두 `lib/cropper/coords.ts`의 함수 사용. 컴포넌트 안에서 직접 계산 금지.

## 체크리스트

- [x] `components/cropper/PdfPageCanvas.tsx` 작성 — controlled, ResizeObserver로 displayWidth 추적
- [x] `components/cropper/CropBoxLayer.tsx` 작성 — SVG 기반 박스 렌더
- [x] 빈 공간 드래그로 새 박스 생성 (id=randomUUID, w<5||h<5는 취소)
- [x] 박스 본체 드래그로 이동 + 핸들 8개로 리사이즈
- [x] 클릭으로 선택, Delete/Backspace로 삭제
- [x] 좌표 변환은 모두 `lib/cropper/coords.ts` 함수 사용 (직접 계산 금지)
- [x] `pnpm --filter ngd-studio build` 통과

## 영향 범위

- 신규 디렉터리 `components/cropper/` 추가
- Phase 4가 import하여 워크스페이스 구성
- 기존 `components/upload/QuestionSlotGrid.tsx`는 건드리지 않음 (Phase 5에서 처리)

## 검증

Phase 4가 통합 페이지를 만들기 전에는 직접 mount 테스트가 어렵다 — 빌드 통과 + 코드 리뷰로 확인. Phase 4에서 실제 인터랙션 검증.

```bash
cd /mnt/c/NGD/ngd-studio
pnpm build
```

수동 검증은 Phase 4 완료 시점에서.

#### Scope Audit (orchestrator)
pass — 2 files in scope (`CropBoxLayer.tsx`, `PdfPageCanvas.tsx` 신규, git diff fallback).

#### Verification Re-run (orchestrator)
exit 0 — `cd ngd-studio && pnpm build` 성공.

## 실행 결과

### 1회차 (2026-05-14 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`components/cropper/` 디렉터리를 신규 생성하고 `CropBoxLayer.tsx`와 `PdfPageCanvas.tsx` 두 파일을 작성했다.
`CropBoxLayer`는 SVG 기반으로 박스 create/move/resize(8핸들) 인터랙션과 Delete/Backspace 삭제를 구현했으며, 좌표 변환은 전량 `lib/cropper/coords.ts` 함수에 위임했다.
`PdfPageCanvas`는 ResizeObserver로 displayWidth/displayHeight를 추적하고 `CropBoxLayer`를 absolute overlay로 합성한다.

#### 변경 파일
- `ngd-studio/components/cropper/CropBoxLayer.tsx` (신규, +280줄)
- `ngd-studio/components/cropper/PdfPageCanvas.tsx` (신규, +80줄)

#### 검증 결과
- [x] `pnpm build`: `cd /mnt/c/NGD/ngd-studio && pnpm build` → 컴파일 성공, TypeScript 오류 없음 (exit 0)
- [ ] 실제 인터랙션 수동 검증: Phase 4 통합 페이지 완료 시점으로 연기 (스펙에 명시된 사항)

#### 추가 발견사항
- `create` drag 중 새 박스의 `page` 필드는 0으로 초기화되나, `PdfPageCanvas.handleBoxesChange`에서 `pageIndex`로 덮어씌우므로 문제없음.
- 번호 라벨이 박스 상단 경계에 걸쳐 렌더되는데, Phase 4에서 마진이 필요하면 조정 가능.

#### 질문 / 결정 사항
없음

#### Simplify (orchestrator)
1 file, 1 edit — `CropBoxLayer.tsx`에서 unused HANDLE_DIRS 상수 제거. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass · ISSUES: 0 · 스펙 설계와 구현 완전 일치, 심볼 실존·scope·검증 기록 모두 문제 없음.

#### Commit
`6b8bfa6` — feat(cropper): Phase 3 — CropBoxLayer + PdfPageCanvas 박스 인터랙션 컴포넌트
