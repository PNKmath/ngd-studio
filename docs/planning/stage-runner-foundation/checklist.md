---
task: stage-runner-foundation
phase_count: 6
created: 2026-05-16
---

# Stage Runner Foundation — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-stage-types-foundation.md](./phase-01-stage-types-foundation.md) | 5 | 5 | 100% | completed | - |
| 2 | [phase-02-file-backed-job-cache.md](./phase-02-file-backed-job-cache.md) | 6 | 0 | 0% | pending | - |
| 3 | [phase-03-sse-event-helpers.md](./phase-03-sse-event-helpers.md) | 5 | 0 | 0% | pending | - |
| 4 | [phase-04-stage-telemetry-foundation.md](./phase-04-stage-telemetry-foundation.md) | 5 | 0 | 0% | pending | - |
| 5 | [phase-05-legacy-job-runner-wrapper.md](./phase-05-legacy-job-runner-wrapper.md) | 6 | 0 | 0% | pending | - |
| 6 | [phase-06-foundation-tests-docs.md](./phase-06-foundation-tests-docs.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **32** | **5** | **16%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 5 ──▶ Phase 6
     │          ▲
     ├──▶ Phase 3 ─────┘
     └──▶ Phase 4 ─────┘
```

Phase 1에서 공통 타입을 먼저 추가한다. Phase 2~4는 타입을 바탕으로 파일 cache, SSE event, telemetry 기반을 분리한다. Phase 5는 이 기반을 기존 `/api/run` legacy workflow 주변에 wrapper로 붙인다. Phase 6은 focused test와 문서 정리를 수행한다.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | Stage 타입 기반 추가 | 30분 |
| P0 | Phase 2 | 파일 기반 JobStore / StageCache helper | 30분 |
| P0 | Phase 3 | SSE event helper 분리 | 20분 |
| P0 | Phase 4 | Stage telemetry foundation | 30분 |
| P0 | Phase 5 | Legacy JobRunner wrapper 추가 | 30분 |
| P1 | Phase 6 | Foundation tests / docs 정리 | 20분 |

## 권장 실행 순서

1. Phase 1을 먼저 실행해 타입 계약을 만든다.
2. Phase 2, 3, 4는 Phase 1 이후 독립적으로 진행 가능하지만, scope 충돌을 줄이기 위해 순차 실행을 권장한다.
3. Phase 5는 Phase 2~4 이후 기존 `/api/run` 주변에 wrapper를 붙인다.
4. Phase 6에서 focused test와 문서 정리를 마무리한다.

## 검증 체크리스트

### 공통 검증

- [ ] 기존 create/resume/crop/review prompt-based workflow가 제거되지 않음
- [ ] SQLite 또는 새 DB 의존성이 추가되지 않음
- [ ] builder/checker/DeepSeek stage 이관이 이번 task에 포함되지 않음
- [ ] `pnpm test` 또는 focused Vitest 명령이 통과함
- [ ] TypeScript 타입 import가 기존 코드와 충돌하지 않음

## 관련 문서

- [README](./README.md)
- [StageRunner Architecture Draft](../agent-provider-operating-model/stage-runner-architecture.md)
- [Implementation Roadmap](../agent-provider-operating-model/implementation-roadmap.md)
