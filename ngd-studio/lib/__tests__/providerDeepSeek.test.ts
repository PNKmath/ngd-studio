import { describe, expect, it } from "vitest";
import { buildDeepSeekMessages, deepseekV4Provider, isDeepSeekStageAllowed } from "../ai/providers/deepseekV4";

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
    delete process.env.DEEPSEEK_API_KEY;
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
});
