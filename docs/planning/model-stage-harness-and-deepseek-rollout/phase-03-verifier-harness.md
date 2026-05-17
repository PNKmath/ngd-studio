---
phase: 3
title: Verifier harness
status: completed
depends_on: [2]
scope:
  - ngd-studio/server/stages/modelHarness.ts
  - ngd-studio/server/stages/verifier.ts
  - ngd-studio/server/stages/cache.ts
  - ngd-studio/lib/ai/providers/deepseekV4.ts
  - ngd-studio/lib/__tests__/providerDeepSeek.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: Verifier harness

> **범위**: Backend / AI model stage
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `server/stages/verifier.ts` 신규

## 배경

DeepSeek V4의 1순위 후보는 `create.verifier`다. 출력 schema가 비교적 작고, 실패해도 원본 데이터를 손상시키지 않으며, pass/fail/feedback을 서버가 검증하기 쉽다.

## 설계

`server/stages/verifier.ts`에 verifier input/output 타입과 runner를 추가한다. 입력은 extracted/solved JSON과 optional guideline context, 출력은 `status`, `issues`, `feedback` 구조로 제한한다. 서버가 validation 후 `qN_verified.json` 또는 verifier result cache를 쓴다.

## 체크리스트

- [x] verifier input/output 타입과 validator 추가
- [x] DeepSeek/Claude provider 호출용 bounded prompt builder 추가
- [x] verifier output validation 후 cache write
- [x] pass/fail/feedback telemetry 기록
- [x] validation failure 시 retry/fallback 가능
- [x] focused DeepSeek/provider test 통과

## 영향 범위

첫 model stage harness 적용 phase다. solver/extractor/reviewer는 직접 변경하지 않는다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerDeepSeek.test.ts lib/__tests__/providerRetry.test.ts
```

## 실행 결과

### 2026-05-17 Phase 3

- `server/stages/verifier.ts`에 verifier input/output 타입, JSON-only prompt builder, validator, runner를 추가했다.
- provider output validation 후 `qNN_verified.json` cache만 기록하고 raw payload는 저장하지 않도록 했다.
- validation failure는 retryable stage error로 반환되며 provider metadata와 model stage key를 유지한다.
- 검증: `pnpm test -- --run lib/__tests__/providerDeepSeek.test.ts lib/__tests__/providerRetry.test.ts`, `pnpm exec tsc --noEmit` 통과.
