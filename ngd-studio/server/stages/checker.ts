import { readFile } from "fs/promises";
import JSZip from "jszip";
import type { StageResult, StageRunner } from "./types";

export type CheckerIssueSeverity = "error" | "warning" | "info";

export interface CheckerIssue {
  ruleId: string;
  severity: CheckerIssueSeverity;
  message: string;
  file?: string;
  evidence?: string;
  fallbackRequired?: boolean;
}

export interface CheckerStageInput {
  hwpxPath?: string;
  sectionXmlPath?: string;
  sectionXml?: string;
}

export interface CheckerStageOutput {
  ok: boolean;
  issues: CheckerIssue[];
  checkedFiles: string[];
  deterministicRuleIds: string[];
  fallbackRequired: boolean;
  fallbackReasons: string[];
  /** true when checker issued a fix and re-ran (safe net triggered) */
  autofixed?: boolean;
}

interface SectionSource {
  xml: string;
  file: string;
}

// ──────────────────────────────────────────────
// Rule handler map
// ──────────────────────────────────────────────

interface RuleHandler {
  detect: (xml: string, file: string) => CheckerIssue[];
  /**
   * Optional deterministic XML-level fix.
   * When present, `runCheckerWithAutoFix` will apply this before triggering a
   * rebuild. Returns the mutated XML string. Must be idempotent.
   */
  fix?: (xml: string) => string;
}

const RULES: Record<string, RuleHandler> = {
  "xml.well_formed": { detect: checkXmlWellFormed },
  "xml.raw_escape": { detect: checkRawEscapes },
  "text.raw_equation_xml": { detect: checkRawEquationXml },
  "text.english_word": { detect: checkEnglishWords },
  "text.difficulty_vocabulary": { detect: checkDifficultyVocabulary },
  "equation.run_on": {
    detect: checkRunOnEquations,
    fix: fixRunOnEquationsInXml,
  },
  "equation.permutation_combination": { detect: checkPermutationCombination },
};

const ALLOWED_DIFFICULTIES = new Set(["하", "중", "상", "킬"]);
const DETERMINISTIC_RULE_IDS = Object.keys(RULES);

export const checkerStageRunner: StageRunner<CheckerStageInput, CheckerStageOutput> = {
  key: "checker",
  run: runCheckerStage,
};

export async function runCheckerStage(input: CheckerStageInput): Promise<StageResult<CheckerStageOutput>> {
  const startedAt = new Date().toISOString();

  try {
    const source = await loadSectionSource(input);
    const issues = runDeterministicCheckerRules(source.xml, source.file);
    const fallbackReasons = issues
      .filter((issue) => issue.fallbackRequired)
      .map((issue) => `${issue.ruleId}: ${issue.message}`);
    const output: CheckerStageOutput = {
      ok: issues.every((issue) => issue.severity !== "error"),
      issues,
      checkedFiles: [source.file],
      deterministicRuleIds: DETERMINISTIC_RULE_IDS,
      fallbackRequired: fallbackReasons.length > 0,
      fallbackReasons,
    };

    return {
      status: output.ok ? "completed" : "failed",
      output,
      validation: {
        ok: output.ok,
        message: output.ok ? "Deterministic checker passed" : `${issues.length} deterministic checker issue(s) found`,
        details: { issueCount: issues.length, fallbackRequired: output.fallbackRequired },
      },
      startedAt,
      completedAt: new Date().toISOString(),
      metadata: { deterministic: true },
    };
  } catch (error) {
    return {
      status: "failed",
      error: {
        code: "checker_failed",
        message: error instanceof Error ? error.message : String(error),
        cause: error,
        retryable: false,
      },
      startedAt,
      completedAt: new Date().toISOString(),
      metadata: { deterministic: true },
    };
  }
}

export function runDeterministicCheckerRules(sectionXml: string, file = "Contents/section0.xml"): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  for (const handler of Object.values(RULES)) {
    issues.push(...handler.detect(sectionXml, file));
  }
  return issues;
}

