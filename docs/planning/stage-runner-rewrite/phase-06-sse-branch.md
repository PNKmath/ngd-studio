---
phase: 6
title: SSE 분기 (코드 orchestrator vs legacy)
status: pending
depends_on: [5]
scope:
  - ngd-studio/server/sse.ts
  - ngd-studio/server/__tests__/sse.branch.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 6: SSE 분기 (코드 orchestrator vs legacy)

> **범위**: Backend (SSE 서버 진입점)
> **난이도**: M
> **의존성**: Phase 5 (orchestrator)
> **영향 파일**: `ngd-studio/server/sse.ts`

## 배경

Phase 5에서 만든 `runStageOrchestrator`를 SSE 서버에서 호출하도록 분기. legacy `runLegacyPromptJob` 경로는 호환 유지.

## 설계

### 분기 조건

```ts
// sse.ts handleRequest 내 deterministicBuilder/Checker 분기 직후
const useCodeOrchestrator =
  (mode === "create" || mode === "resume") &&
  AI_STAGE_KEYS.some((k) =>
    (k === "create.extractor" || k === "create.solver" || k === "create.verifier") &&
    stageOverrides[k] !== undefined
  );
```

즉, 사용자가 `/settings`에서 create.* stage 중 하나라도 명시적으로 provider override를 지정하면 코드 orchestrator 경로 진입. 그렇지 않으면 기존 legacy 경로.

`auto` 기본값(stageOverrides 빈 객체)은 legacy 유지 → /create 페이지·기존 사용자 영향 없음.

### 분기 코드 위치

`sse.ts:286`의 `try { const deterministicBuilder = ...` 블록 안에서 새 분기를 추가:

```ts
if (useCodeOrchestrator) {
  const orchResult = await runStageOrchestrator({
    mode,
    resumeFrom: meta?.resumeFrom,
    meta: meta ?? {},
    questionImages: questionImagePaths,
    stageOverrides,
    baseDir: BASE_DIR,
    send,
    isAborted: () => clientDisconnected,
  });
  outputFile = orchResult.outputFile ?? "";
  resultSummary = orchResult.resultSummary ?? "";
  finalStatus = orchResult.status;
  providerTelemetry = orchResult.providerTelemetry;
} else if (deterministicBuilder) {
  ...  // 기존
} else if (deterministicChecker) {
  ...  // 기존
} else {
  ...  // 기존 runLegacyPromptJob
}
```

### 입력 정합성

`questionImagePaths`는 sse.ts:217에서 이미 생성되므로 그대로 사용. resume 모드에서 `files.questionImages`가 비어 있으면 cache scan으로 보강 (orchestrator 내부에서 `determineStartStage` + `cache.listExtracted()`).

### inferPrimaryStageKey 변경

기존 `inferPrimaryStageKey`는 단일 provider 결정용. 코드 orchestrator 경로에서는 stage별로 provider를 따로 lookup하므로 이 함수 호출은 legacy 경로에서만 의미 있음.

### Review 모드는 비범위

`mode=review`는 본 task의 코드 orchestrator로 옮기지 **않는다**. 이유:
- review 흐름은 reviewer agent 단일 stage로 단순하고, Skill 의존도가 낮아 legacy CLI 경로로도 충분히 동작
- 본 task는 시험지 제작(create/resume) 흐름을 우선 정상화하는 데 집중
- `review.reviewer = deepseek-v4` 설정은 legacy 경로의 `inferPrimaryStageKey` → deepseek 라우팅으로 현재도 부분 지원됨

`shouldUseCodeOrchestrator(mode, stageOverrides)`는 `mode !== "create" && mode !== "resume"`이면 무조건 false 반환. review 모드의 코드 orchestrator 이관은 별도 후속 task로 분리.

### 테스트

`server/__tests__/sse.branch.test.ts`:
- 빈 stageOverrides + mode=create → legacy 경로 (`useCodeOrchestrator === false`)
- `stageOverrides["create.solver"] = "deepseek-v4"` + mode=create → 코드 경로
- mode=review → 코드 경로 진입 안 함 (legacy only)
- 분기 결정 unit test로 단순 추출 (분기 조건만 테스트, 실제 호출 mock)

분기 조건을 helper 함수로 추출: `function shouldUseCodeOrchestrator(mode, stageOverrides): boolean`.

## 체크리스트

- [ ] `shouldUseCodeOrchestrator(mode, stageOverrides)` helper 함수 export
- [ ] `sse.ts`에 새 분기 추가 (deterministicBuilder/Checker 분기보다 우선)
- [ ] `runStageOrchestrator` 호출 + outputFile / finalStatus / telemetry 반영
- [ ] questionImagePaths가 resume 모드에서도 정상 전달되는지 확인
- [ ] `sse.branch.test.ts` 단위 테스트 4케이스
- [ ] `npx tsc --noEmit` + 전체 vitest 회귀 통과

## 영향 범위

- `sse.ts` 분기 1곳 추가. legacy 경로는 변경 없음.
- `auto` 기본값 사용자(=대부분)는 동일 동작.
- 명시적 stage override 사용자만 새 경로.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/__tests__/sse.branch.test.ts --reporter=basic
npx vitest run --reporter=basic  # 전체 회귀
```
