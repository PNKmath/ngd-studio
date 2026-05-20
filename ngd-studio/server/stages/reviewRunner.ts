/**
 * reviewRunner.ts
 *
 * Orchestrates the review (오검) pipeline:
 *
 *   1. LLM call (reviewer agent) → ReviewIssueDraft[]
 *   2. applyReviewMutations       → mutates HWPX in-place
 *   3. writeFixedReviewTableEntries → fills 22-item checklist table
 *   4. runAddReviewTable            → appends second table
 *   5. runReviewPostprocess         → fix_namespaces + validate
 *
 * Steps 2–5 are deterministic code; step 1 is the only LLM call.
 *
 * The LLM integration point (`runReviewerAgent`) is declared as a callable
 * dependency so callers can inject any AI harness (Claude CLI, SDK, etc.)
 * without changing this file.
 */

import { readFile } from "fs/promises";
import JSZip from "jszip";
import {
  applyReviewMutations,
  type ReviewIssueDraft,
  type MutationResult,
} from "../review/mutation";
import {
  runAutoValidators,
  AUTO_VALIDATED_RULE_IDS,
} from "../review/autoValidators";
import {
  writeFixedReviewTableEntries,
  runAddReviewTable,
  type FixedTableEntry,
  type ExtraTableEntry,
  type AddReviewTableOptions,
} from "../review/reviewTable";
import { runReviewPostprocess, type ReviewPostprocessOptions } from "../review/postprocess";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewRunnerInput {
  /** Absolute path to the HWPX file to review (modified in-place). */
  hwpxPath: string;
  /**
   * Callable that invokes the reviewer agent (LLM) and returns issue drafts.
   *
   * Callers supply their own implementation (Claude CLI, SDK provider, etc.).
   * The function receives `hwpxPath` and `skipRuleIds` — rule IDs that the
   * code-level autoValidators already cover, so the agent must not produce
   * duplicate drafts for them.
   */
  runReviewerAgent: (
    hwpxPath: string,
    opts: { skipRuleIds: string[] }
  ) => Promise<ReviewIssueDraft[]>;
  /** Options forwarded to runAddReviewTable. */
  addReviewTableOpts?: AddReviewTableOptions;
  /** Options forwarded to runReviewPostprocess. */
  postprocessOpts?: ReviewPostprocessOptions;
}

