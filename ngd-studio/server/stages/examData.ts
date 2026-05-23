import { readFile, writeFile } from "fs/promises";
import type { StageCache } from "./cache";
import type { ExamMetaInput } from "@/lib/exam/meta";

/**
 * Per-question cache merge contract (verifier = solver reviewer).
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
 *                     — reviewer ledger. NEVER contains answer/explanation_parts or
 *                       problem-definition fields, so MUST NOT participate in
 *                       problem-body merge. Used by orchestrator to seed solver
 *                       feedback rounds.
 *
 * The canonical merged problem = { ...extracted, ...solved }.
 * build_hwpx.py / assemble.py expect this shape (e.g. prob["type"], prob["parts"]).
 */

/**
 * A single problem entry in the combined exam_data.json.
 * The shape is determined by the extractor/solver/verifier JSON output.
 */
export type ExamDataProblem = Record<string, unknown>;

/**
 * Top-level shape of exam_data.json.
 * Uses `info` key for compatibility with figure_processor.py and build_hwpx.py.
 * `info` is typed as Record<string, unknown> to accommodate the dual-emit
 * snake_case keys that P2 will remove (exam_type, school_level, filename_base).
 */
export interface ExamDataOutput {
  info: ExamMetaInput & Record<string, unknown>;
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

function normalizeMeta(meta: ExamMetaInput): ExamMetaInput & Record<string, unknown> {
  // NOTE: body preserved for P2 cleanup. snake_case fields (exam_type, school_level,
  // filename_base) are accessed via cast — P2 will remove dual emit once all consumers
  // are migrated to camelCase.
  const m = meta as Record<string, unknown>;
  const examType = (m.exam_type as string | undefined) ?? meta.examType ?? "";
  const year = typeof meta.year === "number" ? meta.year : new Date().getFullYear();
  const semester = meta.semester ?? "";
  const subject = meta.subject ?? "";
  const schoolLevel: "중" | "고" = meta.schoolLevel ?? (m.school_level as "중" | "고" | undefined) ?? "고"; // default "고" for legacy
  let filenameBase = m.filename_base as string | undefined;
  if (!filenameBase) {
    const parts = [meta.code, schoolLevel, year, semester, meta.region, meta.school, subject, meta.code]
      .filter((v) => v !== undefined && v !== "")
      .map((v) => `[${v}]`)
      .join("");
    filenameBase = parts.length > 0 ? parts : `exam_${year}`;
  }
  // P2 will remove snake_case dual-emit; cast needed until then.
  return {
    ...meta,
    examType,
    year,
    schoolLevel,
    // snake_case keys for Python consumption — P2 will remove these:
    exam_type: examType,
    filename_base: filenameBase,
    school_level: schoolLevel,
  } as ExamMetaInput & Record<string, unknown>;
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

  const merged = solved ? { ...extracted, ...solved } : extracted;
  return normalizeProblem(merged);
}

/**
 * Strip leading circled-number prefix (①②③④⑤) from choice entries.
 *
 * Contract: assemble.py's make_choices_xml prepends CHOICE_SYMBOLS[i] itself,
 * so choices coming into the builder must NOT carry their own prefix. The
 * extractor sometimes emits `[{"t": "① "}, {"eq": "-20"}]` despite the
 * contract; if left as-is, two failures cascade:
 *   1) is_short_choice() returns False (presence of any `t` part), forcing
 *      eq-only choices into the 5-row layout instead of 3+2;
 *   2) builder prepends "①" and then emits the extractor's "① " — duplicate
 *      circled number ("① ①" before the value).
 * Both symptoms vanish once the leading prefix is stripped here.
 */
const CHOICE_PREFIX_RE = /^[①②③④⑤]\s*/;

function normalizeProblem(problem: ExamDataProblem): ExamDataProblem {
  if (!problem || typeof problem !== "object") return problem;
  const raw = (problem as { choices?: unknown }).choices;
  if (!Array.isArray(raw)) return problem;
  const normalized = raw.map(stripChoicePrefix);
  return { ...problem, choices: normalized };
}

function stripChoicePrefix(choice: unknown): unknown {
  if (!Array.isArray(choice) || choice.length === 0) return choice;
  const first = choice[0];
  if (!first || typeof first !== "object" || !("t" in first)) return choice;
  const t = (first as { t: unknown }).t;
  if (typeof t !== "string" || !CHOICE_PREFIX_RE.test(t)) return choice;
  const stripped = t.replace(CHOICE_PREFIX_RE, "");
  if (stripped.length === 0) return choice.slice(1);
  return [{ ...(first as Record<string, unknown>), t: stripped }, ...choice.slice(1)];
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
