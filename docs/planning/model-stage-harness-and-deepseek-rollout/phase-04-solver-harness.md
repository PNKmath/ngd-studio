---
phase: 4
title: Solver harness
status: completed
depends_on: [3]
scope:
  - ngd-studio/server/stages/solver.ts
  - ngd-studio/server/stages/modelHarness.ts
  - ngd-studio/server/stages/cache.ts
  - ngd-studio/lib/__tests__/providerDeepSeek.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: Solver harness

> **범위**: Backend / AI model stage
> **난이도**: M
> **의존성**: Phase 3
> **영향 파일**: `server/stages/solver.ts` 신규

## 배경

`create.solver`는 DeepSeek 후보지만, 수학 오답과 HWP equation syntax 리스크가 verifier보다 크다. 따라서 verifier harness와 validation telemetry가 선행되어야 한다.

## 설계

`server/stages/solver.ts`에 solver input/output 타입과 validator를 추가한다. output은 answer, explanation parts, equation/text segments처럼 cache schema에 맞는 구조로 제한한다. HWP equation lint는 deterministic validator hook으로 분리한다.

## 체크리스트

- [x] solver input/output 타입과 validator 추가
- [x] bounded solver prompt builder 추가
- [x] answer/explanation schema validation 추가
- [x] equation/text segment validation hook 추가
- [x] verifier로 downstream validation 가능한 구조 유지

## 영향 범위

solver model output 품질에 영향을 준다. 기존 legacy solver agent fallback을 제거하지 않는다.

## 검증

```bash
pnpm exec tsc --noEmit
```

## 실행 결과

### 2026-05-17 Phase 4

- `server/stages/solver.ts`에 solver input/output 타입, JSON-only prompt builder, validator, runner를 추가했다.
- answer/explanation segment schema와 equation/text segment validation hook을 추가했다.
- 검증된 solver output만 `qNN_solved.json` cache에 기록하고 verifier가 사용할 context 구조를 유지했다.
- 검증: `pnpm exec tsc --noEmit`, `pnpm test -- --run lib/__tests__/providerDeepSeek.test.ts` 통과.
