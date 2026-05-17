import path from "path";
import { readFile } from "fs/promises";
import type { SSEEvent } from "@/lib/claude";
import type { AIProviderId } from "@/lib/ai/types";
import { getProviderAdapter } from "@/lib/ai/registry";
import type { StageOverrideMap, StageProviderId } from "@/lib/ai/settings";
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
import { runCheckerStage } from "./checker";
import { runStageCommand } from "./commands";
import { determineStartStage, shouldRunStage } from "./resumeState";
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
// Concurrency helper
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
  const { startStage, targetQuestions } = await determineStartStage(
    input.resumeFrom,
    cache,
    questionNumbers
  );

  let outputFile: string | undefined;
  let resultSummary: string | undefined;

  try {
    // ── Stage 1: Extractor ─────────────────────
    if (!checkAborted() && shouldRunStage(startStage, "extractor")) {
      await runExtractorStageGroup({
        questionNumbers,
        questionImages,
        targetQuestions,
        cache,
        stageOverrides,
        send,
        isAborted,
        signal,
        providerTelemetry,
      });

      if (checkAborted()) return cancelled(providerTelemetry);

      // After extractor, pause for user review (only when we actually ran extractor).
      // Emit extraction_review event and return "done" — the user will resume
      // via a new request with resumeFrom=solver.
      send({
        event: "extraction_review",
        data: { questionNumbers },
      });
      send(resultEvent("success", "extraction_review_pending"));

      await persistTelemetry(input, providerTelemetry, "running");
      return {
        status: "done",
        resultSummary: "extraction_review_pending",
        providerTelemetry,
      };
    }

    // ── Stage 2: Solver ────────────────────────
    if (!checkAborted() && shouldRunStage(startStage, "solver")) {
      await runSolverStageGroup({
        questionNumbers: startStage === "solver" ? targetQuestions : questionNumbers,
        cache,
        stageOverrides,
        send,
        isAborted,
        signal,
        providerTelemetry,
      });
      if (checkAborted()) return cancelled(providerTelemetry);
    }

    // ── Stage 3: Verifier (with feedback loop) ─
    if (!checkAborted() && shouldRunStage(startStage, "verifier")) {
      await runVerifierStageGroup({
        questionNumbers: startStage === "verifier" ? targetQuestions : questionNumbers,
        cache,
        stageOverrides,
        send,
        isAborted,
        signal,
        providerTelemetry,
      });
      if (checkAborted()) return cancelled(providerTelemetry);
    }

    // ── Build exam_data.json ───────────────────
    if (!checkAborted()) {
      await persistTelemetry(input, providerTelemetry, "running");
      try {
        await buildExamDataJson({ cache, meta, questionNumbers });
        send(logEvent("system", "exam_data.json 생성 완료"));
      } catch (err) {
        send(logEvent("system", `exam_data.json 생성 실패: ${err instanceof Error ? err.message : String(err)}`, "error"));
        return failed(providerTelemetry, "exam_data.json 생성 실패");
      }
    }

    // ── Stage 4: Figure ────────────────────────
    if (!checkAborted() && shouldRunStage(startStage, "figure")) {
      const figureOk = await runFigureStage({ baseDir, cache, send });
      if (!figureOk && checkAborted()) return cancelled(providerTelemetry);
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
        // Builder failed — try legacy CLI fallback.
        send(stageEvent("builder", "failed", { summary: builderResult.error?.message }));
        send(logEvent("builder", "deterministic builder 실패 — legacy builder fallback으로 전환합니다.", "warn"));
        const legacyResult = await runLegacyBuilderFallback({ baseDir, send });
        outputFile = legacyResult.outputFile;
        resultSummary = legacyResult.resultSummary ?? "builder fallback 완료";
        if (legacyResult.telemetry) providerTelemetry.push(legacyResult.telemetry);
      }

      providerTelemetry.push(
        createProviderTelemetryEntry({
          stageKey: undefined,
          workflowStageKey: "builder",
          requestedProvider: "auto",
          resolvedProvider: "claude-cli",
          attempt: 1,
          status: builderResult.status === "completed" ? "success" : "failed",
          elapsedMs: Date.now() - builderStartedAt,
          retry: false,
        })
      );

      await persistTelemetry(input, providerTelemetry, "running");
      if (checkAborted()) return cancelled(providerTelemetry);
    }

    // ── Stage 6: Checker ───────────────────────
    if (!checkAborted() && shouldRunStage(startStage, "checker")) {
      send(stageEvent("checker", "running"));
      send(progressEvent("checker", 5));
      send(logEvent("checker", "deterministic checker runner를 실행합니다."));

      const hwpxPath = outputFile
        ? (path.isAbsolute(outputFile) ? outputFile : path.join(baseDir, outputFile))
        : "";

      const checkerStartedAt = Date.now();
      const checkerResult = await runCheckerStage({ hwpxPath: hwpxPath || undefined });

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
        })
      );

      if (checkerResult.status === "completed" && checkerResult.output) {
        const issueCount = checkerResult.output.issues.length;
        resultSummary = `checker 완료: ${issueCount} issue(s)`;
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
// Stage group helpers
// ──────────────────────────────────────────────

interface StageGroupOptions {
  questionNumbers: number[];
  cache: StageCache;
  stageOverrides: StageOverrideMap;
  send: (event: SSEEvent) => void;
  isAborted: () => boolean;
  signal: AbortSignal;
  providerTelemetry: ProviderTelemetryEntry[];
}

interface ExtractorGroupOptions extends StageGroupOptions {
  questionImages: { number: number; path: string }[];
  targetQuestions: number[];
}

const EXTRACTOR_CONCURRENCY = 4;
const SOLVER_CONCURRENCY = 6;
const VERIFIER_CONCURRENCY = 6;

async function runExtractorStageGroup(opts: ExtractorGroupOptions): Promise<void> {
  const { questionImages, targetQuestions, cache, stageOverrides, send, isAborted, signal, providerTelemetry } = opts;

  send(stageEvent("create.extractor", "running"));
  send(progressEvent("create.extractor", 0));

  const provider = getProviderForStage("create.extractor", stageOverrides);
  const imagesToProcess = questionImages.filter((q) => targetQuestions.includes(q.number));
  send(logEvent("create.extractor",
    `${provider.label} 으로 ${imagesToProcess.length}문제 추출 시작 (동시 ${EXTRACTOR_CONCURRENCY})`));

  let completed = 0;
  const failed: number[] = [];

  const results = await runWithConcurrency(
    EXTRACTOR_CONCURRENCY,
    imagesToProcess,
    async (img) => {
      if (isAborted()) throw new Error("aborted");
      send(logEvent("create.extractor", `Q${img.number} 추출 시작`));
      const result = await runExtractorStage({
        questionNumber: img.number,
        imagePath: img.path,
        cache,
        provider,
        signal,
      });
      if (result.status === "completed") {
        send(logEvent("create.extractor", `Q${img.number} 추출 완료`));
      } else {
        send(logEvent("create.extractor",
          `Q${img.number} 추출 실패: ${result.error?.message ?? "unknown"}`, "error"));
      }
      return result;
    }
  );

  for (let i = 0; i < results.length; i++) {
    const img = imagesToProcess[i];
    const result = results[i];

    if (!result || !img) continue;

    if (result.ok) {
      const stageResult = result.value;
      if (stageResult.provider) {
        providerTelemetry.push(
          createProviderTelemetryEntry({
            stageKey: "create.extractor",
            workflowStageKey: "create.extractor",
            requestedProvider: stageResult.provider.requestedProvider ?? "auto",
            resolvedProvider: stageResult.provider.provider ?? "claude-cli",
            attempt: 1,
            status: stageResult.status === "completed" ? "success" : "failed",
            elapsedMs: computeElapsedMs(stageResult.startedAt, stageResult.completedAt),
            retry: false,
            errorSummary: stageResult.error?.message,
          })
        );
      }

      if (stageResult.status === "completed" && stageResult.output) {
        completed++;
        send({
          event: "question",
          data: { number: img.number, stage: "extracted", status: "ok", data: stageResult.output },
        });
      } else {
        failed.push(img.number);
        send({
          event: "question",
          data: { number: img.number, stage: "extracted", status: "failed", error: stageResult.error?.message },
        });
      }
    } else {
      failed.push(img.number);
      const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
      send({
        event: "question",
        data: { number: img.number, stage: "extracted", status: "failed", error: errorMessage },
      });
    }

    send(progressEvent("create.extractor", Math.round(((i + 1) / imagesToProcess.length) * 100)));
  }

  const summary = `완료: ${completed}/${imagesToProcess.length}${failed.length > 0 ? `, 실패: [${failed.join(", ")}]` : ""}`;

  if (completed === 0 && imagesToProcess.length > 0) {
    send(stageEvent("create.extractor", "failed", { summary }));
    throw new Error(`extractor: 모든 문제 추출 실패. ${summary}`);
  }

  // Partial failure: emit warning but continue (UI will show individual failures).
  if (failed.length > 0) {
    send(logEvent("create.extractor", `일부 문제 추출 실패: [${failed.join(", ")}]`, "warn"));
  }

  send(stageEvent("create.extractor", "done", { summary }));
}

async function runSolverStageGroup(opts: StageGroupOptions): Promise<void> {
  const { questionNumbers, cache, stageOverrides, send, isAborted, signal, providerTelemetry } = opts;

  send(stageEvent("create.solver", "running"));
  send(progressEvent("create.solver", 0));

  const provider = getProviderForStage("create.solver", stageOverrides);

  let completed = 0;
  const failed: number[] = [];

  const results = await runWithConcurrency(
    SOLVER_CONCURRENCY,
    questionNumbers,
    async (n) => {
      if (isAborted()) throw new Error("aborted");
      const extracted = await readCacheJson(cache.extractorResultPath(n));
      return runSolverStage({ questionNumber: n, extracted, cache, provider, signal });
    }
  );

  for (let i = 0; i < results.length; i++) {
    const n = questionNumbers[i];
    const result = results[i];

    if (!result || n === undefined) continue;

    if (result.ok) {
      const stageResult = result.value;
      if (stageResult.provider) {
        providerTelemetry.push(
          createProviderTelemetryEntry({
            stageKey: "create.solver",
            workflowStageKey: "create.solver",
            requestedProvider: stageResult.provider.requestedProvider ?? "auto",
            resolvedProvider: stageResult.provider.provider ?? "claude-cli",
            attempt: 1,
            status: stageResult.status === "completed" ? "success" : "failed",
            elapsedMs: computeElapsedMs(stageResult.startedAt, stageResult.completedAt),
            retry: false,
            errorSummary: stageResult.error?.message,
          })
        );
      }

      if (stageResult.status === "completed") {
        completed++;
        send({
          event: "question",
          data: { number: n, stage: "solved", status: "ok", data: stageResult.output },
        });
      } else {
        failed.push(n);
        send({
          event: "question",
          data: { number: n, stage: "solved", status: "failed", error: stageResult.error?.message },
        });
      }
    } else {
      failed.push(n);
      const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
      send({
        event: "question",
        data: { number: n, stage: "solved", status: "failed", error: errorMessage },
      });
    }

    send(progressEvent("create.solver", Math.round(((i + 1) / questionNumbers.length) * 100)));
  }

  const summary = `완료: ${completed}/${questionNumbers.length}${failed.length > 0 ? `, 실패: [${failed.join(", ")}]` : ""}`;
  send(stageEvent("create.solver", completed > 0 ? "done" : "failed", { summary }));
}

async function runVerifierStageGroup(opts: StageGroupOptions): Promise<void> {
  const { questionNumbers, cache, stageOverrides, send, isAborted, signal, providerTelemetry } = opts;

  send(stageEvent("create.verifier", "running"));
  send(progressEvent("create.verifier", 0));

  const solverProvider = getProviderForStage("create.solver", stageOverrides);
  const verifierProvider = getProviderForStage("create.verifier", stageOverrides);

  let completed = 0;
  const failed: number[] = [];

  const results = await runWithConcurrency(
    VERIFIER_CONCURRENCY,
    questionNumbers,
    async (n) => {
      if (isAborted()) throw new Error("aborted");

      const extracted = await readCacheJson(cache.extractorResultPath(n));
      let solved = await readCacheJson(cache.solverResultPath(n));

      let attempt = 0;
      const MAX_ATTEMPTS = 3;
      let lastVerifierResult: Awaited<ReturnType<typeof runVerifierStage>> | undefined;

      // Feedback loop: verifier runs at most MAX_ATTEMPTS times.
      // Pattern: verify → if fail → solve(feedback) → verify → if fail → solve → verify → done.
      // verifier is called at the top of each iteration, so exactly MAX_ATTEMPTS calls max.
      while (attempt < MAX_ATTEMPTS) {
        if (isAborted()) throw new Error("aborted");

        const verifierResult = await runVerifierStage({
          questionNumber: n,
          extracted,
          solved,
          cache,
          provider: verifierProvider,
          signal,
        });
        lastVerifierResult = verifierResult;

        if (verifierResult.provider) {
          providerTelemetry.push(
            createProviderTelemetryEntry({
              stageKey: "create.verifier",
              workflowStageKey: "create.verifier",
              requestedProvider: verifierResult.provider.requestedProvider ?? "auto",
              resolvedProvider: verifierResult.provider.provider ?? "claude-cli",
              attempt: attempt + 1,
              status: verifierResult.status === "completed" ? "success" : "failed",
              elapsedMs: computeElapsedMs(verifierResult.startedAt, verifierResult.completedAt),
              retry: attempt > 0,
              errorSummary: verifierResult.error?.message,
            })
          );
        }

        if (verifierResult.status === "completed" && verifierResult.output?.status === "pass") {
          return verifierResult;
        }

        attempt++;

        // After last attempt, do not re-run solver — just return what we have.
        if (attempt >= MAX_ATTEMPTS) break;
        if (isAborted()) throw new Error("aborted");

        // Re-run solver with verifier feedback before the next verifier attempt.
        const feedback = verifierResult.output?.feedback;
        const solverResult = await runSolverStage({
          questionNumber: n,
          extracted,
          guidelineContext: feedback ? `Verifier feedback: ${feedback}` : undefined,
          cache,
          provider: solverProvider,
          signal,
        });

        if (solverResult.provider) {
          providerTelemetry.push(
            createProviderTelemetryEntry({
              stageKey: "create.solver",
              workflowStageKey: "create.solver",
              requestedProvider: solverResult.provider.requestedProvider ?? "auto",
              resolvedProvider: solverResult.provider.provider ?? "claude-cli",
              attempt: attempt,
              status: solverResult.status === "completed" ? "success" : "failed",
              elapsedMs: computeElapsedMs(solverResult.startedAt, solverResult.completedAt),
              retry: true,
              downstreamCorrection: true,
              errorSummary: solverResult.error?.message,
            })
          );
        }

        if (solverResult.status === "completed") {
          solved = solverResult.output as unknown;
        }
      }

      // Return the last verifier result (status=fail after all attempts exhausted).
      return lastVerifierResult!;
    }
  );

  for (let i = 0; i < results.length; i++) {
    const n = questionNumbers[i];
    const result = results[i];

    if (!result || n === undefined) continue;

    if (result.ok) {
      const stageResult = result.value;
      if (stageResult.status === "completed") {
        completed++;
        send({
          event: "question",
          data: { number: n, stage: "verified", status: "ok", data: stageResult.output },
        });
      } else {
        failed.push(n);
        send({
          event: "question",
          data: { number: n, stage: "verified", status: "failed", error: stageResult.error?.message },
        });
      }
    } else {
      failed.push(n);
      const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
      send({
        event: "question",
        data: { number: n, stage: "verified", status: "failed", error: errorMessage },
      });
    }

    send(progressEvent("create.verifier", Math.round(((i + 1) / questionNumbers.length) * 100)));
  }

  const summary = `완료: ${completed}/${questionNumbers.length}${failed.length > 0 ? `, 실패: [${failed.join(", ")}]` : ""}`;
  send(stageEvent("create.verifier", completed > 0 ? "done" : "failed", { summary }));
}

// ──────────────────────────────────────────────
// Figure stage
// ──────────────────────────────────────────────

interface FigureStageOptions {
  baseDir: string;
  cache: StageCache;
  send: (event: SSEEvent) => void;
}

async function runFigureStage(opts: FigureStageOptions): Promise<boolean> {
  const { baseDir, cache, send } = opts;

  send(stageEvent("figure", "running"));
  send(progressEvent("figure", 5));
  send(logEvent("figure", "figure_processor.py를 실행합니다."));

  const python = process.platform === "win32" ? "python" : "python3";
  const scriptPath = path.join(baseDir, "figure_processor.py");
  const examDataPath = cache.paths.examData;

  const result = await runStageCommand({
    command: python,
    args: [scriptPath, examDataPath],
    cwd: baseDir,
    timeoutMs: 300_000, // 5 minutes for figure generation
  });

  if (result.status === "success") {
    send(progressEvent("figure", 100));
    send(stageEvent("figure", "done", { summary: "figure 처리 완료" }));
    return true;
  }

  send(stageEvent("figure", "failed", {
    summary: result.stderr.slice(0, 300) || `exit code ${result.exitCode}`,
  }));
  send(logEvent("figure", `figure_processor.py 실패: ${result.stderr.slice(0, 300)}`, "error"));
  return false;
}

// ──────────────────────────────────────────────
// Legacy builder fallback
// ──────────────────────────────────────────────

interface LegacyBuilderFallbackOptions {
  baseDir: string;
  send: (event: SSEEvent) => void;
}

interface LegacyBuilderFallbackResult {
  outputFile?: string;
  resultSummary?: string;
  telemetry?: ProviderTelemetryEntry;
}

/**
 * Fallback to scanning outputs/ for the most recently-written HWPX file when
 * the deterministic builder fails. The legacy CLI agent writes files there.
 *
 * (Full runLegacyPromptJob invocation is handled by sse.ts for now;
 *  here we provide a lightweight fallback that reports a warning and
 *  returns whatever the builder may have written previously.)
 */
async function runLegacyBuilderFallback(
  opts: LegacyBuilderFallbackOptions
): Promise<LegacyBuilderFallbackResult> {
  const { baseDir, send } = opts;

  send(logEvent("builder", "outputs/ 폴더에서 최신 HWPX를 탐색합니다.", "warn"));

  try {
    const { readdir, stat } = await import("fs/promises");
    const outputsDir = path.join(baseDir, "outputs");
    const files = await readdir(outputsDir);
    const hwpxFiles = files.filter((f) => f.endsWith(".hwpx"));

    if (hwpxFiles.length > 0) {
      let latest = { name: "", mtime: 0 };
      for (const f of hwpxFiles) {
        const s = await stat(path.join(outputsDir, f));
        if (s.mtimeMs > latest.mtime) {
          latest = { name: f, mtime: s.mtimeMs };
        }
      }
      if (latest.name) {
        const relPath = path.join("outputs", latest.name);
        send(fileEvent({ type: "hwpx", name: latest.name, path: relPath }));
        return { outputFile: relPath, resultSummary: "legacy builder fallback (기존 HWPX 발견)" };
      }
    }
  } catch {
    // outputs/ might not exist yet.
  }

  return { resultSummary: "legacy builder fallback: HWPX 없음" };
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
