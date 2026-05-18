---
phase: 4
title: sse.ts / orchestrator.ts LLM build 의존성 제거 + deterministic builder 합성
status: completed
depends_on: [3]
scope:
  - ngd-studio/server/sse.ts
  - ngd-studio/server/stages/orchestrator.ts
intervention_likely: true
intervention_reason: "legacy 경로(useCodeOrchestrator=false) 종료 후 자동 deterministic builder 합성 방식을 코드 보면서 확정 필요. skill의 종료 시그널 처리/실패 분기 디테일이 모호할 수 있음."
---

# Phase 4: sse.ts / orchestrator.ts LLM build 의존성 제거 + deterministic builder 합성

> **범위**: Backend (TS)
> **난이도**: M
> **의존성**: Phase 3 (SKILL.md가 build를 하지 않는다고 명시한 뒤 sse.ts 합성 추가)
> **영향 파일**: `ngd-studio/server/sse.ts`, `ngd-studio/server/stages/orchestrator.ts`

## 배경

build 단계에 LLM이 끼어드는 잔재 3곳을 모두 제거한다:

1. **`sse.ts:331-368` deterministicBuilder 분기의 legacy fallback** — deterministic builder 실패 시 `runLegacyPromptJob`으로 LLM에 재시도 위임
2. **`sse.ts:415-434` legacy 경로(`useCodeOrchestrator=false`)** — skill이 Phase 3에서 build를 안 한다고 명시했으므로, skill 종료 후 호스트가 `runBuilderStage`를 이어 실행해야 한다
3. **`orchestrator.ts:608-621` + `:785-816` `runLegacyBuilderFallback` stub** — `outputs/`에서 옛 HWPX 주워오는 silent failure mask

## 설계

### sse.ts:331-368 — deterministicBuilder 분기 정리

기존 흐름:
```
runBuilderStage()
  ├─ completed → file/result/done
  └─ failed → runLegacyPromptJob(LLM에 위임)
```

변경 흐름:
```
runBuilderStage()
  ├─ completed → file/result/done
  └─ failed → stageEvent("builder", "failed", { summary: error.message })
              + resultEvent("failed", error.message)
              + finalStatus = "failed"
              + 종료 (LLM fallback 없음)
```

### sse.ts:415-434 — legacy 경로에 deterministic builder 합성

기존:
```ts
} else {
  const legacyResult = await runLegacyPromptJob({...});
  outputFile = legacyResult.outputFile ?? "";
  resultSummary = legacyResult.resultSummary ?? "";
  finalStatus = legacyResult.status;
  ...
}
```

변경:
```ts
} else {
  // skill 실행 (extractor → solver → verifier → figure 까지)
  const legacyResult = await runLegacyPromptJob({...});

  // skill이 정상 완료 시 호스트가 deterministic builder 자동 실행
  if (legacyResult.status === "done" && mode === "create") {
    send(stageEvent("builder", "running"));
    send(logEvent("builder", "skill 완료 후 deterministic builder runner를 자동 실행합니다."));

    const builderResult = await runBuilderStage({ baseDir: BASE_DIR });
    if (builderResult.status === "completed" && builderResult.output) {
      const relativeOutput = path.relative(BASE_DIR, builderResult.output.hwpxPath);
      outputFile = relativeOutput;
      resultSummary = "skill 완료 + deterministic builder 완료";
      finalStatus = "done";
      send(progressEvent("builder", 100));
      send(stageEvent("builder", "done", { summary: resultSummary }));
      send(fileEvent({ type: "hwpx", name: path.basename(relativeOutput), path: relativeOutput }));
      send(resultEvent("success", resultSummary, relativeOutput));
    } else {
      send(stageEvent("builder", "failed", { summary: builderResult.error?.message }));
      send(resultEvent("failed", builderResult.error?.message ?? "builder failed"));
      finalStatus = "failed";
    }
  } else {
    // skill 자체 실패 — LLM 단계에서 멈춤
    outputFile = legacyResult.outputFile ?? "";
    resultSummary = legacyResult.resultSummary ?? "";
    finalStatus = legacyResult.status;
  }
  finalProviderMetadata = legacyResult.providerMetadata;
  providerTelemetry = legacyResult.providerTelemetry;
}
```

**열린 결정 항목** (worker가 코드 보면서 확정):
- `mode === "resume"`일 때도 같은 합성을 적용할지 (이미 별도 deterministicBuilder 분기 있음)
- `crop`/`review` 모드는 build와 무관 → 합성 제외 확인
- skill이 build를 했는지/안 했는지 신호 — 일단 skill 종료 후 무조건 호스트가 build 시도. 이미 만들어진 hwpx가 있어도 멱등하게 재build (build_hwpx.py가 멱등).

### orchestrator.ts — fallback 제거

**제거**:
- `orchestrator.ts:608-621` legacy builder fallback 호출부:
  ```ts
  send(logEvent("builder", "deterministic builder 실패 — legacy builder fallback으로 전환합니다.", "warn"));
  const legacyResult = await runLegacyBuilderFallback({...});
  ```
- `orchestrator.ts:785-816` `runLegacyBuilderFallback` 함수 전체 + interfaces (`LegacyBuilderFallbackOptions`, `LegacyBuilderFallbackResult`)
- 관련 import (`readdir`, `stat` 가 다른 곳에서 안 쓰이면 제거)

