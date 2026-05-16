---
phase: 3
title: SSE provider 선택 수용
status: completed
depends_on: [2]
scope:
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/ai/
  - ngd-studio/lib/__tests__/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: SSE provider 선택 수용

> **범위**: Backend + client runner
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `server/sse.ts`, `lib/useJobRunner.ts`, `lib/store.ts`

## 배경

SSE 서버는 현재 provider 개념 없이 무조건 Claude를 실행한다. provider 선택을 request body와 job metadata에 포함하되, provider 미지정 요청은 기존과 동일하게 Claude로 처리해야 한다.

## 설계

`POST /api/run` body에 선택 필드 `provider?: AIProviderId`를 추가한다. 기본값은 `auto`로 받되 1차 구현에서는 `auto -> claude`로 해석한다. `jobData`에는 실제 선택된 provider와 요청 provider를 기록한다.

`useJobRunner.startJob()`도 선택 provider를 받을 수 있게 확장한다. Phase 5 전까지는 호출자가 넘기지 않으므로 기존 UI는 무회귀여야 한다.

## 체크리스트

- [x] `/api/run` request body type에 `provider?: AIProviderId` 추가
- [x] provider 미지정 또는 `auto` 요청이 Claude provider로 해석됨
- [x] `server/sse.ts`가 registry를 통해 provider를 실행함
- [x] job JSON에 `requestedProvider`와 `provider` 기록
- [x] `useJobRunner.startJob()`이 optional provider를 전달할 수 있음
- [x] 기존 create/review/crop/resume 요청 테스트가 무회귀로 통과함

## 영향 범위

API body는 하위호환 필드 추가만 한다. 기존 클라이언트와 스크립트는 provider를 보내지 않아도 계속 동작해야 한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/provider*.test.ts lib/__tests__/store.test.ts --reporter=basic
pnpm test
```

## 실행 결과

### 2026-05-16 — Phase 3

#### Summary
- `/api/run` body에 `provider?: AIProviderId`를 추가하고 미지정/빈 값은 `auto`, `auto`는 현재 `claude`로 해석하게 했다.
- `server/sse.ts`가 `runAIProvider()` registry path를 통해 provider를 실행하도록 변경했다.
- job JSON 초기/최종 저장 데이터에 `requestedProvider`와 resolved `provider`를 기록한다.
- `useJobRunner.startJob()`에 optional provider 인자를 추가해 기존 호출은 그대로 유지하면서 provider 전달이 가능하게 했다.
- registry 테스트에 provider normalization/invalid value 회귀 테스트를 추가했다.

#### Scope Audit (orchestrator)
- pass — changed files are within Phase 3 scope: `ngd-studio/server/sse.ts`, `ngd-studio/lib/useJobRunner.ts`, `ngd-studio/lib/ai/`, `ngd-studio/lib/__tests__/providerRegistry.test.ts`

#### Verification Re-run (orchestrator)
- pass — `npx vitest run lib/__tests__/provider*.test.ts lib/__tests__/store.test.ts --reporter=basic` (14 tests)
- pass — `pnpm test` (68 tests)
- pass — `npx tsc --noEmit`

#### Review (orchestrator)
- pass — provider field is additive; existing clients omit it and still resolve to Claude.

#### Commit
- pending — commit will be recorded in `checklist.md` after local commit creation.
