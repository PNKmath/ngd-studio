---
phase: 4
title: per-question pipeline orchestrator + disk-scan resume + partial-fail
status: completed
depends_on: [2, 3]
scope:
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/cache.ts
  - ngd-studio/server/stages/__tests__/orchestrator.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
intervention_likely: true
intervention_reason: "stage event 의미 재정의(running/done atomic counter) + partial-fail handling 설계 confirm 필요. 큰 변경이라 설계 후 사용자 검토 권장."
---

# Phase 4: per-question pipeline orchestrator

> **범위**: Backend (orchestrator 핵심)
> **난이도**: M
> **의존성**: Phase 2, Phase 3 (새 schema 안정화 후)
> **영향 파일**: `server/stages/orchestrator.ts`, `cache.ts`, 두 orchestrator 테스트

## 배경

현재 orchestrator는 stage-batched 직렬: `runExtractorStageGroup` → `runSolverStageGroup` → `runVerifierStageGroup`. 각 stage 안은 `runWithConcurrency`로 병렬이지만 **stage 경계마다 전체 question이 대기**. 가장 느린 question 1개가 모든 후속을 막음.

per-question pipeline으로 전환하면 각 question이 `extract → solve → verify`를 독립 chain으로 흐르고, stage별 semaphore가 동시성만 제한.

## 설계

### 1. 핵심 구조

```ts
function semaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return {
    acquire: async <T>(fn: () => Promise<T>): Promise<T> => {
      if (active >= max) await new Promise<void>((r) => queue.push(r));
      active++;
      try { return await fn(); }
      finally {
        active--;
        const next = queue.shift();
        next?.();
      }
    },
  };
}

const extractSem = semaphore(EXTRACTOR_CONCURRENCY);
const solveSem   = semaphore(SOLVER_CONCURRENCY);
const verifySem  = semaphore(VERIFIER_CONCURRENCY);

// stage counter for atomic stageEvent
const stageCounter = {
  extractor: { entered: 0, completed: 0, failed: 0 },
  solver: { entered: 0, completed: 0, failed: 0 },
  verifier: { entered: 0, completed: 0, failed: 0 },
};

async function processQuestion(n: number) {
  // Extract
  const extracted = await extractSem.acquire(async () => {
    onEnter("extractor", n);
    const r = await runExtractorStage({ ... });
    onLeave("extractor", n, r.status);
    return r;
  });
  if (extracted.status !== "completed") return { number: n, failedAt: "extractor", result: extracted };

  // Solve
  const solved = await solveSem.acquire(async () => {
    onEnter("solver", n);
    const r = await runSolverStage({ ... });
    onLeave("solver", n, r.status);
    return r;
  });
  if (solved.status !== "completed") return { number: n, failedAt: "solver", result: solved };

  // Verify with feedback loop (re-uses solveSem on re-solve)
  const verified = await runVerifierFeedbackLoop(n, extracted.output, solved.output, { solveSem, verifySem, ... });

  return { number: n, failedAt: verified.failedAt, result: verified.result };
}

const results = await Promise.all(questionNumbers.map(processQuestion));
```

### 2. Stage event 의미 재정의

- `onEnter("extractor", n)`:
  - `counter.extractor.entered++`
  - 만약 이 호출이 첫 entered (1번째)면 `send(stageEvent("extractor", "running"))`
  - `send(logEvent("extractor", "Q${n} 추출 시작"))`
- `onLeave("extractor", n, status)`:
  - if status === "completed": `counter.extractor.completed++`
  - else: `counter.extractor.failed++`
  - `send(progressEvent("extractor", ((completed + failed) / total) * 100))`
  - `send(logEvent("extractor", "Q${n} 추출 ${status}"))`
  - 만약 `completed + failed === total` (모든 question이 이 stage를 거쳐감):
    - if `completed === 0`: `send(stageEvent("extractor", "failed", { summary }))`
    - else: `send(stageEvent("extractor", "done", { summary }))` (partial fail 포함)

solver / verifier 동일 패턴.

### 3. Partial fail 처리

- 한 question이 extractor에서 fail → 그 question은 더 진행 안 함 (chain return). 다른 question은 영향 없음.
- 전체 종료 시 `results` 집계:
  - 모두 success → `result: success`
  - 일부 fail → `result: partial`, failed question 번호 목록 포함
  - 모두 fail → `result: failed`
- 현재 `runExtractorStageGroup`이 throw하던 `"extractor: 모든 문제 추출 실패"` 패턴은 `processQuestion` 외부에서 집계 후 결정.

### 4. exam_data.json 생성 시점

- 현재: 모든 verifier 완료 후 `buildExamDataJson` 1회 호출.
- 새: 모든 `processQuestion` Promise 완료 후 동일하게 1회. 위치만 옮김.
- partial fail 시: 성공한 question만으로 exam_data.json 생성 (현재도 사실상 그렇게 동작).

### 5. Disk-scan resume

- `cache.ts`에 helper 추가:
  ```ts
  export interface QuestionCacheState {
    extracted: boolean;
    solved: boolean;
    verified: boolean;
  }

  async scanQuestionState(n: number): Promise<QuestionCacheState> { ... }
  async scanAll(numbers: number[]): Promise<Map<number, QuestionCacheState>>;
  ```
- orchestrator 진입 시 (resume 모드) `scanAll(questionNumbers)` → 각 question별로 skip할 stage 결정.
- `processQuestion`이 시작 시 자신의 state를 보고 이미 완료된 stage는 skip하고 cache에서 결과 로드.

```ts
async function processQuestion(n) {
  const state = await scanQuestionState(n);
  let extracted = state.extracted ? await readCacheJson(extractorResultPath(n)) : null;
  if (!extracted) extracted = (await extractSem.acquire(...)).output;
  ...
}
```

