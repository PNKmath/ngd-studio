---
phase: 4
title: Stage telemetry foundation
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/telemetry.ts
  - ngd-studio/lib/ai/retry.ts
  - ngd-studio/lib/ai/recommendation.ts
  - ngd-studio/lib/__tests__/providerRetry.test.ts
  - ngd-studio/lib/__tests__/providerRecommendation.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: Stage telemetry foundation

> **범위**: Backend / AI telemetry
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `server/stages/telemetry.ts` 신규, `lib/ai/retry.ts`

## 배경

현재 provider telemetry는 `ProviderTelemetryEntry` 중심이다. StageRunner에서는 retry, fallback, validation failure, downstream correction 같은 stage-level 정보를 기록할 수 있어야 한다.

## 설계

`server/stages/telemetry.ts`에 stage attempt telemetry helper를 추가한다. 기존 `ProviderTelemetryEntry`와 호환되도록 확장하거나 변환 helper를 둔다. `recommendation.ts` 기존 테스트가 깨지지 않아야 한다.

## 체크리스트

- [x] stage attempt telemetry helper 또는 타입 추가
- [x] retry/fallback/validation failure 기록 필드 반영
- [x] 기존 `ProviderTelemetryEntry` 사용처와 호환
- [x] `recommendStageProvider` 기존 동작 유지
- [x] provider retry/recommendation focused test 통과

## 영향 범위

기존 telemetry 필드를 제거하지 않는다. 새 필드는 optional이어야 하며 기존 job JSON을 읽는 코드와 호환되어야 한다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerRetry.test.ts lib/__tests__/providerRecommendation.test.ts
```

## 실행 결과

### 2026-05-16

- `server/stages/telemetry.ts`를 추가해 workflow stage attempt telemetry entry 생성과 provider telemetry 변환 helper를 정의했다.
- `ProviderTelemetryEntry`에 `workflowStageKey`, fallback, validation, failure kind, downstream correction 필드를 optional로 추가해 기존 job JSON과 recommendation 로직 호환을 유지했다.
- provider retry telemetry 테스트를 보강해 optional stage-level 필드가 payload 없이 보존되는지 확인했다.
- 검증: `pnpm test -- --run lib/__tests__/providerRetry.test.ts lib/__tests__/providerRecommendation.test.ts`, `pnpm exec tsc --noEmit` 통과.
