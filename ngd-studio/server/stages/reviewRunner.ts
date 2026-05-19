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

import {
  applyReviewMutations,
  type ReviewIssueDraft,
  type MutationResult,
} from "../review/mutation";
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
   * The function receives the same `hwpxPath` and any extra context needed.
   */
  runReviewerAgent: (hwpxPath: string) => Promise<ReviewIssueDraft[]>;
  /** Options forwarded to runAddReviewTable. */
  addReviewTableOpts?: AddReviewTableOptions;
  /** Options forwarded to runReviewPostprocess. */
  postprocessOpts?: ReviewPostprocessOptions;
}

export interface ReviewRunnerOutput {
  /** All drafts returned by the reviewer LLM. */
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

  // ── Step 1: LLM → issue drafts ─────────────────────────────────────────────
  const drafts = await runReviewerAgent(hwpxPath);

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

  return { drafts, applied, failed, fixedTableEntries, extraTableItems };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: derive table entries from applied drafts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group applied drafts by `rule_id` (items 1–22) and produce FixedTableEntries.
 *
 * For each rule_id like "#9", extract the number and collect unique problem
 * numbers from the issue location / description. Falls back to "확인" when
 * no specific numbers can be determined.
 */
function buildFixedTableEntries(applied: ReviewIssueDraft[]): FixedTableEntry[] {
  const seen = new Set<number>();

  for (const draft of applied) {
    const numMatch = draft.rule_id?.match(/#(\d+)/);
    if (!numMatch) continue;
    const itemNum = parseInt(numMatch[1], 10);
    if (itemNum >= 1 && itemNum <= 22) seen.add(itemNum);
  }

  return [...seen].map((itemNumber) => ({ itemNumber, issueNumbers: "확인" }));
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
