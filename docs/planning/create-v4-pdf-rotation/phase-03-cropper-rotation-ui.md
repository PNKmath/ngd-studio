---
phase: 3
title: Cropper 회전 UI와 저장 정합성
status: completed
depends_on: [2]
scope:
  - ngd-studio/components/cropper/CropperWorkspace.tsx
  - ngd-studio/components/cropper/PdfPageCanvas.tsx
  - ngd-studio/app/create-v4/page.tsx
  - ngd-studio/app/pdf-cropper/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: Cropper 회전 UI와 저장 정합성

> **범위**: Frontend
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `components/cropper/CropperWorkspace.tsx`

## 배경

`CropperWorkspace`는 PDF 업로드 후 `/api/pdf-meta`, `/api/pdf-preview`를 호출하고, `pageImages` map과 `localStorage`에 상태를 저장한다. 회전값이 이 흐름에 포함되지 않으면 다른 회전 상태의 이미지와 박스가 섞일 수 있다.

## 설계

- `CropperWorkspace`에 전체 PDF 공통 `rotation` 상태를 추가한다.
- 헤더에 90도 단위 회전 컨트롤을 추가한다. 우선 좌회전/우회전 또는 180도 버튼 중 구현 난이도와 UI 일관성에 맞춰 선택하되, 최종적으로 `0/90/180/270` 상태를 표현할 수 있어야 한다.
- rotation 변경 시 `pdf-meta`와 현재/다음 페이지 preview를 새 rotation으로 재요청한다.
- `pageImages` cache map은 rotation 변경 시 비우거나 key에 rotation을 포함해 오염을 막는다.
- localStorage key에는 pdfPath와 rotation을 함께 포함하거나, 저장 payload에 rotation을 넣어 다른 회전값의 box가 자동 복원되지 않게 한다.
- `PdfPageCanvas`는 회전된 이미지의 width/height를 받기만 하면 되도록 유지한다.

## 체크리스트

- [x] `CropperWorkspace`에 `rotation` 상태와 회전 컨트롤 추가
- [x] `/api/pdf-meta` 요청 body에 `rotation` 전달
- [x] `/api/pdf-preview` 요청 body에 `rotation` 전달
- [x] rotation 변경 시 `pageImages`, `selectedBoxId`, 현재 박스 복원 정책이 일관되게 처리
- [x] localStorage 저장/복원 키 또는 payload가 rotation을 구분
- [x] `/create-v4`와 `/pdf-cropper`가 동일 컴포넌트로 회전 UI를 사용할 수 있음

## 영향 범위

`/create-v4`와 `/pdf-cropper` 모두 `CropperWorkspace`를 공유하므로 두 화면에 동시에 회전 UI가 노출된다. 기존 PDF에서 rotation 기본값은 `0`이어야 하며, 기존 저장 데이터가 있다면 rotation 없는 데이터는 `0`으로만 복원하는 것이 안전하다.

## 검증

```bash
cd ngd-studio
pnpm build
```

수동 확인:

1. `/pdf-cropper`에서 PDF 업로드 후 기본 방향으로 박스 생성 가능
2. 회전 버튼 클릭 시 미리보기 치수와 방향 변경
3. 회전 상태에서 박스 생성/이동/삭제 가능
4. 새로고침 또는 같은 PDF 재업로드 시 다른 회전값의 박스가 섞이지 않음

## 실행 결과

### 1회차 (2026-05-17 13:39 KST) — completed
**상태**: completed
**소요 시간**: 약 20분
**진행 모델**: codex

#### 요약
`CropperWorkspace`에 PDF 공통 `rotation` 상태와 좌/우 90도 회전 컨트롤을 추가했다.
`/api/pdf-meta`와 `/api/pdf-preview` 요청에 현재 rotation을 전달하고, 회전 변경 시 메타 재조회, preview cache 초기화, 선택 박스 초기화, rotation별 저장 박스 복원을 수행한다.
localStorage 키는 rotation별로 분리하되 기존 rotation 없는 저장 데이터는 `0°`에서만 fallback 복원한다.

#### 변경 파일
- `ngd-studio/components/cropper/CropperWorkspace.tsx` (수정)
- `docs/planning/create-v4-pdf-rotation/phase-03-cropper-rotation-ui.md` (수정)
- `docs/planning/create-v4-pdf-rotation/checklist.md` (수정)

#### 검증 결과
- [x] production build: `pnpm build` → pass

#### 추가 발견사항
`CropperWorkspace.tsx`에는 phase 시작 전부터 `onPdfSelected` 관련 미커밋 변경이 포함되어 있었다. 같은 파일 내 변경이라 현재 working tree 기준으로 보존했다.

#### 질문 / 결정 사항
없음