// ──────────────────────────────────────────────
// Auto-fix wrapper
// ──────────────────────────────────────────────

export interface CheckerAutoFixResult {
  result: StageResult<CheckerStageOutput>;
  /** true when the auto-fix path applied an XML patch and re-ran the checker. */
  autofixed: boolean;
}

/**
 * Run the checker with up to `maxAttempts` deterministic fix rounds.
 *
 * Strategy (rebuild trigger):
 *  1. Run the checker on the given XML.
 *  2. If ok, return immediately.
 *  3. If there are fixable issues (rules with `fix?`), apply each fix in turn
 *     (direct XML mutation) and re-run once.
 *  4. Return the final result (fixed or not).
 *
 * `input.sectionXml` must be provided for the fix loop; if only `hwpxPath` is
 * given the function falls back to a single plain check (no fix attempted).
 */
export async function runCheckerWithAutoFix(
  input: CheckerStageInput,
  maxAttempts = 2,
): Promise<CheckerAutoFixResult> {
  // Load source XML once so we can mutate it in the fix loop.
  const source = await loadSectionSource(input).catch(() => null);

  if (!source) {
    // Couldn't load — let runCheckerStage handle the error path normally.
    const result = await runCheckerStage(input);
    return { result, autofixed: false };
  }

  let xml = source.xml;
  let autofixed = false;

  function buildResult(issues: CheckerIssue[]): CheckerAutoFixResult {
    const ok = issues.every((i) => i.severity !== "error");
    const fallbackReasons = issues
      .filter((i) => i.fallbackRequired)
      .map((i) => `${i.ruleId}: ${i.message}`);
    const output: CheckerStageOutput = {
      ok,
      issues,
      checkedFiles: [source!.file],
      deterministicRuleIds: DETERMINISTIC_RULE_IDS,
      fallbackRequired: fallbackReasons.length > 0,
      fallbackReasons,
      autofixed,
    };
    const startedAt = new Date().toISOString();
    const validationMessage = ok
      ? autofixed
        ? "Deterministic checker passed after auto-fix"
        : "Deterministic checker passed"
      : `${issues.length} deterministic checker issue(s) found`;
    return {
      result: {
        status: ok ? "completed" : "failed",
        output,
        validation: {
          ok,
          message: validationMessage,
          details: { issueCount: issues.length, fallbackRequired: output.fallbackRequired, autofixed },
        },
        startedAt,
        completedAt: new Date().toISOString(),
        metadata: { deterministic: true },
      },
      autofixed,
    };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const issues = runDeterministicCheckerRules(xml, source.file);

    // Any fixable issue (error or warning with fix?) — including fallbackRequired warnings
    const fixableIssues = issues.filter((i) => RULES[i.ruleId]?.fix);

    // If no fixable issues exist, or this is the last attempt: return current result
    if (fixableIssues.length === 0 || attempt >= maxAttempts - 1) {
      return buildResult(issues);
    }

    // Apply fixes in order of the RULES map, then loop again
    const fixableRuleIds = new Set(fixableIssues.map((i) => i.ruleId));
    for (const [ruleId, handler] of Object.entries(RULES)) {
      if (fixableRuleIds.has(ruleId) && handler.fix) {
        xml = handler.fix(xml);
      }
    }
    autofixed = true;
  }

  // Fallback (shouldn't reach here with maxAttempts >= 1): plain single-run
  const result = await runCheckerStage(input);
  return { result, autofixed };
}

async function loadSectionSource(input: CheckerStageInput): Promise<SectionSource> {
  if (input.sectionXml) {
    return { xml: input.sectionXml, file: input.sectionXmlPath ?? "inline section XML" };
  }

  if (input.sectionXmlPath) {
    return { xml: await readFile(input.sectionXmlPath, "utf8"), file: input.sectionXmlPath };
  }

  if (input.hwpxPath) {
    const zip = await JSZip.loadAsync(await readFile(input.hwpxPath));
    const entry = zip.file("Contents/section0.xml");
    if (!entry) throw new Error(`Missing Contents/section0.xml in ${input.hwpxPath}`);
    return { xml: await entry.async("string"), file: `${input.hwpxPath}:Contents/section0.xml` };
  }

  throw new Error("Checker requires hwpxPath, sectionXmlPath, or sectionXml");
}

