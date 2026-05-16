---
phase: 2
title: Provider 계약 + Claude adapter
status: pending
depends_on: [1]
scope:
  - ngd-studio/lib/claude.ts
  - ngd-studio/lib/ai/
  - ngd-studio/lib/__tests__/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: Provider 계약 + Claude adapter

> **범위**: Backend library
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `lib/ai/` 신규, `lib/claude.ts`

## 배경

현재 실행기는 `runClaude()`가 직접 `claude` CLI를 spawn한다. Codex와 DeepSeek를 붙이려면 먼저 공통 provider 계약과 registry가 필요하다. 첫 adapter는 기존 Claude 구현을 감싸서 무회귀를 확인한다.

## 설계

`lib/ai/` 아래에 provider 공통 타입을 만든다.

- `AIProviderId`: `auto | claude | codex | deepseek-v4`
- `AIProviderAdapter`: `run(prompt, options)` 형태의 공통 실행 계약
- `ProviderRunOptions`: `cwd`, `maxTurns`, `mode`, `jobId` 등
- `ProviderRunResult`: child process, async events, exitCode, provider metadata
- `ClaudeCliProvider`: 기존 `runClaude()` 구현을 내부로 이동 또는 래핑

기존 `ClaudeEvent`/`SSEEvent` 타입은 당장 유지하되 provider-neutral 이름으로 이동할 수 있다. 큰 rename은 이 phase에서 피한다.

## 체크리스트

- [ ] `lib/ai/types.ts`에 provider id/run 계약 정의
- [ ] `lib/ai/providers/claudeCli.ts`에 기존 Claude spawn 구현 래핑
- [ ] `lib/ai/registry.ts`에서 `claude`와 `auto` 기본 해석 제공
- [ ] 기존 `runClaude()` import 경로 호환 또는 호출부 갱신
- [ ] provider registry 단위 테스트 추가
- [ ] Phase 1 baseline 테스트가 계속 통과함

## 영향 범위

외부 API와 UI는 아직 provider를 알지 못한다. 이 phase 완료 후에도 기존 Claude 실행 경로가 동일하게 동작해야 한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/claude.test.ts lib/__tests__/provider*.test.ts --reporter=basic
pnpm test
```

## 실행 결과

