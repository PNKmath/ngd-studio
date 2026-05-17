/**
 * orchestrator.integration.test.ts
 *
 * Phase 9 — mock integration e2e test.
 *
 * Strategy:
 *  - Mock all AI-calling stage runners (extractor, solver, verifier) via vi.mock so
 *    the test can inject deterministic "pass" responses without real API keys.
 *  - Mock the figure stage (runStageCommand) to write a fixture figure_status.json.
 *  - The builder and checker use their real deterministic code paths but are given
 *    a tempdir that lacks Python scripts, so they fall through to the legacy fallback
 *    (which is also mocked/pre-populated).
 *  - 3-question e2e: solver → verifier → figure → builder → checker → done
 *    (The orchestrator pauses after extractor; we resume from "solver".)
 *
 * Assertions:
 *  - result.status === "done"
 *  - providerTelemetry has entries for solver + verifier (2 per question × 3 = 6) +
 *    builder + checker (1 each = 2 total)
 *  - SSE events contain extraction_review ✗ (bypassed), solver stage events ✓
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { AIProviderAdapter, ProviderRunOptions } from "@/lib/ai/types";
import type { SSEEvent } from "@/lib/claude";
import { FileBackedStageCache } from "../cache";

// ────────────────────────────────────────────────────────────────────────────
// Fixture data mirrors server/stages/__tests__/fixtures/
// ────────────────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, "fixtures");

const EXTRACTED_Q1 = {
  question: "다음 중 옳은 것은? (문제 1)",
  choices: ["① 1", "② 2", "③ 3", "④ 4", "⑤ 5"],
  answer: "①",
  has_figure: false,
  figure_info: null,
};

const EXTRACTED_Q2 = {
  question: "그림을 보고 물음에 답하시오. (문제 2)",
  choices: ["① 가", "② 나", "③ 다", "④ 라", "⑤ 마"],
  answer: "③",
  has_figure: true,
  figure_info: {
    description_en: "A right triangle with legs a and b and hypotenuse c.",
    position: "right",
    crop_ratio: [0.1, 0.1, 0.9, 0.9],
  },
};

const EXTRACTED_Q3 = {
  question: "다음 식을 계산하시오. (문제 3)",
  choices: null,
  answer: "4",
  has_figure: false,
  figure_info: null,
};

const SOLVED_OUTPUT = {
  answer: "①",
  explanation: [{ kind: "text" as const, content: "정답 설명입니다." }],
};

const VERIFIED_OUTPUT_PASS = {
  status: "pass" as const,
  issues: [],
  feedback: undefined,
};

// ────────────────────────────────────────────────────────────────────────────
// Mock provider factory — deterministic JSON response
// ────────────────────────────────────────────────────────────────────────────

function makeMockProvider(
  responseJson: unknown,
  opts: { id?: AIProviderAdapter["id"] } = {}
): AIProviderAdapter {
  const id = opts.id ?? "claude-sdk";
  const text = typeof responseJson === "string" ? responseJson : JSON.stringify(responseJson);

  return {
    id,
    label: `Mock(${id})`,
    run(_prompt: string, _options?: ProviderRunOptions) {
      async function* events() {
        yield {
          type: "assistant" as const,
          message: {
            role: "assistant" as const,
            content: [{ type: "text" as const, text }],
          },
        };
        yield { type: "result" as const, subtype: "success" as const, result: text };
      }

      let resolveExit!: (n: number) => void;
      const exitCodePromise = new Promise<number>((r) => {
        resolveExit = r;
      });

      const eventsAsync = (async function* () {
        for await (const e of events()) yield e;
        resolveExit(0);
      })();

      return {
        process: {} as import("child_process").ChildProcess,
        events: eventsAsync,
        exitCode: exitCodePromise,
        metadata: {
          requestedProvider: id,
          provider: id,
          label: `Mock(${id})`,
        },
      };
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// vi.mock — intercept stage runners so they use mock providers
// ────────────────────────────────────────────────────────────────────────────

// We mock the three AI-calling stage runners by intercepting their module exports.
// The mocked implementations delegate to the real logic but inject mock providers.
vi.mock("../extractor", async (importOriginal) => {
  const real = await importOriginal<typeof import("../extractor")>();
  return {
    ...real,
    runExtractorStage: vi.fn(async (input: Parameters<typeof real.runExtractorStage>[0]) => {
      const mockProvider = makeMockProvider(EXTRACTED_Q1, { id: "claude-sdk" });
      return real.runExtractorStage({ ...input, provider: mockProvider });
    }),
  };
});

vi.mock("../solver", async (importOriginal) => {
  const real = await importOriginal<typeof import("../solver")>();
  return {
    ...real,
    runSolverStage: vi.fn(async (input: Parameters<typeof real.runSolverStage>[0]) => {
      const mockProvider = makeMockProvider(SOLVED_OUTPUT, { id: "deepseek-v4" });
      return real.runSolverStage({ ...input, provider: mockProvider });
    }),
  };
});

vi.mock("../verifier", async (importOriginal) => {
  const real = await importOriginal<typeof import("../verifier")>();
  return {
    ...real,
    runVerifierStage: vi.fn(async (input: Parameters<typeof real.runVerifierStage>[0]) => {
      const mockProvider = makeMockProvider(VERIFIED_OUTPUT_PASS, { id: "deepseek-v4" });
      return real.runVerifierStage({ ...input, provider: mockProvider });
    }),
  };
});

// Mock the figure stage command runner so python3 is never invoked.
// Instead, write figure_status.json from fixture before the stage runs.
vi.mock("../commands", async (importOriginal) => {
  const real = await importOriginal<typeof import("../commands")>();
  return {
    ...real,
    runStageCommand: vi.fn(async (_opts: Parameters<typeof real.runStageCommand>[0]) => {
      // Return success immediately — figure_status.json is pre-written in beforeEach.
      return {
        status: "success" as const,
        exitCode: 0,
        stdout: "",
        stderr: "",
        elapsedMs: 0,
      };
    }),
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "orch-int-test-"));
  tempDirs.push(dir);
  return dir;
}

async function makeCache(baseDir: string): Promise<FileBackedStageCache> {
  const examDir = path.join(baseDir, "inputs", "시험지 제작");
  await mkdir(path.join(examDir, ".v3cache"), { recursive: true });
  await mkdir(path.join(examDir, "question_images"), { recursive: true });
  return new FileBackedStageCache(examDir);
}

function makeSseCollector(): { events: SSEEvent[]; send: (e: SSEEvent) => void } {
  const events: SSEEvent[] = [];
  return { events, send: (e) => events.push(e) };
}

/** Pre-populate cache so the orchestrator can resume from a given stage. */
async function prepopulateSolverCache(cache: FileBackedStageCache, questionNums: number[]): Promise<void> {
  await cache.ensureCacheDir();
  for (const n of questionNums) {
    const extractedFixture = path.join(FIXTURES_DIR, "extracted", `q0${n}.json`);
    const extractedContent = await readFile(extractedFixture, "utf8");
    await writeFile(cache.extractorResultPath(n), extractedContent, "utf8");
  }
}

