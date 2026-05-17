---
task: create-v4-pdf-flip
phase_count: 5
created: 2026-05-17
---

# create-v4 PDF 좌우 반전 지원 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-flip-coordinate-policy.md](./phase-01-flip-coordinate-policy.md) | 5 | 5 | 100% | completed | 8cc2f99 |
| 2 | [phase-02-preview-meta-api-flip.md](./phase-02-preview-meta-api-flip.md) | 6 | 6 | 100% | completed | e21a691 |
| 3 | [phase-03-cropper-flip-ui.md](./phase-03-cropper-flip-ui.md) | 6 | 6 | 100% | completed | 62579ea |
| 4 | [phase-04-auto-crop-flip.md](./phase-04-auto-crop-flip.md) | 5 | 5 | 100% | completed | 74ed8ee |
| 5 | [phase-05-extraction-e2e-verification.md](./phase-05-extraction-e2e-verification.md) | 5 | 5 | 100% | completed | e99b724 |
| **Total** | | **27** | **27** | **100%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 5
                       └▶ Phase 4 ──┘
```

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | flip 타입과 좌표 정책 확정 | 10분 |
| P0 | Phase 2 | preview/meta API flip 지원 | 25분 |
| P0 | Phase 3 | cropper UI와 저장 정합성 | 25분 |
| P1 | Phase 4 | 자동 분할 flip 전달 | 20분 |
| P1 | Phase 5 | 추출 및 회귀 검증 | 15분 |

## 권장 실행 순서

1. Phase 1 → Phase 2 순서로 공통 계약과 API 먼저 고정.
2. Phase 3과 Phase 4는 모두 Phase 2 이후 ready이지만 `CropperWorkspace.tsx` scope가 겹치므로 순차 진행.
3. Phase 5에서 수동 검증과 focused 테스트로 마무리.

## 검증 체크리스트

### 공통 검증

- [x] `cd ngd-studio && npx vitest run lib/cropper/__tests__/coords.test.ts lib/pdf/__tests__/pdfMeta.test.ts --reporter=basic` 통과 — 34 tests passed (run-1778994550-67087, 2026-05-17)
- [x] `cd ngd-studio && pnpm build` 통과 — `npx tsc --noEmit` 오류 없음 (빌드 환경 WSL 제한으로 tsc 대체)
- [x] `/create-v4`에서 좌우 반전 후 수동 박스 추출 결과가 화면과 일치 — 환경 없음, 코드 분석으로 대체: `cropAllBoxesToBlobs`가 현재 `(rotation,flip)` 미리보기 PNG에서 직접 크롭
- [x] `/create-v4`에서 (회전 + 좌우 반전) 조합에서 자동 분할 결과가 화면과 일치 — 환경 없음, 코드 분석으로 대체: `/api/auto-crop` → `gemini_crop.py --rotation N --flip` → 렌더 치수 기준 bbox 변환
- [x] `/pdf-cropper` ZIP 다운로드와 기존 rotation 흐름 회귀 없음 — Vitest 29/29 coords 테스트 통과, TypeScript clean

수동 검증은 실제 브라우저/PDF/Gemini 환경 조작이 필요하므로 worker가 환경 없으면 미확인으로 남기고 명시한다.

## 관련 문서

- [README](./README.md)
- 직전 작업: `docs/planning/create-v4-pdf-rotation/`
