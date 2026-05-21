import path from "path";
import { readFile } from "fs/promises";
import type { SSEEvent } from "@/lib/claude";
import type { AIProviderId } from "@/lib/ai/types";
import { getProviderAdapter } from "@/lib/ai/registry";
import type { StageOverrideMap, StageProviderId, StageSkipMap } from "@/lib/ai/settings";
import type { ProviderTelemetryEntry } from "@/lib/ai/retry";
import { createProviderTelemetryEntry } from "@/lib/ai/retry";
import type { StageCache } from "./cache";
import { createStageCache } from "./cache";
import type { ExamMetaInput } from "./examData";
import { buildExamDataJson } from "./examData";
import { runExtractorStage } from "./extractor";
import { runSolverStage } from "./solver";
import { runVerifierStage } from "./verifier";
import { runBuilderStage } from "./builder";
import { runCheckerWithAutoFix } from "./checker";
import { runFigureStage } from "./figureRunner";
import { readRuntimeEnv } from "../../lib/server/runtimeEnv";
import { determineStartStage, shouldRunStage } from "./resumeState";
import { applyVerifierRetry } from "./stagePlan";
import {
  stageEvent,
  progressEvent,
  logEvent,
  fileEvent,
  resultEvent,
} from "./events";
import type { JobStore } from "./jobStore";

// ──────────────────────────────────────────────
// Public interfaces
// ──────────────────────────────────────────────

export interface OrchestratorInput {
  mode: "create" | "resume";
  /** Stage to resume from: "extractor"|"solver"|"verifier"|"figure"|"builder"|"confirm"|"checker" */
  resumeFrom?: string;
  meta: ExamMetaInput;
  questionImages: { number: number; path: string }[];
  stageOverrides: StageOverrideMap;
  /** stage별 스킵 플래그. 현재는 create.verifier만 의미 있음. */
  stageSkip?: StageSkipMap;
  /** Gemini로 그림을 재생성할지. false면 crop+워터마크만 (figure_processor.py --no-regen). default true. */
  figureRegen?: boolean;
  /** checker auto-fix 시도 최대 횟수. 0 = 검사만, 기본 2. 범위 0~5. */
  checkerMaxAttempts?: number;
  /** verifier 재시도 최대 횟수. 0 = verifier 단계 스킵, 기본 3. 범위 1~5 (>=1일 때만 적용). */
  verifierMaxAttempts?: number;
  baseDir: string;
  send: (event: SSEEvent) => void;
  isAborted: () => boolean;
  /** Optional external AbortSignal — when aborted, fires the internal controller immediately
   *  (without waiting for the next stage-boundary `checkAborted()` poll). Required to kill
   *  in-flight provider processes (codex/claude CLI) on client disconnect. */
  externalSignal?: AbortSignal;
  /** Optional jobStore for live telemetry persistence */
  jobStore?: JobStore;
  jobId?: string;
  /** Override cache (used in tests) */
  cache?: StageCache;
}

export interface OrchestratorResult {
  status: "done" | "failed" | "cancelled";
  outputFile?: string;
  resultSummary?: string;
  providerTelemetry: ProviderTelemetryEntry[];
}

// ──────────────────────────────────────────────
// Concurrency helpers
// ──────────────────────────────────────────────

/**
 * Run `worker` over `items` with at most `limit` concurrent executions.
 * Results are returned in input order. Individual failures are captured as
 * `{ ok: false; error }` objects rather than re-thrown.
 */
export async function runWithConcurrency<T, R>(
  limit: number,
  items: T[],
  worker: (item: T) => Promise<R>
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));
  let queueIndex = 0;

  async function runOne(): Promise<void> {
    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];
      if (!current) break;
      try {
        const value = await worker(current.item);
        results[current.index] = { ok: true, value };
      } catch (error) {
        results[current.index] = { ok: false, error };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runOne());
  await Promise.all(workers);

  return results;
}

/**
 * A promise-based semaphore that limits concurrent executions.
 * acquire() waits until a slot is available, runs `fn`, then releases.
 */
