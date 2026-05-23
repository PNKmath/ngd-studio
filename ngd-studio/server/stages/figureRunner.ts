/**
 * figureRunner.ts — Phase 4
 *
 * TS runner that spawns figure_processor.py as a single deterministic entrypoint.
 * Parses the resulting figure_status.json and surfaces boundary_uncertain questions.
 *
 * Normal path (all boundary_uncertain=false): no agent call required.
 * Only when needsAgentReview.length > 0 should the caller dispatch ngd-exam-figure agent.
 */

import path from "path";
import { readFile } from "fs/promises";
import type { ImageProviderId } from "@/lib/ai/settings";
import { runStageCommand } from "./commands";

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

export interface FigureRunnerInput {
  /** Absolute path to exam_data.json */
  examDataPath: string;
  /** Absolute path to the output directory for final images */
  outputDir: string;
  /** Absolute path where figure_status.json will be written */
  statusOutPath: string;
  /** false → --no-regen: crop+watermark only, skip Gemini */
  regenerate: boolean;
  /** 이미지 재생성 provider. regenerate=false면 사용하지 않음. */
  imageProvider?: ImageProviderId;
  /** Optional: reprocess only this question number */
  questionNumber?: number;
  /** Directory containing figure_processor.py (defaults to process.cwd()) */
  baseDir?: string;
  /** Optional AbortSignal (unused currently — reserved for future cancellation) */
  signal?: AbortSignal;
  /**
   * Optional environment variables to merge into the spawned process env.
   * Used by the orchestrator to inject GEMINI_API_KEY from runtimeEnv.
   */
  env?: NodeJS.ProcessEnv;
}

export interface FigureRunnerOutput {
  status: "done" | "partial" | "failed";
  /** Absolute path of the written figure_status.json */
  statusJsonPath: string;
  /** Question numbers where boundary_uncertain=true (require agent review) */
  needsAgentReview: number[];
}

// ──────────────────────────────────────────────
// figure_status.json schema (emitted by figure_processor.py)
// ──────────────────────────────────────────────

interface FigureQuestionStatus {
  status: "ok" | "boundary_uncertain" | "failed";
  image?: string;           // legacy (backward compat)
  finalImage?: string;      // 정본 키 (camelCase, P3+)
  boundary_uncertain?: boolean;  // legacy (backward compat)
  boundaryUncertain?: boolean;   // camelCase (P3+)
  crop_attempts?: number;        // legacy (backward compat)
  cropAttempts?: number;         // camelCase (P3+)
  needs_agent_review?: boolean;  // legacy (backward compat)
  needsAgentReview?: boolean;    // camelCase (P3+)
  error?: string;
}

interface FigureStatusJson {
  status: "done" | "partial" | "failed";
  questions: Record<string, FigureQuestionStatus>;
}

// ──────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────

/**
 * Spawns figure_processor.py and parses the resulting figure_status.json.
 *
 * Normal path (all boundary_uncertain=false) resolves without requiring agent calls.
 * Callers must check `needsAgentReview` and conditionally dispatch ngd-exam-figure agent.
 */
export async function runFigureStage(
  input: FigureRunnerInput
): Promise<FigureRunnerOutput> {
  const baseDir = input.baseDir ?? process.cwd();
  const python = process.platform === "win32" ? "python" : "python3";
  const scriptPath = path.join(baseDir, "figure_processor.py");

  const args: string[] = [
    scriptPath,
    "--exam-data",
    input.examDataPath,
    "--output-dir",
    input.outputDir,
    "--status-out",
    input.statusOutPath,
  ];

  if (!input.regenerate) {
    args.push("--no-regen");
  }

  if (input.regenerate && input.imageProvider) {
    args.push("--image-provider", input.imageProvider);
  }

  if (input.questionNumber !== undefined) {
    args.push("--question", String(input.questionNumber));
  }

  const result = await runStageCommand({
    command: python,
    args,
    cwd: baseDir,
    timeoutMs: 300_000, // 5 minutes for Gemini generation
    ...(input.env ? { env: input.env } : {}),
  });

  if (result.status !== "success") {
    return {
      status: "failed",
      statusJsonPath: input.statusOutPath,
      needsAgentReview: [],
    };
  }

  // Parse the emitted status JSON
  const parsed = await parseFigureStatusJson(input.statusOutPath);
  const needsAgentReview = extractNeedsAgentReview(parsed);

  return {
    status: parsed.status,
    statusJsonPath: input.statusOutPath,
    needsAgentReview,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function parseFigureStatusJson(
  statusPath: string
): Promise<FigureStatusJson> {
  try {
    const text = await readFile(statusPath, "utf8");
    return JSON.parse(text) as FigureStatusJson;
  } catch {
    // Return a minimal failed status if the file cannot be read/parsed
    return { status: "failed", questions: {} };
  }
}

function extractNeedsAgentReview(parsed: FigureStatusJson): number[] {
  const result: number[] = [];
  for (const [key, q] of Object.entries(parsed.questions)) {
    if (
      q.needsAgentReview === true ||  // camelCase (P3+)
      q.needs_agent_review === true || // legacy
      q.status === "boundary_uncertain"
    ) {
      const n = Number(key);
      if (!Number.isNaN(n)) result.push(n);
    }
  }
  return result.sort((a, b) => a - b);
}
