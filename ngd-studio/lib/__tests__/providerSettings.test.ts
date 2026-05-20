import { describe, expect, it } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  AI_STAGE_KEYS,
  allModelStagesUseDeepSeek,
  createDeepSeekStageOverrides,
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

  it("reads a stored selectable default provider (new IDs)", () => {
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "codex-cli" })))).toBe("codex-cli");
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "claude-sdk" })))).toBe("claude-sdk");
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "openai-sdk" })))).toBe("openai-sdk");
  });

  it("migrates legacy 'codex' → 'codex-cli' and 'claude' → 'claude-cli' from storage", () => {
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "codex" })))).toBe("codex-cli");
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "claude" })))).toBe("claude-cli");
  });

  it("falls back to auto for hidden or invalid providers", () => {
    expect(readDefaultProvider(createStorage(JSON.stringify({ defaultProvider: "deepseek-v4" })))).toBe("auto");
    expect(readDefaultProvider(createStorage("{bad json"))).toBe("auto");
  });

  it("writes normalized settings", () => {
    const storage = createStorage();
    expect(writeAISettings({ defaultProvider: "claude-cli", stageOverrides: {}, figureRegen: true, checkerMaxAttempts: 2 }, storage)).toEqual({
      defaultProvider: "claude-cli",
      stageOverrides: {},
      figureRegen: true,
      checkerMaxAttempts: 2,
    });
    expect(readDefaultProvider(storage)).toBe("claude-cli");
  });

  it("exposes auto, claude-cli, claude-sdk, codex-cli, openai-sdk as selectable providers", () => {
    expect(isSelectableProviderId("auto")).toBe(true);
    expect(isSelectableProviderId("claude-cli")).toBe(true);
    expect(isSelectableProviderId("claude-sdk")).toBe(true);
    expect(isSelectableProviderId("codex-cli")).toBe(true);
    expect(isSelectableProviderId("openai-sdk")).toBe(true);
    expect(isSelectableProviderId("deepseek-v4")).toBe(false);
  });

  it("accepts legacy 'claude' and 'codex' as selectable (backward-compat)", () => {
    expect(isSelectableProviderId("claude")).toBe(true);
    expect(isSelectableProviderId("codex")).toBe(true);
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
      "create.verifier": "codex-cli",
    })).toEqual({
      "create.extractor": "deepseek-v4",
      "create.verifier": "codex-cli",
    });
  });

  it("migrates legacy stage overrides from 'codex' → 'codex-cli'", () => {
    expect(normalizeStageOverrides({
      "create.extractor": "deepseek-v4",
      "create.writer": "deepseek-v4",
      "review.reviewer": "unknown",
      "create.verifier": "codex",
    })).toEqual({
      "create.extractor": "deepseek-v4",
      "create.verifier": "codex-cli",
    });
  });

  it("creates DeepSeek overrides only for text-only model-call stages", () => {
    // DeepSeek V4 (preview)는 이미지 입력 미지원 → create.extractor 제외
    expect(createDeepSeekStageOverrides()).toEqual({
      "create.solver": "deepseek-v4",
      "create.verifier": "deepseek-v4",
      "review.reviewer": "deepseek-v4",
    });
    expect(allModelStagesUseDeepSeek(createDeepSeekStageOverrides())).toBe(true);
    expect(normalizeStageOverrides({
      ...createDeepSeekStageOverrides(),
      builder: "deepseek-v4",
      checker: "deepseek-v4",
      cropper: "deepseek-v4",
    })).toEqual(createDeepSeekStageOverrides());
  });

  it("reads and writes stage overrides with the same payload", () => {
    const storage = createStorage();
    writeAISettings({
      defaultProvider: "auto",
      stageOverrides: {
        "review.reviewer": "deepseek-v4",
      },
      figureRegen: true,
      checkerMaxAttempts: 2,
    }, storage);

    expect(readAISettings(storage)).toEqual({
      defaultProvider: "auto",
      stageOverrides: {
        "review.reviewer": "deepseek-v4",
      },
      figureRegen: true,
      checkerMaxAttempts: 2,
    });
  });

  it("normalizes checkerMaxAttempts to 0~5 range", () => {
    // Test clamping
    expect(writeAISettings({ ...DEFAULT_AI_SETTINGS, checkerMaxAttempts: -1 })).toEqual({
      ...DEFAULT_AI_SETTINGS,
      checkerMaxAttempts: 0,
    });
    expect(writeAISettings({ ...DEFAULT_AI_SETTINGS, checkerMaxAttempts: 10 })).toEqual({
      ...DEFAULT_AI_SETTINGS,
      checkerMaxAttempts: 5,
    });
    // Test valid range
    expect(writeAISettings({ ...DEFAULT_AI_SETTINGS, checkerMaxAttempts: 3 })).toEqual({
      ...DEFAULT_AI_SETTINGS,
      checkerMaxAttempts: 3,
    });
  });

  it("applies default checkerMaxAttempts when legacy settings lack the field", () => {
    const storage = createStorage(JSON.stringify({
      defaultProvider: "auto",
      stageOverrides: {},
      figureRegen: true,
      // checkerMaxAttempts missing
    }));
    expect(readAISettings(storage)).toEqual({
      defaultProvider: "auto",
      stageOverrides: {},
      figureRegen: true,
      checkerMaxAttempts: 2,
    });
  });

  it("rounds checkerMaxAttempts to nearest integer", () => {
    expect(writeAISettings({ ...DEFAULT_AI_SETTINGS, checkerMaxAttempts: 2.7 })).toEqual({
      ...DEFAULT_AI_SETTINGS,
      checkerMaxAttempts: 3,
    });
    expect(writeAISettings({ ...DEFAULT_AI_SETTINGS, checkerMaxAttempts: 2.3 })).toEqual({
      ...DEFAULT_AI_SETTINGS,
      checkerMaxAttempts: 2,
    });
  });
});