**대체**:
```ts
} else {
  send(stageEvent("builder", "failed", { summary: builderResult.error?.message }));
  send(logEvent("builder", "deterministic builder 실패. LLM fallback 없이 작업을 중단합니다.", "error"));
  finalProviderTelemetry.push({
    stageKey: "builder",
    workflowStageKey: "builder",
    requestedProvider: "code",
    resolvedProvider: "code",
    attempt: 1,
    status: "failed",
    elapsedMs: Date.now() - builderStartedAt,
    errorSummary: builderResult.error?.message?.slice(0, 300),
  });
  await persistTelemetry(input, finalProviderTelemetry, "failed");
  return failed(finalProviderTelemetry, builderResult.error?.message);
}
```

## 체크리스트

- [x] `sse.ts:331-368` deterministicBuilder 분기에서 `runLegacyPromptJob` fallback 호출 제거 → 실패 시 stageEvent failed + resultEvent failed + finalStatus = "failed"
- [x] `sse.ts:415-434` legacy 경로(`useCodeOrchestrator=false`)에 skill 완료 후 `runBuilderStage` 자동 호출 합성 추가 (create 모드 한정)
- [x] `orchestrator.ts:608-621` legacy builder fallback 호출부 제거 → failed 이벤트 + telemetry 기록 + return failed
- [x] `orchestrator.ts:785-816` `runLegacyBuilderFallback` 함수 + 관련 interfaces 제거
- [x] `npx tsc --noEmit` 통과 (unused import 정리 포함)

## 영향 범위

- legacy skill 경로(`useCodeOrchestrator=false`) 사용자의 빌드 결과: skill이 build를 안 해도 호스트가 자동 이어받음. 동작 변화 없어야 함.
- deterministic builder 실패 시 사용자 경험: 종전엔 LLM이 재시도했으나 이제 즉시 failed. 실패 원인이 명확히 드러나는 장점.
- Phase 5의 테스트 갱신 항목과 연동: `runLegacyBuilderFallback` 테스트가 있다면 제거.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/__tests__/sse.branch.test.ts server/stages/__tests__/orchestrator.test.ts

# 정리 확인
grep -n "runLegacyBuilderFallback" ngd-studio/server/stages/orchestrator.ts
# (출력 없어야 통과)
grep -n "runLegacyPromptJob" ngd-studio/server/sse.ts
# (남아 있는 호출이 deterministicBuilder 실패 fallback이 아닌, legacy 경로 본체와 deterministicChecker 분기에만 있는지 확인)
```

## 실행 결과

### 1회차

- **실행일**: 2026-05-18
- **run_id**: run-1779093325-87617
- **상태**: completed

#### 변경 내용

1. **`sse.ts` deterministicBuilder 분기 (구 346-368)**
   - `runLegacyPromptJob` fallback 12줄 제거
   - 대체: `stageEvent("builder", "failed")` + `resultEvent("failed", ...)` + `finalStatus = "failed"`

2. **`sse.ts` legacy 경로 else 블록 (구 415-434)**
   - `runLegacyPromptJob` 결과를 그대로 반환하던 4줄 → skill 완료 후 `runBuilderStage` 자동 합성 (create 모드 한정)
   - skill 실패/non-create 모드는 기존과 동일하게 legacyResult 반환

3. **`orchestrator.ts` builder 실패 분기 (구 613-621)**
   - `runLegacyBuilderFallback` 호출 제거
   - 대체: `stageEvent failed` + `logEvent error` + telemetry push + `persistTelemetry("failed")` + `return failed(...)`
   - 성공 분기의 telemetry status를 `builderResult.status === "completed" ? "success" : "failed"` → 항상 `"success"` (실패 시 이미 return하므로)

4. **`orchestrator.ts` `runLegacyBuilderFallback` 함수 + interfaces 제거 (구 762-816)**
   - `LegacyBuilderFallbackOptions` interface 제거
   - `LegacyBuilderFallbackResult` interface 제거
   - `runLegacyBuilderFallback` 함수 전체 제거

5. **`orchestrator.ts` import 정리**
   - `readdir`, `stat` 제거 (`runLegacyBuilderFallback`에서만 사용했던 것)
   - `readFile`만 유지 (다른 곳에서 사용)

#### 검증 결과

- `npx tsc --noEmit`: 오류 없음
- `npx vitest run server/__tests__/sse.branch.test.ts server/stages/__tests__/orchestrator.test.ts`: 27/27 pass
- `grep runLegacyBuilderFallback orchestrator.ts`: 출력 없음 (통과)
- `runLegacyPromptJob` sse.ts 잔존 호출: deterministicChecker 분기 (scope 밖) + legacy 경로 본체 (정상)

#### Scope Audit (orchestrator)
pass — sse.ts + orchestrator.ts 모두 scope 내. 추가로 checklist.md 1건 worker 편집(허용 외) 있으나 내용은 진행 테이블 갱신으로 무해.

#### Verification Re-run (orchestrator)
exit 0 — tsc 클린, vitest 27/27 pass, runLegacyBuilderFallback grep 0건. runLegacyPromptJob 잔존 2건은 deterministicChecker 분기 + legacy 본체로 모두 정상.

#### Simplify (orchestrator)
orchestrator.ts 미사용 `targetQuestions` 1개 destructure 제거. 재검증 27/27 pass.

#### Review (orchestrator)
VERDICT: pass. 3개 LLM fallback 제거 + legacy 경로 deterministic builder 합성, 설계와 실구현 완전 일치.
