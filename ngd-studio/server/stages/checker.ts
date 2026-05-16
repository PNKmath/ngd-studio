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
}

interface SectionSource {
  xml: string;
  file: string;
}

const ALLOWED_DIFFICULTIES = new Set(["하", "중", "상", "킬"]);
const DETERMINISTIC_RULE_IDS = [
  "xml.well_formed",
  "xml.raw_escape",
  "text.raw_equation_xml",
  "text.english_word",
  "text.difficulty_vocabulary",
  "equation.run_on",
  "equation.permutation_combination",
];

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
  return [
    ...checkXmlWellFormed(sectionXml, file),
    ...checkRawEscapes(sectionXml, file),
    ...checkRawEquationXml(sectionXml, file),
    ...checkEnglishWords(sectionXml, file),
    ...checkDifficultyVocabulary(sectionXml, file),
    ...checkRunOnEquations(sectionXml, file),
    ...checkPermutationCombination(sectionXml, file),
  ];
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
