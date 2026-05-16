import { describe, expect, it } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  AI_STAGE_KEYS,
  isAIStageKey,
  isSelectableProviderId,
  isStageProviderId,
  normalizeStageOverrides,
  readAISettings,
  readDefaultProvider,
  readStageOverrides,
  writeAISettings,
} from "../ai/settings";

function createStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(AI_SETTINGS_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("AI settings storage", () => {
  it("defaults to auto when storage is missing or empty", () => {
    expect(readAISettings(undefined)).toEqual(DEFAULT_AI_SETTINGS);
    expect(readDefaultProvider(createStorage())).toBe("auto");
    expect(readStageOverrides(createStorage())).toEqual({});
  });

  it("reads a stored selectable default provider", () => {
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "codex" })))).toBe("codex");
  });

  it("falls back to auto for hidden or invalid providers", () => {
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "deepseek-v4" })))).toBe("auto");
    expect(readDefaultProvider(createStorage("{bad json"))).toBe("auto");
  });

  it("writes normalized settings", () => {
    const storage = createStorage();
    expect(writeAISettings({ defaultProvider: "claude", stageOverrides: {} }, storage)).toEqual({
      defaultProvider: "claude",
      stageOverrides: {},
    });
    expect(readDefaultProvider(storage)).toBe("claude");
  });

  it("exposes only auto, claude, and codex as selectable providers", () => {
    expect(isSelectableProviderId("auto")).toBe(true);
    expect(isSelectableProviderId("claude")).toBe(true);
    expect(isSelectableProviderId("codex")).toBe(true);
    expect(isSelectableProviderId("deepseek-v4")).toBe(false);
  });

  it("normalizes stage override keys and providers", () => {
    expect(AI_STAGE_KEYS).toEqual(["create.extractor", "create.solver", "create.verifier", "review.reviewer"]);
    expect(isAIStageKey("create.extractor")).toBe(true);
    expect(isAIStageKey("create.writer")).toBe(false);
    expect(isStageProviderId("deepseek-v4")).toBe(true);
    expect(normalizeStageOverrides({
      "create.extractor": "deepseek-v4",
      "create.writer": "deepseek-v4",
      "review.reviewer": "unknown",
      "create.verifier": "codex",
    })).toEqual({
      "create.extractor": "deepseek-v4",
      "create.verifier": "codex",
    });
  });

  it("reads and writes stage overrides with the same payload", () => {
    const storage = createStorage();
    writeAISettings({
      defaultProvider: "auto",
      stageOverrides: {
        "review.reviewer": "deepseek-v4",
      },
    }, storage);

    expect(readAISettings(storage)).toEqual({
      defaultProvider: "auto",
      stageOverrides: {
        "review.reviewer": "deepseek-v4",
      },
    });
  });
});
