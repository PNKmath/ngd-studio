import { readFile, writeFile } from "fs/promises";
import type { StageCache } from "./cache";

/**
 * Per-question cache merge contract (A안 — verifier = gating only).
 *
 * Cache files store disjoint field sets, NOT progressively-enriched versions of
 * the same object. They must be merged, not picked:
 *
 *   _extracted.json : problem definition
 *                     (type, score, parts, choices, has_figure, condition_box,
 *                      bogi_box, data_table, explanation_table, figure_info, ...)
 *                     — produced by extractor, kept as-is throughout the pipeline.
 *
 *   _solved.json    : { number, answer, explanation_parts } only
 *                     — produced by solver. On verifier-feedback retries the
 *                       orchestrator re-runs solver, which OVERWRITES this file,
 *                       so the latest _solved.json always carries the corrected
 *                       answer/explanation (see orchestrator.ts applyVerifierRetry).
 *
 *   _verified.json  : { number, status, issues, feedback } only
 *                     — gating ledger. NEVER contains answer/explanation_parts or
 *                       problem-definition fields, so MUST NOT participate in
 *                       problem-body merge. Used by orchestrator to decide
 *                       pass/fail and to seed solver retry feedback.
 *
 * The canonical merged problem = { ...extracted, ...solved }.
 * build_hwpx.py / assemble.py expect this shape (e.g. prob["type"], prob["parts"]).
 */

/**
 * Exam metadata matching the `info` key in exam_data.json.
 * Field names match build_hwpx.py / figure_processor.py consumption.
 */
export interface ExamMetaInput {
  schoolLevel?: "중" | "고";
  school_level?: "중" | "고"; // snake_case alias (Python side reads this)
  school?: string;
  grade?: number;
  subject?: string;
  subject_code?: string;
  semester?: string;
  exam_type?: string;
  examType?: string; // camelCase alias accepted on input
  range?: string;
  region?: string;
  code?: string;
  year?: number;
  textbook?: string;
  total_pages?: number;
  filename_base?: string;
  [key: string]: unknown;
}

/**
 * A single problem entry in the combined exam_data.json.
 * The shape is determined by the extractor/solver/verifier JSON output.
 */
export type ExamDataProblem = Record<string, unknown>;

/**
 * Top-level shape of exam_data.json.
 * Uses `info` key for compatibility with figure_processor.py and build_hwpx.py.
 */
export interface ExamDataOutput {
  info: ExamMetaInput;
  problems: ExamDataProblem[];
}

/**
 * Build and write exam_data.json by merging per-question cache files.
 *
 * Merge: { ...extracted, ...solved }. _verified.json is gating only and never
 * contributes problem-body fields. Both _extracted and _solved are REQUIRED
 * (orchestrator only invokes this with question numbers that passed the
 * solver stage), so missing either raises.
 */
