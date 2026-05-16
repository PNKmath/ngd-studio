---
phase: 6
title: Foundation tests / docs 정리
status: completed
depends_on: [5]
scope:
  - ngd-studio/server/stages/__tests__/
  - ngd-studio/lib/__tests__/
  - docs/planning/stage-runner-foundation/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 6: Foundation tests / docs 정리

> **범위**: Tests / Documentation
> **난이도**: S
> **의존성**: Phase 5
> **영향 파일**: `server/stages/__tests__/`, planning docs

## 배경

Foundation 작업은 후속 task의 기반이므로 최소 focused test와 문서 정리가 필요하다. 문서에는 SQLite 제외, legacy workflow 유지, 후속 task 연결을 명시해야 한다.

## 설계

새 helper에 대한 focused test를 추가하거나 기존 provider/SSE 테스트를 보강한다. 전체 task checklist의 공통 검증을 완료 상태로 갱신한다.

## 체크리스트

- [x] stage types/cache/events/telemetry helper focused test 추가 또는 기존 테스트 보강
- [x] `pnpm test` 또는 합리적 focused Vitest 명령 통과
- [x] `docs/planning/stage-runner-foundation/checklist.md` 공통 검증 갱신
- [x] 실행 결과에 SQLite 제외, legacy 유지, 후속 task 연결 명시
- [x] 다음 추천 task를 `deterministic-builder-runner`로 기록

## 영향 범위

테스트와 planning 문서 정리 phase다. production behavior 변경은 Phase 5에서 이미 끝난 상태여야 한다.

## 검증

```bash
pnpm test
```

## 실행 결과

### 2026-05-16

- `lib/__tests__/stageFoundation.test.ts`를 추가해 JobStore, StageCache, SSE event helper, stage telemetry 변환을 검증했다.
- README에 SQLite 제외, legacy workflow 유지, builder/checker/DeepSeek stage 미이관, 다음 추천 task `deterministic-builder-runner`를 기록했다.
- 검증: `pnpm test` 12 files / 103 tests 통과, `pnpm exec tsc --noEmit` 통과.
