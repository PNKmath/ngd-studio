---
phase: 3
title: Verifier harness
status: pending
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

- [ ] verifier input/output 타입과 validator 추가
- [ ] DeepSeek/Claude provider 호출용 bounded prompt builder 추가
- [ ] verifier output validation 후 cache write
- [ ] pass/fail/feedback telemetry 기록
- [ ] validation failure 시 retry/fallback 가능
- [ ] focused DeepSeek/provider test 통과

## 영향 범위

첫 model stage harness 적용 phase다. solver/extractor/reviewer는 직접 변경하지 않는다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerDeepSeek.test.ts lib/__tests__/providerRetry.test.ts
```
