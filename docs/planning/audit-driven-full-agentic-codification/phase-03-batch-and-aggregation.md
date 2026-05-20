---
phase: 3
title: batch scheduling / verifier retry / verified aggregation codify
status: pending
depends_on: [2]
scope:
  - ngd-studio/server/stages/stagePlan.ts
  - ngd-studio/server/stages/examData.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/__tests__/stagePlan.test.ts
  - ngd-studio/server/stages/__tests__/examData.test.ts
  - ngd-studio/server/stages/__tests__/fixtures/stage-plan-cases.json
  - .claude/skills/ngd-exam-create/SKILL.md
intervention_likely: true
intervention_reason: "orchestrator의 기존 retry/aggregation 코드를 함수로 추출하면서 호출 위치 변경. 회귀 위험 있어 e2e 회귀 사전 확인 필요."
---

# Phase 3: batch scheduling / verifier retry / verified aggregation codify

> **범위**: Backend (TS) + skill 문서
> **난이도**: L
> **의존성**: Phase 2 (resumeCommand 사용)
> **영향 파일**: `stagePlan.ts` (신규), `examData.ts` (기존 확장), `orchestrator.ts` (리팩터)

## 배경

audit doc Group A3, A4 + Group B4, B5, B6, B7.

현재 `ngd-studio/server/stages/orchestrator.ts:151` `runStageOrchestrator` 내부에 batch 실행, verifier retry, aggregation 로직이 인라인으로 박혀 있음. skill에는 같은 로직이 자연어 + inline Python으로 중복.

본 phase는 4개 함수로 추출 + skill 자연어 제거.

## 설계

### 1. `ngd-studio/server/stages/stagePlan.ts` (신규)

```typescript
import type { ResumeCommand, ResumeStage } from "./resumeCommand";
import type { QuestionState } from "./resumeState";

export interface PerQuestionPlan {
  questionNumber: number;
  stages: ResumeStage[];      // 실행 순서대로
}

export interface StagePlan {
  totalQuestions: number[];
  perQuestion: PerQuestionPlan[];
}

/**
 * resume 명령 + 현재 disk state로부터 per-question stage plan 산출.
 * - resume.questions=undefined → 전체
 * - state가 verified → stage 0개 (skip)
 * - state가 extracted, resume.fromStage=solver → [solver, verifier, ...]
 */
export function buildStagePlan(
  resume: ResumeCommand,
  states: Map<number, QuestionState>,
  allQuestions: number[],
): StagePlan;
```

fixture: `__tests__/fixtures/stage-plan-cases.json` — 입력(`resume`, `states`, `allQuestions`) 10개 + expected `StagePlan` 출력.

### 2. orchestrator의 batch loop를 `runBatches`로 추출

```typescript
// ngd-studio/server/stages/stagePlan.ts (같은 파일)
export interface RunBatchesOptions<T> {
  concurrency: number;
  items: T[];
  worker: (item: T, signal: AbortSignal) => Promise<unknown>;
  onProgress?: (done: number, total: number) => void;
  signal: AbortSignal;
}

export async function runBatches<T>(opts: RunBatchesOptions<T>): Promise<Array<{ok: true; value: unknown} | {ok: false; error: unknown}>>;
```

기존 `runWithConcurrency` (orchestrator.ts:73)와 통합 또는 alias. concurrency=8 기본값을 stagePlan.ts에 명시.

### 3. `applyVerifierRetry`

orchestrator의 verifier feedback loop를 함수로 추출:

```typescript
export interface VerifierRetryConfig {
  maxAttempts: number;        // 3 기본
  onAttemptFail?: (attempt: number, feedback: string) => void;
}

export interface VerifierRetryResult {
  status: "pass" | "manual_review";
  finalSolverOutput: unknown;
  finalVerifierOutput: unknown;
  attempts: number;
  feedbackHistory: string[];
}

export async function applyVerifierRetry(
  runSolver: (feedback?: string) => Promise<unknown>,
  runVerifier: (solverOutput: unknown) => Promise<{ status: "pass"|"fail"; feedback?: string }>,
  config: VerifierRetryConfig,
): Promise<VerifierRetryResult>;
```