export async function buildExamDataJson(input: {
  cache: StageCache;
  meta: ExamMetaInput;
  questionNumbers: number[];
}): Promise<ExamDataOutput> {
  const { cache, meta, questionNumbers } = input;
  const problems: ExamDataProblem[] = [];

  for (const n of questionNumbers) {
    const problem = await mergeQuestionSources(cache, n, { requireSolved: true });
    problems.push(problem);
  }

  const output: ExamDataOutput = {
    info: normalizeMeta(meta),
    problems,
  };

  await writeFile(
    cache.paths.examData,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  return output;
}

function normalizeMeta(meta: ExamMetaInput): ExamMetaInput {
  const examType = meta.exam_type ?? meta.examType ?? "";
  const year = typeof meta.year === "number" ? meta.year : new Date().getFullYear();
  const semester = meta.semester ?? "";
  const subject = meta.subject ?? "";
  const schoolLevel: "중" | "고" = meta.schoolLevel ?? meta.school_level ?? "고"; // default "고" for legacy
  let filenameBase = meta.filename_base;
  if (!filenameBase) {
    const parts = [meta.code, schoolLevel, year, semester, meta.region, meta.school, subject, meta.code]
      .filter((v) => v !== undefined && v !== "")
      .map((v) => `[${v}]`)
      .join("");
    filenameBase = parts.length > 0 ? parts : `exam_${year}`;
  }
  return {
    ...meta,
    exam_type: examType,
    examType,
    year,
    filename_base: filenameBase,
    school_level: schoolLevel, // snake_case for Python consumption
    schoolLevel,               // camelCase preserved for TS usage
  };
}

/**
 * Merge per-question cache sources into a single problem object.
 *
 * Layers: base = _extracted.json (problem definition);
 *         overlay = _solved.json (answer + explanation_parts).
 * _verified.json is intentionally NOT a source — see contract at top of file.
 *
 * - `requireSolved: true`  → solver result must exist (orchestrator main path).
 * - `requireSolved: false` → solver result may be absent; extracted-only is
 *   returned (aggregate path may want to surface partially-processed problems).
 * If _extracted is missing this always throws — no fallback can produce the
 * problem-definition fields (type/score/parts/choices) build_hwpx.py requires.
 */
async function mergeQuestionSources(
  cache: StageCache,
  n: number,
  opts: { requireSolved: boolean }
): Promise<ExamDataProblem> {
  const [extracted, solved] = await Promise.all([
    tryReadJson(cache.extractorResultPath(n)),
    tryReadJson(cache.solverResultPath(n)),
  ]);

  if (!extracted) {
    throw new Error(
      `missing extracted for Q${n}: _extracted.json could not be read (problem definition required)`
    );
  }
  if (opts.requireSolved && !solved) {
    throw new Error(
      `missing solved for Q${n}: _solved.json could not be read (answer/explanation required)`
    );
  }

  return solved ? { ...extracted, ...solved } : extracted;
}

async function tryReadJson(filePath: string): Promise<ExamDataProblem | null> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as ExamDataProblem;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// aggregateVerifiedProblems — Phase 3
// ──────────────────────────────────────────────

/**
 * Result of aggregating verified problems into exam_data.json.
 */
export interface AggregateResult {
  examDataPath: string;
  totalQuestions: number;
  includedQuestions: number;
  skippedQuestions: Array<{ number: number; reason: string }>;
}

/**
 * Aggregate per-question cache files into `exam_data.json` with partial-skip policy.
 *
 * Codifies SKILL.md Step 5-1 "JSON 취합":
 * - Merge: { ...extracted, ...solved }. _verified.json is gating-only and never merged.
 * - A question is INCLUDED only when its _extracted.json exists; _solved.json is
 *   strongly preferred (carries answer/explanation), but extracted-only problems
 *   are still surfaced so the caller can see partial progress.
 * - Problems whose _extracted.json is missing are reported in `skippedQuestions`
 *   rather than throwing.
 * - If ALL questions are skipped, throws `AggregateError`.
 *
 * For orchestrator-level usage where strict counting is required:
 * use `buildExamDataJson` (which throws on any missing question).
 *
 * @param cache          - StageCache for path resolution and writing exam_data.json.
 * @param totalQuestions - All question numbers in this exam (determines `totalQuestions` in result).
 * @param meta           - Exam metadata for the `info` key.
 */
export async function aggregateVerifiedProblems(
  cache: StageCache,
  totalQuestions: number[],
  meta: ExamMetaInput,
): Promise<AggregateResult> {
  const problems: ExamDataProblem[] = [];
  const skippedQuestions: Array<{ number: number; reason: string }> = [];

  for (const n of totalQuestions) {
    try {
      const problem = await mergeQuestionSources(cache, n, { requireSolved: false });
      problems.push(problem);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skippedQuestions.push({ number: n, reason });
    }
  }

  if (problems.length === 0) {
    throw new AggregateError(
      skippedQuestions.map((s) => new Error(s.reason)),
      `aggregateVerifiedProblems: no problems could be read (${totalQuestions.length} total, all skipped)`
    );
  }

  const output: ExamDataOutput = {
    info: normalizeMeta(meta),
    problems,
  };

  const examDataPath = cache.paths.examData;
  await writeFile(examDataPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  return {
    examDataPath,
    totalQuestions: totalQuestions.length,
    includedQuestions: problems.length,
    skippedQuestions,
  };
}
