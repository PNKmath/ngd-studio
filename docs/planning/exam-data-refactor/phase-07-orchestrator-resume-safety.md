---
phase: 7
title: orchestrator resume 안전성 (cleanup matrix + per-Q figure + SSE 핸들러 단일화 + stage counter race)
status: pending
depends_on: [1, 2, 3, 4]
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/cleanup.ts
  - ngd-studio/server/stages/figureRunner.ts
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
  - ngd-studio/lib/sseClient.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/components/results/question-result/resume.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
  - ngd-studio/server/stages/__tests__/cleanup.test.ts
  - ngd-studio/server/stages/__tests__/figureRunner.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - build-hwpx-cli
e2e_triggers: []
---

# Phase 7: orchestrator resume 안전성

> **범위**: Both (orchestrator + 프론트엔드 SSE 핸들러)
> **난이도**: L
> **의존성**: P1, P2, P3, P4
> **영향 파일**: `server/stages/orchestrator.ts`, `cleanup.ts`, `figureRunner.ts`, `lib/sseClient.ts` (신설), `useJobRunner.ts`, `resume.ts`

## 배경

P1-P4가 끝나 데이터 컨트랙트는 깨끗하다. 이제 4개 logic 결함을 통합 해결:

### F2: cleanup matrix 비대칭
`cleanup.ts`의 stage→삭제 매트릭스가 orchestrator 동작과 불일치:
- `--from=builder` (`cleanup.ts:113-115`): hwpx만 지움 → exam_data 보존 의도. 그러나 orchestrator는 `buildExamDataJson` rebuild → 의미 모순.
- `--from=verifier` (`cleanup.ts:96-102`): exam_data 지우면서 figure_status는 안 지움 → P3 이후엔 final_image가 figure_status에 살아있어 OK. 의미 일관성만 갱신.

**결정 (사용자 답 4)**: 모든 cleanup에서 **exam_data.json은 매번 새 rebuild가 정답**. 따라서 모든 case가 exam_data를 삭제하도록 명세 정리 + orchestrator의 rebuild 항상 안전(P3 이후).

### F3: per-Q figure forwarding 누락
`orchestrator.ts:921-929`가 `figure_processor.py`로 `--question N`을 전달하지 않음. `resume --q=5 --from=figure` 시 cleanup은 `prob5_*`만 지웠지만 figure_processor는 모든 figure 문제 재처리 → Gemini quota 낭비.

### F5: SSE 이벤트 핸들러 불일치
- `lib/useJobRunner.ts:280-292`: `extraction_review` legacy items[] + 단일 {number,data} 모두 처리
- `components/results/question-result/resume.ts` (followup 경로): items[]만 처리, 단일 {number,data} 무시

→ 메인 run과 followup이 다른 SSE 처리 → followup에서 Navigator dot 누락 가능.

### F8: stage counter race (cache hit miscounting)
`orchestrator.ts:511-518`: extractor cache hit이면 SSE만 흘리고 stageCounter는 안 건드림. 일부 hit + 일부 miss 시 done 카운팅 부족 → UI 영구 running.

## 설계

### 1) cleanup.ts 매트릭스 정정

목표 매트릭스 (의미 단순화):

| fromStage | 삭제 대상 |
|---|---|
| `extractor` | _extracted/_solved/_verified + figure outputs + figure_status + **exam_data** |
| `review_extract` | _solved/_verified + **exam_data** |
| `solver` | _solved/_verified + figure outputs + figure_status + **exam_data** |
| `verifier` | _verified + figure outputs + figure_status + **exam_data** ← (이전: figure 보존했었지만, exam_data rebuild가 안전하므로 figure도 함께 새로) |
| `figure` | figure outputs + figure_status + **exam_data** ← (이전: exam_data 보존. rebuild로 동일 결과지만 의미 통일) |
| `confirm` | **exam_data** ← (이전: no-op. confirm = builder 진입 직전이므로 exam_data 새 rebuild) |
| `builder` | hwpx outputs + **exam_data** ← (이전: hwpx만. exam_data 새 rebuild가 정답) |
| `cleaned` | cleaned 이미지 + extractor downstream + **exam_data** |
| `image_replace` | (caller가 원본 삭제) + extractor downstream + **exam_data** |

