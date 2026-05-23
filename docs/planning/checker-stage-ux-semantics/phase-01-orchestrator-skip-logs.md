---
phase: 1
title: orchestrator — checkerMaxAttempts=0 시 stage skip + builder/checker 완료 logEvent
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/orchestrator.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "체크리스트 1번(checker skip 조건) 이 핵심 시맨틱 변경. 2·3번 logEvent 추가는 UX 보강."
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 1: orchestrator — checkerMaxAttempts=0 시 stage skip + builder/checker 완료 logEvent

> **범위**: Backend (orchestrator only)
> **난이도**: S (체크리스트 4항목)
> **의존성**: 없음

## 배경

사용자가 figure 확인 → HWPX 조립 시도하면서 발견한 두 가지 문제:

1. **자동수정 = 0 인데도 checker 가 호출됨** — `checkerMaxAttempts=0` 이면 `runCheckerWithAutoFix` 의 fallback 경로(`checker.ts:344`) 가 `runCheckerStage(input)` 한 번 호출 → 검사 1회 + fix 0회. 결과로 "9 issue(s)" 같은 카운트만 표시되고 사용자에게 actionable 한 정보 부재. **사용자 결정**: 0 = stage 자체 skip.

2. **builder/checker 완료가 로그 패널에 안 보임** — `orchestrator.ts:973-979`(builder done), `:1052-1056`(checker done) 에서 `stageEvent` + `fileEvent` + `resultEvent` 만 emit, `logEvent` 없음 → 사용자 로그 패널만 응시하면 "두 줄 후 멈춤"으로 보임. 실제로는 다른 UI 영역(stage indicator, file download, result label)에 표시되지만 못 알아챔.

## 설계

### 1. checker stage 진입 조건에 0 분기 추가

`orchestrator.ts:1018` 현재:
```ts
if (!checkAborted() && shouldRunStage(startStage, "checker") && stillUnder("checker")) {
```

변경:
```ts
const checkerAttempts = input.checkerMaxAttempts ?? 2;
if (!checkAborted() && shouldRunStage(startStage, "checker") && stillUnder("checker") && checkerAttempts > 0) {
```

`checkerAttempts === 0` 이면 stage 진입 자체를 건너뛰므로 `stageEvent("checker", "running"|"done"|"failed")` 도 emit 되지 않음. UI 의 stage indicator 는 기본 pending 상태로 남아 자연스럽게 숨김 처리됨 (사용자는 "checker 가 없는 흐름" 으로 인지).

logEvent 보조 한 줄 — 사용자가 "왜 checker 가 없지?" 라고 헷갈리지 않게:
```ts
} else if (checkerAttempts === 0 && shouldRunStage(startStage, "checker") && stillUnder("checker")) {
  send(logEvent("system", "checker 단계 건너뜀 (자동수정 = 0).", "info"));
}
```

**대안 고려**: `stageEvent("checker", "skipped", ...)` 같은 새 status 도입. 현재 stageEvent 의 status 타입은 `"running" | "done" | "failed" | "pending"` 추정 — 신규 status 추가는 store/UI 양쪽 영향이라 본 phase 에서는 회피. 단순 미발화 + system 레벨 한 줄 로그가 최소 변경.

### 2. builder 완료 logEvent

`orchestrator.ts:973-979` 현재:
```ts
if (builderResult.status === "completed" && builderResult.output) {
  const relativeOutput = path.relative(baseDir, builderResult.output.hwpxPath);
  outputFile = relativeOutput;
  resultSummary = "builder 완료";
  send(progressEvent("builder", 100));
  send(stageEvent("builder", "done", { summary: resultSummary }));
  send(fileEvent({ type: "hwpx", name: path.basename(relativeOutput), path: relativeOutput }));
}
```

`fileEvent` 다음에 logEvent 한 줄 추가:
```ts
send(logEvent("builder", `HWPX 조립 완료 → ${relativeOutput}`, "info"));
```

### 3. checker 완료 logEvent

`orchestrator.ts:1052-1056` 현재:
```ts
if (checkerResult.status === "completed" && checkerResult.output) {
  const issueCount = checkerResult.output.issues.length;
  resultSummary = `checker 완료: ${issueCount} issue(s)${autofixed ? " (auto-fixed)" : ""}`;
  send(progressEvent("checker", 100, { issueCount }));
  send(stageEvent("checker", "done", { summary: resultSummary }));
}
```

`stageEvent` 다음에 logEvent 한 줄 추가:
```ts
send(logEvent("checker", `검수 완료: ${issueCount}건 issue${autofixed ? " (auto-fixed)" : ""}`, "info"));
```

