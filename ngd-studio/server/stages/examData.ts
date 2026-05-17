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
    info: meta,
    problems,
  };

  await writeFile(
    cache.paths.examData,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  return output;
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