function checkXmlWellFormed(xml: string, file: string): CheckerIssue[] {
  const stack: string[] = [];
  const tagPattern = /<([^!?/\s>]+)(?:\s[^>]*)?>|<\/([^>\s]+)>/g;

  for (const match of xml.matchAll(tagPattern)) {
    const open = match[1];
    const close = match[2];
    if (open && !match[0].endsWith("/>")) {
      stack.push(open);
      continue;
    }
    if (!close) continue;

    const expected = stack.pop();
    if (expected !== close) {
      return [{
        ruleId: "xml.well_formed",
        severity: "error",
        message: `XML tag mismatch: expected </${expected ?? "none"}> but found </${close}>`,
        file,
        evidence: snippet(match[0]),
      }];
    }
  }

  if (stack.length > 0) {
    return [{
      ruleId: "xml.well_formed",
      severity: "error",
      message: `Unclosed XML tag: <${stack[stack.length - 1]}>`,
      file,
    }];
  }

  return [];
}

function checkRawEscapes(xml: string, file: string): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  for (const match of xml.matchAll(/<hp:script\b[^>]*>([\s\S]*?)<\/hp:script>/g)) {
    const content = match[1];
    if (/[<&](?!amp;|lt;|gt;|quot;|apos;)/.test(content)) {
      issues.push({
        ruleId: "xml.raw_escape",
        severity: "error",
        message: "Unescaped XML character inside hp:script",
        file,
        evidence: snippet(content),
      });
    }
  }
  return issues;
}

function checkRawEquationXml(xml: string, file: string): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  for (const text of textNodes(xml)) {
    if (/(&lt;|<)\/?hp:(equation|script)\b/.test(text)) {
      issues.push({
        ruleId: "text.raw_equation_xml",
        severity: "error",
        message: "Equation XML appears as text inside hp:t",
        file,
        evidence: snippet(text),
      });
    }
  }
  return issues;
}

function checkEnglishWords(xml: string, file: string): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  for (const text of textNodes(xml)) {
    const match = text.match(/[A-Za-z]{3,}/);
    if (match) {
      issues.push({
        ruleId: "text.english_word",
        severity: "warning",
        message: "Consecutive English letters found in visible text",
        file,
        evidence: snippet(match[0]),
      });
    }
  }
  return issues;
}

function checkDifficultyVocabulary(xml: string, file: string): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  const visibleText = textNodes(xml).join("\n");
  for (const match of visibleText.matchAll(/\[난이도\]\s*([^\s\[]+)/g)) {
    const value = match[1].trim();
    if (!ALLOWED_DIFFICULTIES.has(value)) {
      issues.push({
        ruleId: "text.difficulty_vocabulary",
        severity: "error",
        message: `Invalid difficulty value: ${value}`,
        file,
        evidence: snippet(match[0]),
      });
    }
  }
  return issues;
}

function checkRunOnEquations(xml: string, file: string): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  for (const script of equationScripts(xml)) {
    if ((script.match(/=/g) ?? []).length >= 2) {
      issues.push({
        ruleId: "equation.run_on",
        severity: "warning",
        message: "Equation script contains multiple equality signs and may be a run-on equation",
        file,
        evidence: snippet(script),
        fallbackRequired: true,
      });
    }
  }
  return issues;
}

function checkPermutationCombination(xml: string, file: string): CheckerIssue[] {
  const issues: CheckerIssue[] = [];
  const forbidden = /\bn\s*[CP]\s*r\b|LSUB|_\s*\{?n\}?\s*\{?rm[CP]\}?|_\s*n\s*C\s*_\s*r/i;
  for (const source of [...equationScripts(xml), ...textNodes(xml)]) {
    const match = source.match(forbidden);
    if (match) {
      issues.push({
        ruleId: "equation.permutation_combination",
        severity: "error",
        message: "Forbidden permutation/combination notation pattern found",
        file,
        evidence: snippet(match[0]),
      });
    }
  }
  return issues;
}

