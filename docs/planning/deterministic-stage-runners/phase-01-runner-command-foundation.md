---
phase: 1
title: Runner command foundation
status: pending
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

- [ ] `runStageCommand()` 또는 동등한 command helper 추가
- [ ] stdout/stderr/exitCode/elapsedMs typed result 정의
- [ ] timeout/spawn 실패/non-zero exit를 구분 가능하게 표현
- [ ] `StageError`와 호환되는 에러 변환 helper 추가
- [ ] focused test 또는 TypeScript 검증 통과

## 영향 범위

새 helper만 추가한다. `/api/run`, legacy prompt workflow, builder/checker agent fallback은 변경하지 않는다.

## 검증

```bash
pnpm exec tsc --noEmit
```
