---
phase: 1
title: Flip 타입과 좌표 정책
status: completed
depends_on: []
scope:
  - ngd-studio/lib/cropper/types.ts
  - ngd-studio/lib/cropper/coords.ts
  - ngd-studio/lib/cropper/__tests__/coords.test.ts
intervention_likely: false
intervention_reason: ""
executor: qwen-fast
---

# Phase 1: Flip 타입과 좌표 정책

> **범위**: Frontend shared logic
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `lib/cropper/types.ts`, `lib/cropper/coords.ts`

## 배경

직전 작업으로 `PdfRotation` 타입(`0 | 90 | 180 | 270`)과 `normalizePdfRotation`, `getRotatedImageSize` helper가 추가되어 회전된 렌더 이미지의 픽셀 좌표계를 cropper 기준으로 쓰고 있다. 좌우 반전을 도입해도 좌표계 자체는 "rotation → flip 적용 후의 렌더 이미지 픽셀"로 유지해야 한다.

이 phase는 flip 상태를 표현하는 타입과, rotation·flip이 합성된 이후의 박스 좌표 변환 helper를 추가하고 테스트로 계약을 고정한다.

## 설계

- `PdfFlip` 타입을 신규 정의한다. 우선 좌우 반전만 지원하므로 `boolean` (true == 좌우 반전 적용). 추후 vertical 확장 가능성을 위해 alias 형태로 둔다.
- flip은 이미지 dimension에 영향 없음 — `getRotatedImageSize`는 그대로 유지하고, 이를 명시하는 테스트만 추가하면 충분하다.
- 박스 x 좌표 mirror helper를 추가한다. 시그니처 예: `mirrorBoxX(box, imageWidth)` → `{ ...box, x: imageWidth - box.x - box.w }`. y/h는 그대로.
- 합성 순서는 **rotation 먼저 → flip**. 즉 `mirrorBoxX`에 들어가는 `imageWidth`는 `getRotatedImageSize`의 결과 width. 합성 helper로 묶을 필요는 없고, 호출부가 두 단계를 명시적으로 부르는 편을 선호.
- `normalizedBboxToCropBox`는 flip 처리하지 않는다 (Phase 4에서 Gemini 입력 이미지를 이미 flip된 상태로 보내므로 반환 bbox는 이미 flip 좌표계).

## 체크리스트

- [x] `PdfFlip` 타입을 `lib/cropper/types.ts`에 추가
- [x] 박스 x 좌표 mirror helper를 `lib/cropper/coords.ts`에 추가 (시그니처는 `mirrorBoxX` 또는 동등한 이름)
- [x] mirror helper round-trip 테스트 (`mirror(mirror(box)) === box`) 추가
- [x] `getRotatedImageSize`가 flip에 영향받지 않음을 명시하는 테스트 1건 추가
- [x] 기존 `coords.test.ts`의 rotation/round-trip 테스트가 계속 통과

## 영향 범위

좌표계 정책을 정리하는 phase라 UI 동작은 바뀌지 않는다. 이후 API와 UI phase가 이 helper를 사용한다. 회귀 시 helper 추가분만 되돌리면 기존 동작으로 복귀 가능.

## 검증

```bash
cd ngd-studio
npx vitest run lib/cropper/__tests__/coords.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-17 14:12 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`PdfFlip` 타입(`boolean` alias)을 `types.ts`에 추가하고, `mirrorBoxX(box, imageWidth)` helper를 `coords.ts`에 추가했다. 테스트 파일에 `mirrorBoxX` 관련 5건 + `getRotatedImageSize` flip 불변 2건을 추가하고, 기존 22건을 포함해 전체 29건 모두 통과했다.

#### 변경 파일
- `ngd-studio/lib/cropper/types.ts` (수정, +10/-0줄)
- `ngd-studio/lib/cropper/coords.ts` (수정, +19/-0줄)
- `ngd-studio/lib/cropper/__tests__/coords.test.ts` (수정, +61/-0줄)

#### 검증 결과
- [x] vitest coords.test.ts: `npx vitest run lib/cropper/__tests__/coords.test.ts --reporter=basic` → 29 tests passed

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 files in scope (types.ts, coords.ts, coords.test.ts)

#### Verification Re-run (orchestrator)
exit 0 — 29 tests passed

#### Simplify (orchestrator)
SIMPLIFIED: 0, VERIFY: pass — 안전하게 적용할 패턴 없음

#### Review (orchestrator)
VERDICT: pass — ISSUES: 0, 스펙 일치 / 체크리스트 정합 / 회귀 없음
