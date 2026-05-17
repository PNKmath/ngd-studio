---
task: model-stage-harness-and-deepseek-rollout
phase_count: 6
created: 2026-05-16
---

# Model Stage Harness and DeepSeek Rollout — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-model-stage-contract.md](./phase-01-model-stage-contract.md) | 6 | 6 | 100% | completed | b2e35f0 |
| 2 | [phase-02-json-harness-validation.md](./phase-02-json-harness-validation.md) | 6 | 6 | 100% | completed | b41d5d2 |
| 3 | [phase-03-verifier-harness.md](./phase-03-verifier-harness.md) | 6 | 6 | 100% | completed | 65bde83 |
| 4 | [phase-04-solver-harness.md](./phase-04-solver-harness.md) | 5 | 5 | 100% | completed | pending |
| 5 | [phase-05-deepseek-rollout-policy.md](./phase-05-deepseek-rollout-policy.md) | 6 | 0 | 0% | pending | - |
| 6 | [phase-06-tests-docs.md](./phase-06-tests-docs.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **34** | **23** | **68%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 5 ──▶ Phase 6
                         │
                         └──▶ Phase 4 ───────┘
```

Phase 1~2에서 model stage contract와 JSON validation harness를 만든다. Phase 3은 첫 rollout 대상으로 verifier를 붙이고, Phase 4는 solver를 제한적으로 추가한다. Phase 5에서 DeepSeek policy/settings/recommendation 연결을 정리하고 Phase 6에서 검증한다.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | model stage contract | 30분 |
| P0 | Phase 2 | JSON harness / validation | 30분 |
| P0 | Phase 3 | verifier harness | 30분 |
| P1 | Phase 4 | solver harness | 30분 |
| P1 | Phase 5 | DeepSeek rollout policy | 30분 |
| P1 | Phase 6 | tests/docs | 20분 |

## 권장 실행 순서

1. Phase 1과 2로 bounded model-call harness 기반을 만든다.
2. Phase 3에서 `create.verifier`를 첫 적용 대상으로 삼는다.
3. Phase 4는 verifier 결과와 validation telemetry가 안정적으로 잡힌 뒤 진행한다.
4. Phase 5에서 DeepSeek override/recommendation 정책을 연결한다.
5. Phase 6에서 테스트와 문서를 정리한다.

## 검증 체크리스트

### 공통 검증

- [ ] DeepSeek가 HWPX/파일 mutation을 직접 수행하지 않음
- [ ] provider output은 schema validation 후 cache에 기록됨
- [ ] legacy Claude/Codex prompt fallback이 제거되지 않음
- [ ] deterministic builder/checker runner와 scope가 섞이지 않음
- [ ] `pnpm test` 또는 focused Vitest 명령이 통과함
- [ ] `pnpm exec tsc --noEmit` 통과

## 관련 문서

- [README](./README.md)
- [DeepSeek Strategy and Harness Decision](../deepseek-v4-provider-roadmap/strategy-and-harness-decision.md)
- [Provider Operating Policy](../agent-provider-operating-model/provider-operating-policy.md)
