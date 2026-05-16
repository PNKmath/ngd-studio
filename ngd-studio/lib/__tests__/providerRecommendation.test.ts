import { describe, expect, it } from "vitest";
import { recommendStageProvider } from "../ai/recommendation";
import type { ProviderTelemetryEntry } from "../ai";

const telemetry: ProviderTelemetryEntry[] = [
  { stageKey: "review.reviewer", requestedProvider: "claude", resolvedProvider: "claude", attempt: 1, status: "success", elapsedMs: 3000, retry: false },
  { stageKey: "review.reviewer", requestedProvider: "claude", resolvedProvider: "claude", attempt: 1, status: "success", elapsedMs: 3200, retry: false },
  { stageKey: "review.reviewer", requestedProvider: "claude", resolvedProvider: "claude", attempt: 1, status: "success", elapsedMs: 3100, retry: false },
  { stageKey: "review.reviewer", requestedProvider: "deepseek-v4", resolvedProvider: "deepseek-v4", attempt: 1, status: "success", elapsedMs: 900, retry: false, externalCostUsd: 0.01 },
  { stageKey: "review.reviewer", requestedProvider: "deepseek-v4", resolvedProvider: "deepseek-v4", attempt: 1, status: "success", elapsedMs: 950, retry: false, externalCostUsd: 0.01 },
  { stageKey: "review.reviewer", requestedProvider: "deepseek-v4", resolvedProvider: "deepseek-v4", attempt: 1, status: "success", elapsedMs: 1000, retry: false, externalCostUsd: 0.01 },
];

describe("stage provider recommendation", () => {
  it("keeps explicit stage overrides ahead of recommendations", () => {
    expect(recommendStageProvider({
      stageKey: "review.reviewer",
      stageOverrides: { "review.reviewer": "codex" },
      telemetry,
    })).toEqual({ provider: "codex", reason: "explicit-override", observations: 0 });
  });

  it("falls back to Claude when observations are insufficient", () => {
    expect(recommendStageProvider({
      stageKey: "create.extractor",
      telemetry,
    })).toEqual({ provider: "claude", reason: "insufficient-data", observations: 0 });
  });

  it("recommends the best telemetry provider for a stage", () => {
    expect(recommendStageProvider({
      stageKey: "review.reviewer",
      telemetry,
    })).toEqual({ provider: "deepseek-v4", reason: "best-telemetry", observations: 3 });
  });

  it("blocks external recommendations by policy", () => {
    expect(recommendStageProvider({
      stageKey: "review.reviewer",
      telemetry,
      externalApiAllowed: false,
    })).toEqual({ provider: "claude", reason: "best-telemetry", observations: 3 });
  });

  it("rejects high failure rate and high cost candidates", () => {
    const failed: ProviderTelemetryEntry[] = [
      ...telemetry,
      { stageKey: "review.reviewer", requestedProvider: "codex", resolvedProvider: "codex", attempt: 1, status: "failed", elapsedMs: 10, retry: true },
      { stageKey: "review.reviewer", requestedProvider: "codex", resolvedProvider: "codex", attempt: 2, status: "failed", elapsedMs: 10, retry: true },
      { stageKey: "review.reviewer", requestedProvider: "codex", resolvedProvider: "codex", attempt: 3, status: "success", elapsedMs: 10, retry: false },
    ];

    expect(recommendStageProvider({
      stageKey: "review.reviewer",
      telemetry: failed,
      maxAverageCostUsd: 0.001,
    })).toEqual({ provider: "claude", reason: "best-telemetry", observations: 3 });
  });
});