checker failed 분기(`:1057-1062`)도 같은 패턴:
```ts
} else {
  const issueCount = checkerResult.output?.issues.length ?? 0;
  const errorMsg = checkerResult.error?.message ?? `${issueCount} issue(s)`;
  send(stageEvent("checker", "failed", { summary: errorMsg }));
  send(logEvent("checker", `검수 실패: ${errorMsg}`, "error"));
}
```

### 4. 다른 stage 완료 logEvent 패턴 (참고용)

orchestrator.ts grep 결과, 현재 stage 완료 logEvent 는 단 한 줄 (`:1035 "auto-fix 적용됨: ..."`) 뿐. 즉 다른 stage(extractor/solver/verifier/figure)도 stageEvent 만 emit 하고 로그 패널에는 빈 상태. 본 phase 는 **builder/checker 두 stage 만** 손봄 (사용자 명시 요청 영역). 다른 stage 의 완료 로그 추가는 별도 task 로 결정.

## 체크리스트

- [x] ⓐ orchestrator.ts:1018 checker stage 진입 조건에 `checkerAttempts > 0` 가드 추가 + 0 일 때 "checker 단계 건너뜀" system 로그 1줄 emit
- [x] ⓑ orchestrator.ts:973-979 builder done 분기에 `logEvent("builder", "HWPX 조립 완료 → ${relativeOutput}", "info")` 추가
- [x] ⓒ orchestrator.ts:1052-1056 checker done 분기에 `logEvent("checker", "검수 완료: N건 issue${autofixed}", "info")` 추가
- [x] ⓓ orchestrator.ts:1057-1062 checker failed 분기에 `logEvent("checker", "검수 실패: ...", "error")` 추가

## 영향 범위

- **변경 파일**: 1개 (orchestrator.ts)
- **호환성**: stageEvent/fileEvent/resultEvent 인터페이스 변경 없음. SSE event 종류 추가도 없음. 사용자 측 영향은 로그 한두 줄 추가 + 자동수정=0 일 때 checker 단계 자체 미실행.
- **롤백 전략**: git revert 단일 커밋
- **e2e 영향**: `create-v4-full-pipeline` — figure 완료 후 build/checker 흐름. checkerMaxAttempts 기본값 2 라 e2e 환경에서는 checker 가 정상 진행되어 회귀 없음. 자동수정=0 분기는 e2e 환경에서는 미발화.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/checker.test.ts --reporter=basic

# 수동 smoke (Phase 1 끝나면 사용자가 직접):
# 1. 설정 자동수정 = 0 → 새 잡 figure 후 "확인 완료 → HWPX 조립 시작" → checker 단계 indicator 안 뜸 + 로그에 "checker 단계 건너뜀" 한 줄
# 2. 설정 자동수정 = 2 → 같은 흐름 → builder 완료 시 "HWPX 조립 완료 → ..." 로그 + checker 완료 시 "검수 완료: N건 issue (auto-fixed)" 로그
```

## 실행 결과

### 1회차 (2026-05-23 01:09 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
orchestrator.ts 단일 파일에 4개 변경 적용 완료. checkerMaxAttempts=0일 때 checker stage 진입 자체를 차단하는 `checkerAttempts > 0` 가드 추가 및 "checker 단계 건너뜀 (자동수정 = 0)" system 로그 1줄 emit. builder done 분기에 "HWPX 조립 완료 → {경로}" info 로그, checker done 분기에 "검수 완료: N건 issue (auto-fixed)" info 로그, checker failed 분기에 "검수 실패: {errorMsg}" error 로그 각 1줄씩 추가. 내부 `maxAttempts` 중복 선언도 `checkerAttempts` 재사용으로 정리.

#### 변경 파일
- `ngd-studio/server/stages/orchestrator.ts` (수정, +6/-2줄)

#### 검증 결과
- [x] TypeScript 타입 체크: `npx tsc --noEmit` → pass (오류 없음)
- [x] 단위 테스트: `npx vitest run server/stages/__tests__/checker.test.ts --reporter=basic` → pass (51 tests passed)

#### 추가 발견사항
phase 파일 설계 섹션 §4에서 언급했듯, extractor/solver/verifier/figure stage 완료 logEvent도 현재 없는 상태. 본 phase scope 밖이므로 기록만 함.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (PHASE_FILE + ngd-studio/server/stages/orchestrator.ts)

#### Verification Re-run (orchestrator)
exit 0 — tsc + vitest checker.test.ts (51 passed) 통과

#### Simplify (orchestrator)
SIMPLIFIED 0 / VERIFY pass — 추가 정리 패턴 없음

#### Review (orchestrator)
VERDICT pass / 0 issues — 설계 4항목 모두 정확히 구현됨

#### Commit
4a9bcb039a5dee0d50377861cad61f1da57e11dc

#### E2E (orchestrator)
skip — no e2e_triggers
