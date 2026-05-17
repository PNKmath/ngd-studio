---
phase: 3
title: Cropper flip UI와 저장 정합성
status: completed
depends_on: [2]
scope:
  - ngd-studio/components/cropper/CropperWorkspace.tsx
intervention_likely: false
intervention_reason: ""
executor: qwen
---

# Phase 3: Cropper flip UI와 저장 정합성

> **범위**: Frontend
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `components/cropper/CropperWorkspace.tsx`

## 배경

`CropperWorkspace`는 직전 작업으로 PDF 공통 `rotation` 상태와 좌/우 회전 컨트롤, rotation별 localStorage key, `/api/pdf-meta`·`/api/pdf-preview` 요청에 rotation 전달, rotation 변경 시 `pageImages`/선택 박스 초기화를 구현했다 (`CropperWorkspace.tsx:33, :54, :100, :287, :324, :347`).

flip을 동일한 라이프사이클로 추가해야 한다.

## 설계

- `CropperWorkspace`에 `flip` 상태(boolean)를 추가, 기본값 `false`.
- 헤더 회전 컨트롤 옆에 좌우 반전 토글 버튼 추가 (아이콘 + 활성 상태 표시).
- flip 변경 시 처리는 rotation 변경 흐름을 모델로 한다:
  - `/api/pdf-meta` 재요청 (flip 전달, width/height는 동일하지만 일관성을 위해 호출)
  - 현재/다음 페이지 preview를 새 flip 값으로 재요청
  - `pageImages` cache를 비우거나 key에 flip 포함
  - `selectedBoxId` 초기화 및 flip별 저장 박스 복원
- localStorage key를 `pdf-cropper:{hash}:rotation:{rot}:flip:{0|1}` 형태로 확장:
  - 기존 `pdf-cropper:{hash}:rotation:{rot}` key는 `rotation === current && flip === false`일 때만 fallback 복원
  - rotation only 호환은 직전 작업에서 이미 처리됨 — 그 위에 flip=false 케이스만 추가로 호환
- `/api/pdf-preview`·`/api/pdf-meta` 요청 body에 항상 flip 포함.
- `cropAllBoxesToBlobs` 등 추출 경로에서 lazy-load 보완 시에도 현재 flip 값으로 preview를 요청.
- `PdfPageCanvas`는 변경 불필요 (현재 rotation을 이미지로 받기만 하는 구조).

## 체크리스트

- [x] `CropperWorkspace`에 `flip` 상태와 토글 버튼 추가
- [x] `/api/pdf-meta`와 `/api/pdf-preview` 요청 body에 `flip` 전달
- [x] flip 변경 시 `pageImages`, `selectedBoxId`, 박스 복원 정책이 일관되게 처리
- [x] localStorage key 또는 payload가 `(rotation, flip)` 쌍을 구분
- [x] 기존 rotation-only 저장 데이터는 `flip=false`에서만 fallback 복원
- [x] `pnpm build` 통과

## 영향 범위

`/create-v4`와 `/pdf-cropper` 모두 `CropperWorkspace`를 공유하므로 두 화면에 동시에 flip UI 노출. 기존 저장 데이터는 flip 미포함 → 자동으로 `flip=false`에 매핑되도록 호환 복원.

## 검증

```bash
cd ngd-studio
pnpm build
```

수동 확인:

1. `/pdf-cropper`에서 PDF 업로드 후 flip 토글 → 미리보기가 좌우 반전됨
2. flip 상태에서 박스 생성/이동/삭제 가능
3. (rotation 90 + flip true) 조합에서도 동일하게 동작
4. 새로고침 또는 같은 PDF 재업로드 시 다른 `(rotation, flip)` 조합의 박스가 섞이지 않음

## 실행 결과

### 1회차 (2026-05-17 KST) — completed

**상태**: completed
**소요 시간**: ~10분
**진행 모델**: claude-sonnet-4-6

#### 요약

`CropperWorkspace`에 `PdfFlip` 상태를 추가하고 회전 컨트롤과 동일한 라이프사이클(meta 재조회, pageImages 초기화, 박스 복원)로 flip 토글 버튼을 구현했다. localStorage key를 `(rotation, flip)` 쌍 키로 확장하고 3단계 fallback(rotation+flip → rotation-only → legacy) 복원을 구현했다.

#### 변경 파일

- `ngd-studio/components/cropper/CropperWorkspace.tsx` — 전체 flip 통합

  주요 변경:
  - `PdfFlip` 타입 import 추가
  - `rotationOnlyLsKey(path, rotation)` 헬퍼 추가 (rotation-only 호환 fallback용)
  - `lsKey` 시그니처 `(path, rotation, flip)` 으로 확장 → key: `pdf-cropper:{hash}:rotation:{rot}:flip:{0|1}`
  - `fetchPdfMeta` 시그니처 `(path, rotation, flip)` 으로 확장 → body에 `flip` 포함
  - `loadStoredBoxes` 시그니처 `(path, rotation, flip)` 으로 확장 + 3단계 fallback 구현
  - `flip` state 추가 (기본값 `false`)
  - `saveToLS` 시그니처 `(path, rot, fl, bxs)` 으로 확장
  - `fetchPage` useCallback deps에 `flip` 추가, `/api/pdf-preview` body에 `flip` 포함
  - `handleFlipToggle()` 함수 추가 — `handleRotate`와 동일한 패턴
  - `handleRotate`, `handleFileChange`, `handleAutoCrop`, `handleClearStorage` 등 모든 flip 연관 경로 갱신
  - 헤더에 `{/* Flip */}` 섹션 추가: 토글 버튼(⇔) + 활성 시 "반전" 레이블

#### 검증 결과

- `npx tsc --noEmit`: 에러 없음
- `pnpm build`: 성공 (all routes compiled)

#### 추가 발견사항

- `handleAutoCrop`의 `/api/auto-crop` 요청 body에 아직 `flip`이 없음 — Phase 4에서 처리 예정 (scope 외이므로 이번 phase에서 수정하지 않음)

#### 질문 / 결정 사항

없음.

#### Scope Audit (orchestrator)
pass — 1 file in scope (CropperWorkspace.tsx)

#### Verification Re-run (orchestrator)
pnpm build exit 0 — pass

#### Simplify (orchestrator)
SIMPLIFIED: 1 (kindFilename: array intermediates → count variables), VERIFY: pass

#### Review (orchestrator)
VERDICT: pass — ISSUES: 0, 스펙 일치 / 3단계 fallback / saveToLS 호출 지점 일관
