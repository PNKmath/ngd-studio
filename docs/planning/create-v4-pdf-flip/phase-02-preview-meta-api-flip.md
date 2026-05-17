---
phase: 2
title: PDF preview/meta API flip
status: completed
depends_on: [1]
scope:
  - ngd-studio/app/api/pdf-preview/route.ts
  - ngd-studio/app/api/pdf-meta/route.ts
  - ngd-studio/lib/pdf/pdfMeta.ts
  - ngd-studio/lib/pdf/__tests__/pdfMeta.test.ts
intervention_likely: false
intervention_reason: ""
executor: qwen
---

# Phase 2: PDF preview/meta API flip

> **범위**: Backend API
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `app/api/pdf-preview/route.ts`, `app/api/pdf-meta/route.ts`

## 배경

두 API는 직전 작업으로 `rotation`을 수신해 PyMuPDF `prerotate` 및 Swift fallback에서 실제 이미지를 회전한다 (`pdf-preview/route.ts:25, :56`, `pdf-meta/route.ts:24, :41`). 좌우 반전을 도입하려면 API가 `flip`을 함께 받고, 렌더 단계에서 회전 적용 후 가로 mirror를 수행해야 한다.

## 설계

- 두 엔드포인트의 JSON body에 `flip: boolean`을 추가한다. 기본값 `false`. 잘못된 타입이면 400.
- `/api/pdf-preview` cache key를 `pdfPath:page:dpi:rotation:flip`으로 확장한다.
- PyMuPDF 경로:
  - rotation 적용은 기존 `prerotate` 유지.
  - 그 뒤 flip이 true면 pixmap을 가로로 뒤집어 PNG로 저장. 옵션:
    - `fitz.Matrix(scale, scale).prerotate(rot)` 결과에 `scale_x = -scale`로 수평 미러를 합성 후 `pretranslate(rotated_width, 0)` 보정.
    - 또는 pixmap PNG를 PIL/`Pixmap.tobytes()` → `PIL.ImageOps.mirror` 후 저장.
  - 어느 쪽이든 결과 PNG의 width/height는 rotation만 적용했을 때와 동일해야 함.
- macOS Swift fallback도 rotation에 이어 horizontal mirror transform (`scaleX = -1, translateX = outWidth`)을 추가.
- `/api/pdf-meta`는 flip을 받아도 `page0Width/page0Height`는 그대로(rotation에만 영향). `readPdfMetaFromBuffer(buffer, dpi, rotation, flip?)`도 동일 결과를 반환하도록 시그니처 확장 또는 명시적 무시.
- `pdfMeta.test.ts`에 "flip 적용 시 dimension 불변" 케이스 추가.

## 체크리스트

- [x] `/api/pdf-preview` POST body에서 `flip`을 수신·검증, 기본값 false
- [x] `/api/pdf-preview` cache key가 `pdfPath/page/dpi/rotation/flip` 조합을 포함
- [x] PyMuPDF 렌더 결과 PNG가 rotation 적용 후 가로로 mirror 됨
- [x] macOS Swift fallback 경로가 동일하게 horizontal mirror를 반영
- [x] `/api/pdf-meta`가 `flip`을 수신해도 width/height는 rotation 기준 그대로 반환
- [x] `lib/pdf/__tests__/pdfMeta.test.ts`에 flip 호출 시 dimension 불변 테스트 추가

## 영향 범위

`components/upload/QuestionSlotGrid.tsx` 등 다른 호출부는 `flip`을 보내지 않으므로 기본값 false로 기존 동작 유지. cache key 변경은 새 캐시 파일을 만들 뿐 기존 파일 삭제 불필요.

## 검증

```bash
cd ngd-studio
npx vitest run lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic
pnpm build
```

가능하면 샘플 PDF로 `/api/pdf-meta`를 호출해 `flip: true`에서 dimension이 그대로인지, `/api/pdf-preview` 결과 PNG가 실제로 좌우 반전됐는지 수동 확인.

## 실행 결과

### 1회차 (2026-05-17 14:17 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`/api/pdf-preview`와 `/api/pdf-meta` 두 엔드포인트에 `flip: boolean` 파라미터를 추가했다. pdf-preview는 cache key를 `pdfPath:page:dpi:rotation:flip`으로 확장하고, PyMuPDF 경로에서 `fitz.Matrix(-1,1).pretranslate(-width, 0)` 미러 행렬을 rotation 행렬에 합성해 PNG를 가로 반전한다. macOS Swift fallback은 rotation 적용 후 `doFlip` 플래그가 true면 `scaleX=-1, translateX=outWidth` 변환을 적용한다. pdf-meta는 flip을 수신해도 dimensions는 rotation 기준 그대로 반환한다. `readPdfMetaFromBuffer`에 `_flip` 옵셔널 파라미터를 추가하고, 테스트 2케이스를 신규 추가했다.

#### 변경 파일
- `ngd-studio/app/api/pdf-preview/route.ts` (수정, +20/-6줄)
- `ngd-studio/app/api/pdf-meta/route.ts` (수정, +5/-1줄)
- `ngd-studio/lib/pdf/pdfMeta.ts` (수정, +2/-1줄)
- `ngd-studio/lib/pdf/__tests__/pdfMeta.test.ts` (수정, +13/-0줄)

#### 검증 결과
- [x] vitest: `npx vitest run lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic` → 5 tests passed
- [x] TypeScript: `npx tsc --noEmit` → no errors

#### 추가 발견사항
Swift fallback의 horizontal mirror 구현은 CGContext의 clip-to-bounds 특성 때문에 이미 그려진 rotated image에 scaleX=-1 transform을 적용해 재그리는 방식을 사용했다. 실제 Swift 실행은 macOS에서만 가능하므로 수동 확인이 필요하다.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 4 files in scope (pdf-preview/route, pdf-meta/route, pdfMeta.ts, pdfMeta.test.ts). noted: unattributed edits to docs/planning/create-v4-merge by another Claude session.

#### Verification Re-run (orchestrator)
vitest exit 0 (5 passed) + pnpm build exit 0 — pass

#### Simplify (orchestrator)
SIMPLIFIED: 1 (pdf-preview/route.ts: removed redundant `flip` alias, used `rawFlip` directly), VERIFY: pass

#### Review (orchestrator)
VERDICT: pass — ISSUES: 0, 스펙 일치 / 회귀 없음

#### Commit
e21a691 — feat(api): Phase 2 — PDF preview/meta API flip support
