---
phase: 2
title: JSON harness / validation
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/modelHarness.ts
  - ngd-studio/server/stages/telemetry.ts
  - ngd-studio/lib/ai/retry.ts
  - ngd-studio/lib/__tests__/providerRetry.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: JSON harness / validation

> **범위**: Backend / AI validation
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `server/stages/modelHarness.ts` 신규

## 배경

API model output은 JSON/text schema로 고정되어야 하고, 서버가 validation 실패를 telemetry에 기록한 뒤 retry/fallback을 판단해야 한다. ad hoc string parsing으로 cache를 쓰면 DeepSeek rollout 리스크가 커진다.

## 설계

`modelHarness.ts`에 JSON extraction/parsing, structural validation callback, retry metadata 변환 helper를 추가한다. 외부 schema library를 새로 도입하지 않고 TypeScript type guard와 validator function 패턴으로 시작한다.

## 체크리스트

- [x] JSON parse/extract helper 추가
- [x] validator function 기반 output validation contract 추가
- [x] validation failure telemetry 기록 필드 연결
- [x] retry/fallback decision에 validation failure reason 전달
- [x] provider raw payload를 job/cache에 저장하지 않음
- [x] focused test 또는 TypeScript 검증 통과

## 영향 범위

model stage harness 내부 helper다. DeepSeek provider 호출 자체는 Phase 3 이후에 연결한다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerRetry.test.ts
```

## 실행 결과

### 2026-05-17 Phase 2

- `server/stages/modelHarness.ts`에 raw/fenced/balanced JSON 추출과 validator callback 계약을 추가했다.
- validation failure를 retry 대상과 provider telemetry에 전달하되 raw provider payload는 저장하지 않도록 했다.
- 검증: `pnpm test -- --run lib/__tests__/providerRetry.test.ts`, `pnpm exec tsc --noEmit` 통과.
