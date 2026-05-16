---
phase: 3
title: SSE event helper 분리
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/events.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/claude.ts
  - ngd-studio/lib/useJobRunner.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: SSE event helper 분리

> **범위**: Backend / Shared SSE
> **난이도**: S
> **의존성**: Phase 1
> **영향 파일**: `server/stages/events.ts` 신규

## 배경

현재 SSE event 생성은 `server/sse.ts`, `lib/claude.ts`의 legacy provider stream 변환, `useJobRunner` event handler에 분산되어 있다. 새 StageRunner path에서는 provider stream이 아니라 서버 runner가 stage/log/progress/file/result/error event를 직접 emit해야 한다.

## 설계

`ngd-studio/server/stages/events.ts`에 server-runner용 event factory/helper를 추가한다. 기존 `SSEEvent` shape와 호환되어야 하며, `transformToSSE()`는 legacy path로 유지한다.

## 체크리스트

- [x] stage/log/progress/file/result/error event helper 추가
- [x] 기존 `SSEEvent` shape와 호환
- [x] `transformToSSE()`는 legacy provider path로 유지
- [x] `useJobRunner` event handler 변경이 필요하면 호환 범위 안에서만 수정
- [x] focused test 또는 기존 SSE 관련 Vitest 통과

## 영향 범위

이 phase는 event 생성 helper를 추가하는 작업이다. `/api/run` 실행 semantics를 바꾸지 않는다.

## 검증

```bash
pnpm test -- --run lib/__tests__/claude.test.ts
```

## 실행 결과

### 2026-05-16

- `server/stages/events.ts`를 추가해 server-runner용 `stage/log/progress/file/result/error` SSE event factory를 제공했다.
- 기존 `lib/claude.ts`의 `transformToSSE()` legacy provider stream 변환과 `useJobRunner` event handler는 동작 변경 없이 유지했다.
- 검증: `pnpm test -- --run lib/__tests__/claude.test.ts`, `pnpm exec tsc --noEmit` 통과.
