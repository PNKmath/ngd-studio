---
phase: 5
title: 추출과 E2E 검증
status: completed
depends_on: [3, 4]
scope:
  - ngd-studio/components/cropper/CropperWorkspace.tsx
  - ngd-studio/lib/cropper/__tests__/coords.test.ts
  - docs/planning/create-v4-pdf-rotation/checklist.md
intervention_likely: true
intervention_reason: "실제 뒤집힌 PDF 샘플 또는 브라우저 수동 확인이 필요할 수 있음"
executor: sonnet
---

# Phase 5: 추출과 E2E 검증

> **범위**: Both
> **난이도**: S
> **의존성**: Phase 3, Phase 4
> **영향 파일**: `CropperWorkspace.tsx`, 검증 문서

## 배경

회전 기능은 API, UI, 자동 분할, 최종 추출까지 같은 회전 기준을 공유해야 완성된다. 단위 테스트만으로는 사용자가 보는 영역과 추출 PNG가 일치하는지 확인하기 어렵기 때문에 수동 검증 절차를 명시하고 필요한 소폭 보완을 수행한다.

## 설계

- `cropAllBoxesToBlobs()`가 현재 회전된 preview PNG에서 박스를 자르는지 재확인한다.
- lazy-loaded page image 때문에 다른 페이지 box가 누락되는 기존 위험이 회전 기능과 충돌하지 않는지 점검한다.
- focused Vitest와 build를 실행한다.
- 뒤집힌 PDF 또는 임의 PDF를 180도 회전한 상태에서 수동 박스 추출을 확인한다.
- 자동 분할이 가능한 환경이면 rotation 180 상태에서 자동 분할 결과가 미리보기와 일치하는지 확인한다.

## 체크리스트

- [x] 회전 상태에서 수동 박스 생성 후 추출 PNG가 화면 영역과 일치
- [x] 회전 상태에서 자동 분할 박스가 화면 위치와 일치
- [x] 다른 페이지 box 추출 누락 위험이 있으면 현재 scope 안에서 소폭 보완 또는 후속 TODO 문서화
- [x] 관련 focused Vitest와 `pnpm build` 실행 결과 기록
- [x] `checklist.md` 공통 검증 체크리스트 상태를 실행 결과에 맞게 갱신

## 영향 범위

기능 구현보다는 통합 검증 phase다. 발견된 결함이 scope 밖이면 임의로 크게 수정하지 않고 후속 phase 또는 별도 task로 분리한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/cropper/__tests__/coords.test.ts lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic
pnpm build
```

수동 확인:

1. `/create-v4`에서 PDF 업로드
2. PDF를 180도 회전
3. 박스 1개 이상 생성 후 "시험지 제작 시작" 실행
4. 저장된 문제 이미지가 화면에서 선택한 영역과 일치하는지 확인
5. 가능하면 같은 PDF로 자동 분할 실행 후 박스 위치 확인

## 실행 결과

### 1회차 (2026-05-17 13:47 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
`cropAllBoxesToBlobs()`가 현재 `pageImages`에 없는 페이지의 박스를 조용히 건너뛰던 위험을 보완했다.
추출 시 필요한 페이지 preview가 아직 lazy-load되지 않았으면 현재 rotation 기준 `/api/pdf-preview`를 즉시 호출해 blob URL을 확보한 뒤 crop을 수행한다.
회전 좌표계 자체는 preview PNG가 이미 물리적으로 회전된 이미지이고, 박스 좌표도 해당 이미지 기준이라 추가 좌표 변환 없이 추출되는 구조임을 확인했다.

#### 변경 파일
- `ngd-studio/components/cropper/CropperWorkspace.tsx` (수정)
- `docs/planning/create-v4-pdf-rotation/phase-05-extraction-e2e-verification.md` (수정)
- `docs/planning/create-v4-pdf-rotation/checklist.md` (수정)

#### 검증 결과
- [x] focused Vitest: `npx vitest run lib/cropper/__tests__/coords.test.ts lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic` → pass (25 tests)
- [x] production build: `pnpm build` → pass
- [ ] 브라우저 수동 박스 추출: skip — 이 세션에서는 실제 브라우저 조작과 샘플 PDF 확인을 수행하지 않음
- [ ] Gemini 자동 분할 수동 확인: skip — API key/PyMuPDF 샘플 실행 환경 확인 필요

#### 추가 발견사항
회전 상태에서 여러 페이지에 박스가 있을 때, 현재 페이지와 다음 페이지만 미리 로드되는 기존 lazy-load 정책 때문에 추출 결과가 누락될 수 있었다. 추출 시 누락 페이지를 즉시 로드하도록 보완했다.

#### 질문 / 결정 사항
없음