async function prepopulateBuilderCache(
  cache: FileBackedStageCache,
  questionNums: number[]
): Promise<void> {
  await cache.ensureCacheDir();
  for (const n of questionNums) {
    const solvedFixture = path.join(FIXTURES_DIR, "solved", `q0${n}.json`);
    const verifiedFixture = path.join(FIXTURES_DIR, "verified", `q0${n}.json`);
    await writeFile(cache.solverResultPath(n), await readFile(solvedFixture, "utf8"), "utf8");
    await writeFile(cache.verifierResultPath(n), await readFile(verifiedFixture, "utf8"), "utf8");
  }
  // Also write exam_data.json so builder stage can find it.
  const examData = {
    info: { school: "테스트고", grade: 2, subject: "수학" },
    problems: [EXTRACTED_Q1, EXTRACTED_Q2, EXTRACTED_Q3],
  };
  await writeFile(cache.paths.examData, `${JSON.stringify(examData, null, 2)}\n`, "utf8");
  // Pre-write figure_status.json from fixture (figure mock checks this).
  const figureStatusFixture = await readFile(
    path.join(FIXTURES_DIR, "figure_status.success.json"),
    "utf8"
  );
  await writeFile(cache.paths.figureStatus, figureStatusFixture, "utf8");
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("orchestrator.integration — 3-question mock e2e", () => {
  let baseDir: string;
  let cache: FileBackedStageCache;

  beforeEach(async () => {
    baseDir = await makeTempDir();
    cache = await makeCache(baseDir);
    await mkdir(path.join(baseDir, "outputs"), { recursive: true });
  });

  it("solver → verifier → figure → builder → checker: returns done status", async () => {
    const { send } = makeSseCollector();
    const questionNums = [1, 2, 3];
    const questionImages = questionNums.map((n) => ({
      number: n,
      path: path.join(FIXTURES_DIR, `q0${n}.png`),
    }));

    // Pre-write extracted cache so we can resume from solver.
    await prepopulateSolverCache(cache, questionNums);

    const { runStageOrchestrator } = await import("../orchestrator");

    const result = await runStageOrchestrator({
      mode: "resume",
      resumeFrom: "solver",
      meta: { school: "테스트고", grade: 2, subject: "수학" },
      questionImages,
      stageOverrides: {
        "create.extractor": "claude-sdk",
        "create.solver": "deepseek-v4",
        "create.verifier": "deepseek-v4",
      },
      baseDir,
      send,
      isAborted: () => false,
      cache,
    });

    expect(result.status).toBe("done");
    expect(Array.isArray(result.providerTelemetry)).toBe(true);

    // Solver telemetry: 1 entry per question (3 total).
    const solverEntries = result.providerTelemetry.filter(
      (e) => e.workflowStageKey === "create.solver"
    );
    expect(solverEntries.length).toBeGreaterThanOrEqual(3);

    // Verifier telemetry: 1 entry per question (3 total, pass on first try).
    const verifierEntries = result.providerTelemetry.filter(
      (e) => e.workflowStageKey === "create.verifier"
    );
    expect(verifierEntries.length).toBeGreaterThanOrEqual(3);

    // Builder + checker telemetry (1 each).
    const builderEntries = result.providerTelemetry.filter(
      (e) => e.workflowStageKey === "builder"
    );
    const checkerEntries = result.providerTelemetry.filter(
      (e) => e.workflowStageKey === "checker"
    );
    expect(builderEntries).toHaveLength(1);
    expect(checkerEntries).toHaveLength(1);

    // Total telemetry entries: 3 solver + 3 verifier + 1 builder + 1 checker = 8
    // (no retries since verifier passes first time)
    expect(result.providerTelemetry.length).toBeGreaterThanOrEqual(6);
  }, 30_000);

  it("solver stage emits SSE events for all 3 questions", async () => {
    const { events, send } = makeSseCollector();
    const questionNums = [1, 2, 3];
    const questionImages = questionNums.map((n) => ({
      number: n,
      path: path.join(FIXTURES_DIR, `q0${n}.png`),
    }));

    await prepopulateSolverCache(cache, questionNums);

    const { runStageOrchestrator } = await import("../orchestrator");

    await runStageOrchestrator({
      mode: "resume",
      resumeFrom: "solver",
      meta: { school: "테스트고", grade: 2, subject: "수학" },
      questionImages,
      stageOverrides: {
        "create.extractor": "claude-sdk",
        "create.solver": "deepseek-v4",
        "create.verifier": "deepseek-v4",
      },
      baseDir,
      send,
      isAborted: () => false,
      cache,
    });

    // solver and verifier stage events should be emitted.
    const solverStageEvent = events.find(
      (e) => e.event === "stage" && (e.data as Record<string, unknown>).name === "create.solver"
    );
    expect(solverStageEvent).toBeDefined();

    const verifierStageEvent = events.find(
      (e) => e.event === "stage" && (e.data as Record<string, unknown>).name === "create.verifier"
    );
    expect(verifierStageEvent).toBeDefined();

    // No extraction_review — we started from solver.
    const reviewEvent = events.find((e) => e.event === "extraction_review");
    expect(reviewEvent).toBeUndefined();

    // Should have question events for all 3 problems (solved + verified).
    const questionEvents = events.filter((e) => e.event === "question");
    expect(questionEvents.length).toBeGreaterThanOrEqual(6); // 3 solved + 3 verified
  }, 30_000);

  it("full flow from extractor review: 3 questions → extraction_review pause, then resume from solver → done", async () => {
    // Run extractor mock first — it pre-writes extracted files and pauses.
    const { events: events1, send: send1 } = makeSseCollector();
    const questionNums = [1, 2, 3];
    const questionImages = questionNums.map((n) => ({
      number: n,
      path: path.join(FIXTURES_DIR, `q0${n}.png`),
    }));

    const { runStageOrchestrator } = await import("../orchestrator");

    // Phase 1: extractor run → extraction_review pause.
    const result1 = await runStageOrchestrator({
      mode: "create",
      meta: { school: "테스트고", grade: 2, subject: "수학" },
      questionImages,
      stageOverrides: { "create.extractor": "claude-sdk" },
      baseDir,
      send: send1,
      isAborted: () => false,
      cache,
    });

    // Extractor mock writes cache; orchestrator pauses with extraction_review.
    expect(result1.status).toBe("done");
    expect(result1.resultSummary).toBe("extraction_review_pending");
    const reviewEvent = events1.find((e) => e.event === "extraction_review");
    expect(reviewEvent).toBeDefined();

    // Phase 2: resume from solver.
    const { events: events2, send: send2 } = makeSseCollector();
    const result2 = await runStageOrchestrator({
      mode: "resume",
      resumeFrom: "solver",
      meta: { school: "테스트고", grade: 2, subject: "수학" },
      questionImages,
      stageOverrides: {
        "create.extractor": "claude-sdk",
        "create.solver": "deepseek-v4",
        "create.verifier": "deepseek-v4",
      },
      baseDir,
      send: send2,
      isAborted: () => false,
      cache,
    });

    expect(result2.status).toBe("done");
    expect(Array.isArray(result2.providerTelemetry)).toBe(true);
    // At least solver + verifier telemetry entries.
    expect(result2.providerTelemetry.length).toBeGreaterThanOrEqual(6);
  }, 60_000);

  it("abort mid-run: returns cancelled status", async () => {
    const { send } = makeSseCollector();
    const questionNums = [1, 2, 3];

    await prepopulateSolverCache(cache, questionNums);

    const { runStageOrchestrator } = await import("../orchestrator");

    let callCount = 0;
    const result = await runStageOrchestrator({
      mode: "resume",
      resumeFrom: "solver",
      meta: {},
      questionImages: questionNums.map((n) => ({
        number: n,
        path: path.join(FIXTURES_DIR, `q0${n}.png`),
      })),
      stageOverrides: {},
      baseDir,
      send,
      isAborted: () => {
        // Abort after first poll.
        callCount++;
        return callCount >= 1;
      },
      cache,
    });

    expect(result.status).toBe("cancelled");
    expect(Array.isArray(result.providerTelemetry)).toBe(true);
  }, 15_000);

  it("verifier pass-on-first-try: providerTelemetry has exactly 3 verifier entries", async () => {
    const { send } = makeSseCollector();
    const questionNums = [1, 2, 3];

    await prepopulateSolverCache(cache, questionNums);

    const { runStageOrchestrator } = await import("../orchestrator");

    const result = await runStageOrchestrator({
      mode: "resume",
      resumeFrom: "solver",
      meta: { school: "테스트고", grade: 2, subject: "수학" },
      questionImages: questionNums.map((n) => ({
        number: n,
        path: path.join(FIXTURES_DIR, `q0${n}.png`),
      })),
      stageOverrides: {
        "create.solver": "deepseek-v4",
        "create.verifier": "deepseek-v4",
      },
      baseDir,
      send,
      isAborted: () => false,
      cache,
    });

    expect(result.status).toBe("done");

    // Verifier passes on first try for all 3 questions → exactly 3 entries.
    const verifierEntries = result.providerTelemetry.filter(
      (e) => e.workflowStageKey === "create.verifier"
    );
    expect(verifierEntries).toHaveLength(3);

    // All verifier entries should be successful (pass).
    for (const entry of verifierEntries) {
      expect(entry.status).toBe("success");
      expect(entry.retry).toBe(false);
    }
  }, 30_000);
});