- schema mismatch (예: Phase 2의 새 schema와 안 맞는 old solver 결과): readCacheJson 후 validator 재실행 → fail이면 cache 무시하고 재실행. 이 phase에서는 그냥 try-validate 로직만 추가.

### 6. extraction_review 이벤트

- 현재: 모든 extractor 완료 후 1회 일괄 emit (`{ items: [...] }`).
- 새: 각 question extract 완료 시점에 `send({ event: "extraction_review", data: { number: n, data: stageResult.output } })` per-question incremental.
- 또는 frontend가 이미 `question` 이벤트 stage="extracted"로 같은 정보 받으므로 deprecate 고려. **이 phase에서는 incremental emit로 유지** (frontend Phase 5에서 핸들러 정리).

### 7. shouldRunStage / startStage 호환

- 현재 `shouldRunStage(startStage, "solver")` 같은 분기는 resume 진입점 결정용.
- 새 모델에서는 `processQuestion`이 자체 disk-scan으로 어디부터 할지 결정 → `startStage` 인자는 사실상 무용지물.
- 호환: `startStage`가 "solver"면 extractor scan 결과를 강제로 `extracted: true` 처리 (사용자가 "solver부터" 의도). 단순 mapping 유지.

## 체크리스트

- [x] `semaphore` 헬퍼 정의 (orchestrator.ts 내부 또는 별도 util)
- [x] `cache.ts`에 `scanQuestionState` / `scanAll` helper 추가
- [x] `processQuestion` 함수 작성 — extract→solve→verify chain + disk-scan skip
- [x] `runVerifierFeedbackLoop`로 verifier 재시도 로직을 처리, solveSem 공유
- [x] stage counter 기반 stageEvent atomic emit 구현
- [x] partial fail 집계 및 최종 result status 결정
- [x] `runExtractorStageGroup` / `runSolverStageGroup` / `runVerifierStageGroup` 제거, 대신 `Promise.all(questionNumbers.map(processQuestion))`
- [x] orchestrator.test.ts / orchestrator.integration.test.ts 새 모델 반영 (mock provider로 검증)

## 영향 범위

- `runExtractorStageGroup` 외부 호출자 없음 (orchestrator 내부 helper).
- SSE event shape는 동일 (`stage`/`progress`/`log`/`question`/`extraction_review`).
- frontend Phase 5에서 `extraction_review` 핸들러를 incremental 처리로 변경. 현재 코드가 `items` 배열 처리하지만 `number/data` 단일 처리도 추가하면 됨.
- 캐시 schema mismatch 처리는 best-effort (try-validate, fail이면 재실행). 이전 작업의 legacy schema cache는 자동 재실행.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/orchestrator.test.ts server/stages/__tests__/orchestrator.integration.test.ts --reporter=basic
```

추가 검증 (Phase 6에서 더 강하게):
- mock provider로 3 question 시뮬레이션 → 모든 SSE event 순서 검증 (Q1 extracted 가 Q3 extracted 이전에 와도 OK)
- partial fail 시나리오: Q2가 extractor에서 fail → 다른 question은 verify까지 진행, 최종 result: partial

## 실행 결과

### 1회차 (2026-05-18 01:31 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
per-question pipeline 구현 완료. `runExtractorStageGroup` / `runSolverStageGroup` / `runVerifierStageGroup` 3개 함수를 제거하고 `processQuestion` 함수로 대체. 각 question이 `extract→solve→verify`를 독립 chain으로 흐르며 semaphore로 동시성 제어. cache.ts에 `scanQuestionState` / `scanAll` helper 추가. stage counter 기반 atomic stageEvent emit 구현.

#### 변경 파일
- `ngd-studio/server/stages/orchestrator.ts` (수정, 대규모 리팩터)
- `ngd-studio/server/stages/cache.ts` (수정, +30줄)
- `ngd-studio/server/stages/__tests__/orchestrator.test.ts` (수정, 테스트 갱신)
- `ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts` (수정, 테스트 갱신)
- `ngd-studio/server/stages/__tests__/fixtures/solved/q01-03.json` (수정, explanation_parts 스키마 갱신)

#### 검증 결과
- [x] `npx tsc --noEmit`: pass (오류 없음)
- [x] orchestrator.test.ts 17/17 pass
- [x] orchestrator.integration.test.ts 5/5 pass
- [x] 전체 22 tests pass

#### 추가 발견사항
- Integration test fixture (solved/q0N.json)가 Phase 2에서 변경된 `explanation_parts` 스키마와 불일치 → 모두 갱신함.
- Integration test의 "full flow from extractor review" 테스트가 구 extraction_review_pending 동작 가정 → per-question pipeline에 맞게 재작성.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)

accepted — declared scope 4파일(orchestrator.ts, cache.ts, 2 테스트) 모두 in-scope. `__tests__/fixtures/solved/q0{1,2,3}.json`은 Phase 2 schema 변경 entailment(integration 테스트가 fixture 사용), Phase 2 동일 정책으로 phase 4 commit에 포함.

#### Verification Re-run (orchestrator)

exit 0 — `npx tsc --noEmit` 0 errors, `vitest orchestrator.test.ts orchestrator.integration.test.ts` 22/22 pass.

#### Simplify (orchestrator)

SIMPLIFIED: 2 — orchestrator.ts: pipelineQuestions 필터 4줄→1줄 단순화, 미사용 extractorProvider 변수 제거. Verify pass.

#### Review (orchestrator)

VERDICT: pass — semaphore/counter/partial-fail 모두 스펙 의미와 일치, 22/22 pass.

#### Commit

8e57dad
