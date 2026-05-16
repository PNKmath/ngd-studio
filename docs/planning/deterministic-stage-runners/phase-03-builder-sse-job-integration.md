---
phase: 3
title: Builder SSE/job 통합
status: completed
depends_on: [2]
scope:
  - ngd-studio/server/stages/jobRunner.ts
  - ngd-studio/server/stages/builder.ts
  - ngd-studio/server/stages/events.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/useJobRunner.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: Builder SSE/job 통합

> **범위**: Backend / Shared SSE
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `server/stages/jobRunner.ts`, `server/sse.ts`

## 배경

Builder runner가 추가되어도 사용 경로에 연결되지 않으면 legacy agent workflow만 계속 사용된다. 단, 기존 create/resume prompt workflow를 제거하면 회귀 위험이 크므로 opt-in 또는 명확한 resume builder 경로부터 연결해야 한다.

## 설계

`runLegacyPromptJob()` 주변에 deterministic builder를 호출할 확장 지점을 추가한다. `resumeFrom === "builder"` 또는 후속 stage plan에서 builder만 실행하는 경우를 우선 대상으로 한다. 서버가 `stage/log/progress/file/result/error` event와 job metadata를 기록하되, 실패 시 legacy builder agent fallback을 유지한다.

## 체크리스트

- [x] builder runner 호출 경로를 legacy wrapper 주변에 추가
- [x] builder stage SSE event가 기존 `useJobRunner` shape와 호환
- [x] job JSON에 builder result/outputFile/status 반영
- [x] builder 실패 시 legacy fallback이 제거되지 않음
- [x] provider/model stage 실행 semantics 변경 없음

## 영향 범위

`/api/run` 주변 회귀 위험이 있다. create/resume/crop/review 전체 prompt behavior를 보존해야 한다.

## 검증

```bash
pnpm test -- --run lib/__tests__/claude.test.ts lib/__tests__/store.test.ts
```

## 실행 결과

### 2026-05-16

STATUS: completed
PHASE: 3
SUMMARY: `resumeFrom === "builder"` 또는 기존 confirm-builder 경로에서 deterministic builder runner를 먼저 실행하도록 SSE 서버에 opt-in 연결을 추가했습니다. 성공 시 builder stage/file/result 이벤트와 job output을 기록하고, 실패 시 legacy prompt workflow로 fallback합니다.
CHECKLIST: 5/5
VERIFICATION: pass
NEXT: Phase 5 진행 가능
COMMIT: f521c54

#### Scope Audit (orchestrator)

pass — 2 files in scope

#### Verification Re-run (orchestrator)

exit 0 — `pnpm test -- --run lib/__tests__/claude.test.ts lib/__tests__/store.test.ts` 통과
