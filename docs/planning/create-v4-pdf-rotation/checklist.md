---
task: create-v4-pdf-rotation
phase_count: 5
created: 2026-05-17
---

# create-v4 PDF 회전 지원 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-rotation-coordinate-policy.md](./phase-01-rotation-coordinate-policy.md) | 5 | 5 | 100% | completed | b4c6cef |
| 2 | [phase-02-preview-meta-api-rotation.md](./phase-02-preview-meta-api-rotation.md) | 6 | 6 | 100% | completed | 2e0b15b |
| 3 | [phase-03-cropper-rotation-ui.md](./phase-03-cropper-rotation-ui.md) | 6 | 6 | 100% | completed | e17fb94 |
| 4 | [phase-04-auto-crop-rotation.md](./phase-04-auto-crop-rotation.md) | 5 | 5 | 100% | completed | 3feb073 |
| 5 | [phase-05-extraction-e2e-verification.md](./phase-05-extraction-e2e-verification.md) | 5 | 5 | 100% | completed | e7a6f0d |
| **Total** | | **27** | **27** | **100%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 5
                       └▶ Phase 4 ──┘
```

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 회전 타입과 좌표 정책 확정 | 20분 |
| P0 | Phase 2 | PDF preview/meta API rotation 지원 | 30분 |
| P0 | Phase 3 | cropper UI와 저장 정합성 | 40분 |
| P1 | Phase 4 | 자동 분할 rotation 전달 | 40분 |
| P1 | Phase 5 | 추출 및 회귀 검증 | 25분 |

## 권장 실행 순서

1. Phase 1 → Phase 2 순서로 공통 계약과 API를 먼저 고정한다.
2. Phase 3과 Phase 4는 모두 Phase 2 이후 가능하지만 `CropperWorkspace.tsx` scope가 겹치므로 순차 진행한다.
3. Phase 5에서 수동 검증과 focused 테스트를 마무리한다.

## 검증 체크리스트

### 공통 검증

- [x] `cd ngd-studio && pnpm test` 또는 관련 focused Vitest 통과
- [x] `cd ngd-studio && pnpm build` 통과
- [ ] `/create-v4`에서 180도 회전 후 수동 박스 추출 결과가 화면과 일치
- [ ] `/create-v4`에서 회전 후 자동 분할 결과가 화면과 일치
- [ ] `/pdf-cropper` ZIP 다운로드 회귀 없음

수동 검증 항목 3건은 이 세션에서 실제 브라우저/PDF/Gemini 환경을 조작하지 않아 미확인 상태로 남긴다.

최종 자동 검증:
- `pnpm test` → pass (14 files, 129 tests)
- `pnpm build` → pass

## 관련 문서

- [README](./README.md)
- 기존 cropper 계획: `docs/planning/pdf-region-cropper/`
- 기존 create-v4 통합 계획: `docs/planning/create-v4-cropper-merge/`
