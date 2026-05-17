import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEEPSEEK_STAGE_TIMEOUTS_MS,
  buildDeepSeekMessages,
  deepseekV4Provider,
  isDeepSeekStageAllowed,
  resolveDeepSeekTimeoutMs,
} from "../ai/providers/deepseekV4";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { createStageCache } from "../../server/stages/cache";
import { buildSolverPrompt, runSolverStage, validateSolverOutput } from "../../server/stages/solver";
import { buildVerifierPrompt, runVerifierStage } from "../../server/stages/verifier";

async function collectEvents(result: ReturnType<typeof deepseekV4Provider.run>) {
  const events = [];
  for await (const event of result.events) {
    events.push(event);
  }
  return events;
}

describe("DeepSeek V4 provider", () => {
  it("exposes per-stage timeouts and falls back to a default", () => {
    expect(DEEPSEEK_STAGE_TIMEOUTS_MS["create.extractor"]).toBe(180_000);
    expect(DEEPSEEK_STAGE_TIMEOUTS_MS["create.solver"]).toBe(300_000);
    expect(DEEPSEEK_STAGE_TIMEOUTS_MS["create.verifier"]).toBe(120_000);
    expect(DEEPSEEK_STAGE_TIMEOUTS_MS["review.reviewer"]).toBe(300_000);
    expect(resolveDeepSeekTimeoutMs("create.solver")).toBe(300_000);
    expect(resolveDeepSeekTimeoutMs(undefined)).toBe(300_000);
  });

  it("aborts the fetch and emits a stage-labeled timeout error", async () => {
    const previousKey = process.env.DEEPSEEK_API_KEY;
    const previousDisable = process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV;
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV = "1";

    let observedSignal: AbortSignal | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      observedSignal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
      return new Promise((_, reject) => {
        observedSignal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as Error & { name: string }).name = "AbortError";
          reject(err);
        });
      });
    });

    try {
      vi.useFakeTimers();
      const result = deepseekV4Provider.run("hi", { stageKey: "create.verifier" });
      const eventsPromise = collectEvents(result);
      // Drive the timer past the verifier timeout (120s)
      await vi.advanceTimersByTimeAsync(120_000 + 100);
      vi.useRealTimers();

      const events = await eventsPromise;
      expect(await result.exitCode).toBe(1);
      expect(observedSignal?.aborted).toBe(true);
      const last = events.at(-1) as { type: string; subtype: string; result: string };
      expect(last.type).toBe("result");
      expect(last.subtype).toBe("error");
      expect(last.result).toMatch(/timed out after 120s/);
      expect(last.result).toMatch(/create\.verifier/);
    } finally {
      vi.useRealTimers();
      fetchSpy.mockRestore();
      if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previousKey;
      if (previousDisable === undefined) delete process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV;
      else process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV = previousDisable;
    }
  });

  it("allows only text-only stages (DeepSeek V4 has no image input)", () => {
    expect(isDeepSeekStageAllowed("create.extractor")).toBe(false);
    expect(isDeepSeekStageAllowed("create.solver")).toBe(true);
    expect(isDeepSeekStageAllowed("create.verifier")).toBe(true);
    expect(isDeepSeekStageAllowed("review.reviewer")).toBe(true);
    expect(isDeepSeekStageAllowed("crop.cropper")).toBe(false);
  });

  it("returns a clear error when env is missing", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    const previousDisableRuntimeEnv = process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV;
    delete process.env.DEEPSEEK_API_KEY;
    process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV = "1";
    const result = deepseekV4Provider.run("check this", { stageKey: "review.reviewer" });
    const events = await collectEvents(result);

    expect(await result.exitCode).toBe(1);
    expect(events.at(-1)).toMatchObject({
      type: "result",
      subtype: "error",
      result: "DEEPSEEK_API_KEY is not configured.",
    });
    if (previous === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previous;
    }
    if (previousDisableRuntimeEnv === undefined) {
      delete process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV;
    } else {
      process.env.NGD_STUDIO_DISABLE_RUNTIME_ENV = previousDisableRuntimeEnv;
    }
  });

  it("rejects requests without an allowed stage", async () => {
    const result = deepseekV4Provider.run("check this", { mode: "crop" });
    const events = await collectEvents(result);

    expect(await result.exitCode).toBe(1);
    expect(events.at(-1)).toMatchObject({
      type: "result",
      subtype: "error",
      result: "DeepSeek V4 is not enabled for stage: unspecified",
    });
  });

  it("builds a chat payload from the prompt and stage without file metadata wrappers", () => {
    const messages = buildDeepSeekMessages("plain prompt", { stageKey: "create.extractor" });

    expect(messages).toEqual([
      expect.objectContaining({ role: "system", content: expect.stringContaining("create.extractor") }),
      { role: "user", content: "plain prompt" },
    ]);
  });

  it("builds a bounded verifier prompt for JSON-only model output", () => {
    const prompt = buildVerifierPrompt({
      extracted: { question: "1+1" },
      solved: { answer: "2" },
      guidelineContext: "Check answer consistency.",
    });

    expect(prompt).toContain("Return only JSON");
    expect(prompt).toContain("\"status\":\"pass\"|\"fail\"");
    expect(prompt).toContain("Do not edit files");
    expect(prompt).toContain("Check answer consistency.");
  });

  it("validates verifier output and writes only the structured cache result", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "verifier-stage-"));
    const cache = createStageCache(tempDir);

    try {
      const result = await runVerifierStage({
        questionNumber: 3,
        extracted: { question: "1+1" },
        solved: { answer: "2" },
        cache,
        provider: {
          id: "deepseek-v4",
          label: "DeepSeek V4",
          run() {
            return {
              process: {} as never,
              events: (async function* () {
                yield {
                  type: "assistant" as const,
                  message: {
                    role: "assistant" as const,
                    content: [{ type: "text" as const, text: "{\"status\":\"pass\",\"issues\":[],\"feedback\":\"ok\"}" }],
                  },
                };
              })(),
              exitCode: Promise.resolve(0),
              metadata: {
                requestedProvider: "deepseek-v4",
                provider: "deepseek-v4",
                label: "DeepSeek V4",
              },
            };
          },
        },
      });

      expect(result).toMatchObject({
        status: "completed",
        output: { status: "pass", issues: [], feedback: "ok" },
        validation: { ok: true },
        provider: { modelStageKey: "create.verifier" },
      });
      await expect(readFile(cache.verifierResultPath(3), "utf8")).resolves.toBe(
        `${JSON.stringify({ status: "pass", issues: [], feedback: "ok" }, null, 2)}\n`
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("marks invalid verifier output as retryable validation failure", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "verifier-stage-"));
    const cache = createStageCache(tempDir);

    try {
      const result = await runVerifierStage({
        questionNumber: 1,
        extracted: {},
        cache,
        provider: {
          id: "deepseek-v4",
          label: "DeepSeek V4",
          run() {
            return {
              process: {} as never,
              events: (async function* () {
                yield {
                  type: "assistant" as const,
                  message: {
                    role: "assistant" as const,
                    content: [{ type: "text" as const, text: "{\"status\":\"maybe\",\"issues\":[]}" }],
                  },
                };
              })(),
              exitCode: Promise.resolve(0),
              metadata: {
                requestedProvider: "deepseek-v4",
                provider: "deepseek-v4",
                label: "DeepSeek V4",
              },
            };
          },
        },
      });

      expect(result).toMatchObject({
        status: "failed",
        validation: { ok: false, message: "verifier status must be pass or fail" },
        error: { code: "verifier_validation_failed", retryable: true },
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("builds and validates bounded solver output for downstream verifier use", () => {
    const prompt = buildSolverPrompt({
      extracted: { question: "x^2=4" },
      guidelineContext: "Keep equations explicit.",
    });

    expect(prompt).toContain("Return only JSON");
    expect(prompt).toContain("\"answer\":string");
    expect(prompt).toContain("Do not edit files");

    expect(validateSolverOutput({
      answer: "2",
      explanation: [
        { kind: "text", content: "Solve the equation." },
        { kind: "equation", content: "x=2" },
      ],
      verifierContext: { method: "substitution" },
    })).toMatchObject({
      ok: true,
      output: { answer: "2" },
    });
    expect(validateSolverOutput({
      answer: "2",
      explanation: [{ kind: "text", content: "<hp:equation>x=2</hp:equation>" }],
    })).toMatchObject({
      ok: false,
      message: "solver text segment contains raw equation XML",
    });
    expect(validateSolverOutput({
      answer: "2",
      explanation: [{ kind: "equation", content: "x==2" }],
    }, () => "invalid equation syntax")).toMatchObject({
      ok: false,
      message: "invalid equation syntax",
    });
  });

  it("writes validated solver output to cache without removing verifier fallback", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "solver-stage-"));
    const cache = createStageCache(tempDir);

    try {
      const output = {
        answer: "2",
        explanation: [{ kind: "text", content: "1+1 equals 2." }],
        verifierContext: { confidence: "high" },
      };
      const result = await runSolverStage({
        questionNumber: 2,
        extracted: { question: "1+1" },
        cache,
        provider: {
          id: "deepseek-v4",
          label: "DeepSeek V4",
          run() {
            return {
              process: {} as never,
              events: (async function* () {
                yield {
                  type: "assistant" as const,
                  message: {
                    role: "assistant" as const,
                    content: [{ type: "text" as const, text: JSON.stringify(output) }],
                  },
                };
              })(),
              exitCode: Promise.resolve(0),
              metadata: {
                requestedProvider: "deepseek-v4",
                provider: "deepseek-v4",
                label: "DeepSeek V4",
              },
            };
          },
        },
      });

      expect(result).toMatchObject({
        status: "completed",
        output,
        validation: { ok: true },
        provider: { modelStageKey: "create.solver" },
      });
      await expect(readFile(cache.solverResultPath(2), "utf8")).resolves.toBe(
        `${JSON.stringify(output, null, 2)}\n`
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
