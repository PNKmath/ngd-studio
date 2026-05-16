---
phase: 2
title: 파일 기반 JobStore / StageCache helper
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/cache.ts
  - ngd-studio/server/stages/jobStore.ts
  - ngd-studio/server/sse.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: 파일 기반 JobStore / StageCache helper

> **범위**: Backend
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `server/stages/cache.ts`, `server/stages/jobStore.ts` 신규

## 배경

현재 `server/sse.ts`가 `data/jobs/{jobId}.json`을 직접 쓰고, `.v3cache` 파일 규약은 skill/agent 문서에 흩어져 있다. SQLite는 이번 task에서 도입하지 않고, 기존 파일 기반 상태 저장을 helper로 감싼다.

## 설계

`jobStore.ts`는 job metadata read/write helper를 제공한다. `cache.ts`는 `.v3cache`, question JSON, `exam_data.json`, `figure_status.json`, `build_status.json` 경로 helper를 제공한다.

서버 helper는 path join과 directory creation을 담당하되, 기존 파일 구조와 호환되어야 한다.

## 체크리스트

- [x] `JobStore` 또는 동등한 job JSON read/write helper 추가
- [x] `StageCache` 또는 동등한 `.v3cache` 경로 helper 추가
- [x] `data/jobs/{jobId}.json` 기존 구조와 호환
- [x] SQLite 또는 새 DB dependency 추가 없음
- [x] 파일 write/read 실패를 typed error 또는 명확한 Result로 표현
- [x] focused test 또는 TypeScript 검증 통과

## 영향 범위

기존 `server/sse.ts`의 직접 path/write 로직을 helper로 일부 이동할 수 있다. 동작은 유지해야 하며 job JSON field를 제거하지 않는다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerRetry.test.ts
```

## 실행 결과

### 2026-05-16

- `server/stages/jobStore.ts`를 추가해 기존 `data/jobs/{jobId}.json` 파일 구조를 유지하는 read/write/update/list helper를 만들었다.
- `server/stages/cache.ts`를 추가해 `.v3cache`, `.v3cache_prev`, question image, `exam_data.json`, `figure_status.json`, `build_status.json` 경로 규약을 한 곳에 모았다.
- `server/sse.ts`의 초기/최종 job JSON 저장을 `JobStore` 호출로 대체했다.
- 검증: `pnpm test -- --run lib/__tests__/providerRetry.test.ts`, `pnpm exec tsc --noEmit` 통과.
