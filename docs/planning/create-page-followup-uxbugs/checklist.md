---
task: create-page-followup-uxbugs
phase_count: 2
created: 2026-05-22
---

# create 페이지 후속 UX 조정 + figure stage 버그 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-ux-bundle.md](./phase-01-ux-bundle.md) | 7 | 0 | 0% | pending | - |
| 2 | [phase-02-figure-stage-bugs.md](./phase-02-figure-stage-bugs.md) | 6 | 0 | 0% | pending | - |
| **Total** | | **13** | **0** | **0%** | | |

## Phase 의존성

```
Phase 1 (UX 묶음)             ─┐
                                ├─→ page.tsx scope 겹침 → 순차 실행 자동
Phase 2 (figure/stage 버그)   ─┘
```

논리적 독립이나 `ngd-studio/app/create/page.tsx`가 두 phase scope 에 모두 포함 → `/phase-run`이 순차화.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | UX 일관성 묶음 (모달 너비, 진입점 정리, 편집 토글, 풀이 탭 편집 신규) | 60–90분 |
| P0 | Phase 2 | figure_processor 실패 진단 + stage routing 버그 + cleaned 이미지 폴백 | 60–120분 (진단 포함) |

## 권장 실행 순서

1. **Phase 1** — frontend UX (결정 완료, 단순 진행)
2. **Phase 2** — 진단 우선, 패턴 분석에 따라 직접 픽스 또는 audit 매트릭스 분기

## 검증 체크리스트

### 공통 검증
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] `cd ngd-studio && npx vitest run lib/__tests__/store.test.ts --reporter=basic` 통과

### Phase 1 전용 (수동 smoke)
- [ ] crop 모달 폭이 시험지 세로 비율에 적합
- [ ] PDF 열기 진입점이 NoActiveSessionPlaceholder + 상단 글로벌 actions 두 곳으로 정리됨
- [ ] placeholder 안내 멘트 "우측 상단" 으로 변경
- [ ] 추출 결과 탭이 read-only 기본, "추출 결과 편집" 버튼 클릭 시 편집 진입
- [ ] "이 문제 저장" — dirty + JSON 형식 유효 양쪽 충족 시만 활성화
- [ ] "풀이부터 재실행" 버튼 부재 (ExtractionEditor 에서 제거)
- [ ] 풀이 및 해설 탭에 "풀이 및 해설 편집" + "풀이 및 해설 저장" 버튼 동작

### Phase 2 전용 (수동 smoke)
- [ ] figure_processor 실패 재현 → 원인 파악 → 픽스 후 동일 PDF 재실행 시 figure 단계 통과
- [ ] cleaned 이미지 자리에 raw 크롭이 표시되지 않음 (placeholder 또는 적절한 폴백)
- [ ] figure 완료 후 "HWPX 조립" 버튼이 정상 노출 (해설 생성 시작 아님)
- [ ] figure 실패 상태에서도 figure 모달 진입 가능 + 재시도 CTA

## 관련 문서
- 조사 컨텍스트: `create-figure-result-modal` task 의 Phase 1·2 결과물 + 사용자 시험 사용 중 발견된 10개 항목
- 메모리: `feedback-uiux-consistency`, `feedback-systematic-audit`, `feedback-both-layers-when-different-jobs`, `feedback-opinion-then-wait`
- 직전 task: `docs/planning/create-figure-result-modal/`
