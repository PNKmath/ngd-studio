---
task: stage-pipeline-audit
phase_count: 6
created: 2026-05-18
---

# stage-pipeline-audit — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-contract-matrix.md](./phase-01-contract-matrix.md) | 4 | 4 | 100% | completed | dac5937 |
| 2 | [phase-02-solver-verifier-prompts.md](./phase-02-solver-verifier-prompts.md) | 7 | 7 | 100% | completed | 662c60d |
| 3 | [phase-03-extractor-validator-sweep.md](./phase-03-extractor-validator-sweep.md) | 5 | 5 | 100% | completed | 00d1762 |
| 4 | [phase-04-per-question-pipeline.md](./phase-04-per-question-pipeline.md) | 8 | 8 | 100% | completed | 8e57dad |
| 5 | [phase-05-store-ui-adapt.md](./phase-05-store-ui-adapt.md) | 7 | 7 | 100% | completed | 4fd0c88 |
| 6 | [phase-06-e2e-smoke.md](./phase-06-e2e-smoke.md) | 4 | 4 | 100% | completed | 1847644 |
| **Total** | | **35** | **35** | **100%** | | |

## Phase 의존성

```
1 ─┬─▶ 2 ─┬─▶ 4 ─▶ 5 ─▶ 6
   └─▶ 3 ─┘
```

병렬 가능 구간:
- Phase 2 + Phase 3 (Phase 1 완료 후, scope disjoint)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | contract 매트릭스 — 이후 모든 변경의 진실 소스 | 15분 |
| P0 | Phase 2 | solver/verifier NGD-rich prompt 통합 + validator 정합 | 45분 |
| P0 | Phase 3 | extractor validator sweep | 20분 |
| P0 | Phase 4 | per-question pipeline — 가장 큰 perf gain, 가장 큰 변경 | 60분 |
| P1 | Phase 5 | Store/UI 적응 (progress %, cleaned 잔재) | 30분 |
| P1 | Phase 6 | mock codex e2e smoke | 30분 |

## 권장 실행 순서

1. Phase 1
2. Phase 2 + Phase 3 (병렬)
3. Phase 4
4. Phase 5
5. Phase 6

## 검증 체크리스트

### 공통 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run --reporter=basic` 통과 (회귀 0)
- [ ] orchestrator.test.ts / extractor.test.ts / solver.test.ts / verifier.test.ts 모두 새 schema 반영
- [ ] e2e smoke (Phase 6)가 mock codex로 6 question 전체 pipeline 통과

### 비범위
- AIStageKey 타입 자체 변경 (settings/recommendation 모듈 그대로)
- figure/builder/checker stage 변경 (현 동작 유지)
- 새 stage 추가/제거
- SSE event 추가 (`stage`/`progress`/`log`/`question` 외 새 이벤트 없음 — 단, `extraction_review`는 incremental로 의미 변경 가능)
- legacy Claude CLI skill 경로 변경

## 관련 문서
- 발단: codex-cli로 시험지 제작 시도 중 prompt-validator 불일치 + 직렬화 bottleneck + UI resume 혼동 발견
- 직전 task: [stage-name-unification](../stage-name-unification/checklist.md)
- 추가 fix 누적: 40fa1f2 (extractor.answer optional), e642792 (extractor.question optional), 2374076 (solver/verifier 로그)
