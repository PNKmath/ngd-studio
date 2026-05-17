---
task: stage-runner-rewrite
phase_count: 10
created: 2026-05-17
---

# stage-runner-rewrite — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-provider-adapter-expansion.md](./phase-01-provider-adapter-expansion.md) | 10 | 10 | 100% | completed | `dfb33e1` |
| 2 | [phase-02-agent-prompts-to-ts.md](./phase-02-agent-prompts-to-ts.md) | 5 | 5 | 100% | completed | `082a5fc` |
| 3 | [phase-03-extractor-stage.md](./phase-03-extractor-stage.md) | 7 | 7 | 100% | completed | `8d84584` |
| 4 | [phase-04-exam-data-builder.md](./phase-04-exam-data-builder.md) | 5 | 5 | 100% | completed | `1f09be6` |
| 5 | [phase-05-orchestrator-and-resume.md](./phase-05-orchestrator-and-resume.md) | 15 | 15 | 100% | completed | `f2627bf` |
| 6 | [phase-06-sse-branch.md](./phase-06-sse-branch.md) | 6 | 6 | 100% | completed | `6acec13` |
| 7 | [phase-07-settings-ui-matrix.md](./phase-07-settings-ui-matrix.md) | 9 | 9 | 100% | completed | `bf1e1f4` |
| 8 | [phase-08-followup-route.md](./phase-08-followup-route.md) | 4 | 4 | 100% | completed | `98e5701` |
| 9 | [phase-09-integration-tests.md](./phase-09-integration-tests.md) | 7 | 5 | 71% | completed | `ff450f3` |
| 10 | [phase-10-docs-and-skill-deprecation.md](./phase-10-docs-and-skill-deprecation.md) | 4 | 4 | 100% | completed | `{commit-10}` |
| **Total** | | **72** | **70** | **97%** | | |

## Phase 의존성

```
Phase 1 ─┬─▶ Phase 3 ─┐
         │            │
Phase 2 ─┘            ├─▶ Phase 5 ─┬─▶ Phase 6 ─┐
                      │            │            │
Phase 4 ──────────────┘            ├─▶ Phase 8 ─┤
                                   │            │
Phase 1 ──▶ Phase 7 ───────────────┘            ├─▶ Phase 9 ─▶ Phase 10
                                                │
```

병렬 가능 구간:
- Phase 2 + Phase 4 (Phase 1 완료 후)
- Phase 6 + Phase 7 + Phase 8 (Phase 5 완료 후)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | provider 타입 확장 + SDK adapter + AbortSignal + 모델 env | 75분 |
| P0 | Phase 2 | agent MD prompt → TS 상수 이식 | 30분 |
| P0 | Phase 3 | extractor stage 신규 (vision 1-shot) | 60분 |
| P0 | Phase 4 | exam_data.json 합치기 TS 이식 | 20분 |
| P0 | Phase 5 | orchestrator + resume + concurrency + review pause + 부분 실패 UX (intervention_likely) | 120분 |
| P0 | Phase 6 | SSE 분기 (review 비범위 명시) | 45분 |
| P0 | Phase 7 | settings UI + API key 필드 + 테스트 엔드포인트 | 75분 |
| P1 | Phase 8 | followup route 라우팅 정리 | 30분 |
| P0 | Phase 9 | 통합 테스트 + fixture + 수동 회귀 (intervention_likely) | 60분 |
| P1 | Phase 10 | 문서/skill 폐기 후보 표시 | 15분 |

## 권장 실행 순서

1. Phase 1
2. Phase 2 + Phase 4 (병렬)
3. Phase 3
4. Phase 5 (사용자 개입 예상)
5. Phase 6 + Phase 7 + Phase 8 (병렬)
6. Phase 9 (사용자 개입 예상)
7. Phase 10

## 검증 체크리스트

### 공통 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run --reporter=basic` 통과
- [ ] /settings에서 신규 provider 5종 + auto 선택 가능
- [ ] /create-v4 신규 작업 e2e PASS (mock 또는 live)
- [ ] legacy /create 경로 회귀 없음

### 비범위
- /create 페이지 삭제 (별도)
- PipelineView stage 정의 변경
- HWPX 포맷 변경
- DeepSeek 외 신규 provider

## 관련 문서
- [README](./README.md)
- 이관 출처: [create-v4-merge/phase-05-deepseek-stage-orchestration.md](../create-v4-merge/phase-05-deepseek-stage-orchestration.md)
