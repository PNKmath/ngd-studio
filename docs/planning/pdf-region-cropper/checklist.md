---
task: pdf-region-cropper
phase_count: 5
created: 2026-05-14
---

# PDF 문제 영역 수동 드래그 분할기 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경 요약

시험지 제작 워크플로우에서 사용자가 한 문제씩 캡처해 붙여넣던 작업을 자동화한다. PDF를 업로드하면 페이지별 이미지가 캔버스에 렌더되고, 사용자가 드래그로 문제 영역 박스를 직접 지정한 뒤 일괄 crop해 per-problem PNG로 추출한다. 결과 PNG는 기존 `ngd-exam-extractor` 파이프라인 입력으로 그대로 투입된다.

순수 수동 UX를 먼저 단단히 만들고, 자동 분할(CV/LLM)은 별도 후속 과제로 둔다 — 수동 드래그 자체가 자동화 결과의 보정 레이어로 재사용된다.

## 전략

- **Step 1 (Phase 1~4)**: ngd-studio에 독립 테스트 페이지 `/pdf-cropper` 구현. 결과는 클라이언트 ZIP 다운로드.
- **Step 2 (Phase 5)**: 사용자가 Step 1 동작 검증 → 시험지 제작 페이지의 "문제별 이미지 붙여넣기" 컴포넌트를 cropper로 통합. 결과는 기존 `/api/question-images` POST 흐름을 그대로 사용.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-pdf-meta-endpoint.md](./phase-01-pdf-meta-endpoint.md) | 5 | 5 | 100% | completed | 45b15ae |
| 2 | [phase-02-coords-util.md](./phase-02-coords-util.md) | 7 | 7 | 100% | completed | 36238c0 |
| 3 | [phase-03-crop-box-interactions.md](./phase-03-crop-box-interactions.md) | 7 | 7 | 100% | completed | 6b8bfa6 |
| 4 | [phase-04-cropper-test-page.md](./phase-04-cropper-test-page.md) | 8 | 8 | 100% | completed | 96910dd |
| 5 | [phase-05-create-page-integration.md](./phase-05-create-page-integration.md) | 6 | 0 | 0% | pending | - |
| **Total** | | **33** | **27** | **82%** | | |

## Phase 의존성

```
Phase 1 ─┐
         ├──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5  (5는 intervention 후 진행)
Phase 2 ─┘                  ▲
         (1과 2는 병렬 가능)  │
                            └─ (1도 4 직전까지만 끝나면 됨)
```

- Phase 1, 2는 scope 독립 → 병렬 실행 가능
- Phase 3은 Phase 2의 좌표 유틸/타입에 의존
- Phase 4는 1, 2, 3 모두 완료된 뒤 통합
- Phase 5는 Phase 4의 동작이 사용자에게 검증된 뒤 진행 (intervention)

## 우선순위 / 권장 실행 순서

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 페이지 메타 엔드포인트 (간단, 막힘 풀기) | 10분 |
| P0 | Phase 2 | 좌표 유틸 + 단위 테스트 | 30분 |
| P0 | Phase 3 | 박스 인터랙션 컴포넌트 (핵심) | 1시간 |
| P0 | Phase 4 | 독립 테스트 페이지 통합 | 1시간 |
| P1 | Phase 5 | 시험지 제작 페이지 통합 (검증 후) | 30분 |

권장:
1. Phase 1과 Phase 2를 병렬 실행
2. Phase 3
3. Phase 4 — 여기서 사용자 동작 검증 (Step 1 끝)
4. Phase 5 — intervention 후 진행

## 공통 검증

- [ ] `pnpm --filter ngd-studio build` (ngd-studio 디렉터리에서 `pnpm build`) 통과
- [ ] `pnpm --filter ngd-studio test` (Vitest) 통과
- [ ] 새 라우트 `/pdf-cropper`가 dev 서버에서 200 응답
- [ ] 다중 페이지 PDF (≥3페이지)로 끝까지 동작 — 모든 박스가 정확한 영역으로 crop됨

## 관련 메모

- 기존 `inputs/시험지 제작/question_images/` 명명 규칙: `q01.png`, `q02.png`, … `q30.png` (zero-padded)
- 기존 PDF 렌더 DPI: `pdf-preview` 기본 150 / cropper는 정확도 위해 200dpi 권장
- 자동 분할(자동 박스 제안)은 별도 task — 본 plan에 포함되지 않음
