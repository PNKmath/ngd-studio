---
phase: 1
title: Model stage contract
status: pending
depends_on: []
scope:
  - ngd-studio/server/stages/model.ts
  - ngd-studio/server/stages/types.ts
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/__tests__/stageFoundation.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: Model stage contract

> **범위**: Backend / AI contract
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `server/stages/model.ts` 신규

## 배경

현재 `AIProviderAdapter.run(prompt)`는 legacy agent workflow와 API model call을 같은 모양으로 다룬다. DeepSeek V4는 repo/file editing agent가 아니므로, stage input/output schema를 서버가 소유하는 bounded model stage contract가 필요하다.

## 설계

`server/stages/model.ts`에 `ModelStageRunner`, `ModelStageInput`, `ModelStageResult`, `StageModelProvider` 또는 동등한 타입을 추가한다. 기존 `AIStageKey`는 provider override 대상 모델 stage key로 유지한다.

## 체크리스트

- [ ] model stage input/output/result 타입 추가
- [ ] provider adapter와 stage harness 책임 경계 명시
- [ ] `AIStageKey`와 `WorkflowStageKey` 경계 유지
- [ ] file mutation 권한이 model provider 타입에 포함되지 않음
- [ ] legacy `AIProviderAdapter` API 호환 유지
- [ ] TypeScript 검증 통과

## 영향 범위

타입 기반 phase다. 실제 provider 호출 경로와 `/api/run` behavior는 변경하지 않는다.

## 검증

```bash
pnpm exec tsc --noEmit
```
