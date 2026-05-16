---
phase: 5
title: Legacy JobRunner wrapper 추가
status: completed
depends_on: [2, 3, 4]
scope:
  - ngd-studio/server/stages/jobRunner.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/prompts.ts
  - ngd-studio/lib/ai/registry.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 5: Legacy JobRunner wrapper 추가

> **범위**: Backend
> **난이도**: M
> **의존성**: Phase 2, Phase 3, Phase 4
> **영향 파일**: `server/stages/jobRunner.ts` 신규, `server/sse.ts`

## 배경

기존 `/api/run`은 mode별 prompt를 만든 뒤 `runAIProvider()`에 바로 넘긴다. StageRunner foundation에서는 이 legacy prompt workflow를 제거하지 않고, `runLegacyPromptJob()` 같은 wrapper로 감싸 새 runner path를 붙일 확장 지점을 만든다.

## 설계

`jobRunner.ts`에 legacy path wrapper를 추가한다. wrapper는 기존 prompt 생성, provider 실행, retry, telemetry, SSE forwarding을 구조화하되 behavior를 유지해야 한다. 실제 builder/checker/DeepSeek stage 이관은 하지 않는다.

## 체크리스트

- [x] `runLegacyPromptJob()` 또는 동등한 wrapper 추가
- [x] 기존 create/resume/crop/review prompt 생성 동작 유지
- [x] `server/sse.ts`가 wrapper를 호출하도록 정리하되 response/SSE behavior 유지
- [x] 새 StageRunner path를 붙일 확장 지점 명시
- [x] builder/checker/DeepSeek stage 이관 없음
- [x] 기존 provider 관련 focused test 통과

## 영향 범위

이 phase는 `/api/run` 주변을 건드리므로 회귀 위험이 가장 크다. 기존 event shape, job JSON, retry 동작을 유지해야 한다.

## 검증

```bash
pnpm test -- --run lib/__tests__/prompts.test.ts lib/__tests__/providerRegistry.test.ts lib/__tests__/providerRetry.test.ts
```

## 실행 결과

### 2026-05-16

- `server/stages/jobRunner.ts`에 `runLegacyPromptJob()` wrapper를 추가해 provider 실행, retry, telemetry, SSE forwarding, 결과 수집을 구조화했다.
- `server/sse.ts`는 기존 mode별 prompt 생성과 request validation을 유지하면서 wrapper를 호출하도록 정리했다.
- builder/checker/DeepSeek stage 이관은 수행하지 않았고, 후속 StageRunner path를 붙일 확장 지점만 마련했다.
- 검증: `pnpm test -- --run lib/__tests__/prompts.test.ts lib/__tests__/providerRegistry.test.ts lib/__tests__/providerRetry.test.ts`, `pnpm exec tsc --noEmit` 통과.