`runStageOrchestrator`의 verifier loop(orchestrator.ts 내 verifier 호출부)를 이 함수로 대체.

### 4. `aggregateVerifiedProblems` — `ngd-studio/server/stages/examData.ts` 확장

기존 `buildExamDataJson` 함수가 있으면 그것의 thin alias 또는 같은 모듈에 추가. audit lines 41 spec:
- 입력: 모든 `qN_verified.json`, exam meta
- 출력: `exam_data.json` 생성, count match
- 실패: 일부 verified 누락 시 typed error

```typescript
export interface AggregateResult {
  examDataPath: string;
  totalQuestions: number;
  includedQuestions: number;
  skippedQuestions: Array<{ number: number; reason: string }>;
}

export async function aggregateVerifiedProblems(
  cache: StageCache,
  totalQuestions: number[],
  meta: ExamMetaInput,
): Promise<AggregateResult>;
```

### 5. orchestrator.ts 리팩터

기존 `runStageOrchestrator` 내 batch/retry/aggregation 인라인 코드를 위 함수 호출로 대체. 시그니처 + 외부 동작 동일.

### 6. SKILL.md 수정

`## 작업 절차`의 batch/retry/aggregation 관련 자연어 + inline Python 블록 제거. 코드 경로 인용으로 대체.

## 영향 범위

- `runStageOrchestrator` 시그니처 불변 — 외부 API 회귀 없음
- 기존 `orchestrator.test.ts` + `orchestrator.integration.test.ts` 전부 통과 유지
- 새 함수의 단위 테스트가 인라인 로직보다 더 강한 회귀 안전망 제공

## 체크리스트

- [ ] coverage-matrix.md의 A3, A4, B4, B5, B6, B7 행에서 본 phase 인용 확인
- [ ] `stagePlan.ts` 신규 — `buildStagePlan` + `runBatches`
- [ ] fixture 10개 + `stagePlan.test.ts` round-trip 검증
- [ ] `examData.ts` — `aggregateVerifiedProblems` 추가 + `examData.test.ts` typed-error case 포함
- [ ] orchestrator.ts 리팩터 — 인라인 batch/retry/aggregation을 신규 함수 호출로 대체 (외부 동작 불변)
- [ ] SKILL.md — batch/retry/aggregation 자연어 + inline Python 제거, 코드 경로 인용
- [ ] **agentic→code 동치성 검증**: skill의 retry 로직 자연어 사양(3회 실패 → manual_review)을 fixture로 만들어 `applyVerifierRetry`가 정확히 같은 흐름 산출. orchestrator.integration.test.ts의 기존 verifier-loop 시나리오 5개 모두 동일 결과.

## 검증

```bash
# 1. 단위 + 통합 테스트
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test server/stages/__tests__/stagePlan.test.ts server/stages/__tests__/examData.test.ts --reporter=basic
cd ngd-studio && pnpm test server/stages/__tests__/orchestrator.test.ts server/stages/__tests__/orchestrator.pipeline.test.ts server/stages/__tests__/orchestrator.integration.test.ts --reporter=basic
# 기존 회귀 없음

# 2. SKILL.md 자연어 잔존 점검
grep -nE "verifier feedback.*재시도|3회 실패.*manual_review|concurrency=8" .claude/skills/ngd-exam-create/SKILL.md
# expected: 0 match (코드 경로 인용 1줄만 허용)

# 3. agentic→code 동치성 — fixture-based
# stagePlan.test.ts 안에서 10개 fixture round-trip
# examData.test.ts 안에서 verified 누락 시 typed error 발생 확인
# orchestrator.integration.test.ts의 verifier feedback loop 시나리오 unchanged
```
