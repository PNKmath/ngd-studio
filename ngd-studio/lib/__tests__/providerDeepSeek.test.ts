import { describe, expect, it } from "vitest";
import { buildDeepSeekMessages, deepseekV4Provider, isDeepSeekStageAllowed } from "../ai/providers/deepseekV4";
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
  it("allows only known stage keys", () => {
    expect(isDeepSeekStageAllowed("create.extractor")).toBe(true);
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
