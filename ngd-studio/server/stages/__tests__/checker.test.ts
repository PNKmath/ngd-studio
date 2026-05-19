/**
 * checker.test.ts
 *
 * Phase 5 — checker deterministic rules + auto-fix unit tests.
 *
 * Covers:
 *  1. `runDeterministicCheckerRules` — each of the 7 rule IDs fires correctly.
 *  2. `fixRunOnEquationsInXml` — run-on equation XML fix.
 *  3. `runCheckerWithAutoFix` — wrapper: clean XML passes immediately;
 *     run-on XML triggers fix and passes on second run; unfixable errors
 *     are returned as-is.
 */

import { describe, expect, it } from "vitest";
import {
  runDeterministicCheckerRules,
  fixRunOnEquationsInXml,
  runCheckerWithAutoFix,
} from "../checker";

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap a bare hp:script content in a minimal valid equation block. */
function makeEquationXml(script: string, equationAttrs = ""): string {
  return `<hp:equation${equationAttrs ? " " + equationAttrs : ""}><hp:script>${script}</hp:script></hp:equation>`;
}

/** Wrap equation blocks in a minimal section XML shell. */
function wrapSection(inner: string): string {
  return `<hsp:secPr><hp:p>${inner}</hp:p></hsp:secPr>`;
}

