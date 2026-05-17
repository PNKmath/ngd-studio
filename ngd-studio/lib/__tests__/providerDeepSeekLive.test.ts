import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { readRuntimeEnv } from "../server/runtimeEnv";
import { deepseekV4Provider } from "../ai/providers/deepseekV4";
import { createStageCache } from "../../server/stages/cache";
import { runVerifierStage } from "../../server/stages/verifier";
import { runSolverStage } from "../../server/stages/solver";

const env = readRuntimeEnv();
const liveKey = env.DEEPSEEK_API_KEY;
const describeLive = liveKey ? describe : describe.skip;

describeLive("DeepSeek V4 live integration", () => {
  it("collects raw provider output for a small prompt", async () => {
    const result = deepseekV4Provider.run(
      "Return only JSON: {\"answer\": string}. What is 2+2?",
      { stageKey: "create.verifier" },
    );

    const events: unknown[] = [];
    for await (const event of result.events) {
      events.push(event);
    }
    const exit = await result.exitCode;

    expect(exit).toBe(0);
    expect(events.at(-1)).toMatchObject({ type: "result", subtype: "success" });
  }, 60_000);

  it("runs verifier stage end-to-end and writes structured JSON", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deepseek-verifier-live-"));
    const cache = createStageCache(tempDir);

    try {
      const result = await runVerifierStage({
        questionNumber: 1,
        extracted: { question: "What is 1+1?", choices: ["1", "2", "3", "4"], answer: 2 },
        solved: { answer: "2", explanation: [{ kind: "text", content: "1 plus 1 equals 2." }] },
        guidelineContext: "Verify the solved answer matches the extracted answer. Status must be \"pass\" or \"fail\".",
        cache,
      });

      expect(result.status).toBe("completed");
      if (result.status !== "completed" || !result.output) {
        throw new Error(`verifier stage did not complete: ${JSON.stringify(result)}`);
      }
      expect(["pass", "fail"]).toContain(result.output.status);
      expect(Array.isArray(result.output.issues)).toBe(true);

      const written = await readFile(cache.verifierResultPath(1), "utf8");
      const parsed = JSON.parse(written);
      expect(parsed).toEqual(result.output);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 90_000);

  it("runs solver stage end-to-end and produces a valid solver JSON", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deepseek-solver-live-"));
    const cache = createStageCache(tempDir);

    try {
      const result = await runSolverStage({
        questionNumber: 1,
        extracted: { question: "What is 3+4?", choices: ["5", "6", "7", "8"], answer: 3 },
        cache,
      });

      expect(result.status).toBe("completed");
      if (result.status !== "completed" || !result.output) {
        throw new Error(`solver stage did not complete: ${JSON.stringify(result)}`);
      }
      expect(typeof result.output.answer).toBe("string");
      expect(result.output.answer.length).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 120_000);
});
