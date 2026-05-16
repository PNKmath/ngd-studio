---
task: agent-provider-operating-model
phase: 5
title: StageRunner Architecture Draft
created: 2026-05-16
---

# StageRunner 아키텍처 초안

목표는 `/api/run`이 전체 prompt를 provider에 넘기는 구조에서 벗어나, 서버가 stage를 직접 실행하고 필요한 순간에만 provider를 호출하는 구조로 이동하는 것이다. Provider는 job owner가 아니라 stage capability가 된다.

## 현재 구조와 목표 구조

현재:

```text
useJobRunner
  -> SSE /api/run
  -> build*Prompt()
  -> runAIProvider(prompt)
  -> Claude/Codex/DeepSeek adapter
  -> transformToSSE()
```

목표:

```text
useJobRunner
  -> SSE /api/run
  -> JobRunner(mode)
  -> StageRunner<Input, Output>[]
  -> deterministic runner OR StageModelProvider call
  -> schema validation
  -> deterministic validators
  -> cache write
  -> SSE events + telemetry
```

## TypeScript 인터페이스 초안

```ts
export interface StageRunContext {
  jobId: string;
  mode: "create" | "resume" | "crop" | "review";
  cwd: string;
  dataDir: string;
  cacheDir: string;
  outputDir: string;
  meta: ExamMeta;
  providerPolicy: ProviderPolicy;
  emit: (event: SSEEvent) => void;
  telemetry: StageTelemetrySink;
  signal?: AbortSignal;
}

export interface StageRunner<Input, Output> {
  key: StageKey;
  label: string;
  inputSchema: Schema<Input>;
  outputSchema: Schema<Output>;
  run(input: Input, context: StageRunContext): Promise<StageResult<Output>>;
  validate?(output: Output, context: StageRunContext): Promise<ValidationResult>;
}

export interface StageResult<Output> {
  status: "success" | "failed" | "needs_user" | "skipped";
  output?: Output;
  error?: StageError;
  files?: StageFile[];
  summary?: string;
}
```

권장 `StageKey`:

- `cropper`
- `create.cleaned`
- `create.extractor`
- `create.review_extract`
- `create.solver`
- `create.verifier`
- `create.aggregate`
- `figure`
- `builder`
- `checker`
- `review.reviewer`

현재 `AIStageKey`는 provider override 대상만 표현한다. 후속 구현에서는 `StageKey`와 `ModelStageKey`를 분리해야 한다.

## Provider 타입 경계

두 provider 계열을 분리한다.

```ts
export interface StageModelProvider<Input, Output> {
  id: ResolvedAIProviderId;
  kind: "model";
  runStage(input: Input, options: StageModelRunOptions): Promise<ModelStageResult<Output>>;
}

export interface AgentWorkflowProvider {
  id: "claude" | "codex";
  kind: "agent-workflow";
  runPrompt(prompt: string, options: AgentWorkflowRunOptions): ProviderRunResult;
}
```

의미:

- `StageModelProvider`: DeepSeek V4, 향후 API model provider. 서버가 input/output schema를 소유한다.
- `AgentWorkflowProvider`: Claude/Codex legacy prompt workflow. 파일/tool/skill 실행이 가능하지만 stage contract 밖의 임시 compatibility layer다.

기존 `AIProviderAdapter`는 migration 중에는 유지하되, 새 stage runner는 model stage에서 `run(prompt)` 대신 `runStage(input)` 형태를 사용해야 한다.

## SSE Event 책임

SSE event emission은 provider가 아니라 서버 runner가 소유한다.

서버 runner가 직접 emit:

- `stage`: stage 시작/완료/실패
- `progress`: batch progress, question count
- `file`: 생성 파일 path
- `question`: extracted/solved/verified JSON update
- `extraction_review`: frontend edit gate
- `log`: stage-level structured log
- `result`: job final result
- `error`: unrecoverable error

Provider event stream은 내부 telemetry/input으로만 사용한다. Claude/Codex legacy adapter의 `transformToSSE()`는 migration 기간에만 쓰고, deterministic runner가 붙은 stage부터는 stage runner가 직접 event를 emit한다.

## Job metadata와 cache write 책임

서버 runner가 write owner다.

Job metadata:

- `data/jobs/{jobId}.json`
- status: running/done/failed/cancelled/needs_user
- requestedProvider, resolvedProvider, stageOverrides
- stage results
- provider telemetry
- outputFile/resultSummary

