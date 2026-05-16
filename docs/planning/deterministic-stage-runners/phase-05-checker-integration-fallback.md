---
phase: 5
title: Checker 통합과 fallback 보존
status: completed
depends_on: [4]
scope:
  - ngd-studio/server/stages/checker.ts
  - ngd-studio/server/stages/jobRunner.ts
  - ngd-studio/server/stages/events.ts
  - ngd-studio/lib/claude.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 5: Checker 통합과 fallback 보존

> **범위**: Backend / Shared SSE
> **난이도**: M
> **의존성**: Phase 4
> **영향 파일**: `server/stages/jobRunner.ts`, `server/stages/checker.ts`

## 배경

Checker rule runner는 deterministic issue list를 만들 수 있지만, 의미 판단과 원본 비교는 여전히 agent가 필요하다. 따라서 통합 단계에서는 rule 결과를 stage event와 job metadata에 반영하고, agent fallback을 보존해야 한다.

## 설계

checker runner를 job runner 확장 지점에 연결한다. deterministic issue가 있으면 structured log/result로 남기고, ambiguous 항목 또는 자동 수정 불가 항목은 legacy checker/reviewer agent fallback 대상으로 넘길 수 있게 한다.

## 체크리스트

- [x] checker runner result를 SSE log/progress/result에 반영
- [x] checker issue list를 job metadata 또는 cache에 저장
- [x] semantic/ambiguous 항목은 fallback 대상으로 분리
- [x] legacy checker stage detection이 깨지지 않음
- [x] focused test 또는 TypeScript 검증 통과

## 영향 범위

checker event shape와 stage status에 영향을 줄 수 있다. 기존 `transformToSSE()` 기반 legacy checker 감지는 유지한다.

## 검증

```bash
pnpm test -- --run lib/__tests__/claude.test.ts
```

## 실행 결과

### 2026-05-16

STATUS: completed
PHASE: 5
SUMMARY: `resumeFrom === "checker"` 경로에 deterministic checker runner를 opt-in 연결했습니다. SSE stage/progress/result/log를 기록하고 `checkerResult`를 job JSON metadata에 저장하며, deterministic issue 또는 ambiguous fallback 필요 시 legacy checker workflow로 넘어갑니다.
CHECKLIST: 5/5
VERIFICATION: pass
NEXT: Phase 6 진행 가능
COMMIT: 7aedeeb

#### Scope Audit (orchestrator)

pass — 1 file in scope

#### Verification Re-run (orchestrator)

exit 0 — `pnpm test -- --run lib/__tests__/claude.test.ts` 통과
