---
phase: 1
title: Stage 타입 기반 추가
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/types.ts
  - ngd-studio/lib/ai/types.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: Stage 타입 기반 추가

> **범위**: Backend / Shared TypeScript
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `server/stages/types.ts` 신규, `lib/ai/types.ts`

## 배경

현재 `AIStageKey`는 provider override 대상인 `create.extractor`, `create.solver`, `create.verifier`, `review.reviewer`만 표현한다. Stage runner foundation은 전체 workflow stage와 model-call stage를 분리해야 한다.

## 설계

`ngd-studio/server/stages/types.ts`를 새로 추가한다. 최소 타입 후보:

- `WorkflowStageKey`: `cropper`, `create.cleaned`, `create.extractor`, `create.review_extract`, `create.solver`, `create.verifier`, `create.aggregate`, `figure`, `builder`, `checker`, `review.reviewer`
- `StageRunContext`
- `StageRunner<Input, Output>`
- `StageResult<Output>`
- `StageError`
- `StageFile`
- `ValidationResult`

`ngd-studio/lib/ai/types.ts`의 기존 `AIStageKey`는 유지한다. 필요하면 주석이나 type alias로 "provider/model stage key" 의미를 명확히 하되, 기존 테스트와 UI가 깨지지 않게 한다.

## 체크리스트

- [x] `ngd-studio/server/stages/types.ts` 신규 추가
- [x] `WorkflowStageKey`와 기존 `AIStageKey`의 책임 경계를 코드에서 명확히 표현
- [x] `StageRunContext`, `StageRunner`, `StageResult`, `StageError` 타입 정의
- [x] 기존 `AIStageKey` import/API 호환 유지
- [x] TypeScript/Vitest focused 검증 통과

## 영향 범위

신규 타입 기반 작업이다. 실제 `/api/run` 실행 경로는 변경하지 않는다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerSettings.test.ts lib/__tests__/providerRetry.test.ts
```

## 실행 결과

### 2026-05-16

- `server/stages/types.ts`를 추가해 workflow stage key와 stage runner/result/error/file/validation 타입 기반을 정의했다.
- `lib/ai/types.ts`의 `AIStageKey`는 기존 union과 API를 유지하고, provider/model-call stage key라는 책임을 주석으로 명확히 했다.
- 검증: `pnpm test -- --run lib/__tests__/providerSettings.test.ts lib/__tests__/providerRetry.test.ts`, `pnpm exec tsc --noEmit` 통과.
