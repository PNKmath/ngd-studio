---
phase: 5
title: orchestrator + resume 로직 구현
status: pending
depends_on: [3, 4]
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/resumeState.ts
  - ngd-studio/server/stages/__tests__/orchestrator.test.ts
intervention_likely: true
intervention_reason: "병렬도, 부분 실패 격리 정책, feedback 루프 재시도 한계, telemetry 흐름 등 설계 결정"
---

# Phase 5: orchestrator + resume 로직 구현

> **범위**: Backend (핵심 오케스트레이터)
> **난이도**: L
> **의존성**: Phase 3 (extractor), Phase 4 (examData), 간접: Phase 1, 2
> **영향 파일**: `ngd-studio/server/stages/orchestrator.ts` (신규)

## 배경

stage runner들(extractor/solver/verifier/figure/builder/checker)을 코드로 직접 조립하는 핵심 모듈. SSE 서버가 mode=create/resume 시 진입점으로 호출. legacy Claude CLI orchestration을 완전히 대체.

## 설계

### 진입점

```ts
// orchestrator.ts
export interface OrchestratorInput {
  mode: "create" | "resume";
  resumeFrom?: string;            // "extractor" | "solver" | "verifier" | "figure" | "builder" | "confirm" | "checker"
  meta: ExamMetaInput;
  questionImages: { number: number; path: string }[];
  stageOverrides: StageOverrideMap;
  baseDir: string;
  send: (event: SSEEvent) => void; // SSE emit
  isAborted: () => boolean;
}

export interface OrchestratorResult {
  status: "done" | "failed" | "cancelled";
  outputFile?: string;
  resultSummary?: string;
  providerTelemetry: ProviderTelemetryEntry[];
}

export async function runStageOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult>;
```

### 흐름

```
1. determineStartStage(resumeFrom, cache) → 시작 단계 결정
2. if startStage <= "extractor":
     runWithConcurrency(extractorLimit, qs, async (img) =>
       runExtractorStage({ ..., provider: getProviderForStage("create.extractor") })
     )
     - 부분 실패 격리: questionEvent(n, "extracted", { status: "failed", error })
     - 전부 실패면 abort, 일부 실패는 calling code가 결정 (기본: 계속 진행, UI에 경고)
2a. if resumeFrom in (없음, "extractor"):
     send extraction_review event  ← ★ 사용자 추출 결과 편집 시점
     orchestrator는 여기서 일단 종료 ("done" 상태로 마감)
     사용자가 프론트엔드에서 편집 → "재개(solver부터)" 클릭하면 새 요청으로 진입
3. if startStage <= "solver":
     runWithConcurrency(solverLimit, qs, async (n) => runSolverStage(...))
4. if startStage <= "verifier":
     runWithConcurrency(verifierLimit, qs, async (n) => {
       attempt = 0
       while attempt < 3:
         verified = await runVerifierStage(...)
         if verified.status === "pass": break
         solved = await runSolverStage({ ..., feedback: verified.feedback })
         attempt += 1
     })
5. buildExamDataJson(...)  // Phase 4 호출
6. if startStage <= "figure":
     spawn(python3 figure_processor.py)  // figure_status.json 갱신
     wait for figure_status.json done
7. if startStage <= "builder":
     runBuilderStage(...)  // 기존 deterministic
     실패 시 legacy CLI builder agent fallback (runLegacyPromptJob with builder prompt)
8. if startStage <= "checker":
     runCheckerStage(...)  // 기존 deterministic
9. send(resultEvent("success", summary, outputPath))
```

### ★ 동시성 제어 (`runWithConcurrency`)

`Promise.all` 대신 동시성 캡을 적용. `p-limit` 의존성 추가 또는 자체 구현:

```ts
async function runWithConcurrency<T, R>(
  limit: number,
  items: T[],
  worker: (item: T) => Promise<R>
): Promise<R[]> { /* 간단한 semaphore */ }
```

Stage별 기본 limit:
- extractor: 4 (이미지 base64 → 큰 payload, rate limit 보호)
- solver: 6
- verifier: 6

provider별 override는 추후 phase로 미룸.

### ★ 추출 검토(extraction review) 일시정지

skill 기반 흐름은 `[EXTRACTION_REVIEW]` 블록을 emit하고 사용자가 frontend에서 편집한 뒤 재개 명령으로 진행. orchestrator도 동일 UX 제공:

- extractor 완료 직후 (resumeFrom이 미지정이거나 `extractor`일 때만) **`extraction_review` SSE 이벤트** + 각 문제별 `questionEvent(n, "extracted", data)` 발사
- orchestrator는 그 시점에 `resultEvent("review_pending")`로 마감하고 종료 (status: "done" 또는 별도 status)
- 프론트엔드 `QuestionResultPanel`은 이미 편집 UI 보유 → 사용자가 편집 후 store에서 캐시 갱신
- 사용자가 "이 결과로 진행" 누르면 새 `/api/run` 요청 (mode=resume, resumeFrom=solver) → orchestrator 재진입 → step 3부터

resumeFrom=solver 이상이면 review pause 없이 직진.

### ★ 부분 실패 UX

각 stage 호출 후 결과별로 SSE 이벤트:

```ts
// 성공
send(questionEvent(n, "extracted", { status: "ok", data: extracted }));
// 실패
send(questionEvent(n, "extracted", { status: "failed", error: errorMessage }));
```

