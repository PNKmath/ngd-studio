/**
 * mutation.ts
 *
 * ZIP-level mutation primitives for HWPX review pipeline.
 *
 * These functions are deterministic: given the same input HWPX + replacements,
 * they always produce the same output. This separates the "decide what to fix"
 * (LLM domain) from "apply the fix" (code domain).
 *
 * All functions operate on the HWPX file path directly, rewriting in-place
 * via a .tmp copy swap (same pattern as add_review_table.py).
 */

import { readFile, writeFile, rename } from "fs/promises";
import JSZip from "jszip";
import type { StageError } from "../stages/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single text → text replacement in a named HWPX zip entry. */
export interface HwpxReplacement {
  /** Zip entry path, e.g. "Contents/section0.xml" */
  file: string;
  /** Exact string to find (used with str.replace – first occurrence only). */
  oldText: string;
  /** Replacement text. */
  newText: string;
}

/** Structured description of a review issue for deterministic mutation. */
export interface ReviewIssueDraft {
  issue_type: "typo" | "missing" | "checklist_violation";
  /**
   * Zip entry file path (e.g. "Contents/section0.xml") and the verbatim
   * snippet that contains the problematic text.
   */
  location: {
    file: string;
    /** XPath-style hint for human readability; not used by the mutation code. */
    xpath?: string;
    /** Verbatim text/XML snippet that needs to be replaced. */
    snippet: string;
  };
  /**
   * Verbatim replacement for `location.snippet`.
   * If undefined the mutation is skipped (LLM produced no fix suggestion).
   */
  suggested_fix?: string;
  /** Identifier matching one of the 22 fixed checklist items (e.g. "#9"). */
  rule_id?: string;
}

export interface MutationResult {
  applied: ReviewIssueDraft[];
  failed: Array<{ issue: ReviewIssueDraft; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core zip replace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a batch of string replacements to named entries inside an HWPX ZIP.
 *
 * Uses a temporary-file swap to avoid corruption on error.
 * Only the first occurrence of each `oldText` is replaced (deterministic).
 */
export async function zipReplaceHwpxSection(
  hwpxPath: string,
  replacements: HwpxReplacement[]
): Promise<void> {
  if (replacements.length === 0) return;

  // Group replacements by file for a single pass per zip entry.
  const byFile = new Map<string, HwpxReplacement[]>();
  for (const r of replacements) {
    const list = byFile.get(r.file);
    if (list) list.push(r);
    else byFile.set(r.file, [r]);
  }

  const data = await readFile(hwpxPath);
  const zip = await JSZip.loadAsync(data);

  for (const [entryPath, reps] of byFile) {
    const entry = zip.file(entryPath);
    if (!entry) {
      throw mkError(
        "review_mutation_missing_entry",
        `HWPX zip entry not found: ${entryPath}`,
        { hwpxPath, entryPath }
      );
    }
    let text = await entry.async("string");
    for (const rep of reps) {
      if (!text.includes(rep.oldText)) {
        throw mkError(
          "review_mutation_snippet_not_found",
          `Snippet not found in ${entryPath}: "${rep.oldText.slice(0, 80)}"`,
          { hwpxPath, entryPath, snippet: rep.oldText.slice(0, 200) }
        );
      }
      text = text.replace(rep.oldText, rep.newText);
    }
    zip.file(entryPath, text);
  }

  const tmpPath = hwpxPath + ".tmp";
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  await writeFile(tmpPath, out);
  await rename(tmpPath, hwpxPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level: apply a batch of ReviewIssueDrafts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply all ReviewIssueDraft items that have a `suggested_fix`.
 *
 * Issues without a `suggested_fix` (or whose snippet can't be located) are
 * collected in `failed` and NOT thrown — callers can surface them to the user.
 *
 * Each issue is applied independently so partial success is possible.
 */
export async function applyReviewMutations(
  hwpxPath: string,
  drafts: ReviewIssueDraft[]
): Promise<MutationResult> {
  const applied: ReviewIssueDraft[] = [];
  const failed: MutationResult["failed"] = [];

  for (const draft of drafts) {
    if (!draft.suggested_fix) {
      failed.push({ issue: draft, reason: "no suggested_fix provided" });
      continue;
    }
    const rep: HwpxReplacement = {
      file: draft.location.file,
      oldText: draft.location.snippet,
      newText: draft.suggested_fix,
    };
    try {
      await zipReplaceHwpxSection(hwpxPath, [rep]);
      applied.push(draft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ issue: draft, reason: msg });
    }
  }

  return { applied, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mkError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): StageError {
  return { code, message, retryable: false, details };
}