function textNodes(xml: string): string[] {
  return [...xml.matchAll(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g)].map((match) => match[1]);
}

function equationScripts(xml: string): string[] {
  return [...xml.matchAll(/<hp:script\b[^>]*>([\s\S]*?)<\/hp:script>/g)].map((match) => match[1]);
}

function snippet(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 160);
}

// ──────────────────────────────────────────────
// XML-level fix: equation.run_on
// ──────────────────────────────────────────────

/**
 * Split run-on equations in section XML.
 *
 * For each `<hp:equation>` block whose `<hp:script>` content has ≥2 top-level
 * `=` signs, split it into multiple sibling `<hp:equation>` elements separated
 * by a `<hp:t> </hp:t>` glue node.
 *
 * The outer `<hp:equation>` tag (including all attributes) is preserved for
 * each segment. Idempotent: a script with exactly 1 top-level `=` is not touched.
 */
export function fixRunOnEquationsInXml(xml: string): string {
  // Match the entire <hp:equation ...>...<hp:script ...>CONTENT</hp:script>...</hp:equation>
  // Captures: (1) opening tag+attrs, (2) markup before script content, (3) script content, (4) close side
  const EQUATION_PATTERN = /(<hp:equation\b[^>]*>)([\s\S]*?<hp:script\b[^>]*>)([\s\S]*?)(<\/hp:script>[\s\S]*?<\/hp:equation>)/g;

  return xml.replace(EQUATION_PATTERN, (_fullMatch, openTag, beforeScript, scriptContent, afterScript) => {
    const segments = splitTopLevelEqChecker(scriptContent);
    if (segments.length <= 1) {
      return _fullMatch;
    }

    // Build replacement: one <hp:equation> per segment, glued with <hp:t> </hp:t>
    return segments
      .map((seg, i) => {
        const eq = `${openTag}${beforeScript}${seg}${afterScript}`;
        return i < segments.length - 1 ? `${eq}<hp:t> </hp:t>` : eq;
      })
      .join("");
  });
}

/**
 * Minimal top-level `=` splitter — equivalent to `splitTopLevelEq` from
 * lib/parts/normalize.ts, inlined here to avoid a cross-boundary import.
 *
 * Returns segments. If fewer than 2 top-level `=` signs → returns [script].
 */
function splitTopLevelEqChecker(script: string): string[] {
  const eqPositions: number[] = [];
  let depth = 0;
  let inBacktick = false;
  let i = 0;

  while (i < script.length) {
    const c = script[i];
    if (c === "`") { inBacktick = !inBacktick; i++; continue; }
    if (!inBacktick) {
      if (c === "{") { depth++; i++; continue; }
      if (c === "}") { depth--; i++; continue; }
      if (depth === 0) {
        if (script.startsWith("LEFT(", i)) { depth++; i += 5; continue; }
        if (script.startsWith("LEFT (", i)) { depth++; i += 6; continue; }
      }
      if (depth === 1) {
        if (script.startsWith("RIGHT)", i)) { depth--; i += 6; continue; }
        if (script.startsWith("RIGHT )", i)) { depth--; i += 7; continue; }
      }
      if (depth === 0 && c === "=") { eqPositions.push(i); }
    }
    i++;
  }

  if (eqPositions.length < 2) return [script];

  const segments: string[] = [];
  segments.push(script.slice(0, eqPositions[1]).trimEnd());
  for (let k = 1; k < eqPositions.length - 1; k++) {
    segments.push(script.slice(eqPositions[k], eqPositions[k + 1]).trim());
  }
  segments.push(script.slice(eqPositions[eqPositions.length - 1]).trim());
  return segments.filter((s) => s.trim().length > 0);
}
