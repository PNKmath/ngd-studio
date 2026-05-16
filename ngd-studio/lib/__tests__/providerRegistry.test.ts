import { describe, expect, it } from "vitest";
import {
  claudeCliProvider,
  codexCliProvider,
  deepseekV4Provider,
  getProviderAdapter,
  listProviderAdapters,
  normalizeProviderId,
  resolveProviderId,
} from "../ai";

describe("AI provider registry", () => {
  it("resolves auto to Claude for the initial provider rollout", () => {
    expect(resolveProviderId()).toBe("claude");
    expect(resolveProviderId("auto")).toBe("claude");
  });

  it("normalizes missing provider requests to auto", () => {
    expect(normalizeProviderId(undefined)).toBe("auto");
    expect(normalizeProviderId(null)).toBe("auto");
    expect(normalizeProviderId("")).toBe("auto");
  });

  it("rejects invalid provider request values", () => {
    expect(() => normalizeProviderId("unknown-provider")).toThrow("Invalid AI provider: unknown-provider");
    expect(() => normalizeProviderId(1)).toThrow("Invalid AI provider: 1");
  });

  it("returns the Claude CLI adapter for auto and claude", () => {
    expect(getProviderAdapter("auto")).toBe(claudeCliProvider);
    expect(getProviderAdapter("claude")).toBe(claudeCliProvider);
  });

  it("returns the Codex CLI adapter when codex is requested", () => {
    expect(resolveProviderId("codex")).toBe("codex");
    expect(getProviderAdapter("codex")).toBe(codexCliProvider);
  });

  it("registers DeepSeek V4 without changing auto fallback", () => {
    expect(resolveProviderId("deepseek-v4")).toBe("deepseek-v4");
    expect(getProviderAdapter("deepseek-v4")).toBe(deepseekV4Provider);
    expect(resolveProviderId("auto")).toBe("claude");
  });

  it("lists only currently usable provider adapters", () => {
    expect(listProviderAdapters().map((provider) => provider.id)).toEqual(["claude", "codex", "deepseek-v4"]);
  });
});
