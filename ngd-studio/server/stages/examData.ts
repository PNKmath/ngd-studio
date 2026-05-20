import { readFile, writeFile } from "fs/promises";
import type { StageCache } from "./cache";

/**
 * Exam metadata matching the `info` key in exam_data.json.
 * Field names match build_hwpx.py / figure_processor.py consumption.
 */
export interface ExamMetaInput {
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
 * Priority: verified (_verified.json) > solved (_solved.json) > extracted (q{N}.json)
 * Throws if any requested question number cannot be read from any source.
 */
export async function buildExamDataJson(input: {
  cache: StageCache;
  meta: ExamMetaInput;
  questionNumbers: number[];
}): Promise<ExamDataOutput> {
  const { cache, meta, questionNumbers } = input;
  const problems: ExamDataProblem[] = [];

  for (const n of questionNumbers) {
    const problem = await readQuestionWithFallback(cache, n);
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
  let filenameBase = meta.filename_base;
  if (!filenameBase) {
    const parts = [meta.code, "고", year, semester, meta.region, meta.school, subject, meta.code]
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
  };
}

/**
 * Read the best available JSON for question number `n`.
 * Priority: verified > solved > extracted
 */
async function readQuestionWithFallback(
  cache: StageCache,
  n: number
): Promise<ExamDataProblem> {
  const candidates: Array<{ label: string; path: string }> = [
    { label: "verified", path: cache.verifierResultPath(n) },
    { label: "solved", path: cache.solverResultPath(n) },
    { label: "extracted", path: cache.questionJsonPath(n) },
  ];

  for (const { path } of candidates) {
    const content = await tryReadJson(path);
    if (content !== null) {
      return content;
    }
  }

  throw new Error(
    `missing extracted/solved/verified for Q${n}: none of the cache files could be read`
  );
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
 * Aggregate all per-question verified JSON files into `exam_data.json`.
 *
 * Codifies SKILL.md Step 5-1 "JSON 취합":
 * - Priority: verified (_verified.json) > solved (_solved.json) > extracted (q{N}.json)
 * - If a question is present in `totalQuestions` but cannot be read from any
 *   source, it is added to `skippedQuestions` (rather than throwing).
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
      const problem = await readQuestionWithFallback(cache, n);
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
