---
phase: 5
title: dead code 정리 (jobRunner, branchHelper, legacy prompts, tests)
status: completed
depends_on: [2, 4]
scope:
  - ngd-studio/server/stages/jobRunner.ts
  - ngd-studio/server/stages/branchHelper.ts
  - ngd-studio/server/__tests__/sse.branch.test.ts
  - ngd-studio/lib/prompts.ts
  - ngd-studio/lib/__tests__/prompts.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers:
  - create-v4-full-pipeline
---

# Phase 5: dead code 정리

> **범위**: Backend
> **난이도**: S
> **의존성**: Phase 2 (followup orchestrator), Phase 4 (sse orchestrator)
> **영향 파일**: `server/stages/jobRunner.ts`, `server/stages/branchHelper.ts`, `lib/prompts.ts`, 관련 테스트

## 배경

Phase 02 (followup) + Phase 04 (sse) 가 `runLegacyPromptJob` 호출처를 모두 제거한 후, 다음 코드는 dead 가 된다:

- `server/stages/jobRunner.ts` 의 `runLegacyPromptJob` — 호출처 0건
- `server/stages/branchHelper.ts` 의 `shouldUseCodeOrchestrator` — 호출처 0건
- `lib/prompts.ts` 의 `buildCreatePrompt` / `buildResumePrompt` / `buildReviewPrompt` — 호출처 0건 (buildCropPrompt 만 유지)
- `server/__tests__/sse.branch.test.ts` — branchHelper 단위 테스트, helper 가 삭제되면 의미 없음
- `lib/__tests__/prompts.test.ts` 의 buildCreatePrompt / buildResumePrompt / buildReviewPrompt 테스트 — 대응 prompt 삭제

본 phase 는 위 dead code 를 일괄 삭제하고 타입/테스트 통과를 검증한다.

## 설계

### 1. 파일 삭제

```
ngd-studio/server/stages/jobRunner.ts          ← runLegacyPromptJob 통째로 사용 안 함
ngd-studio/server/stages/branchHelper.ts        ← shouldUseCodeOrchestrator 통째로 사용 안 함
ngd-studio/server/__tests__/sse.branch.test.ts  ← branchHelper 단위 테스트
```

### 2. `lib/prompts.ts` 축소

`buildCreatePrompt`, `buildResumePrompt`, `buildReviewPrompt` 삭제. `buildCropPrompt` 만 유지.

### 3. `lib/__tests__/prompts.test.ts` 축소

삭제된 prompt 빌더 테스트 제거. crop 관련 테스트는 유지 (존재하는 경우).

### 4. import 정리 (사전 grep)

phase 5 시작 시 다음 grep 으로 dead import 가 남아 있지 않은지 확인:

```bash
cd ngd-studio
grep -rn "runLegacyPromptJob\|shouldUseCodeOrchestrator" --include="*.ts" --include="*.tsx" .
grep -rn "buildCreatePrompt\|buildResumePrompt\|buildReviewPrompt" --include="*.ts" --include="*.tsx" .
```

위 grep 결과가 본인 정의/테스트 외 0건이어야 phase 02, 04 가 잘 끝난 것. 만약 남아 있으면 phase 02 또는 04 로 돌아가 처리.

### 5. 타입 + 테스트 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/ server/__tests__/ lib/__tests__/ --reporter=basic
```

## 체크리스트

- [x] `grep -rn "runLegacyPromptJob\|shouldUseCodeOrchestrator"` 결과가 본인 정의/테스트 외 0건임을 확인
- [x] `server/stages/jobRunner.ts` 파일 삭제
- [x] `server/stages/branchHelper.ts` 파일 삭제
- [x] `server/__tests__/sse.branch.test.ts` 파일 삭제
- [x] `lib/prompts.ts` 에서 `buildCreatePrompt`, `buildResumePrompt`, `buildReviewPrompt` export 삭제 (buildCropPrompt 만 유지)
- [x] `lib/__tests__/prompts.test.ts` 에서 삭제된 빌더 대응 테스트 제거
- [x] `cd ngd-studio && npx tsc --noEmit && npx vitest run server/stages/__tests__/ server/__tests__/ lib/__tests__/ --reporter=basic` 통과

## 영향 범위

- **production 동작**: 변경 없음 (이미 phase 02, 04 에서 호출처 제거 완료).
- **`lib/claude.ts`**: 유지. `runClaude` (Claude CLI spawn helper) 는 `claudeCliProvider` 가 의존. `transformToSSE`, `fromWslPath` 는 provider 레이어 외부에서도 사용 (phase 03 의 crop 인라인 헬퍼, sse.ts) — 유지.
- **`server/stages/cleanup.ts` 등 다른 stage runner**: 영향 없음 (jobRunner.ts 와 별도).

## 검증

```bash
cd ngd-studio
grep -rn "runLegacyPromptJob\|shouldUseCodeOrchestrator\|buildCreatePrompt\|buildResumePrompt\|buildReviewPrompt" --include="*.ts" --include="*.tsx" . | grep -v node_modules
# → 본인 정의 / 의도된 테스트 외 0건이어야 함 (이상적으로는 0건)

npx tsc --noEmit
npx vitest run server/stages/__tests__/ server/__tests__/ lib/__tests__/ --reporter=basic
```

## 실행 결과

### run-1779378207-3137 (2026-05-22)

- grep 선행 확인: `runLegacyPromptJob`, `shouldUseCodeOrchestrator`, `buildCreatePrompt`, `buildResumePrompt`, `buildReviewPrompt` 모두 정의/테스트 파일 외 외부 호출처 0건 확인.
- `server/stages/jobRunner.ts` 삭제 완료.
- `server/stages/branchHelper.ts` 삭제 완료.
- `server/__tests__/sse.branch.test.ts` 삭제 완료.
- `lib/prompts.ts`: `buildCreatePrompt`, `buildResumePrompt`, `buildReviewPrompt` 제거 — `buildCropPrompt`만 유지.
- `lib/__tests__/prompts.test.ts`: 삭제된 빌더 테스트 3개 describe 블록 제거 — `buildCropPrompt` 테스트만 유지.
- `npx tsc --noEmit`: 오류 0건.
- `npx vitest run`: 28개 파일, 510개 테스트 전부 통과.

#### Scope Audit (orchestrator)
pass — 5 files in scope (jobRunner/branchHelper/sse.branch.test 삭제 + prompts.ts/prompts.test.ts 수정)

#### Verification Re-run (orchestrator)
exit 0 — grep 0건, tsc exit 0. 초회 vitest에서 `providerDeepSeekLive.test.ts > extractor + solver + verifier full e2e` 1건 fail (외부 DeepSeek API flaky, Phase 5 변경과 인과 무관) → 재실행 시 4/4 pass 확인.

#### Simplify (orchestrator)
skipped — phase 성격이 삭제 위주. prompts.ts/test는 워커가 buildCropPrompt만 남기는 축소 작업으로 이미 simplest 형태.

#### Review (orchestrator)
VERDICT: pass — 5개 파일 모두 스펙 그대로 처리. 외부 import 잔류 0건 grep 확인.

#### Commit
0c4392c — refactor(cleanup): Phase 5 — dead code 정리
