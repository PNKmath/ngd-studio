# create-v4 PDF 좌우 반전 지원

## 배경

직전에 완료된 `create-v4-pdf-rotation` 작업으로 90도 단위 PDF 회전이 가능해졌다 (커밋 b4c6cef ~ e7a6f0d). 그러나 일부 스캔 PDF는 단순 회전으로는 정방향이 되지 않고 좌우가 뒤집힌 상태(mirror)로 들어온다. cropper preview/박스/자동 분할/추출이 모두 회전과 동일한 방식으로 좌우 반전을 공유해야 추출 결과가 화면과 일치한다.

## 목표

PDF preview/meta/auto-crop/extract 흐름이 동일한 `(rotation, flip)` 상태를 공유하도록 만든다. 사용자가 회전 + 좌우 반전을 조합해 적용한 뒤 박스를 만들고 자동 분할해도 모든 단계가 같은 좌표계를 본다.

## 합성 정책

`(rotation, flip)`은 **rotation → flip** 순서로 합성한다. 즉 PDF 원본 페이지를 먼저 회전한 뒤, 회전된 이미지의 좌우를 뒤집는다.

- 박스 좌표는 회전·반전이 모두 끝난 후의 이미지 픽셀 좌표계로 유지 (기존 정책 연장).
- 동일 이미지의 x를 mirror하면 `x' = W_rotated - x`. height에는 영향 없음.
- 좌우 반전만 우선 지원 (vertical flip은 범위 외).

## 성공 기준

- `/create-v4`와 `/pdf-cropper`에서 좌우 반전 토글 가능
- 반전 또는 (회전 + 반전) 상태에서 수동 박스 추출 PNG가 화면과 일치
- 동일 상태에서 자동 분할 박스가 화면 위치와 일치
- 기존 rotation-only 흐름과 비회전·비반전 PDF 흐름이 회귀하지 않음

## 제약

- WSL에서 `pnpm install` 금지 (CLAUDE.md). 검증은 `pnpm build`와 focused `npx vitest`만.
- 회전과 마찬가지로 전체 PDF 공통 반전. 페이지별 반전은 범위 외.
- 좌표계는 "회전 후 렌더된 PNG 픽셀 좌표계"를 유지.
- localStorage 저장 데이터는 flip 미포함 버전을 `flip=false`에서만 호환 복원.

## 참고

- 이전 작업: `docs/planning/create-v4-pdf-rotation/` (README + phase-01~05)
- 좌표 helper: `ngd-studio/lib/cropper/coords.ts`
- cropper 상태 관리: `ngd-studio/components/cropper/CropperWorkspace.tsx`
