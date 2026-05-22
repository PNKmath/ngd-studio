---
phase: 4
title: checker 가드 누락 path 추적 + 적용 (legacy/resume 흐름 의심)
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "추적 후 진짜 root cause 위치에 가드 추가 — 위치가 사전에 확정 안 됨"
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 4: checker 가드 누락 path 추적 + 적용

> **범위**: Backend (추적 + 가드 추가)
> **난이도**: M (디버깅 + 코드 추적)
> **의존성**: 없음 (Phase 1 가드는 이미 있으나 일부 path 우회)

## 배경

Phase 1 에서 `orchestrator.ts:1020` 에 `checkerAttempts > 0` 가드를 추가해 `checkerMaxAttempts=0` 시 checker stage 진입을 차단했다. 하지만 **사용자 보고 (2026-05-23)**:

> "새 작업 시 '자동 수정'을 체크하지 않았는데도,
> [checker]
> deterministic checker runner를 실행합니다.
> [checker]
> 검수 완료: 9건 issue"

즉 Phase 1 의 가드가 새 작업 흐름에서 **안 먹은** 케이스 존재. 가능한 root cause:

1. **input.checkerMaxAttempts 가 0이 아닌 default(2) 로 들어옴** — `useJobRunner.ts:108` 는 `aiSettings.checkerMaxAttempts` 를 그대로 body 에 담는데, 새 작업 path 또는 작업 재개 path 에서 별도 default 처리가 끼어들 가능성. `sse.ts:487` 매핑 또는 그 이전.
2. **별도 path 가 가드를 우회** — `CLAUDE.md` 의 "신규 흐름 vs legacy 흐름" 명시: `/settings` 에서 create.* stage override 미지정 시 `runLegacyPromptJob` (Claude CLI + `ngd-exam-create` skill) 경로로 진행. 이 legacy path 가 별도로 checker 를 호출한다면 Phase 1 가드 미적용. (단 현재 grep 으론 `runLegacyPromptJob` 함수가 코드에 없어 보임 — 명칭이 다르거나 deprecated 된 가능성, 추적 필요)
3. **체크박스 onChange 가 발화 안 함** — Phase 2 의 onChange 가 새 작업 시작 시 stale state 로 0 대신 2 가 전달. 가능성 낮으나 배제 불가.

**인과 사슬 self-audit** (Phase-init Step 2.5):
- "사용자 보고된 checker 호출 → orchestrator.ts:1020 가드 우회" — `verified` (가드는 있음, 호출은 일어남)
- "우회 경로 = legacy / resume / 다른 endpoint" — `assumed` (코드 grep 으론 legacy 함수 미확인). **load-bearing 단계 — worker 가 먼저 재현해서 확정**.
- 가설을 코드에 박지 말고, **worker 가 1단계로 재현 + 격리** 후 2단계로 가드 추가.

## 설계

### 1. 재현 + 격리 (worker 가 먼저 수행)

1. localStorage 상태를 `checkerMaxAttempts: 0` 으로 강제 설정 후 새 작업 흐름 한 번 실행 (수동 smoke 또는 `console.log` 디버그 트레이스 임시 삽입).
2. 다음 지점에 임시 로그 추가해 `checkerMaxAttempts` 값 추적:
   - `useJobRunner.ts:108` (body 로 보내기 직전)
   - `sse.ts:487` (input 으로 매핑되는 시점)
   - `orchestrator.ts:1019` (가드 직전)
3. 어느 지점에서 0 이 아닌 값(또는 undefined) 으로 변하는지 확인.

추가 확인 — 다른 진입점:
- `/api/run` 외의 endpoint 가 orchestrator 또는 `runCheckerWithAutoFix` 를 직접 호출하는지 grep
- `runCheckerWithAutoFix` 의 caller 전수 (`grep -rn "runCheckerWithAutoFix(" ngd-studio/`)
- `runLegacyPromptJob` / `ngd-exam-create` skill 진입점 코드 존재 여부 재확인

### 2. 가드 적용

재현된 root cause 위치에 맞춰:

- **case A (input 전파 누락)**: `sse.ts:487` 직전에 `checkerMaxAttempts: body.checkerMaxAttempts ?? aiSettings default ?? 2` 같은 명시 fallback 추가 또는 useJobRunner 호출부 점검.
- **case B (다른 path 우회)**: 해당 path 진입점에 `checkerMaxAttempts === 0` 가드 추가 (orchestrator.ts:1020 패턴 복제).
- **case C (체크박스 stale state)**: page.tsx onChange + read 흐름 재검토 — Phase 6 와 영역 겹치므로 보고만, 직접 수정 X.

가드 추가 위치는 **재현 결과 보고서에 명시** 후 결정. Phase 4 worker 가 case 별 분기 판단.

### 3. 임시 로그 제거

진단용 console.log / 임시 로그는 fix 적용 후 모두 제거. PR 에 진단 로그 남기지 말 것.

## 체크리스트

- [x] ⓐ `checkerMaxAttempts=0` 상태에서 새 작업 시작 시 실제 input 값을 추적해 root cause 위치 격리 (useJobRunner / sse / 다른 path)
- [x] ⓑ 재현 결과를 `## 실행 결과 → #### 요약` 에 case A/B/C 분기와 함께 기록
- [x] ⓒ 격리된 위치에 가드 추가 (또는 input 전파 fix). orchestrator.ts:1020 의 기존 가드 패턴 유지.
- [x] ⓓ 진단용 임시 로그 모두 제거 + 회귀 확인

## 영향 범위

