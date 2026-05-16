import { describe, expect, it } from "vitest";
import {
  claudeCliProvider,
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

  it("does not register future providers until their phases implement them", () => {
    expect(() => getProviderAdapter("codex")).toThrow("AI provider is not registered yet: codex");
    expect(() => getProviderAdapter("deepseek-v4")).toThrow("AI provider is not registered yet: deepseek-v4");
  });

  it("lists only currently usable provider adapters", () => {
    expect(listProviderAdapters().map((provider) => provider.id)).toEqual(["claude"]);
  });
});