**원칙: 어느 stage에서 재개해도 exam_data는 새로 rebuild된다**. P3가 final_image를 figure_status로 옮겼으므로 안전.

구현 — 공통 helper:

```ts
async function deleteExamData(cache: StageCache, tryDelete: (p: string) => Promise<void>) {
  await tryDelete(cache.paths.examData);
}
```

각 case 끝에 `await deleteExamData(...)` 호출. `confirm`/`builder` case도 포함.

### 2) figureRunner.ts에 per-Q forwarding

```ts
export interface FigureRunnerInput {
  // ...
  /** 특정 문제만 재처리. orchestrator의 followup --q=N 경로에서 전달. */
  questionNumber?: number;
}
```

이미 `figure_processor.py`가 `--question N` 지원하고 figureRunner도 인자 시그니처에 있음. **누락은 orchestrator 측**:

```ts
// orchestrator.ts (figure stage 호출 부)
const figureResult = await runFigureStage({
  examDataPath: cache.paths.examData,
  outputDir: path.join(baseDir, "outputs", "images"),
  statusOutPath: cache.paths.figureStatus,
  regenerate,
  imageProvider,
  baseDir,
  env: runtimeEnv as NodeJS.ProcessEnv,
  questionNumber: input.targetQuestionNumber,  // ← 추가
});
```

`OrchestratorInput`에 `targetQuestionNumber?: number` 추가. followup route(`run/[jobId]/followup/route.ts`)가 `targetQuestions?.length === 1`일 때 `targetQuestionNumber: targetQuestions[0]` 전달.

> targetQuestions이 2개 이상이면 모두 처리하는 게 정합 (figure_processor에 `--questions 5,7` 옵션 추가 또는 반복 호출 — 후자 권장, P10 manual smoke에서 검증).

### 3) SSE 핸들러 단일화 — `lib/sseClient.ts`

```ts
import { useJobStore, type JobState } from "@/lib/store";
import { parseReviewReport } from "@/lib/reviewParser";
import type { SSEEvent } from "@/lib/claude";

type Store = ReturnType<typeof useJobStore.getState>;

/**
 * SSE 이벤트 → store 적용. 메인 run(`useJobRunner`)와 followup(`resume.ts`) 모두 사용.
 * 단일 출처에서 동기화되므로 두 경로의 UI 갱신 정합 보장.
 */
export function applySSEEvent(event: SSEEvent, store: Store): void {
  const data = event.data;
  switch (event.event) {
    case "stage": { /* 기존 useJobRunner 구현 그대로 */ }
    case "log":   { /* ... */ }
    case "progress": { /* ... */ }
    case "file": { /* ... */ }
    case "result": { /* ... */ }
    case "question": {
      const num = data.number as number;
      const stage = (data.stage as string | undefined) ?? (data.phase as string | undefined);
      const status = data.status as string | undefined;
      if (!num || !stage) break;
      if (status && status !== "ok") break;
      const payload = (data.data as unknown) ?? (data.content as unknown);
      if (payload == null) break;
      if (typeof payload === "string") {
        try { store.updateQuestionResult(num, stage, JSON.parse(payload)); }
        catch { store.updateQuestionResult(num, stage, { _raw: payload }); }
      } else {
        store.updateQuestionResult(num, stage, payload as Record<string, unknown>);
      }
      break;
    }
    case "extraction_review": {
      if (Array.isArray(data.items)) {
        for (const item of data.items as { number: number; data: Record<string, unknown> }[]) {
          store.updateQuestionResult(item.number, "extracted", item.data);
        }
      } else if (typeof data.number === "number" && data.data) {
        store.updateQuestionResult(data.number as number, "extracted", data.data as Record<string, unknown>);
      }
      store.setExtractionReviewActive(true);
      break;
    }
    case "error": { /* ... */ }
  }
}
```

`useJobRunner.ts`와 `resume.ts` 모두 `applySSEEvent(event, store)` 호출. 로컬 `handleSSEEvent` 함수 삭제.

### 4) stage counter cache-hit 카운팅 정정

