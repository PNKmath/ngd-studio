/**
 * postprocess.ts
 *
 * Review-pipeline postprocessing: runs fix_namespaces.py and validate.py
 * on the reviewed HWPX file. Mirrors the builder stage's postprocess step
 * but resolves scripts from the ngd-exam-review skill directory.
 *
 * `runReviewPostprocess` is deterministic (given the same HWPX, same output).
 */

import path from "path";
import { runStageCommand, stageCommandToError } from "../stages/commands";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewPostprocessOptions {
  /** Absolute path to fix_namespaces.py (review variant). Inferred if omitted. */
  fixNamespacesScript?: string;
  /** Absolute path to validate.py. Inferred if omitted. */
  validateScript?: string;
  /** Python executable (default: "python3" on non-Windows, "python" on Windows) */
  pythonCommand?: string;
  timeoutMs?: number;
}

export interface ReviewPostprocessResult {
  fixNamespacesStdout: string;
  validateStdout: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run fix_namespaces.py (review variant) then validate.py on `hwpxPath`.
 *
 * Throws a `StageError`-shaped object on failure. Both scripts are executed
 * in sequence; validate.py is called with `--fix` so it auto-corrects
 * recoverable issues.
 */
export async function runReviewPostprocess(
  hwpxPath: string,
  opts: ReviewPostprocessOptions = {}
): Promise<ReviewPostprocessResult> {
  const python =
    opts.pythonCommand ?? (process.platform === "win32" ? "python" : "python3");

  // __dirname here is ngd-studio/server/review/
  // repo root is four levels up: review → server → ngd-studio → ngd-studio(proj) → repo
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const fixNamespaces =
    opts.fixNamespacesScript ??
    path.join(repoRoot, ".claude", "skills", "ngd-exam-review", "scripts", "fix_namespaces.py");
  const validate =
    opts.validateScript ?? path.join(repoRoot, "resources", "hwpx_scripts", "validate.py");

  // 1. fix_namespaces.py
  const fixResult = await runStageCommand({
    command: python,
    args: [fixNamespaces, hwpxPath],
    timeoutMs: opts.timeoutMs ?? 30_000,
  });
  const fixErr = stageCommandToError(fixResult);
  if (fixErr) throw fixErr;

  // 2. validate.py --fix
  const validateResult = await runStageCommand({
    command: python,
    args: [validate, hwpxPath, "--fix"],
    timeoutMs: opts.timeoutMs ?? 30_000,
  });
  const validateErr = stageCommandToError(validateResult);
  if (validateErr) throw validateErr;

  return {
    fixNamespacesStdout: fixResult.stdout,
    validateStdout: validateResult.stdout,
  };
}
