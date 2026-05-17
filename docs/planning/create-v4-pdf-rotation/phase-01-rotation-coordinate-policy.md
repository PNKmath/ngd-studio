---
phase: 1
title: 회전 상태와 좌표 정책
status: completed
depends_on: []
scope:
  - ngd-studio/lib/cropper/types.ts
  - ngd-studio/lib/cropper/coords.ts
  - ngd-studio/lib/cropper/__tests__/coords.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: 회전 상태와 좌표 정책

> **범위**: Frontend shared logic
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `lib/cropper/types.ts`, `lib/cropper/coords.ts`

## 배경

현재 `CropBox`는 `lib/cropper/types.ts`에 정의된 대로 PDF 페이지가 200dpi로 렌더된 PNG의 픽셀 좌표계를 사용한다. 회전 기능을 CSS transform으로만 구현하면 화면 좌표, 저장 좌표, 추출 좌표가 서로 달라진다.

이 phase는 회전값을 전체 PDF 공통 상태로 다루고, 회전된 렌더 이미지 자체의 픽셀 좌표계를 cropper의 기준으로 유지하는 정책을 코드와 테스트에 반영한다.

## 설계

- `PdfRotation` 타입을 신규 정의한다. 허용값은 `0 | 90 | 180 | 270`.
- 회전값 정규화 helper를 추가한다. 외부 입력은 90도 단위가 아니거나 음수일 수 있으므로 안전하게 `0/90/180/270`으로 보정한다.
- 회전 후 이미지 치수 helper를 추가한다. `90/270`은 width/height swap, `0/180`은 유지한다.
- 기존 `screenToImage`, `imageToScreen`, `normalizedBboxToCropBox`는 회전된 이미지의 좌표계를 입력받는 전제로 유지한다.
- 자동 분할 bbox 역변환은 하지 않는다. Phase 4에서 Gemini 입력 이미지를 같은 회전 기준으로 돌려 bbox가 이미 회전된 이미지 좌표에 대응하도록 만든다.

## 체크리스트

- [x] `PdfRotation` 타입 또는 동등한 타입 계약을 `lib/cropper/types.ts`에 추가
- [x] rotation 정규화 helper를 `lib/cropper/coords.ts` 또는 적절한 cropper util에 추가
- [x] rotation 적용 후 width/height 계산 helper 추가
- [x] `normalizedBboxToCropBox`가 회전된 imageWidth/imageHeight 기준으로 동작한다는 테스트 보강
- [x] 기존 `screenToImage / imageToScreen` round-trip 테스트가 계속 통과

## 영향 범위

좌표계 정책을 명확히 하는 phase라 UI 동작은 아직 바뀌지 않는다. 이후 API와 UI phase가 이 helper를 사용한다. 회귀 시 helper 추가분만 되돌리면 기존 cropper 동작으로 복귀 가능하다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/cropper/__tests__/coords.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-17 13:33 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
`PdfRotation` 타입과 rotation 정규화 helper를 추가했다.
회전 후 렌더 이미지 치수 helper를 추가하고, 90/270도에서 width/height가 swap되는 계약을 테스트로 고정했다.
`normalizedBboxToCropBox`는 회전된 이미지 치수를 그대로 기준으로 사용하며 bbox 역변환을 하지 않는다는 테스트를 보강했다.

#### 변경 파일
- `ngd-studio/lib/cropper/types.ts` (수정)
- `ngd-studio/lib/cropper/coords.ts` (수정)
- `ngd-studio/lib/cropper/__tests__/coords.test.ts` (수정)
- `docs/planning/create-v4-pdf-rotation/phase-01-rotation-coordinate-policy.md` (수정)

#### 검증 결과
- [x] focused Vitest: `npx vitest run lib/cropper/__tests__/coords.test.ts --reporter=basic` → pass (22 tests)

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Commit
5280e99