Stage cache:

- `inputs/시험지 제작/.v3cache/qN_extracted.json`
- `qN_solved.json`
- `qN_verified.json`
- `exam_data.json`
- `figure_status.json`
- `build_status.json`

규칙:

- Model provider는 파일을 직접 쓰지 않는다.
- 서버가 provider output을 schema validation한 뒤 cache에 쓴다.
- deterministic script는 파일을 생성할 수 있지만, runner가 결과 파일을 검증하고 metadata에 반영한다.

## Validation 흐름

각 stage는 다음 순서를 따른다.

```text
input schema validation
  -> runner execution
  -> output schema validation
  -> deterministic validator
  -> cache write
  -> telemetry write
  -> SSE completion
```

예:

- `create.extractor`: output JSON schema, subtopic vocabulary, HWP equation lint
- `create.solver`: explanation_parts schema, no run-on equation, answer exists
- `create.verifier`: fail이면 feedback required, pass만 aggregate 가능
- `builder`: HWPX exists, zip valid, `validate.py --fix` exit 0
- `checker`: XML rule issue list schema
- `review.reviewer`: patch result, review table presence, postprocess validation

## Retry / fallback / telemetry

기존 `ngd-studio/lib/ai/retry.ts`의 개념을 stage runner로 올린다.

권장 순서:

1. provider/stage policy gate
2. attempt start telemetry
3. provider call 또는 deterministic command 실행
4. output schema validation
5. deterministic validator
6. retry decision
7. fallback decision
8. final telemetry write

Retry:

- 같은 provider 재시도는 stage별 maxAttempts로 제한한다.
- validation failure도 retry reason으로 기록한다.
- abort/cancel은 retry하지 않는다.

Fallback:

- cross-provider fallback은 stage policy와 사용자 opt-in이 있는 경우에만 허용한다.
- 기본 fallback은 Claude agent workflow가 아니라, deterministic runner 또는 같은 stage의 명시 fallback provider다.
- DeepSeek 결과 실패 시 서버가 Claude/Codex fallback을 고를 수 있지만, 이 결정은 provider adapter가 아니라 runner policy가 한다.

Telemetry:

- stageKey
- requestedProvider
- resolvedProvider
- attempt
- status
- elapsedMs
- retry
- fallbackFrom/fallbackTo
- validationFailure kind
- externalCostUsd
- downstreamCorrectionRequired

## Migration path

### 1단계: Legacy wrapper 유지

- 현재 `/api/run` prompt workflow를 유지한다.
- `provider-operating-policy.md`에 legacy 한계를 문서화한다.
- `auto`는 계속 Claude 기본값으로 둔다.

### 2단계: deterministic stage부터 분리

- `create.aggregate`
- `builder`
- `checker` XML rules
- review table insertion
- cache cleanup/resume parser

이 단계는 model provider 변경 없이 가능하다.

### 3단계: model stage harness 도입

- `create.verifier`부터 `StageModelProvider`를 붙인다.
- `create.solver`를 추가한다.
- `review.reviewer`는 direct edit이 아니라 report draft stage로 시작한다.
- `create.extractor`는 이미지 API payload와 schema validation이 준비된 뒤 진행한다.

### 4단계: Claude/Codex prompt workflow 축소

- `buildCreatePrompt`, `buildResumePrompt`, `buildReviewPrompt`는 legacy fallback prompt로 남긴다.
- 새 path는 `JobRunner`가 stage plan을 만들고 stage별 runner를 실행한다.
- `transformToSSE()`의 text/tool 기반 stage detection 의존을 줄인다.

## 후속 구현 파일 후보

- `ngd-studio/server/stages/types.ts`
- `ngd-studio/server/stages/jobRunner.ts`
- `ngd-studio/server/stages/cache.ts`
- `ngd-studio/server/stages/events.ts`
- `ngd-studio/server/stages/modelProvider.ts`
- `ngd-studio/server/stages/validators/*.ts`
- `ngd-studio/server/stages/runners/builder.ts`
- `ngd-studio/server/stages/runners/checker.ts`
- `ngd-studio/server/stages/runners/createVerifier.ts`
- `ngd-studio/lib/ai/stageTypes.ts`

`server/sse.ts`는 처음에는 새 `JobRunner`를 호출하는 thin HTTP/SSE adapter가 되고, 안정화 후 provider prompt assembly 책임을 내려놓는다.
