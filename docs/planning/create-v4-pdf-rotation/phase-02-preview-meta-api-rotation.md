---
phase: 2
title: PDF preview/meta API rotation
status: completed
depends_on: [1]
scope:
  - ngd-studio/app/api/pdf-preview/route.ts
  - ngd-studio/app/api/pdf-meta/route.ts
  - ngd-studio/lib/pdf/pdfMeta.ts
  - ngd-studio/lib/pdf/__tests__/pdfMeta.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: PDF preview/meta API rotation

> **범위**: Backend API
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `app/api/pdf-preview/route.ts`, `app/api/pdf-meta/route.ts`

## 배경

`/api/pdf-preview`는 PyMuPDF `get_pixmap()` 결과를 PNG로 캐시하고, `/api/pdf-meta`는 첫 페이지의 렌더 치수를 반환한다. 현재 두 엔드포인트 모두 회전 파라미터가 없어서, 클라이언트에서 회전 상태를 추가해도 실제 이미지와 메타 치수를 맞출 수 없다.

## 설계

- 두 엔드포인트의 JSON body에 `rotation`을 추가한다. 기본값은 `0`.
- 입력값은 Phase 1의 정책과 동일하게 `0/90/180/270`만 허용하거나 정규화한다.
- `/api/pdf-preview`의 cache key에 `rotation`을 포함한다.
- PyMuPDF 경로에서는 page pixmap 생성 시 matrix prerotate 또는 렌더 후 회전을 사용해 실제 PNG 파일 자체를 회전한다.
- macOS Swift fallback도 가능한 범위에서 동일한 회전 출력을 내도록 처리한다.
- `/api/pdf-meta`는 `90/270` 회전에서 `page0Width/page0Height`를 swap해서 반환한다. fallback parser(`readPdfMetaFromBuffer`)도 같은 결과를 낼 수 있어야 한다.

## 체크리스트

- [x] `/api/pdf-preview` POST body에서 `rotation`을 수신하고 검증
- [x] `/api/pdf-preview` cache key가 `pdfPath/page/dpi/rotation` 조합을 포함
- [x] PyMuPDF 렌더 결과 PNG가 rotation에 맞게 실제 회전
- [x] macOS Swift fallback 경로가 rotation을 반영하거나 명시적으로 동일 결과를 보장
- [x] `/api/pdf-meta`가 rotation에 따른 `page0Width/page0Height`를 반환
- [x] `lib/pdf/__tests__/pdfMeta.test.ts`에 90/270도 치수 swap 테스트 추가

## 영향 범위

`components/upload/QuestionSlotGrid.tsx`도 `/api/pdf-preview`를 사용하지만 rotation을 보내지 않으므로 기본값 `0`으로 기존 동작을 유지해야 한다. cache key 변경은 새 캐시 파일을 만들 뿐 기존 파일 삭제는 필요 없다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic
pnpm build
```

필요 시 샘플 PDF로 `/api/pdf-meta`를 직접 호출해 `rotation: 90`에서 width/height가 바뀌는지 확인한다.

## 실행 결과

### 1회차 (2026-05-17 13:36 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: codex

#### 요약
`/api/pdf-preview`와 `/api/pdf-meta`가 `rotation` body 값을 수신하고 숫자 검증 후 `0/90/180/270`으로 정규화하도록 연결했다.
preview cache key에 rotation을 포함했고, PyMuPDF 렌더는 matrix `prerotate`로 실제 PNG를 회전한다.
macOS Swift fallback은 렌더된 CGImage를 회전된 출력 canvas에 다시 그려 동일하게 회전 PNG와 width/height를 반환한다.
`readPdfMetaFromBuffer` fallback도 rotation에 따른 90/270도 치수 swap을 지원한다.

#### 변경 파일
- `ngd-studio/app/api/pdf-preview/route.ts` (수정)
- `ngd-studio/app/api/pdf-meta/route.ts` (수정)
- `ngd-studio/lib/pdf/pdfMeta.ts` (신규)
- `ngd-studio/lib/pdf/__tests__/pdfMeta.test.ts` (신규)
- `docs/planning/create-v4-pdf-rotation/phase-02-preview-meta-api-rotation.md` (수정)

#### 검증 결과
- [x] focused Vitest: `npx vitest run lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic` → pass (3 tests)
- [x] production build: `pnpm build` → pass

#### 추가 발견사항
`ngd-studio/lib/pdf/filenameMeta.ts`와 해당 테스트는 기존 미커밋 파일로 남아 있으며 이번 phase 커밋에는 포함하지 않는다.

#### 질문 / 결정 사항
없음
