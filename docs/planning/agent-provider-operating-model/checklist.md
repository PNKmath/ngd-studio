---
task: agent-provider-operating-model
phase_count: 6
created: 2026-05-16
---

# Agent Provider Operating Model — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-current-provider-agent-audit.md](./phase-01-current-provider-agent-audit.md) | 6 | 6 | 100% | completed | - |
| 2 | [phase-02-stage-contract-inventory.md](./phase-02-stage-contract-inventory.md) | 7 | 7 | 100% | completed | - |
| 3 | [phase-03-deterministic-code-candidates.md](./phase-03-deterministic-code-candidates.md) | 6 | 6 | 100% | completed | - |
| 4 | [phase-04-provider-operating-policy.md](./phase-04-provider-operating-policy.md) | 6 | 6 | 100% | completed | - |
| 5 | [phase-05-stage-runner-architecture.md](./phase-05-stage-runner-architecture.md) | 7 | 7 | 100% | completed | - |
| 6 | [phase-06-roadmap-reconciliation.md](./phase-06-roadmap-reconciliation.md) | 6 | 6 | 100% | completed | - |
| **Total** | | **38** | **38** | **100%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5 ──▶ Phase 6
```

Phase 1에서 현행 구조를 먼저 사실 기반으로 고정한다. Phase 2~5는 그 감사 결과를 바탕으로 stage contract, 코드화 후보, provider 정책, runner 아키텍처를 순차 확정한다. Phase 6은 기존 DeepSeek/provider roadmap과 새 운영 모델을 맞춘다.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 현행 provider/agent 구조 감사 | 30분 |
| P0 | Phase 2 | stage별 input/output contract 초안 | 30분 |
| P0 | Phase 3 | deterministic code 전환 후보 확정 | 30분 |
| P1 | Phase 4 | Claude Code/Codex/DeepSeek 운영 정책 | 30분 |
| P1 | Phase 5 | StageRunner 아키텍처 초안 | 30분 |
| P1 | Phase 6 | 기존 roadmap 보정 및 다음 task 후보 | 30분 |

## 권장 실행 순서

1. Phase 1에서 현재 `/api/run`, provider adapter, `.claude/skills`, `.claude/agents` 의존 구조를 문서화한다.
2. Phase 2에서 stage별 contract를 문서화하되 구현 코드는 만들지 않는다.
3. Phase 3에서 agent 제거/코드화 우선순위를 정한다.
4. Phase 4에서 provider별 책임과 금지 영역을 확정한다.
5. Phase 5에서 구현 가능한 runner 인터페이스와 telemetry/fallback 구조를 설계한다.
6. Phase 6에서 기존 DeepSeek/provider 계획을 보정하고 다음 phase-init 후보를 만든다.

## 검증 체크리스트

### 공통 검증

- [x] 새 문서가 `docs/planning/agent-provider-operating-model/`에 생성됨
- [x] `ngd-studio/lib/prompts.ts`, `ngd-studio/server/sse.ts`, `ngd-studio/lib/ai/*`의 실제 구조와 문서 내용이 일치함
- [x] `.claude/skills/ngd-exam-create/SKILL.md`와 `.claude/agents/*.md`의 실제 stage 책임을 반영함
- [x] DeepSeek V4를 repo edit agent로 다루지 않는 정책이 명시됨
- [x] 다음 구현 task 후보가 기존 작업과 충돌하지 않게 분리됨

## 관련 문서

- [README](./README.md)
- [DeepSeek V4 strategy](../deepseek-v4-provider-roadmap/strategy-and-harness-decision.md)
- [AI provider adapters roadmap](../ai-provider-adapters/roadmap.md)
