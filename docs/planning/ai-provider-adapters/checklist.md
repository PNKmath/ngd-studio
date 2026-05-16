---
task: ai-provider-adapters
phase_count: 7
created: 2026-05-16
---

# AI provider adapters — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-regression-baseline.md](./phase-01-regression-baseline.md) | 6 | 6 | 100% | completed | 1895bd2 |
| 2 | [phase-02-provider-contract-claude.md](./phase-02-provider-contract-claude.md) | 6 | 6 | 100% | completed | 5063158 |
| 3 | [phase-03-sse-provider-selection.md](./phase-03-sse-provider-selection.md) | 6 | 6 | 100% | completed | dd5d53f |
| 4 | [phase-04-codex-cli-provider.md](./phase-04-codex-cli-provider.md) | 7 | 0 | 0% | pending | - |
| 5 | [phase-05-settings-engine-selection.md](./phase-05-settings-engine-selection.md) | 7 | 0 | 0% | pending | - |
| 6 | [phase-06-provider-retry-policy.md](./phase-06-provider-retry-policy.md) | 6 | 0 | 0% | pending | - |
| 7 | [phase-07-follow-up-roadmap.md](./phase-07-follow-up-roadmap.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **43** | **18** | **42%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5
                                      └────────▶ Phase 6

Phase 7 (문서/후속 로드맵, 독립)
```

병렬 가능 쌍:
- Phase 7은 코드 변경과 독립이므로 Phase 1 이후 아무 때나 병렬 가능.
- Phase 5와 Phase 6은 둘 다 Phase 4 이후 가능하지만, `lib/useJobRunner.ts`와 provider runner scope가 겹칠 수 있으므로 순차 실행 권장.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | Claude 현 동작 회귀 테스트 baseline | 30분 |
| P0 | Phase 2 | provider 계약 도입 + Claude adapter 래핑 | 30분 |
| P0 | Phase 3 | SSE 서버가 provider 선택을 수용 | 30분 |
| P1 | Phase 4 | Codex CLI provider TDD 구현 | 45분 |
| P1 | Phase 5 | 설정 페이지에서 기본 엔진 선택 | 30분 |
| P1 | Phase 6 | 선택 provider 재시도 3회 정책 | 30분 |
| P2 | Phase 7 | DeepSeek V4/단계별 선택/자동 추천 후속 로드맵 | 20분 |

## 권장 실행 순서

1. Phase 1로 현재 Claude behavior를 먼저 테스트로 고정한다.
2. Phase 2 → 3으로 구조를 바꾸되 기존 request는 provider 미지정 시 Claude로 유지한다.
3. Phase 4에서 Codex provider를 fixture 기반 TDD로 추가한다.
4. Phase 5에서 `/settings` 기본 엔진 선택을 붙인다.
5. Phase 6에서 provider 실패 재시도 정책을 추가한다.
6. Phase 7은 중간 또는 마지막에 문서화한다.

## 검증 체크리스트

### 공통 검증
- [ ] `cd ngd-studio && pnpm test` 통과
- [ ] `cd ngd-studio && npx vitest run lib/__tests__/claude.test.ts --reporter=basic` 통과
- [ ] `cd ngd-studio && npx vitest run lib/__tests__/prompts.test.ts --reporter=basic` 통과
- [ ] `cd ngd-studio && npx vitest run lib/__tests__/provider*.test.ts --reporter=basic` 통과
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] Claude provider 미지정 요청이 기존과 동일하게 실행됨

### 보존 항목
- [ ] `.claude/skills/ngd-exam-create/` workflow와 agent 파일 이름 유지
- [ ] Claude CLI stream-json 기반 stage/file/question 이벤트 의미 유지
- [ ] `mode: create | resume | crop | review` API 의미 유지
- [ ] DeepSeek V4 구현은 외부 API 전송 정책 확정 전 시작하지 않음

## 관련 문서
- [README](./README.md)
- [현재 API 아키텍처](../03-api-architecture.md)
- [프로젝트 아키텍처](../../architecture.md)