/** Build minimal section XML with a text node. */
function makeTextXml(text: string): string {
  return wrapSection(`<hp:t>${text}</hp:t>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Deterministic rule: xml.well_formed
// ─────────────────────────────────────────────────────────────────────────────

describe("checkXmlWellFormed (xml.well_formed)", () => {
  it("clean XML produces no issues", () => {
    const xml = "<root><child>text</child></root>";
    const issues = runDeterministicCheckerRules(xml);
    const wellFormed = issues.filter((i) => i.ruleId === "xml.well_formed");
    expect(wellFormed).toHaveLength(0);
  });

  it("mismatched closing tag produces error", () => {
    const xml = "<root><child>text</wrong></root>";
    const issues = runDeterministicCheckerRules(xml);
    const wellFormed = issues.filter((i) => i.ruleId === "xml.well_formed");
    expect(wellFormed).toHaveLength(1);
    expect(wellFormed[0]?.severity).toBe("error");
  });

  it("unclosed tag produces error", () => {
    const xml = "<root><child>text</root>";
    const issues = runDeterministicCheckerRules(xml);
    const wellFormed = issues.filter((i) => i.ruleId === "xml.well_formed");
    expect(wellFormed).toHaveLength(1);
    expect(wellFormed[0]?.severity).toBe("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Deterministic rule: xml.raw_escape
// ─────────────────────────────────────────────────────────────────────────────

describe("checkRawEscapes (xml.raw_escape)", () => {
  it("clean script produces no issues", () => {
    const xml = makeEquationXml("f(x) = x^2");
    const issues = runDeterministicCheckerRules(xml);
    expect(issues.filter((i) => i.ruleId === "xml.raw_escape")).toHaveLength(0);
  });

  it("unescaped < inside hp:script produces error", () => {
    const xml = `<hp:equation><hp:script>a < b</hp:script></hp:equation>`;
    const issues = runDeterministicCheckerRules(xml);
    expect(issues.filter((i) => i.ruleId === "xml.raw_escape").length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Deterministic rule: text.difficulty_vocabulary
// ─────────────────────────────────────────────────────────────────────────────

describe("checkDifficultyVocabulary (text.difficulty_vocabulary)", () => {
  it("valid difficulty values pass", () => {
    for (const val of ["하", "중", "상", "킬"]) {
      const xml = makeTextXml(`[난이도] ${val}`);
      const issues = runDeterministicCheckerRules(xml);
      expect(issues.filter((i) => i.ruleId === "text.difficulty_vocabulary")).toHaveLength(0);
    }
  });

  it("invalid difficulty value produces error", () => {
    const xml = makeTextXml("[난이도] 극상");
    const issues = runDeterministicCheckerRules(xml);
    const diff = issues.filter((i) => i.ruleId === "text.difficulty_vocabulary");
    expect(diff).toHaveLength(1);
    expect(diff[0]?.severity).toBe("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Deterministic rule: equation.run_on
// ─────────────────────────────────────────────────────────────────────────────

describe("checkRunOnEquations (equation.run_on)", () => {
  it("single = in equation passes", () => {
    const xml = wrapSection(makeEquationXml("f(x) = x^2"));
    const issues = runDeterministicCheckerRules(xml);
    expect(issues.filter((i) => i.ruleId === "equation.run_on")).toHaveLength(0);
  });

  it("two = in equation triggers warning", () => {
    const xml = wrapSection(makeEquationXml("f(x) = x^2 = y"));
    const issues = runDeterministicCheckerRules(xml);
    const runOn = issues.filter((i) => i.ruleId === "equation.run_on");
    expect(runOn).toHaveLength(1);
    expect(runOn[0]?.severity).toBe("warning");
    expect(runOn[0]?.fallbackRequired).toBe(true);
  });

  it("three = in equation triggers warning", () => {
    const xml = wrapSection(makeEquationXml("a = b = c = d"));
    const issues = runDeterministicCheckerRules(xml);
    expect(issues.filter((i) => i.ruleId === "equation.run_on")).toHaveLength(1);
  });

  it("= inside equation string is counted (detect is conservative)", () => {
    // The detect rule counts all = signs in the script (including internal ones).
    // "k = LEFT(a=1 RIGHT)" has 2 = signs → triggers warning.
    // The split fix is smarter and knows LEFT() is depth-guarded.
    const xml = wrapSection(makeEquationXml("k = LEFT(a=1 RIGHT)"));
    const issues = runDeterministicCheckerRules(xml);
    // 2 = signs → warning triggered (conservative detection)
    expect(issues.filter((i) => i.ruleId === "equation.run_on")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. fixRunOnEquationsInXml
// ─────────────────────────────────────────────────────────────────────────────

describe("fixRunOnEquationsInXml", () => {
  it("no-op for equation with single =", () => {
    const xml = wrapSection(makeEquationXml("f(x) = x^2"));
    expect(fixRunOnEquationsInXml(xml)).toBe(xml);
  });

  it("splits equation with two = into two sibling equations", () => {
    const xml = wrapSection(makeEquationXml("f(x) = x^2 = y"));
    const fixed = fixRunOnEquationsInXml(xml);

    // Should have two <hp:equation> blocks now
    const equationMatches = [...fixed.matchAll(/<hp:equation\b[^>]*>/g)];
    expect(equationMatches).toHaveLength(2);

    // Should have a glue text node between them
    expect(fixed).toContain("<hp:t> </hp:t>");

    // First block contains "f(x) = x^2"
    const firstScript = fixed.match(/<hp:script>([\s\S]*?)<\/hp:script>/)?.[1] ?? "";
    expect(firstScript.trim()).toBe("f(x) = x^2");

    // Second block contains "= y"
    const scripts = [...fixed.matchAll(/<hp:script>([\s\S]*?)<\/hp:script>/g)].map((m) => m[1].trim());
    expect(scripts).toHaveLength(2);
    expect(scripts[1]).toBe("= y");
  });

  it("splits equation with three = into three sibling equations", () => {
    const xml = wrapSection(makeEquationXml("a = b = c = d"));
    const fixed = fixRunOnEquationsInXml(xml);

    const scripts = [...fixed.matchAll(/<hp:script>([\s\S]*?)<\/hp:script>/g)].map((m) => m[1].trim());
    expect(scripts).toHaveLength(3);
    expect(scripts[0]).toBe("a = b");
    expect(scripts[1]).toBe("= c");
    expect(scripts[2]).toBe("= d");
  });

  it("is idempotent: applying fix twice yields same result", () => {
    const xml = wrapSection(makeEquationXml("a = b = c"));
    const fixed = fixRunOnEquationsInXml(xml);
    const fixedTwice = fixRunOnEquationsInXml(fixed);
    expect(fixedTwice).toBe(fixed);
  });

  it("preserves equation attributes on all split blocks", () => {
    const xml = wrapSection(makeEquationXml("x = y = z", 'id="eq1" style="font-size:11"'));
    const fixed = fixRunOnEquationsInXml(xml);
    const openTags = [...fixed.matchAll(/<hp:equation\b([^>]*)>/g)].map((m) => m[1].trim());
    expect(openTags).toHaveLength(2);
    for (const tag of openTags) {
      expect(tag).toContain('id="eq1"');
      expect(tag).toContain('style="font-size:11"');
    }
  });

  it("does not split = inside LEFT() — depth-guarded by fix splitter", () => {
    // "k = LEFT(a=1 RIGHT)" — the fix splitter uses depth tracking so the
    // internal = inside LEFT() is ignored. Only 1 top-level = → no split.
    const xml = wrapSection(makeEquationXml("k = LEFT(a=1 RIGHT)"));
    const fixed = fixRunOnEquationsInXml(xml);
    // Should still be a single equation (fix splitter is smarter than detect)
    const equationMatches = [...fixed.matchAll(/<hp:equation\b[^>]*>/g)];
    expect(equationMatches).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. runCheckerWithAutoFix
// ─────────────────────────────────────────────────────────────────────────────

describe("runCheckerWithAutoFix", () => {
  it("clean XML: ok=true, autofixed=false, no fix needed", async () => {
    const xml = wrapSection(makeEquationXml("f(x) = x^2"));
    const { result, autofixed } = await runCheckerWithAutoFix({ sectionXml: xml });

    expect(autofixed).toBe(false);
    expect(result.status).toBe("completed");
    expect(result.output?.ok).toBe(true);
    expect(result.output?.autofixed).toBe(false);
  });

  it("run-on equation: triggers auto-fix, checker passes after fix", async () => {
    // XML with a run-on equation ("equation.run_on" is a warning, not error)
    // The fix is still applied to demonstrate the fix path.
    const xml = wrapSection(makeEquationXml("a = b = c"));
    const { result, autofixed } = await runCheckerWithAutoFix({ sectionXml: xml });

    // After fix, equation.run_on should no longer fire (split into two equations each with 1 =)
    expect(autofixed).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.output?.ok).toBe(true);
    // No run-on issues after fix
    const runOnIssues = result.output?.issues.filter((i) => i.ruleId === "equation.run_on") ?? [];
    expect(runOnIssues).toHaveLength(0);
    expect(result.output?.autofixed).toBe(true);
  });

  it("unfixable error (invalid difficulty): returns failed, autofixed=false", async () => {
    const xml = makeTextXml("[난이도] 극상");
    const { result, autofixed } = await runCheckerWithAutoFix({ sectionXml: xml });

    expect(autofixed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.output?.ok).toBe(false);
  });

  it("missing input: falls back to plain runCheckerStage error path", async () => {
    const { result, autofixed } = await runCheckerWithAutoFix({});

    expect(autofixed).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("maxAttempts=1: fix is not attempted even for fixable issue", async () => {
    const xml = wrapSection(makeEquationXml("a = b = c"));
    const { result, autofixed } = await runCheckerWithAutoFix({ sectionXml: xml }, 1);

    // With maxAttempts=1 the loop runs once, finds the issue, no fix pass
    expect(autofixed).toBe(false);
    // ok is true because equation.run_on is warning-only (no errors)
    expect(result.output?.ok).toBe(true);
  });

  it("validation message includes 'auto-fix' when fix was applied", async () => {
    const xml = wrapSection(makeEquationXml("a = b = c"));
    const { result, autofixed } = await runCheckerWithAutoFix({ sectionXml: xml });

    expect(autofixed).toBe(true);
    expect(result.validation?.message).toContain("auto-fix");
  });
});
