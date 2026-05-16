---
phase: 1
title: Runner command foundation
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/commands.ts
  - ngd-studio/server/stages/types.ts
  - ngd-studio/lib/__tests__/stageFoundation.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: Runner command foundation

> **범위**: Backend
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `server/stages/commands.ts` 신규

## 배경

Builder와 checker runner는 Python script와 deterministic validation command를 실행해야 한다. `runLegacyPromptJob()`은 provider process를 다루지만, deterministic runner에는 stdout/stderr/exit code를 typed result로 받는 작은 command helper가 필요하다.

## 설계

`server/stages/commands.ts`를 추가한다. `runStageCommand()`는 command, args, cwd, env, timeout 옵션을 받아 stdout/stderr/exitCode/elapsedMs를 반환한다. timeout, spawn 실패, non-zero exit를 `StageError` 또는 명확한 result field로 표현한다.

## 체크리스트

- [x] `runStageCommand()` 또는 동등한 command helper 추가
- [x] stdout/stderr/exitCode/elapsedMs typed result 정의
- [x] timeout/spawn 실패/non-zero exit를 구분 가능하게 표현
- [x] `StageError`와 호환되는 에러 변환 helper 추가
- [x] focused test 또는 TypeScript 검증 통과

## 영향 범위

새 helper만 추가한다. `/api/run`, legacy prompt workflow, builder/checker agent fallback은 변경하지 않는다.

## 검증

```bash
pnpm exec tsc --noEmit
```

## 실행 결과

### 2026-05-16

STATUS: completed
PHASE: 1
SUMMARY: `server/stages/commands.ts`에 deterministic stage command helper를 추가하고, stdout/stderr/exitCode/elapsedMs 및 timeout/spawn/non-zero 상태를 typed result로 구분했습니다. `stageCommandToError()`로 `StageError` 호환 변환을 제공합니다.
CHECKLIST: 5/5
VERIFICATION: pass
NEXT: Phase 2 또는 Phase 4 진행 가능
COMMIT: 990e836

#### Scope Audit (orchestrator)

pass — 2 files in scope

#### Verification Re-run (orchestrator)

exit 0 — `pnpm exec tsc --noEmit` 통과
