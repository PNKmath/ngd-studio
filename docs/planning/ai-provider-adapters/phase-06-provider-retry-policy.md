---
phase: 6
title: Provider 재시도 3회 정책
status: completed
depends_on: [4]
scope:
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/ai/
  - ngd-studio/lib/__tests__/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 6: Provider 재시도 3회 정책

> **범위**: Backend provider runner
> **난이도**: M
> **의존성**: Phase 4
> **영향 파일**: `server/sse.ts`, `lib/ai/`

## 배경

선택한 provider가 실패하면 같은 provider로 최대 3회 재시도한다. 자동 fallback은 1차 범위가 아니다. 사용자가 Codex를 선택했으면 Codex만 3회 시도하고, Claude를 선택했으면 Claude만 3회 시도한다.

## 설계

provider 실행을 `runProviderWithRetry` 같은 순수한 orchestration 함수로 분리한다. TDD로 fake provider를 사용해 다음 케이스를 먼저 고정한다.

- 1회 실패 후 2회차 성공
- 3회 모두 실패
- client disconnect 또는 abort 시 재시도 금지
- 각 attempt 시작/실패 로그 SSE 발행

재시도 기준은 provider process exit code non-zero, provider-level result failure, spawn error로 한정한다. 작업 자체가 성공적으로 완료된 뒤 checker가 문제를 보고하는 것은 provider failure가 아니다.

## 체크리스트

- [x] fake provider 기반 retry unit test 작성
- [x] 최대 3회 attempt 정책 구현
- [x] attempt별 SSE log 이벤트 발행
- [x] client disconnect/abort 시 추가 attempt를 시작하지 않음
- [x] 최종 실패 시 job status와 result/error 이벤트가 일관됨
- [x] Claude/Codex provider 양쪽에 retry wrapper 적용

## 영향 범위

재시도는 긴 작업 시간을 늘릴 수 있다. UI에는 attempt log를 남겨 사용자가 멈춘 것처럼 보지 않게 한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/provider*.test.ts --reporter=basic
pnpm test
```

## 실행 결과

### 2026-05-16 — Phase 6

#### Summary
- `lib/ai/retry.ts`에 최대 3회 retry 정책, retry 여부 판정, attempt log formatter, 순수 `runProviderWithRetry` helper를 추가했다.
- `providerRetry.test.ts`에서 1회 실패 후 성공, 3회 실패, abort 시 중단, retry 조건, SSE log 문구를 fake provider로 고정했다.
- `server/sse.ts`가 선택된 같은 provider를 최대 3회 재시도하고 attempt 시작/실패 로그를 SSE로 발행하도록 했다.
- client disconnect 시 현재 process만 종료하고 추가 attempt를 시작하지 않게 했다.

#### Scope Audit (orchestrator)
- pass — changed files are within Phase 6 scope: `ngd-studio/server/sse.ts`, `ngd-studio/lib/ai/`, `ngd-studio/lib/__tests__/providerRetry.test.ts`

#### Verification Re-run (orchestrator)
- pass — `npx vitest run lib/__tests__/provider*.test.ts --reporter=basic` (24 tests)
- pass — `pnpm test` (86 tests)
- pass — `npx tsc --noEmit`

#### Review (orchestrator)
- pass — retry stays on the selected provider; no automatic fallback is introduced.

#### Commit
- 4014954 — `feat(ai): retry provider runs`
