---
task: create-figure-result-modal
phase_count: 2
created: 2026-05-22
---

# create 페이지 UI 모달화 리팩토링 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-figure-modal.md](./phase-01-figure-modal.md) | 8 | 8 | 100% | completed | 637492d |
| 2 | [phase-02-cropper-modal.md](./phase-02-cropper-modal.md) | 7 | 0 | 0% | pending | - |
| **Total** | | **15** | **8** | **53%** | | |

## Phase 의존성

```
Phase 1 (figure 모달)  ─┐
                        ├─→ page.tsx scope 겹침 → 순차 실행 자동
Phase 2 (crop 모달)    ─┘
```

논리적 의존성은 없으나 두 phase 모두 `app/create/page.tsx`를 수정 → scope 겹침으로 `/phase-run`이 자동 순차화.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | figure 결과 영역 스크롤 클리핑 버그 직접 해결 + figure UI 단일 진실 출처화 | 30–45분 |
| P1 | Phase 2 | PDF crop 워크스페이스 모달화 (UX 개선) | 45–60분 |

## 권장 실행 순서

1. **Phase 1** — figure 모달화 + Bottom Panel figure card 흡수 + max-h 패치 원복
2. **Phase 2** — crop 워크스페이스 모달화 (Phase 1 종료 후 안정화 확인 뒤 진입)

## 검증 체크리스트

### 공통 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] 관련 vitest 통과 (`ngd-studio/lib/__tests__/store.test.ts` 등)
- [ ] 다양한 viewport(900/1080/1440px 높이)에서 모달 내부 스크롤이 끝까지 도달
- [ ] 두 모달 동시 오픈 시도 시 차단
- [ ] ESC + 백드롭 클릭 닫기 동작 일관성
- [ ] `QuestionDetailModal` 베이스 스타일과 시각적 일관성 (border-radius, shadow, backdrop)

### Phase 1 전용
- [ ] figure 단계 done 상태에서 버튼 클릭 → 모달 오픈 → 확인 CTA → 새 잡 진입(builder부터) → 정상 완주
- [ ] Bottom Panel figure card 흔적 0건 (`showFigureConfirm` 잔존 reference 없음)

### Phase 2 전용
- [ ] PDF 열기 → crop 모달 오픈 → 크롭 → 모달 닫고 잡 시작 → 정상 흐름
- [ ] Right Workspace `!hasJob` placeholder 일관성 (기존 No Active Session 패턴 준수)

## 관련 문서
- 조사 컨텍스트: 본 대화 (canonical action 판정, 모달 베이스 패턴 추출)
- 모달 베이스: `ngd-studio/components/results/question-result/QuestionDetailModal.tsx`
- 메모리: `feedback-uiux-consistency` (settings/create UI 일관성 준수)
