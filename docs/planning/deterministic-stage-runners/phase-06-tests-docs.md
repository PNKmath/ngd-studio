---
phase: 6
title: Tests / docs 정리
status: completed
depends_on: [3, 5]
scope:
  - ngd-studio/lib/__tests__/
  - docs/planning/deterministic-stage-runners/
intervention_likely: false
intervention_reason: ""
executor: haiku
---

# Phase 6: Tests / docs 정리

> **범위**: Tests / Documentation
> **난이도**: S
> **의존성**: Phase 3, Phase 5
> **영향 파일**: `lib/__tests__/`, planning docs

## 배경

Deterministic runner는 후속 model stage harness의 기준점이므로 focused test와 문서 정리가 필요하다.

## 설계

builder/checker runner helper 테스트를 추가하거나 `stageFoundation.test.ts`를 보강한다. README에는 legacy fallback 유지, DeepSeek rollout 제외, 다음 작업이 model stage harness임을 기록한다.

## 체크리스트

- [x] builder runner focused test 추가 또는 보강
- [x] checker rule runner focused test 추가 또는 보강
- [x] `pnpm test` 또는 합리적 focused Vitest 명령 통과
- [x] README/checklist에 fallback 유지와 model harness 후속 연결 명시
- [x] 다음 추천 task를 `model-stage-harness-and-deepseek-rollout`로 기록

## 영향 범위

테스트와 문서 정리 phase다. production behavior 변경은 이전 phase에서 끝난 상태여야 한다.

## 검증

```bash
pnpm test
```

## 실행 결과

### 2026-05-16

STATUS: completed
PHASE: 6
SUMMARY: `stageFoundation.test.ts`에 command/builder/checker focused coverage를 보강했고, README/checklist에 legacy fallback 유지, model harness 제외, 다음 추천 task를 기록했습니다.
CHECKLIST: 5/5
VERIFICATION: pass
NEXT: `model-stage-harness-and-deepseek-rollout`
COMMIT: b7f1063

#### Scope Audit (orchestrator)

pass — 3 files in scope

#### Verification Re-run (orchestrator)

exit 0 — `pnpm test` 통과
