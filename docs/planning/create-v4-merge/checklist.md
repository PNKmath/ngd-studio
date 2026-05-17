---
task: create-v4-merge
phase_count: 5
created: 2026-05-17
---

# create-v4 ↔ create 통합 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-idle-sidebar-redesign.md](./phase-01-idle-sidebar-redesign.md) | 7 | 6 | 86% | completed | 23852b8 |
| 2 | [phase-02-state-branch-and-running-view.md](./phase-02-state-branch-and-running-view.md) | 14 | 13 | 93% | completed | 61c7e4d |
| 3 | [phase-03-resume-and-conditional-panels.md](./phase-03-resume-and-conditional-panels.md) | 15 | 13 | 87% | completed | 7f9fadd |
| 4 | [phase-04-verify-and-regression-check.md](./phase-04-verify-and-regression-check.md) | 8 | 2 | 25% | needs_user | - |
| 5 | [phase-05-deepseek-stage-orchestration.md](./phase-05-deepseek-stage-orchestration.md) | 12 | 12 | 100% | completed (stage-runner-rewrite로 흡수) | - |
| **Total** | | **56** | **0** | **0%** | | |

## Phase 의존성

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5
```

Phase 1~4는 모두 `app/create-v4/page.tsx` 한 파일을 수정하므로 병렬 불가.
Phase 5는 server-side (sse.ts, server/stages/*) 변경이라 다른 phase와 파일 충돌 없음.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 좌측 사이드바 디자인 통일 + 파이프라인 미리보기 | 15분 |
| P0 | Phase 2 | 작업 상태 분기 + Running/Done 뷰 도입 (핵심) | 60분 |
| P0 | Phase 3 | 재개 + figure/build/followup 패널 포팅 | 45분 |
| P1 | Phase 4 | 타입 체크 + 회귀 시나리오 수동 검증 | 15분 |
| P0 | Phase 5 | DeepSeek stage-by-stage 오케스트레이션 (실제 동작) | 4~8시간 |

## 권장 실행 순서

1. Phase 1 (사이드바 디자인)
2. Phase 2 (상태 분기 — 핵심 리팩터)
3. Phase 3 (보조 패널)
4. Phase 4 (검증) — 사용자 개입 예상

## 검증 체크리스트

### 공통 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] `/create-v4`에서 추출 시 라우팅 없이 같은 페이지 내 전환
- [ ] `/create` 페이지는 그대로 동작 (이번 작업에서 미수정)
- [ ] PipelineView가 live stages로 업데이트
- [ ] 다운로드 / 재개 / figure 확인 / build 상태 / followup 모두 동작

### 비범위 (이 작업에서 하지 않음)
- `/create` 페이지 삭제
- PipelineView stage 정의 변경
- 백엔드 API 변경
- crop 단계를 PipelineView에 추가

## 관련 문서
- [README](./README.md)
- 참고 소스: `ngd-studio/app/create/page.tsx`
- 통합 대상: `ngd-studio/app/create-v4/page.tsx`
