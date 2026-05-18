---
task: stage-name-unification
phase_count: 4
created: 2026-05-17
---

# stage-name-unification — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-canonical-types.md](./phase-01-canonical-types.md) | 4 | 4 | 100% | completed | 8ba1f01 |
| 2 | [phase-02-orchestrator-events.md](./phase-02-orchestrator-events.md) | 5 | 5 | 100% | completed | 0d74aa0 |
| 3 | [phase-03-store-and-ui.md](./phase-03-store-and-ui.md) | 6 | 6 | 100% | completed | 5455729 |
| 4 | [phase-04-integration.md](./phase-04-integration.md) | 4 | 2 | 50% | needs_user | - |
| **Total** | | **19** | **17** | **89%** | | |

## Phase 의존성

```
Phase 1 ─┬─▶ Phase 2 ─┐
         │            │
         └─▶ Phase 3 ─┴─▶ Phase 4
```

병렬 가능 구간:
- Phase 2 + Phase 3 (Phase 1 완료 후, scope disjoint)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | canonical pipeline stage namespace + 매핑 함수 | 10분 |
| P0 | Phase 2 | orchestrator stageEvent/progressEvent/logEvent canonical name 사용 + 테스트 | 25분 |
| P0 | Phase 3 | store stages 6개 축소 + UI 정리 + 테스트 | 20분 |
| P0 | Phase 4 | 통합 회귀 + 수동 시나리오로 6 stage 카드 갱신 확인 | 15분 |

## 권장 실행 순서

1. Phase 1
2. Phase 2 + Phase 3 (병렬)
3. Phase 4 (사용자 개입 예상)

## 검증 체크리스트

### 공통 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run --reporter=basic` 통과 (회귀 0)
- [ ] /create-v4에서 PDF 업로드 → 추출 시작 시 6개 stage 카드가 순차적으로 pending → running → done으로 갱신
- [ ] LogStream에 `[extractor]`/`[solver]`/`[verifier]`로 표시 (prefix 없음)
- [ ] 일시정지/재개/재시도 버튼이 stage 상태와 무관하게 status에 따라 정상 노출

### 비범위
- AIStageKey 타입 자체 변경 (settings/recommendation 모듈은 그대로 유지)
- figure/builder/checker 동작 변경 (이미 canonical name 사용 중)
- 새 stage 추가/제거 (cleaned/review_extract는 단순 삭제)
- SSE event protocol 변경 (event/data shape는 그대로)

## 관련 문서
- 발단: `/Users/junhyukpark/ngd/ngd-studio` create-v4 stage card 갱신 안 됨 디버깅
- 직전 task: [stage-runner-rewrite](../stage-runner-rewrite/checklist.md)