export interface ReviewRunnerOutput {
  /**
   * Deterministic drafts produced by autoValidators (auto_verified: true).
   * These are merged into `drafts` but exposed separately for observability.
   */
  autoDrafts: ReviewIssueDraft[];
  /** All drafts (autoDrafts + agent drafts, rule_id-deduplicated). */
  drafts: ReviewIssueDraft[];
  /** Drafts that were successfully applied to the HWPX. */
  applied: MutationResult["applied"];
  /** Drafts that could NOT be applied (snippet not found, no suggested_fix, etc.). */
  failed: MutationResult["failed"];
  /** Entries written to the 22-item fixed checklist table. */
  fixedTableEntries: FixedTableEntry[];
  /** Extra items appended to the second review table. */
  extraTableItems: ExtraTableEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full review pipeline for a single HWPX file.
 *
 * The HWPX at `input.hwpxPath` is mutated in-place. On success, it contains:
 *   - all applied fixes
 *   - the filled 22-item checklist table
 *   - the second "extra items" table
 *   - post-processed namespaces (fix_namespaces) and validated structure
 *
 * Throws on postprocess failures. Individual mutation failures are collected
 * in the returned `failed` list rather than thrown.
 */
export async function runReviewStage(input: ReviewRunnerInput): Promise<ReviewRunnerOutput> {
  const { hwpxPath, runReviewerAgent, addReviewTableOpts, postprocessOpts } = input;

  // ── Step 0: Read section XML for deterministic validators ──────────────────
  const sectionXml = await readSectionXml(hwpxPath);

  // ── Step 1a: Deterministic auto-validators ─────────────────────────────────
  const autoDrafts = runAutoValidators(sectionXml);

  // ── Step 1b: LLM → issue drafts (skipping auto-validated rule IDs) ─────────
  const agentDrafts = await runReviewerAgent(hwpxPath, {
    skipRuleIds: AUTO_VALIDATED_RULE_IDS,
  });

  // Merge: auto drafts take precedence; agent drafts for already-covered
  // rule_ids are dropped to prevent duplicates.
  const drafts: ReviewIssueDraft[] = [
    ...autoDrafts,
    ...agentDrafts.filter(
      (d) => !AUTO_VALIDATED_RULE_IDS.includes(d.rule_id ?? "")
    ),
  ];

  // ── Step 2: Apply mutations ────────────────────────────────────────────────
  const { applied, failed } = await applyReviewMutations(hwpxPath, drafts);

  // ── Step 3: Fill fixed checklist table ────────────────────────────────────
  const fixedTableEntries = buildFixedTableEntries(applied);
  await writeFixedReviewTableEntries(hwpxPath, fixedTableEntries);

  // ── Step 4: Append second table ───────────────────────────────────────────
  const extraTableItems = buildExtraTableItems(applied);
  await runAddReviewTable(hwpxPath, extraTableItems, addReviewTableOpts);

  // ── Step 5: Postprocess ───────────────────────────────────────────────────
  await runReviewPostprocess(hwpxPath, postprocessOpts);

  return { autoDrafts, drafts, applied, failed, fixedTableEntries, extraTableItems };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: extract Contents/section0.xml from HWPX zip
// ─────────────────────────────────────────────────────────────────────────────

async function readSectionXml(hwpxPath: string): Promise<string> {
  const data = await readFile(hwpxPath);
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file("Contents/section0.xml");
  if (!entry) {
    throw {
      code: "review_section_missing",
      message: `Contents/section0.xml not found in HWPX: ${hwpxPath}`,
      retryable: false,
    };
  }
  return entry.async("string");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: derive table entries from applied drafts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group applied drafts by `rule_id` (items 1–22) and produce FixedTableEntries.
 *
 * For each rule_id like "#9", collect `question_number` values into a
 * comma-separated list. Drafts without a question_number contribute to a
 * "확인" fallback for that item.
 */
function buildFixedTableEntries(applied: ReviewIssueDraft[]): FixedTableEntry[] {
  const byItem = new Map<number, Set<number>>();
  const fallback = new Set<number>();

  for (const draft of applied) {
    const numMatch = draft.rule_id?.match(/#(\d+)/);
    if (!numMatch) continue;
    const itemNum = parseInt(numMatch[1], 10);
    if (itemNum < 1 || itemNum > 22) continue;

    if (!byItem.has(itemNum)) byItem.set(itemNum, new Set());
    if (typeof draft.question_number === "number") {
      byItem.get(itemNum)!.add(draft.question_number);
    } else {
      fallback.add(itemNum);
    }
  }

  return [...byItem.entries()].map(([itemNumber, qSet]) => {
    if (qSet.size === 0) return { itemNumber, issueNumbers: "확인" };
    const sorted = [...qSet].sort((a, b) => a - b).join(",");
    return { itemNumber, issueNumbers: fallback.has(itemNumber) ? `${sorted},확인` : sorted };
  });
}

/**
 * Build extra table items from applied drafts that do NOT have a rule_id
 * (i.e. ad-hoc fixes not covered by the 22 fixed items).
 */
function buildExtraTableItems(applied: ReviewIssueDraft[]): ExtraTableEntry[] {
  return applied
    .filter((d) => !d.rule_id)
    .map((d) => ({
      description: summarizeDraft(d),
      numbers: "",
    }));
}

function summarizeDraft(draft: ReviewIssueDraft): string {
  const prefix =
    draft.issue_type === "typo"
      ? "오타 수정"
      : draft.issue_type === "missing"
        ? "누락 추가"
        : "위반 수정";
  const snippet = draft.location.snippet.slice(0, 40).replace(/\s+/g, " ").trim();
  return snippet ? `${prefix}: ${snippet}` : prefix;
}
