---
phase: 2
title: Deterministic builder runner
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/builder.ts
  - ngd-studio/server/stages/cache.ts
  - ngd-studio/server/stages/commands.ts
  - ngd-studio/lib/__tests__/stageFoundation.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: Deterministic builder runner

> **범위**: Backend
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `server/stages/builder.ts` 신규

## 배경

`ngd-exam-builder` agent의 정상 경로는 `exam_data.json -> build_hwpx.py -> fix_namespaces.py -> validate.py --fix`로 정리할 수 있다. 이 경로는 모델 판단보다 deterministic script 실행과 결과 검증에 가깝다.

## 설계

`server/stages/builder.ts`에 `runBuilderStage()` 또는 `builderStageRunner`를 추가한다. 입력은 `exam_data.json`, template/output 경로, cache helper이며 출력은 HWPX path, build status, command summaries다. script path는 기존 repo 구조를 확인해 현재 파일 위치 기준으로 안전하게 계산한다.

## 체크리스트

- [x] builder `StageRunner` 또는 동등한 runner 추가
- [x] `build_hwpx.py` 실행 결과에서 output HWPX path 확인
- [x] namespace fix / validation command hook 추가
- [x] `build_status.json` write helper 사용
- [x] 실패 원인을 typed error 또는 status로 반환
- [x] focused test 또는 TypeScript 검증 통과

## 영향 범위

정상 builder path를 서버 코드로 옮길 준비만 한다. 실제 `/api/run` 연결은 Phase 3에서 수행한다.

## 검증

```bash
pnpm exec tsc --noEmit
```

## 실행 결과

### 2026-05-16

STATUS: completed
PHASE: 2
SUMMARY: `server/stages/builder.ts`에 deterministic builder `StageRunner`를 추가했습니다. `build_hwpx.py -> fix_namespaces.py -> validate.py --fix` 순서를 실행하고, stdout에서 HWPX 경로를 추출해 `build_status.json`과 `StageResult`에 반영합니다.
CHECKLIST: 6/6
VERIFICATION: pass
NEXT: Phase 3 진행 가능. Phase 4도 Phase 1 의존성이 충족되어 진행 가능.
COMMIT: pending

#### Scope Audit (orchestrator)

pass — 2 files in scope

#### Verification Re-run (orchestrator)

exit 0 — `pnpm exec tsc --noEmit` 통과
