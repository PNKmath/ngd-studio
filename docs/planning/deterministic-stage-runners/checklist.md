---
task: deterministic-stage-runners
phase_count: 6
created: 2026-05-16
---

# Deterministic Stage Runners — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-runner-command-foundation.md](./phase-01-runner-command-foundation.md) | 5 | 5 | 100% | completed | 4e03e46 |
| 2 | [phase-02-builder-runner.md](./phase-02-builder-runner.md) | 6 | 6 | 100% | completed | 2644065 |
| 3 | [phase-03-builder-sse-job-integration.md](./phase-03-builder-sse-job-integration.md) | 5 | 0 | 0% | pending | - |
| 4 | [phase-04-checker-rule-runner.md](./phase-04-checker-rule-runner.md) | 6 | 6 | 100% | completed | pending |
| 5 | [phase-05-checker-integration-fallback.md](./phase-05-checker-integration-fallback.md) | 5 | 0 | 0% | pending | - |
| 6 | [phase-06-tests-docs.md](./phase-06-tests-docs.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **32** | **17** | **53%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 6
     │
     └──▶ Phase 4 ──▶ Phase 5 ─────┘
```

Phase 1에서 command runner와 script result 타입을 먼저 만든다. Phase 2~3은 builder 실행과 SSE/job 통합을 다루고, Phase 4~5는 checker rule 실행과 fallback 연결을 다룬다. Phase 6에서 테스트와 문서를 정리한다.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | deterministic command foundation | 30분 |
| P0 | Phase 2 | builder runner 구현 | 30분 |
| P0 | Phase 3 | builder SSE/job 통합 | 30분 |
| P0 | Phase 4 | checker XML rule runner 구현 | 30분 |
| P1 | Phase 5 | checker 통합과 fallback 보존 | 30분 |
| P1 | Phase 6 | 테스트와 문서 정리 | 20분 |

## 권장 실행 순서

1. Phase 1을 먼저 실행해 command 실행/결과 타입을 만든다.
2. Phase 2와 Phase 4는 Phase 1 이후 독립적으로 진행 가능하지만, scope 충돌을 줄이기 위해 순차 실행을 권장한다.
3. Phase 3은 Phase 2 이후, Phase 5는 Phase 4 이후 진행한다.
4. Phase 6에서 focused test와 문서를 마무리한다.

## 검증 체크리스트

### 공통 검증

- [ ] 기존 legacy prompt workflow와 agent fallback이 제거되지 않음
- [ ] builder/checker 이외 model stage harness가 이번 task에 포함되지 않음
- [ ] DeepSeek provider rollout이 이번 task에 포함되지 않음
- [ ] `pnpm test` 또는 focused Vitest 명령이 통과함
- [ ] `pnpm exec tsc --noEmit` 통과

## 관련 문서

- [README](./README.md)
- [StageRunner Foundation](../stage-runner-foundation/README.md)
- [Deterministic Code Candidates](../agent-provider-operating-model/deterministic-code-candidates.md)
