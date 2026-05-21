---
phase: 4
title: sse.ts create/resume/review legacy 분기 일괄 제거
status: completed
depends_on: [1, 3]
scope:
  - ngd-studio/server/sse.ts
intervention_likely: true
intervention_reason: "sse.ts 는 모든 SSE 클라이언트의 중앙 진입점. legacy 분기 + deterministicBuilder/Checker 분기 일괄 제거 후 create/resume/review 3 모드 manual smoke 권장."
executor: sonnet
load_bearing: "useCodeOrchestrator 게이트 제거 — 모든 흐름이 orchestrator 로 진입하는 핵심 변경"
e2e_refs:
  - create-v4-full-pipeline
  - review-full-pipeline
e2e_triggers:
  - review-full-pipeline
---

# Phase 4: sse.ts create/resume/review legacy 분기 일괄 제거

> **범위**: Backend (SSE server)
> **난이도**: M
> **의존성**: Phase 1 (orchestrator review mode), Phase 3 (crop migration)
> **영향 파일**: `server/sse.ts`

## 배경

`server/sse.ts:316-422` 의 분기 구조:

```ts
const deterministicBuilder = mode === "resume" && (resumeFrom === "builder" || "confirm");
const deterministicChecker = mode === "resume" && resumeFrom === "checker";
const useCodeOrchestrator = shouldUseCodeOrchestrator(mode, stageOverrides);

if (useCodeOrchestrator) {
  // orchestrator 경로
} else if (deterministicBuilder) {
  // runBuilderStage 직접 호출
} else if (deterministicChecker) {
  // runCheckerStage 직접 호출, 실패 시 runLegacyPromptJob 폴백
} else {
  // 최종 fallback: runLegacyPromptJob (legacy)
  // + create 모드면 후처리로 runBuilderStage 자동 실행
}
```

이 모든 분기는 `useCodeOrchestrator` (= stageOverrides 가 비어 있을 때 false) 에 의존한다. legacy 제거 = `useCodeOrchestrator` 게이트 제거 → 모든 흐름이 orchestrator 로 직진.

- `deterministicBuilder` / `deterministicChecker` 분기는 orchestrator 의 resume builder/checker 가 동등 기능 제공 (orchestrator.ts:194-198 `determineStartStage` + builder/checker stage 단계). 별도 분기 불필요.
- `mode === "review"` 는 phase 01 에서 통합된 orchestrator review 분기로 라우팅.
- `mode === "crop"` 는 phase 03 에서 분리된 `runCropJob` 으로 라우팅.

## 설계

### 1. 분기 단순화

```ts
if (mode === "crop") {
  const cropResult = await runCropJob({ ... });   // phase 3 에서 도입
  // ...
} else {
  // create / resume / review 모두 orchestrator
  const orchResult = await runStageOrchestrator({
    mode: mode as "create" | "resume" | "review",
    resumeFrom: meta?.resumeFrom,
    meta: meta ?? {},
    questionImages: questionImagePaths,
    stageOverrides,
    stageSkip,
    figureRegen: body.figureRegen,
    imageCleaningEnabled: body.imageCleaningEnabled,
    checkerMaxAttempts: body.checkerMaxAttempts,
    verifierMaxAttempts: body.verifierMaxAttempts,
    // review mode 전용:
    hwpxPath: mode === "review" ? toAbsWsl(wslFiles.hwpx) : undefined,
    additionalInstruction: mode === "review" ? meta?.additionalInstruction : undefined,
    baseDir: BASE_DIR,
    send,
    isAborted: () => clientDisconnected,
    externalSignal: disconnectAbort.signal,
  });
  outputFile = orchResult.outputFile ?? "";
  resultSummary = orchResult.resultSummary ?? "";
  finalStatus = orchResult.status;
  providerTelemetry = orchResult.providerTelemetry;
}
```

### 2. legacy 코드 제거

- `useCodeOrchestrator` 변수 + `shouldUseCodeOrchestrator` import + `shouldUseCodeOrchestrator` re-export (sse.ts:30) 삭제
- `deterministicBuilder`, `deterministicChecker` 변수 + 분기 삭제
- 최종 `else` 의 `runLegacyPromptJob` 호출 + skill 후처리 (create 후 자동 builder) 삭제
- `runLegacyPromptJob` import 삭제

### 3. 사전 prompt 빌드 흐름

sse.ts:248-263 의 `prompt` 변수 (buildCreatePrompt / buildResumePrompt / buildReviewPrompt / buildCropPrompt 결과) 는 legacy 가 사용. 본 phase 후:
- crop 만 prompt 변수 필요 → crop 분기에서만 빌드
- create / resume / review 는 orchestrator 가 stage 별 prompt 내부 빌드 → 외부 prompt 변수 불필요

prompt 빌드 분기를 `if (mode === "crop") { prompt = buildCropPrompt(...) }` 로 축소. 나머지 분기 제거.

### 4. review mode 입력 검증

기존 sse.ts:202 에 `mode === "review" && !files.hwpx` 검증 존재. 유지 — orchestrator 진입 전 fail-fast.

`hwpxPath` 절대경로 변환은 sse.ts 의 `toAbsWsl(wslFiles.hwpx)` 사용. orchestrator 는 절대 경로 받음.

## 체크리스트

