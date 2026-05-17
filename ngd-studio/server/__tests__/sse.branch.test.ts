/**
 * Unit tests for shouldUseCodeOrchestrator helper (Phase 6).
 *
 * These tests verify the branching logic in sse.ts without invoking any actual
 * HTTP server, provider adapters, or file system operations.
 */
import { describe, expect, it } from "vitest";
import { shouldUseCodeOrchestrator } from "../stages/branchHelper";
import type { StageOverrideMap } from "../../lib/ai/settings";

describe("shouldUseCodeOrchestrator", () => {
  it("returns false for mode=create with empty stageOverrides (default/auto path)", () => {
    const overrides: StageOverrideMap = {};
    expect(shouldUseCodeOrchestrator("create", overrides)).toBe(false);
  });

  it("returns true for mode=create when create.solver is overridden", () => {
    const overrides: StageOverrideMap = { "create.solver": "deepseek-v4" };
    expect(shouldUseCodeOrchestrator("create", overrides)).toBe(true);
  });

  it("returns true for mode=create when create.extractor is overridden", () => {
    const overrides: StageOverrideMap = { "create.extractor": "claude-sdk" };
    expect(shouldUseCodeOrchestrator("create", overrides)).toBe(true);
  });

  it("returns true for mode=create when create.verifier is overridden", () => {
    const overrides: StageOverrideMap = { "create.verifier": "openai-sdk" };
    expect(shouldUseCodeOrchestrator("create", overrides)).toBe(true);
  });

  it("returns false for mode=create when only review.reviewer is overridden (non-create stage)", () => {
    const overrides: StageOverrideMap = { "review.reviewer": "deepseek-v4" };
    expect(shouldUseCodeOrchestrator("create", overrides)).toBe(false);
  });

  it("returns true for mode=resume when create.solver is overridden", () => {
    const overrides: StageOverrideMap = { "create.solver": "deepseek-v4" };
    expect(shouldUseCodeOrchestrator("resume", overrides)).toBe(true);
  });

  it("returns false for mode=resume with empty stageOverrides", () => {
    const overrides: StageOverrideMap = {};
    expect(shouldUseCodeOrchestrator("resume", overrides)).toBe(false);
  });

  it("returns false for mode=review regardless of stageOverrides (review is legacy-only)", () => {
    const overrides: StageOverrideMap = { "create.solver": "deepseek-v4" };
    expect(shouldUseCodeOrchestrator("review", overrides)).toBe(false);
  });

  it("returns false for mode=review with empty stageOverrides", () => {
    const overrides: StageOverrideMap = {};
    expect(shouldUseCodeOrchestrator("review", overrides)).toBe(false);
  });

  it("returns false for mode=crop regardless of stageOverrides", () => {
    const overrides: StageOverrideMap = { "create.solver": "deepseek-v4" };
    expect(shouldUseCodeOrchestrator("crop", overrides)).toBe(false);
  });
});
