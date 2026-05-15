---
task: create-v4-cropper-merge
phase_count: 5
created: 2026-05-14
---

# create-v4 + PDF-CROPPER UI 통합 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경 요약

사이드바 "PDF 자동크롭" → `/create-v4`는 Gemini Vision으로 PDF 문제를 자동 분할하지만, 결과는 썸네일 그리드일 뿐 좌표 조정 UI가 없어 LLM이 잘못 자른 경우 수정이 매우 힘들다.

방금 phase-run으로 완성된 PDF-CROPPER (`CropperWorkspace` + `CropBoxLayer` + `PdfPageCanvas` + `lib/cropper/*`)는 박스 드래그/이동/리사이즈/삭제 + 박스 리스트 DnD 재정렬을 지원한다.

본 task는 두 흐름을 통합한다 — LLM이 박스 **좌표만** 추출(PNG 저장 안 함) → cropper UI에 초기 박스로 주입 → 사용자가 드래그로 조정 → 최종 결과를 **`/api/question-images` POST**로 직결해 기존 시험지 제작(extractor) 파이프라인 계속.

## 핵심 결정

- **Phase 4 "추출 실행" 동작**: `/api/question-images` POST 직결 (시험지 제작 계속). ZIP 다운로드는 기존 `/pdf-cropper` 페이지가 담당.
- **객관식/서술형 정책**: `CropBox.kind?: "regular" | "essay"` (선택적, 기본 regular). 파일명만 분리 — 객관식 `q01.png`, 서술형 `q_s01.png`. 같은 번호여도 별도 파일.
- **기존 `gemini_crop.py`**: `--json-only` flag로 좌표 반환 모드 추가. PNG 저장 모드는 그대로 유지 (CLI/ngd-exam-crop 스킬 호환).
- **`/pdf-cropper` 독립 페이지**: 유지 (개발자/디버깅용).

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-auto-crop-api.md](./phase-01-auto-crop-api.md) | 4 | 4 | 100% | completed | 80f59c5 |
| 2 | [phase-02-cropbox-kind-and-bbox-util.md](./phase-02-cropbox-kind-and-bbox-util.md) | 4 | 4 | 100% | completed | c5a70c7 |
| 3 | [phase-03-cropper-auto-split-entry.md](./phase-03-cropper-auto-split-entry.md) | 5 | 5 | 100% | completed | 699d22f |
| 4 | [phase-04-create-v4-page-redesign.md](./phase-04-create-v4-page-redesign.md) | 5 | 5 | 100% | completed | 29e5f48 |
| 5 | [phase-05-essay-kind-bug-fix-and-e2e.md](./phase-05-essay-kind-bug-fix-and-e2e.md) | 5 | 5 | 100% | completed | 519fc66 |
| **Total** | | **23** | **23** | **100%** | | |

## Phase 의존성

```
Phase 1 ─┐
         ├──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5
Phase 2 ─┘
(1, 2는 scope 독립 → 병렬 가능)
```

- Phase 1, 2는 scope 독립 → 병렬 실행 가능
- Phase 3은 Phase 1(API)과 Phase 2(변환 유틸/타입) 모두에 의존
- Phase 4는 Phase 3 완료 후 — UX 결정 필요(intervention)
- Phase 5는 Phase 4 완료 후 — kind 정책 + 덮어쓰기 버그 fix + end-to-end 검증(intervention)

## 우선순위 / 권장 실행 순서

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | /api/auto-crop + gemini_crop.py --json-only | 30분 |
| P0 | Phase 2 | CropBox.kind + bbox 변환 유틸 | 20분 |
| P0 | Phase 3 | CropperWorkspace 자동 분할 진입점 | 40분 |
| P0 | Phase 4 | /create-v4 페이지 cropper UI 재설계 | 1시간 |
| P0 | Phase 5 | kind 정책 + 덮어쓰기 버그 fix + e2e | 40분 |

권장:
1. Phase 1과 Phase 2를 병렬 실행
2. Phase 3
3. Phase 4 — intervention (추출 실행 UX 확인) 후 진행
4. Phase 5 — intervention (e2e 수동 검증) 후 진행

## 공통 검증

- [ ] `pnpm --filter ngd-studio build` 통과
- [ ] `pnpm --filter ngd-studio test` 통과
- [ ] `/create-v4`에서 PDF 업로드 → "자동 분할" → 박스 주입 → 드래그 조정 → "추출 실행" → 시험지 제작 흐름 진입
- [ ] 객관식/서술형이 같은 페이지에 섞인 PDF에서 덮어쓰기 없음 (회귀)
- [ ] 기존 `/pdf-cropper` 독립 페이지 동작 그대로 유지

## 관련 메모

- `gemini_crop.py:182-187`의 number 타입 분기는 약함 — 명시적 `kind` 마커 도입 필요
- `/api/question-images` 기존 흐름은 그대로 유지 — cropper 결과 PNG를 FormData로 POST
- `crop_results.json`은 레거시 유지 (`ngd-exam-crop` 스킬이 그대로 생성). 새 흐름은 API 응답을 직접 소비