- **변경 파일**: 1-2개 (orchestrator.ts 또는 sse.ts 또는 다른 path 진입점)
- **호환성**: 입력 인터페이스 변경 없음. SSE event 인터페이스 변경 없음. 사용자 측 영향은 가드가 모든 path 에서 일관 적용.
- **롤백 전략**: git revert 단일 커밋
- **e2e 영향**: `create-v4-full-pipeline` — 자동검수 OFF 흐름이 정상 검증됨

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/checker.test.ts --reporter=basic

# 수동 smoke (Phase 4 끝나면 사용자가 직접):
# 1. 자동검수 체크 해제 + 새 작업 → 로그 패널에 "[checker] deterministic checker runner를 실행합니다." 라인 없음
# 2. 자동검수 체크 + 새 작업 → checker stage 정상 진행 + "검수 완료: N건 issue" 로그
```

## 실행 결과

### 1회차 (2026-05-23 01:48 KST) — needs_user

**상태**: needs_user
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약

root cause를 추적한 결과, Phase 1의 가드(`orchestrator.ts:1020`)는 **새 작업 (sse.ts → api/run) 경로에서는 정상 작동**한다. 문제는 다른 진입점인 `app/api/run/[jobId]/followup/route.ts`에서 `runStageOrchestrator`를 호출할 때 `checkerMaxAttempts`를 **전혀 전달하지 않는다**는 것이다. 이로 인해 orchestrator.ts:1019에서 `input.checkerMaxAttempts ?? 2`가 2로 default되어 checker가 항상 실행된다.

**case A/B/C 분기 결과:**
- **case A (input 전파 누락)**: 해당 경로 `sse.ts:487`에서는 `body.checkerMaxAttempts`가 정상 전달됨. 새 작업 경로(SSE path)는 문제 없음.
- **case B (다른 path 우회)**: **실제 root cause**. `app/api/run/[jobId]/followup/route.ts`가 `runStageOrchestrator`를 두 곳에서 호출(line 213 review mode, line 318 create/resume mode)하는데, 두 곳 모두 `checkerMaxAttempts` 전달 없음 → `input.checkerMaxAttempts = undefined → ?? 2 = 2 → checkerAttempts > 0 = true` → checker 항상 실행.
- **case C (체크박스 stale state)**: 해당 없음. 새 작업(startJob) 경로는 `readAISettings()`로 localStorage 값을 항상 fresh하게 읽어 전달한다.

**누락 트리거 시나리오:**
- "이미지 확인 완료" 버튼 → `sendResumeAction(jobId, "resume --from=builder", store)` → `/api/run/${jobId}/followup` POST → `followup/route.ts` → `runStageOrchestrator({ checkerMaxAttempts: 없음 })` → checker 실행

**in-scope 부분 완료:**
`sse.ts`의 job data 저장 시 `checkerMaxAttempts`와 `verifierMaxAttempts`를 함께 저장하도록 수정. 이로써 `followup/route.ts`에서 job file을 읽어 이 값을 orchestrator에 전달하는 것이 가능해진다.

**미완료 (scope 외):** `app/api/run/[jobId]/followup/route.ts` 수정 필요:
1. line ~177: `const checkerMaxAttempts = typeof job.checkerMaxAttempts === 'number' ? job.checkerMaxAttempts : 2;`
2. review mode orchResult 호출(line ~213): `checkerMaxAttempts` 추가
3. create/resume mode orchResult 호출(line ~318): `checkerMaxAttempts` 추가

#### 변경 파일
- `ngd-studio/server/sse.ts` (수정, +2줄 — job data에 checkerMaxAttempts/verifierMaxAttempts 저장 추가)

#### 검증 결과
- [x] `npx tsc --noEmit` → pass (출력 없음)
- [x] `npx vitest run server/stages/__tests__/checker.test.ts --reporter=basic` → pass (57 tests passed)

#### 추가 발견사항
- `followup/route.ts`에서 `stageSkip`도 job file에 저장돼 있지 않아 followup 경로에서 stageSkip도 누락될 수 있음. 하지만 phase scope 외이므로 별도 보고만.
- `followup/route.ts` 수정 시 verifierMaxAttempts도 동일 패턴으로 함께 전달할 것을 권고.

#### 질문 / 결정 사항
- **scope 확장 요청**: `app/api/run/[jobId]/followup/route.ts`를 Phase 4 scope에 추가해야 fix가 완전히 적용됨. 승인 시 3줄 변경으로 완료 가능.

### 2회차 (2026-05-23) — completed

**상태**: completed
**진행 모델**: claude-sonnet-4-6

#### 요약

1회차에서 식별한 root cause에 `app/api/run/[jobId]/followup/route.ts` 수정 적용:

1. line ~180: `checkerMaxAttempts`와 `verifierMaxAttempts`를 job 파일에서 읽어 추출 (number 타입 가드 포함, fallback: checker=2, verifier=3)
2. review mode 호출(line ~215)에 두 값 모두 추가
3. create/resume mode 호출(line ~330)에 두 값 모두 추가

이로써 "이미지 확인 완료" 버튼 → `followup/route.ts` 경로에서도 최초 작업 시작 시 저장된 `checkerMaxAttempts=0` 값이 orchestrator에 올바르게 전달되어, Phase 1의 `checkerAttempts > 0` 가드가 resume/followup 경로에서도 정상 작동한다.

#### 변경 파일
- `ngd-studio/app/api/run/[jobId]/followup/route.ts` (수정, +6줄 — checkerMaxAttempts/verifierMaxAttempts 전달 추가)

#### 검증 결과
- [x] `npx tsc --noEmit` → pass (출력 없음)
- [x] `npx vitest run server/stages/__tests__/checker.test.ts --reporter=basic` → pass (57 tests passed)
