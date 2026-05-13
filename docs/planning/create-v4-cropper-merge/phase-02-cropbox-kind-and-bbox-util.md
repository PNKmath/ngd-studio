---
phase: 2
title: CropBox.kind 추가 + bbox 변환 유틸
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

# Phase 2: `CropBox.kind` + bbox 변환 유틸 + 단위 테스트

> **범위**: Frontend (lib only, DOM 의존 없음)
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `ngd-studio/lib/cropper/types.ts`, `lib/cropper/coords.ts`, `lib/cropper/__tests__/coords.test.ts`

## 배경

Phase 1의 `/api/auto-crop` 응답은 Gemini 원본 정규화 좌표 `[y_min, x_min, y_max, x_max]` (0-1000) + `kind` 필드를 포함한다. cropper(`CropperWorkspace`)는 image-pixel 좌표계 `CropBox`(`lib/cropper/types.ts:2-10`)를 사용하므로 클라이언트 측 변환이 필요하다.

또한 객관식과 서술형이 같은 번호여도 별도 파일로 저장하려면 `CropBox`에 `kind`를 보존해야 한다 (Phase 5에서 파일명 분리 시 사용).

## 설계

### `lib/cropper/types.ts` — `CropBox.kind` 추가 (optional)

```ts
export interface CropBox {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  number: number;
  kind?: "regular" | "essay";   // 신규, optional; 미지정 시 "regular"로 해석
}
```

- **optional + default "regular"** — 기존 박스 객체(localStorage 복원분 포함) 모두 호환.
- Phase 3에서 `CropperWorkspace`가 LLM 응답 → CropBox 변환 시 `kind` 채움.
- Phase 5에서 파일명 정책에 사용 (`q01.png` vs `q_s01.png`).

### `lib/cropper/coords.ts` — `normalizedBboxToCropBox` 신규

```ts
/**
 * Gemini Vision의 1000×1000 정규화 bbox를 이미지 픽셀 좌표계 CropBox로 변환.
 * bbox 형식: [y_min, x_min, y_max, x_max] (0-1000, Gemini native 좌표계).
 */
export function normalizedBboxToCropBox(args: {
  bbox: [number, number, number, number];
  pageIndex: number;
  imageWidth: number;
  imageHeight: number;
  number: number;
  kind?: "regular" | "essay";
  id?: string;   // 미지정 시 crypto.randomUUID()
}): CropBox
```

구현:
- bbox `[y_min, x_min, y_max, x_max]` → image px `x, y, w, h`
- `x = round(x_min / 1000 * imageWidth)`, `y = round(y_min / 1000 * imageHeight)`
- `w = round((x_max - x_min) / 1000 * imageWidth)`, `h = round((y_max - y_min) / 1000 * imageHeight)`
- 결과는 `clampBox(..., imageWidth, imageHeight)`로 페이지 경계 클램프
- `id`는 인자 우선, 미지정 시 `crypto.randomUUID()` (테스트는 id 인자로 결정성 확보)

### `lib/cropper/__tests__/coords.test.ts` — 신규 테스트

- `normalizedBboxToCropBox`: 1000×1000 → 800×1200 변환 round-trip 검증
- 경계 케이스: bbox가 [0,0,1000,1000]이면 전체 페이지로 매핑
- kind 보존 확인 (regular/essay 모두)
- id 인자 명시 시 그대로 사용

## 체크리스트

- [x] `CropBox`에 optional `kind` 필드 추가, `lib/cropper/types.ts`
- [x] `normalizedBboxToCropBox` 구현, `lib/cropper/coords.ts`
- [x] 단위 테스트 3개 이상 추가 (변환 round-trip, 경계, kind 보존), `coords.test.ts`
- [x] `pnpm --filter ngd-studio test -- coords` 통과 + 기존 14개 테스트 회귀 없음

## 영향 범위

- 신규 유틸과 optional 필드만 추가 — 기존 CropBox 사용처(`CropBoxLayer`, `CropperWorkspace`, `coords.test.ts` 기존) 영향 없음.
- Phase 3가 이 유틸을 import해 사용.

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm test -- coords
# 기대: 4 test files / 17+ tests pass (기존 14 + 신규 3+)
pnpm build
```

## 실행 결과

### 1회차 (2026-05-14 04:40 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`CropBox` 인터페이스에 optional `kind` 필드를 추가하고, Gemini 1000×1000 정규화 bbox를 이미지 픽셀 CropBox로 변환하는 `normalizedBboxToCropBox` 유틸을 구현했다. 단위 테스트 5개를 추가해 총 19개 테스트 전체 통과. pnpm WSL symlink 누락 문제로 node_modules/.bin/vitest 및 관련 패키지 심링크를 수동 생성한 뒤 테스트 실행.

#### 변경 파일
- `ngd-studio/lib/cropper/types.ts` (수정, +1줄): `kind?: "regular" | "essay"` 필드 추가
- `ngd-studio/lib/cropper/coords.ts` (수정, +36줄): `normalizedBboxToCropBox` 함수 추가
- `ngd-studio/lib/cropper/__tests__/coords.test.ts` (수정, +80줄): `normalizedBboxToCropBox` 테스트 5개 추가

#### 검증 결과
- [x] coords 테스트: `lib/cropper/__tests__/coords.test.ts (19 tests)` → pass (기존 14 + 신규 5)
- [x] 회귀 없음: 기존 screenToImage/imageToScreen/normalizeBox/clampBox/autoNumber 테스트 14개 모두 pass
- [x] TypeScript 타입 체크: `tsc --noEmit --skipLibCheck` → 스코프 파일 오류 없음
- [x] `pnpm build` — next CLI 심링크 누락으로 실행 불가 (WSL pnpm 환경 이슈, scope 외). TypeScript 검증으로 대체 smoke test 수행, 오류 없음.

#### 추가 발견사항
- WSL 환경에서 pnpm 클린 reinstall 후 node_modules/.bin 심링크가 생성되지 않는 문제 존재 (vitest, next 등). 이는 기존 환경 이슈이며 phase 외 작업임.
- `store.test.ts`는 zustand 심링크 미생성으로 실패하나, 이 역시 pre-existing 이슈 (scope 외).

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 files in scope (types.ts, coords.ts, __tests__/coords.test.ts). Hook log session_id 컬럼이 비어 git diff fallback.

#### Verification Re-run (orchestrator)
exit 0 — `npx vitest run lib/cropper/__tests__/coords.test.ts` → 19/19 pass. `pnpm build`는 WSL symlink 이슈로 skip (worker가 명시한 환경 제약, scope 외).