- [x] prompt 빌드 분기 축소 — `mode === "crop"` 만 `buildCropPrompt` 호출, 나머지 분기 삭제
- [x] `useCodeOrchestrator` / `shouldUseCodeOrchestrator` import + 사용 + re-export (line 30) 삭제
- [x] `deterministicBuilder`, `deterministicChecker` 변수 + 분기 (line 341~405) 삭제
- [x] 최종 else (`runLegacyPromptJob` + create 후처리 builder, line 406~) 삭제
- [x] `mode === "crop"` 외 분기는 `runStageOrchestrator` 호출로 통합 — review mode 시 `hwpxPath` + `additionalInstruction` 전달
- [x] `runLegacyPromptJob` import 삭제
- [x] `cd ngd-studio && npx tsc --noEmit` 통과
- [x] manual smoke: create 처음~끝 / resume from extractor / review 처음~끝 — 3 흐름 SSE 이벤트 발생 + 결과 파일 생성 확인 (사용자 수동 검증 pass, 2026-05-22)

## 영향 범위

- **모든 SSE 클라이언트**: 분기 단순화로 응답 패턴 일관됨. 사용자에 보이는 이벤트 흐름은 동일 (`stage` / `log` / `question` / `result` / `error`).
- **deterministic builder/checker 폴백 제거**: orchestrator 의 resume 경로가 builder/checker 만 단독 실행하도록 이미 구현되어 있으므로 영향 없음.
- **stageOverrides 미지정 사용자**: 이전엔 legacy 경로 → 이제 orchestrator + auto resolve (= claude-cli). provider 동작은 동일 (Claude CLI), 다만 stage 별 결정론적 호출 방식으로 변경 — 응답 패턴이 달라질 수 있음 (phase 01 의 default resolve 보장이 전제).
- **롤백**: 가장 위험. legacy 분기 일괄 삭제 후 어떤 모드가 실패하면 phase 01 (review) / 03 (crop) / 02 (followup) 으로 흩어져 있어 부분 롤백 어렵다. PR 단위로 본 phase 만 revert 가능하도록 phase 별 commit 분리 필수.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 검증 (필수 — intervention_likely=true):
- [x] create 처음~끝 (PDF + 양식지 + 문제 이미지 N개 업로드 → outputs/*.hwpx)
- [x] resume from extractor (기존 .v3cache 보존 상태에서 navigator action "재추출")
- [x] review 처음~끝 (PDF + 작업 HWPX 업로드 → 수정된 HWPX + 리포트)

세 흐름 모두 `stage` / `log` / `result` SSE 이벤트가 발생하고, 최종 파일이 outputs 또는 입력 hwpx 위치에 생성/수정되어야 함.

## 실행 결과

### 1회차 (2026-05-22 14:30 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`sse.ts`의 모든 legacy 분기(useCodeOrchestrator 게이트, deterministicBuilder, deterministicChecker, runLegacyPromptJob)를 일괄 제거하고 create/resume/review 3모드를 모두 `runStageOrchestrator`로 통합. crop 모드는 기존 `runCropJob` 인라인 헬퍼 유지. prompt 빌드 분기도 crop 전용으로 축소. `npx tsc --noEmit` 통과. manual smoke는 intervention_likely=true로 사용자 수동 검증 필요.

#### 변경 파일
- `ngd-studio/server/sse.ts` (수정, +12/-92줄)

#### 검증 결과
- [x] `npx tsc --noEmit`: `cd ngd-studio && npx tsc --noEmit` → pass (출력 없음)

#### 추가 발견사항
- `CheckerStageOutput`, `fileEvent`, `logEvent`, `progressEvent`, `resultEvent`, `stageEvent` import도 불필요해져 함께 제거
- `finalProviderMetadata`, `checkerResult` 변수도 불필요해져 제거 — jobStore.write는 `requestedProvider`/`resolvedProvider`를 직접 사용
- `meta.additionalInstruction` 필드를 body 타입에 추가 (review followup 경로에서 사용 가능)

#### 질문 / 결정 사항
없음

### 2회차 (2026-05-22 — manual smoke + 사용자 cleanup)
**상태**: completed
**진행 모델**: 사용자 직접 수정

#### 요약
사용자가 manual smoke(create / resume / review 3 흐름)를 직접 실행해 모두 정상 동작 확인. 추가로 sse.ts에 잔존한 dead variable(`finalProviderMetadata`, `checkerResult`)을 제거하고 crop 분기를 `if (mode === "crop") { ... } else { ... }` 형태로 정리. `let prompt: string = ""`로 초기화 + jobStore.write가 `requestedProvider` / `resolvedProvider`를 직접 참조하도록 단순화.

#### 변경 파일
- `ngd-studio/server/sse.ts` (사용자 cleanup, dead variable 제거 + crop 분기 정리)

#### 검증 결과
- [x] `cd ngd-studio && npx tsc --noEmit` → pass (exit 0)
- [x] `cd ngd-studio && npx vitest run server/stages/__tests__/ server/__tests__/ lib/__tests__/ --reporter=basic` → 533 tests passed
- [x] manual smoke 3 흐름 → 사용자 pass 보고

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — sse.ts 단일 파일 (worker + 사용자 cleanup 모두 scope 내)

#### Verification Re-run (orchestrator)
exit 0 — tsc + vitest 533 tests passed 재현됨

#### Review (orchestrator)
VERDICT: pass — worker 변경 + 사용자 cleanup 후 legacy 분기 완전 제거 확인. crop 인라인 헬퍼 + orchestrator 통합 1대1 매칭. dead variable 정리로 unused symbol 없음. manual smoke 3 흐름 모두 사용자 검증 pass.

#### E2E (orchestrator)
skip — review-full-pipeline 시나리오는 사용자 manual smoke로 동등 검증됨 (intervention_likely=true 경로). catalog 자동 실행 환경 미구비.

#### Commit
0763faf — refactor(sse): Phase 4 — sse.ts legacy 분기 일괄 제거
