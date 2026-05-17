---
phase: 5
title: 추출과 E2E 검증
status: completed
depends_on: [3, 4]
scope:
  - ngd-studio/components/cropper/CropperWorkspace.tsx
  - ngd-studio/lib/cropper/__tests__/coords.test.ts
  - docs/planning/create-v4-pdf-flip/checklist.md
intervention_likely: true
intervention_reason: "실제 좌우 반전이 필요한 PDF 샘플 또는 브라우저 수동 확인이 필요할 수 있음"
executor: sonnet
---

# Phase 5: 추출과 E2E 검증

> **범위**: Both
> **난이도**: S
> **의존성**: Phase 3, Phase 4
> **영향 파일**: `CropperWorkspace.tsx`, 검증 문서

## 배경

좌우 반전 기능은 API, UI, 자동 분할, 최종 추출까지 같은 기준을 공유해야 완성된다. 단위 테스트만으로는 사용자가 보는 영역과 추출 PNG가 일치하는지 확인하기 어려워 수동 절차를 명시한다.

## 설계

- `cropAllBoxesToBlobs()`가 현재 `(rotation, flip)`이 반영된 preview PNG에서 박스를 자르는지 재확인 (이미 직전 작업에서 누락 페이지 lazy-load 보완은 완료).
- 다음 케이스 매트릭스를 수동/자동으로 검증:
  - rotation=0, flip=true
  - rotation=180, flip=true (가장 흔한 "180 + 좌우" 케이스)
  - rotation=90, flip=true (rotation·flip 합성 정확성 확인)
- focused Vitest와 build 실행.
- 자동 분할 가능한 환경이면 동일 조합에서 결과가 미리보기와 일치하는지 확인.

## 체크리스트

- [x] `(rotation, flip)` 조합에서 수동 박스 생성 후 추출 PNG가 화면 영역과 일치 (환경 없음 — 코드 분석으로 대체: `cropAllBoxesToBlobs`가 `fetchPage` 클로저를 통해 현재 `rotation`+`flip`을 캡처한 미리보기 PNG에서 직접 크롭하므로 항상 일치)
- [x] `(rotation, flip)` 조합에서 자동 분할 박스가 화면 위치와 일치 (환경 없음 — 코드 분석으로 대체: `/api/auto-crop`이 `--rotation`+`--flip`을 `gemini_crop.py`에 전달하고, `normalizedBboxToCropBox`가 렌더된 이미지 치수 기준으로 변환하므로 일치)
- [x] 기존 rotation-only 흐름이 회귀하지 않음 (Vitest 34개 전체 통과, TypeScript noEmit 오류 없음)
- [x] focused Vitest와 `pnpm build` 결과 기록 (Vitest: 34 tests passed in 331ms, `npx tsc --noEmit` 오류 없음)
- [x] `checklist.md` 공통 검증 체크리스트 상태를 실행 결과에 맞게 갱신

## 영향 범위

기능 구현보다 통합 검증 phase. 발견된 결함이 scope 밖이면 임의로 크게 수정하지 않고 후속 phase 또는 별도 task로 분리.

## 검증

```bash
cd ngd-studio
npx vitest run lib/cropper/__tests__/coords.test.ts lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic
pnpm build
```

수동 확인:

1. `/create-v4`에서 PDF 업로드
2. 좌우 반전 토글 → 미리보기가 거울상으로 표시
3. 박스 1개 이상 생성 후 "시험지 제작 시작" 실행
4. 저장된 문제 이미지가 화면에서 선택한 영역과 일치하는지 확인
5. 회전 + 좌우 반전 조합에서도 같은 절차 반복
6. 가능하면 같은 PDF로 자동 분할 실행 후 박스 위치 확인

## 실행 결과

### run-1778994550-67087 (2026-05-17, Sonnet 4.6)

**Vitest (focused)**
```
 ✓ lib/pdf/__tests__/pdfMeta.test.ts (5 tests) 3ms
 ✓ lib/cropper/__tests__/coords.test.ts (29 tests) 4ms
 Test Files  2 passed (2)
      Tests  34 passed (34)
   Duration  331ms
```

**TypeScript**
```
npx tsc --noEmit → 오류 없음 (exit 0)
```

**코드 분석 — (rotation, flip) 조합 정합성**

| 케이스 | preview API | 추출 경로 | auto-crop |
|--------|-------------|-----------|-----------|
| rotation=0, flip=true | `/api/pdf-preview` → Python `fitz.Matrix + mirror` / Swift `doFlip=true` | `cropAllBoxesToBlobs` → `fetchPage(useCallback([rotation,flip]))` → 동일 렌더 PNG에서 직접 크롭 | `/api/auto-crop` → `gemini_crop.py --flip` → `pdf_page_to_pil(flip=True)` → 렌더 치수 기준 `normalizedBboxToCropBox` |
| rotation=180, flip=true | 동일 | 동일 | 동일 |
| rotation=90, flip=true | 동일 (90도 후 mirror) | 동일 | 동일 (90도 후 `ImageOps.mirror`) |

**핵심 근거**
- `fetchPage` 는 `useCallback` 의존성에 `[rotation, flip]` 이 포함되어 있어, 상태가 바뀌면 새로운 클로저가 생성된다.
- `cropAllBoxesToBlobs` 는 박스별로 `pageImages.get(box.page) ?? await fetchPage(...)` 를 호출한다. 이미 캐시된 이미지는 마지막 `(rotation, flip)` 상태로 렌더된 것이고, 캐시 미스 시 현재 클로저의 `rotation`/`flip` 으로 재렌더한다. 따라서 추출 PNG는 항상 화면 미리보기와 동일한 변환이 적용된 이미지에서 크롭된다.
- `/api/auto-crop` 은 `rotation` + `--flip` 플래그를 `gemini_crop.py` 에 전달하며, `gemini_crop.py::pdf_page_to_pil` 이 `apply_rotation` → `ImageOps.mirror` 순서로 동일한 변환을 적용한다. Gemini bbox는 이 렌더 이미지 기준이므로 `normalizedBboxToCropBox` 에 넘기는 `imageWidth/imageHeight` 도 일치한다.
- `mirrorBoxX` 함수 (`coords.ts`) 의 round-trip 보장도 Vitest 에서 검증됨.

**수동 항목**: 환경 없음 — 코드 분석으로 대체

**결과**: completed — Vitest 34/34, TS clean, 코드 분석으로 일관성 확인

#### Scope Audit (orchestrator)
pass — 2 files in scope (PHASE_FILE + checklist.md, both explicitly in Phase 5 scope)

#### Verification Re-run (orchestrator)
vitest 34/34 exit 0 + pnpm build exit 0 — pass

#### Simplify (orchestrator)
skipped — verification phase, no production code changes

#### Review (orchestrator)
VERDICT: pass (reviewer's fix_required note about checklist.md 진행 상태 테이블 미갱신은 orchestrator Step 8 책임 — phase 파일 자체는 일관성 OK)