export function semaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return {
    acquire: async <T>(fn: () => Promise<T>): Promise<T> => {
      if (active >= max) {
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      active++;
      try {
        return await fn();
      } finally {
        active--;
        const next = queue.shift();
        next?.();
      }
    },
  };
}

// ──────────────────────────────────────────────
// Concurrency constants
// ──────────────────────────────────────────────

const EXTRACTOR_CONCURRENCY = 4;
const SOLVER_CONCURRENCY = 6;
const VERIFIER_CONCURRENCY = 6;

// ──────────────────────────────────────────────
// Provider selection helper
// ──────────────────────────────────────────────

function getProviderForStage(
  stageKey: keyof StageOverrideMap,
  overrides: StageOverrideMap,
  defaultProvider: AIProviderId = "auto"
) {
  const id: StageProviderId = overrides[stageKey] ?? defaultProvider;
  return getProviderAdapter(id);
}

// ──────────────────────────────────────────────
// Orchestrator entry point
// ──────────────────────────────────────────────

export async function runStageOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const { baseDir, send, isAborted, stageOverrides, meta, questionImages } = input;

  const cache = input.cache ?? createStageCache(baseDir);
  const questionNumbers = questionImages.map((q) => q.number);
  const providerTelemetry: ProviderTelemetryEntry[] = [];

  // AbortController used to propagate cancellation into provider SDK fetch calls.
  const controller = new AbortController();
  const { signal } = controller;

  // Forward external aborts (e.g. SSE client disconnect) immediately — don't wait
  // for the next stage-boundary `checkAborted()` poll.
  if (input.externalSignal) {
    if (input.externalSignal.aborted) {
      controller.abort();
    } else {
      input.externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  /** Checks isAborted() and, if true, fires controller.abort() then returns true. */
  function checkAborted(): boolean {
    if (isAborted()) {
      controller.abort();
      return true;
    }
    return false;
  }

  // Determine where to start.
  const { startStage } = await determineStartStage(
    input.resumeFrom,
    cache,
    questionNumbers
  );

  let outputFile: string | undefined;
  let resultSummary: string | undefined;

  // Semaphores for per-question pipeline concurrency control.
  const extractSem = semaphore(EXTRACTOR_CONCURRENCY);
  const solveSem   = semaphore(SOLVER_CONCURRENCY);
  const verifySem  = semaphore(VERIFIER_CONCURRENCY);

  // Stage counters for atomic stage event emission.
  // Each stage tracks how many questions entered and how many finished.
  const stageCounter = {
    extractor: { entered: 0, completed: 0, failed: 0, total: 0 },
    solver:    { entered: 0, completed: 0, failed: 0, total: 0 },
    verifier:  { entered: 0, completed: 0, failed: 0, total: 0 },
  };

  type PipelineStageName = "extractor" | "solver" | "verifier";

  function onEnter(stage: PipelineStageName, n: number): void {
    const c = stageCounter[stage];
    c.entered++;
    if (c.entered === 1) {
      // First question entering this stage — emit "running".
      send(stageEvent(stage, "running"));
    }
    send(logEvent(stage, `Q${n} ${stage === "extractor" ? "추출" : stage === "solver" ? "풀이" : "검증"} 시작`));
  }

  function onLeave(stage: PipelineStageName, n: number, status: "completed" | "failed"): void {
    const c = stageCounter[stage];
    if (status === "completed") c.completed++;
    else c.failed++;

    const done = c.completed + c.failed;
    const label = stage === "extractor" ? "추출" : stage === "solver" ? "풀이" : "검증";
    const resultLabel = status === "completed" ? "완료" : "실패";
    send(logEvent(stage, `Q${n} ${label} ${resultLabel}`));
    send(progressEvent(stage, Math.round((done / c.total) * 100)));

    if (done === c.total) {
      // All questions have passed through this stage — emit summary stage event.
      const summary = `완료: ${c.completed}/${c.total}${c.failed > 0 ? `, 실패: [확인 필요]` : ""}`;
      if (c.completed === 0) {
        send(stageEvent(stage, "failed", { summary }));
      } else {
        send(stageEvent(stage, "done", { summary }));
      }
    }
  }

  /** Per-question result: which stage it failed at (undefined = full success). */
  interface QuestionPipelineResult {
    number: number;
    failedAt?: PipelineStageName;
    error?: string;
  }

  /** Run a single question through extract→solve→verify, skipping stages that are
   *  already cached (disk-scan resume). */
  async function processQuestion(
    img: { number: number; path: string }
  ): Promise<QuestionPipelineResult> {
    const n = img.number;

    // ── Disk-scan: determine which stages are already done ──────────────────
    const state = await cache.scanQuestionState(n);

    // Skip extractor if: stage is not needed (startStage > extractor), disk cache exists,
    // or user explicitly started from solver/verifier (extractor results must exist).
    const skipExtractor =
      !shouldRunStage(startStage, "extractor") ||
      state.extracted ||
      startStage === "solver" ||
      startStage === "verifier";

    // Skip solver if: stage not needed OR disk cache already has solver result.
    const skipSolver =
      !shouldRunStage(startStage, "solver") ||
      state.solved;

    // verifier 재시도 최대 횟수 (기본 3, 범위 0~5). 0이면 verifier 단계 스킵.
    const verifierMaxAttempts = Math.max(0, Math.min(5, Math.round(input.verifierMaxAttempts ?? 3)));

    // Skip verifier if: stage not needed OR disk cache already has verifier result
    // OR user explicitly set stageSkip["create.verifier"] = true OR verifierMaxAttempts === 0.
    const skipVerifier =
      !shouldRunStage(startStage, "verifier") ||
      state.verified ||
      input.stageSkip?.["create.verifier"] === true ||
      verifierMaxAttempts === 0;

    // ── Stage: Extractor ────────────────────────────────────────────────────
    let extractedOutput: unknown = null;

    if (skipExtractor) {
      extractedOutput = await readCacheJson(cache.extractorResultPath(n));
      // 캐시 hit: UI에 결과를 흘려준다. 라이브 모드든 resume이든
      // Navigator dot이 일관되게 켜지도록 신규 계산과 동일한 이벤트를 emit한다.
      if (extractedOutput != null) {
        send({
          event: "question",
          data: { number: n, stage: "extracted", status: "ok", data: extractedOutput },
        });
      }
    } else {
      const result = await extractSem.acquire(async () => {
        if (isAborted()) throw new Error("aborted");
        onEnter("extractor", n);
        const r = await runExtractorStage({
          questionNumber: n,
          imagePath: img.path,
          examMeta: input.meta,
          cache,
          provider: getProviderForStage("create.extractor", stageOverrides),
          signal,
        });
        onLeave("extractor", n, r.status === "completed" ? "completed" : "failed");
        return r;
      });

      if (result.provider) {
        providerTelemetry.push(
          createProviderTelemetryEntry({
            stageKey: "create.extractor",
            workflowStageKey: "create.extractor",
            requestedProvider: result.provider.requestedProvider ?? "auto",
            resolvedProvider: result.provider.provider ?? "claude-cli",
            attempt: 1,
            status: result.status === "completed" ? "success" : "failed",
            elapsedMs: computeElapsedMs(result.startedAt, result.completedAt),
            retry: false,
            errorSummary: result.error?.message,
          })
        );
      }

      if (result.status !== "completed") {
        send({
          event: "question",
          data: { number: n, stage: "extracted", status: "failed", error: result.error?.message },
        });
        return { number: n, failedAt: "extractor", error: result.error?.message };
      }

      send({
        event: "question",
        data: { number: n, stage: "extracted", status: "ok", data: result.output },
      });
      // Incremental extraction_review (per-question).
      send({ event: "extraction_review", data: { number: n, data: result.output } });
      extractedOutput = result.output;
    }

    // ── Stage: Solver ───────────────────────────────────────────────────────
    let solvedOutput: unknown = null;

    if (skipSolver) {
      solvedOutput = await readCacheJson(cache.solverResultPath(n));
      if (solvedOutput != null) {
        send({
          event: "question",
          data: { number: n, stage: "solved", status: "ok", data: solvedOutput },
        });
      }
    } else {
      const result = await solveSem.acquire(async () => {
        if (isAborted()) throw new Error("aborted");
        onEnter("solver", n);
        const r = await runSolverStage({
          questionNumber: n,
          extracted: extractedOutput,
          examMeta: input.meta,
          cache,
          provider: getProviderForStage("create.solver", stageOverrides),
          signal,
        });
        onLeave("solver", n, r.status === "completed" ? "completed" : "failed");
        return r;
      });

      if (result.provider) {
        providerTelemetry.push(
          createProviderTelemetryEntry({
            stageKey: "create.solver",
            workflowStageKey: "create.solver",
            requestedProvider: result.provider.requestedProvider ?? "auto",
            resolvedProvider: result.provider.provider ?? "claude-cli",
            attempt: 1,
            status: result.status === "completed" ? "success" : "failed",
            elapsedMs: computeElapsedMs(result.startedAt, result.completedAt),
            retry: false,
            errorSummary: result.error?.message,
          })
        );
      }

      if (result.status !== "completed") {
        send({
          event: "question",
          data: { number: n, stage: "solved", status: "failed", error: result.error?.message },
        });
        return { number: n, failedAt: "solver", error: result.error?.message };
      }

      send({
        event: "question",
        data: { number: n, stage: "solved", status: "ok", data: result.output },
      });
      solvedOutput = result.output;
    }

    // ── Stage: Verifier (with feedback loop via applyVerifierRetry) ──────────
    // When skipped explicitly by user setting, emit a single done event for UI clarity.
    const verifierExplicitlySkipped =
      (input.stageSkip?.["create.verifier"] === true || verifierMaxAttempts === 0) &&
      !state.verified;
    if (verifierExplicitlySkipped) {
      send(stageEvent("verifier", "done", { summary: "스킵됨 (사용자 설정)" }));
      send(logEvent("verifier", `Q${n} 검증 스킵 (verifierMaxAttempts=${verifierMaxAttempts})`));
    }

    // 캐시 hit: verifier 결과를 UI에 흘려준다 (verifier 블록은 통째로 스킵되므로 별도 처리).
    if (skipVerifier && state.verified) {
      const cachedVerified = await readCacheJson(cache.verifierResultPath(n));
      if (cachedVerified != null) {
        send({
          event: "question",
          data: { number: n, stage: "verified", status: "ok", data: cachedVerified },
        });
      }
    }

    if (!skipVerifier) {
      if (isAborted()) throw new Error("aborted");

      const verifierProvider = getProviderForStage("create.verifier", stageOverrides);
      const solverProvider   = getProviderForStage("create.solver",   stageOverrides);

      onEnter("verifier", n);

      // Track the last verifier result for error reporting.
      let lastVerifierError: string | undefined;

      // retryAttempt tracks how many retry solver calls have been made (for telemetry attempt number).
      let retryAttempt = 0;

      const retryResult = await applyVerifierRetry(
        // runSolver callback: called only on verifier-feedback retries (feedback is always set).
        // The initial solver output (solvedOutput) is provided via initialSolverOutput.
        async (feedback) => {
          if (isAborted()) throw new Error("aborted");
          retryAttempt++;
          send(logEvent("verifier", `Q${n} 검증 fail — 재풀이 (시도 ${retryAttempt + 1}/3)`));
          const solverResult = await solveSem.acquire(async () =>
            runSolverStage({
              questionNumber: n,
              extracted: extractedOutput,
              guidelineContext: feedback ? `Verifier feedback: ${feedback}` : undefined,
              examMeta: input.meta,
              cache,
              provider: solverProvider,
              signal,
            })
          );
          if (solverResult.provider) {
            providerTelemetry.push(
              createProviderTelemetryEntry({
                stageKey: "create.solver",
                workflowStageKey: "create.solver",
                requestedProvider: solverResult.provider.requestedProvider ?? "auto",
                resolvedProvider: solverResult.provider.provider ?? "claude-cli",
                attempt: retryAttempt,
                status: solverResult.status === "completed" ? "success" : "failed",
                elapsedMs: computeElapsedMs(solverResult.startedAt, solverResult.completedAt),
                retry: true,
                downstreamCorrection: true,
                errorSummary: solverResult.error?.message,
              })
            );
          }
          return solverResult.status === "completed" ? solverResult.output as unknown : solvedOutput;
        },
        // runVerifier callback: called after each solver run
        async (currentSolvedOutput) => {
          if (isAborted()) throw new Error("aborted");
          const verifierResult = await verifySem.acquire(async () =>
            runVerifierStage({
              questionNumber: n,
              extracted: extractedOutput,
              solved: currentSolvedOutput,
              examMeta: input.meta,
              cache,
              provider: verifierProvider,
              signal,
            })
          );
          if (verifierResult.provider) {
            providerTelemetry.push(
              createProviderTelemetryEntry({
                stageKey: "create.verifier",
                workflowStageKey: "create.verifier",
                requestedProvider: verifierResult.provider.requestedProvider ?? "auto",
                resolvedProvider: verifierResult.provider.provider ?? "claude-cli",
                attempt: retryAttempt + 1,
                status: verifierResult.status === "completed" ? "success" : "failed",
                elapsedMs: computeElapsedMs(verifierResult.startedAt, verifierResult.completedAt),
                retry: retryAttempt > 0,
                errorSummary: verifierResult.error?.message,
              })
            );
          }
          lastVerifierError = verifierResult.error?.message;
          if (verifierResult.status === "completed" && verifierResult.output?.status === "pass") {
            return { status: "pass" as const };
          }
          const feedback = verifierResult.output?.feedback;
          return { status: "fail" as const, ...(feedback ? { feedback } : {}) };
        },
        // config — pass the already-computed solver output to skip the initial solver call
        {
          maxAttempts: Math.max(1, verifierMaxAttempts),
          initialSolverOutput: solvedOutput,
        }
      );

      if (retryResult.status === "pass") {
        onLeave("verifier", n, "completed");
        send({
          event: "question",
          data: { number: n, stage: "verified", status: "ok", data: retryResult.finalVerifierOutput },
        });
        return { number: n };
      }

      // All attempts exhausted — manual_review.
      send(logEvent("verifier", `Q${n} 검증 실패: ${Math.max(1, verifierMaxAttempts)}회 시도 후에도 pass 못함`, "warn"));
      onLeave("verifier", n, "failed");
      send({
        event: "question",
        data: {
          number: n,
          stage: "verified",
          status: "failed",
          error: lastVerifierError ?? "verifier max attempts exceeded",
        },
      });
      // Not a hard stop — partial result is still usable.
      return { number: n };
    }

    return { number: n };
  }

  try {
    // ── Per-question pipeline: extractor → solver → verifier ──────────────
    const runExtractor = shouldRunStage(startStage, "extractor");
    const runSolver    = shouldRunStage(startStage, "solver");
    const runVerifier  = shouldRunStage(startStage, "verifier");

    // All questions participate when any per-question stage is active;
    // processQuestion() handles per-question skip logic via disk-scan.
    const pipelineQuestions = (runExtractor || runSolver || runVerifier) ? questionImages : [];

    const failedQuestionNumbers = new Set<number>();

    if (pipelineQuestions.length === 0) {
      // All model stages skipped (e.g. resume past verifier). Emit done events
      // so UI shows cached stages as completed rather than perpetual pending.
      for (const stage of ["extractor", "solver", "verifier"] as const) {
        send(stageEvent(stage, "done", { summary: "캐시로 스킵" }));
        send(progressEvent(stage, 100));
      }
    }

    if (pipelineQuestions.length > 0) {
      if (checkAborted()) return cancelled(providerTelemetry);

      // Initialise stage totals so onLeave can emit summaries correctly.
      // total = how many questions will actually visit each stage.
      for (const img of pipelineQuestions) {
        const state = await cache.scanQuestionState(img.number);
        const forceExtracted = startStage === "solver" || startStage === "verifier";
        if (runExtractor && !state.extracted && !forceExtracted) stageCounter.extractor.total++;
        if (runSolver    && !state.solved)                        stageCounter.solver.total++;
        if (runVerifier  && !state.verified)                      stageCounter.verifier.total++;
      }

      // If all questions already have cached results for a given stage, emit
      // a "done" event with cache-summary so UI doesn't show the card as pending.
      for (const stage of ["extractor", "solver", "verifier"] as const) {
        const enabled = stage === "extractor" ? runExtractor : stage === "solver" ? runSolver : runVerifier;
        if (enabled && stageCounter[stage].total === 0) {
          send(stageEvent(stage, "done", { summary: "캐시로 스킵" }));
          send(progressEvent(stage, 100));
        }
      }

      const pipelineResults = await Promise.all(pipelineQuestions.map(processQuestion));

      if (checkAborted()) return cancelled(providerTelemetry);

      // Aggregate pipeline result.
      const failedQuestions = pipelineResults.filter((r) => r.failedAt !== undefined);
      const successCount = pipelineResults.length - failedQuestions.length;

      if (successCount === 0 && pipelineResults.length > 0 && runExtractor) {
        // All questions failed in extractor — hard fail.
        send(logEvent("system", "모든 문제 추출 실패 — 작업을 중단합니다.", "error"));
        return failed(providerTelemetry, "extractor: 모든 문제 추출 실패");
      }

      if (failedQuestions.length > 0) {
        const failedNums = failedQuestions.map((r) => `Q${r.number}(${r.failedAt ?? "?"})`).join(", ");
        send(logEvent("system", `일부 문제 처리 실패: [${failedNums}] — 성공한 문제만으로 exam_data.json을 조립합니다.`, "warn"));
        for (const r of failedQuestions) failedQuestionNumbers.add(r.number);
      }

      // Emit batch extraction_review for backward-compatibility when extractor ran.
      // (Per-question incremental events were already sent; this gives UI the full list.)
      if (runExtractor && stageCounter.extractor.total > 0) {
        send({ event: "extraction_review", data: { questionNumbers } });
      }
    }

    // ── Build exam_data.json ───────────────────
    if (!checkAborted()) {
      await persistTelemetry(input, providerTelemetry, "running");
      const successfulQuestionNumbers = questionNumbers.filter((n) => !failedQuestionNumbers.has(n));
      if (successfulQuestionNumbers.length === 0) {
        send(logEvent("system", "성공한 문제가 없어 exam_data.json을 생성할 수 없습니다.", "error"));
        return failed(providerTelemetry, "모든 문제 처리 실패");
      }
      try {
        await buildExamDataJson({ cache, meta, questionNumbers: successfulQuestionNumbers });
        const skippedCount = questionNumbers.length - successfulQuestionNumbers.length;
        const summary = skippedCount > 0
          ? `exam_data.json 생성 완료 (${successfulQuestionNumbers.length}/${questionNumbers.length}, ${skippedCount}개 누락)`
          : "exam_data.json 생성 완료";
        send(logEvent("system", summary));
      } catch (err) {
        send(logEvent("system", `exam_data.json 생성 실패: ${err instanceof Error ? err.message : String(err)}`, "error"));
        return failed(providerTelemetry, "exam_data.json 생성 실패");
      }
    }

    // ── Stage 4: Figure ────────────────────────
    if (!checkAborted() && shouldRunStage(startStage, "figure")) {
      const regenerate = input.figureRegen !== false;
      send(stageEvent("figure", "running"));
      send(progressEvent("figure", 5));
      send(logEvent("figure", regenerate
        ? "figure_processor.py를 실행합니다 (Gemini 재생성)."
        : "figure_processor.py를 실행합니다 (crop만, Gemini 호출 없음)."));

      const runtimeEnv = readRuntimeEnv() as Record<string, string | undefined>;
      if (regenerate && !runtimeEnv.GEMINI_API_KEY && !runtimeEnv.GOOGLE_API_KEY) {
        send(logEvent(
          "figure",
          "GEMINI_API_KEY 미설정 — /settings에서 키를 추가하거나 figureRegen을 끄세요 (crop+워터마크만 적용됨).",
          "warn",
        ));
      }

      const figureResult = await runFigureStage({
        examDataPath: cache.paths.examData,
        outputDir: path.join(baseDir, "outputs", "images"),
        statusOutPath: cache.paths.figureStatus,
        regenerate,
        baseDir,
        env: runtimeEnv as NodeJS.ProcessEnv,
      });

      // figure_status.json을 읽어 문제별 결과를 SSE로 흘려준다.
      // (figureRunner는 partial/failed 상태에도 status 파일을 쓰므로 항상 시도.)
      await emitFigureQuestionEvents(cache.paths.figureStatus, send);

      if (figureResult.status !== "failed") {
        send(progressEvent("figure", 100));
        send(stageEvent("figure", "done", { summary: "figure 처리 완료" }));
      } else {
        send(stageEvent("figure", "failed", { summary: "figure_processor.py 실패" }));
        send(logEvent("figure", "figure_processor.py 실패", "error"));
        if (checkAborted()) return cancelled(providerTelemetry);
      }
    }

    // ── Stage 5: Builder ───────────────────────
    if (!checkAborted() && shouldRunStage(startStage, "builder")) {
      send(stageEvent("builder", "running"));
      send(progressEvent("builder", 5));
      send(logEvent("builder", "deterministic builder runner를 실행합니다."));

      const builderStartedAt = Date.now();
      const builderResult = await runBuilderStage({ baseDir, cache });

      if (builderResult.status === "completed" && builderResult.output) {
        const relativeOutput = path.relative(baseDir, builderResult.output.hwpxPath);
        outputFile = relativeOutput;
        resultSummary = "builder 완료";
        send(progressEvent("builder", 100));
        send(stageEvent("builder", "done", { summary: resultSummary }));
        send(fileEvent({ type: "hwpx", name: path.basename(relativeOutput), path: relativeOutput }));
      } else {
        send(stageEvent("builder", "failed", { summary: builderResult.error?.message }));
        send(logEvent("builder", "deterministic builder 실패. LLM fallback 없이 작업을 중단합니다.", "error"));
        providerTelemetry.push(
          createProviderTelemetryEntry({
            stageKey: undefined,
            workflowStageKey: "builder",
            requestedProvider: "auto",
            resolvedProvider: "claude-cli",
            attempt: 1,
            status: "failed",
            elapsedMs: Date.now() - builderStartedAt,
            retry: false,
            errorSummary: builderResult.error?.message?.slice(0, 300),
          })
        );
        await persistTelemetry(input, providerTelemetry, "failed");
        return failed(providerTelemetry, builderResult.error?.message);
      }

      providerTelemetry.push(
        createProviderTelemetryEntry({
          stageKey: undefined,
          workflowStageKey: "builder",
          requestedProvider: "auto",
          resolvedProvider: "claude-cli",
          attempt: 1,
          status: "success",
          elapsedMs: Date.now() - builderStartedAt,
          retry: false,
        })
      );

      await persistTelemetry(input, providerTelemetry, "running");
      if (checkAborted()) return cancelled(providerTelemetry);
    }

    // ── Stage 6: Checker (with auto-fix) ──────────
    if (!checkAborted() && shouldRunStage(startStage, "checker")) {
      send(stageEvent("checker", "running"));
      send(progressEvent("checker", 5));
      send(logEvent("checker", "deterministic checker runner를 실행합니다."));

      const hwpxPath = outputFile
        ? (path.isAbsolute(outputFile) ? outputFile : path.join(baseDir, outputFile))
        : undefined;

      const checkerStartedAt = Date.now();
      const maxAttempts = input.checkerMaxAttempts ?? 2;
      const { result: checkerResult, autofixed } = await runCheckerWithAutoFix(
        { hwpxPath, schoolLevel: input.meta.schoolLevel },
        maxAttempts
      );

      if (autofixed) {
        send(logEvent("checker", "auto-fix 적용됨: 결정적 수정 후 재검사 완료."));
      }

      providerTelemetry.push(
        createProviderTelemetryEntry({
          stageKey: undefined,
          workflowStageKey: "checker",
          requestedProvider: "auto",
          resolvedProvider: "claude-cli",
          attempt: 1,
          status: checkerResult.status === "completed" ? "success" : "failed",
          elapsedMs: Date.now() - checkerStartedAt,
          retry: false,
          ...(autofixed ? { downstreamCorrection: true } : {}),
        })
      );

      if (checkerResult.status === "completed" && checkerResult.output) {
        const issueCount = checkerResult.output.issues.length;
        resultSummary = `checker 완료: ${issueCount} issue(s)${autofixed ? " (auto-fixed)" : ""}`;
        send(progressEvent("checker", 100, { issueCount }));
        send(stageEvent("checker", "done", { summary: resultSummary }));
      } else {
        const issueCount = checkerResult.output?.issues.length ?? 0;
        send(stageEvent("checker", "failed", {
          summary: checkerResult.error?.message ?? `${issueCount} issue(s)`,
        }));
      }

      if (checkAborted()) return cancelled(providerTelemetry);
    }

    // ── Done ───────────────────────────────────
    if (checkAborted()) return cancelled(providerTelemetry);

    send(resultEvent("success", resultSummary, outputFile));
    await persistTelemetry(input, providerTelemetry, "done");

    return {
      status: "done",
      outputFile,
      resultSummary,
      providerTelemetry,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(logEvent("system", `오케스트레이터 오류: ${message}`, "error"));
    send(resultEvent("failed", message));
    await persistTelemetry(input, providerTelemetry, "failed");
    return failed(providerTelemetry, message);
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function readCacheJson(filePath: string): Promise<unknown> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

interface FigureStatusFile {
  questions?: Record<string, { status?: string; image?: string; error?: string }>;
}

/**
 * figure_status.json을 읽어 문제별 figure 결과를 SSE `question` 이벤트로 흘려준다.
 * Navigator의 그림 dot이 완료/실패/경계불확실을 정확히 반영하도록 한다.
 */
async function emitFigureQuestionEvents(
  statusPath: string,
  send: (event: SSEEvent) => void,
): Promise<void> {
  const parsed = await readCacheJson(statusPath) as FigureStatusFile | null;
  if (!parsed?.questions) return;
  for (const [key, q] of Object.entries(parsed.questions)) {
    const n = Number(key);
    if (!Number.isFinite(n)) continue;
    // SSE envelope status는 항상 "ok"로 둔다 — figure 단계의 ok/failed/boundary_uncertain
    // 구분은 payload 내부 status 필드로 전달하여 클라이언트 핸들러 필터에 막히지 않도록 한다.
    const payload: Record<string, unknown> = {
      status: q?.status ?? "ok",
      ...(q?.image ? { image: q.image } : {}),
      ...(q?.error ? { error: q.error } : {}),
    };
    send({
      event: "question",
      data: { number: n, stage: "figure", status: "ok", data: payload },
    });
  }
}

function computeElapsedMs(startedAt?: string, completedAt?: string): number {
  if (!startedAt || !completedAt) return 0;
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

async function persistTelemetry(
  input: OrchestratorInput,
  telemetry: ProviderTelemetryEntry[],
  status: string
): Promise<void> {
  if (!input.jobStore || !input.jobId) return;
  try {
    await input.jobStore.update(input.jobId, {
      providerTelemetry: telemetry,
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // telemetry persistence is best-effort
  }
}

function cancelled(providerTelemetry: ProviderTelemetryEntry[]): OrchestratorResult {
  return { status: "cancelled", providerTelemetry };
}

function failed(providerTelemetry: ProviderTelemetryEntry[], message?: string): OrchestratorResult {
  return { status: "failed", resultSummary: message, providerTelemetry };
}