`QuestionResultPanel`이 status를 보고 빨간색 표시. Stage 전체는 일부 실패해도 "done"으로 끝낼 수 있게 — 사용자가 보고 결정.

Stage 종료 시 summary에 실패 문제 번호 포함:
```ts
send(stageEvent("extractor", "done", { summary: `완료: 18/20, 실패: [5, 12]` }));
```

### ★ SDK fetch 취소 전파

orchestrator는 `AbortController`를 stage 호출마다 만들고, `isAborted()`가 true가 되면:
- 진행 중 SDK fetch의 signal abort
- 다음 stage 진입 차단

`ProviderRunOptions`에 `signal?: AbortSignal` 추가(Phase 1 보강). claudeSdk/openaiSdk/deepseekV4는 fetch에 signal 전달. CLI provider는 `proc.kill("SIGTERM")` 사용.

### Stage-level 로그 영속화

각 stage 시작/종료 시 telemetry entry를 jobStore.write로 즉시 저장 (현재는 finally에서 한 번에 기록). 작업 진행 중에도 `/jobs/[id]`에서 부분 진행을 볼 수 있게.

### resume 결정 로직 (`resumeState.ts`)

skill MD `detect_resume_state` Python을 TS로:

```ts
// server/stages/resumeState.ts
export function determineStartStage(
  resumeFrom: string | undefined,
  cache: StageCache,
  questionNumbers: number[]
): { startStage: WorkflowStage; targetQuestions: number[] };
```

- `resumeFrom`이 명시되면 그대로 사용
- 미지정 시 cache 스캔: 각 문제의 verified > solved > extracted 존재 여부로 미완료 지점 자동 감지
- `confirm`은 builder 진입과 동일 (figure 결과 확인 완료)

### provider 선택 헬퍼

```ts
function getProviderForStage(stageKey: AIStageKey, overrides: StageOverrideMap): AIProviderAdapter {
  const id = overrides[stageKey] ?? "auto";
  return getProviderAdapter(id);
}
```

### SSE 이벤트

기존 PipelineView가 받는 `stageEvent("extractor", "running"|"done"|"failed")`, `progressEvent`, `questionEvent`, `fileEvent`, `resultEvent`를 그대로 emit. UI 변경 없음.

### Cancel

`isAborted()`가 true가 되면:
- 진행 중 Promise.all은 settle 대기
- 다음 stage 진입 차단
- 완료된 부분 캐시는 유지 (resume에 재활용)
- `resultEvent("cancelled", ...)` emit

### Telemetry

각 stage 호출 후 `createProviderTelemetryEntry`로 누적 → 반환값에 포함. SSE 서버가 jobStore.write 시 기록.

### Builder fallback

`runBuilderStage`가 실패하면 기존 sse.ts의 deterministic builder fallback 로직을 재사용 — `runLegacyPromptJob`을 builder 프롬프트로 호출. 이 fallback 코드는 sse.ts에 이미 있으니 helper로 추출 후 orchestrator에서도 호출.

### 테스트

`server/stages/__tests__/orchestrator.test.ts`:
- mock provider들로 extractor → solver → verifier → mock figure spawn → mock builder → checker 풀 통과
- verifier fail → solver 재시도 후 pass (feedback 루프)
- extractor 1개 실패 시 나머지 계속 진행
- resumeFrom="solver" → extractor skip
- isAborted() true → cancelled 반환

## 체크리스트

- [ ] `server/stages/resumeState.ts` 신규 작성 + `determineStartStage` export
- [ ] `server/stages/orchestrator.ts` 신규 작성, `runStageOrchestrator` export
- [ ] extractor stage 호출 + 부분 실패 격리 + SSE stage/question 이벤트 emit
- [ ] solver/verifier 호출 + feedback 루프 (최대 3회)
- [ ] `buildExamDataJson` 호출 (Phase 4)
- [ ] figure stage spawn (python3/python OS 분기) + `figure_status.json` 폴링 호환
- [ ] builder/checker 호출 + builder 실패 시 legacy CLI fallback helper
- [ ] cancel 처리 + telemetry 누적
- [ ] `runWithConcurrency` 유틸 + stage별 기본 limit(extractor 4, solver 6, verifier 6) 적용
- [ ] extraction_review pause: extractor 완료 후 SSE event + questionEvent emit 후 종료, resumeFrom=solver로 재진입 시 step 3부터
- [ ] 부분 실패 UX: 문제별 questionEvent에 status ok/failed, stageEvent summary에 실패 번호 포함
- [ ] AbortSignal 전파: ProviderRunOptions.signal, SDK fetch에 signal 전달, CLI는 SIGTERM
- [ ] stage 시작/종료마다 jobStore.write로 telemetry 즉시 영속화 (부분 진행 가시화)
- [ ] orchestrator mock 단위 테스트 6케이스 (정상 / feedback / 부분실패 / resume / cancel / review_pause)
- [ ] `npx tsc --noEmit` + `npx vitest run server/stages/__tests__/orchestrator.test.ts --reporter=basic` 통과

## 영향 범위

- 신규 파일 2개. 기존 stage runner들은 호출만 받으므로 인터페이스 변경 없음.
- `sse.ts`의 builder fallback 분기를 helper로 추출(Phase 6에서 본격 활용).
- legacy `runLegacyPromptJob` 경로에는 영향 없음.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/orchestrator.test.ts --reporter=basic
```