`orchestrator.ts:processQuestion` 내부 cache-hit 분기에도 `onEnter`/`onLeave` 호출:

```ts
if (skipExtractor) {
  extractedOutput = await readCacheJson(cache.extractorResultPath(n));
  if (extractedOutput != null) {
    onEnter("extractor", n);   // ← 추가
    onLeave("extractor", n, "completed");  // ← 추가
    send({ event: "question", data: { number: n, stage: "extracted", status: "ok", data: extractedOutput } });
  }
}
```

단 `stageCounter.extractor.total`도 cache-hit 분 포함하도록 사전 계산 단계(`orchestrator.ts:834-840`) 수정:

```ts
// total = pipeline에 들어가는 전체 문제 수 (hit + miss 모두 포함)
if (runExtractor) stageCounter.extractor.total++;  // forceExtracted/state.extracted 분기 제거
```

→ cache-hit도 `entered/completed` 카운트, total과 일치. UI race 해소.

### 5) followup 라우트의 stopAfterStage 확장

`run/[jobId]/followup/route.ts:317-321`: stopAfterStage가 per-Q 분기에서만 set. 이미 동작 OK. `targetQuestionNumber` 전달 추가:

```ts
const orchResult = await runStageOrchestrator({
  mode: "resume",
  resumeFrom,
  meta,
  questionImages,
  stageOverrides,
  stopAfterStage,
  targetQuestionNumber: targetQuestions && targetQuestions.length === 1 ? targetQuestions[0] : undefined,
  // ...
});
```

### 6) 테스트

- `cleanup.test.ts`: 매트릭스 갱신 — 모든 case에서 exam_data 삭제 확인
- `figureRunner.test.ts`: `questionNumber` 전달 시 `--question N` 인자 확인 (spawn args 검증)
- `orchestrator.pipeline.test.ts`:
  - resume-from-builder 시 exam_data 새 rebuild되고 final_image가 figure_status에서 복원되어 HWPX에 그림 포함
  - cache hit + miss 혼합 시 stage counter `entered === total === completed` 결과
- 신규 `sseClient.test.ts`: `applySSEEvent`가 두 경로(메인 run / followup)에서 동일하게 store 갱신

## 체크리스트
- [ ] `cleanup.ts` 매트릭스 갱신 — 모든 fromStage에서 `exam_data.json` 삭제 (helper `deleteExamData` 추가)
- [ ] `orchestrator.ts`에 `targetQuestionNumber?: number` 받아 `runFigureStage(..., questionNumber: input.targetQuestionNumber)` 전달
- [ ] `run/[jobId]/followup/route.ts`에서 `targetQuestions.length === 1`일 때 `targetQuestionNumber` 전달
- [ ] `lib/sseClient.ts` 신설 — `applySSEEvent` 단일 구현
- [ ] `useJobRunner.ts`와 `components/results/question-result/resume.ts`에서 로컬 `handleSSEEvent` 삭제하고 `applySSEEvent` 사용
- [ ] `orchestrator.ts:processQuestion` cache-hit 분기에서 `onEnter`/`onLeave` 호출, `stageCounter.total` 계산 시 hit 포함
- [ ] `cleanup.test.ts` / `figureRunner.test.ts` / `orchestrator.pipeline.test.ts` 갱신
- [ ] 신규 `sseClient.test.ts` 케이스 추가
- [ ] `npx tsc --noEmit` + `npx vitest run server/stages/__tests__/ lib/__tests__/ --reporter=basic` 전체 통과

## 영향 범위

- 모든 resume 경로(B-α/β/γ)에서 exam_data 일관성 보장.
- followup 경로의 SSE 처리가 메인 run과 동일 — Navigator dot/UI 상태 정합.
- per-Q figure 재처리가 진짜로 1문제만 처리 → 비용 절감.
- stage counter UI 정합.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/ lib/__tests__/ --reporter=basic

# manual (사후 검증)
# 1) resume --from=builder 후 HWPX에 그림 포함 확인
# 2) resume --q=5 --from=figure 후 figure_processor 호출 로그에 --question 5 포함
# 3) cache hit + miss 혼합 (일부 _extracted만 있는 상태에서 resume) → UI 모든 stage가 done에 도달
```
