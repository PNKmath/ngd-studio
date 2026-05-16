import { describe, expect, it } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  isSelectableProviderId,
  readAISettings,
  readDefaultProvider,
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
    expect(writeAISettings({ defaultProvider: "claude" }, storage)).toEqual({ defaultProvider: "claude" });
    expect(readDefaultProvider(storage)).toBe("claude");
  });

  it("exposes only auto, claude, and codex as selectable providers", () => {
    expect(isSelectableProviderId("auto")).toBe(true);
    expect(isSelectableProviderId("claude")).toBe(true);
    expect(isSelectableProviderId("codex")).toBe(true);
    expect(isSelectableProviderId("deepseek-v4")).toBe(false);
  });
});
