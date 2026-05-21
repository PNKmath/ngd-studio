import { NextRequest } from "next/server";
import { type SSEEvent } from "@/lib/claude";
import { readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { runStageOrchestrator, type OrchestratorResult } from "@/server/stages/orchestrator";
import { normalizeStageOverrides, type StageOverrideMap } from "@/lib/ai/settings";
import { createStageCache } from "@/server/stages/cache";
import { cleanupFromStage } from "@/server/stages/cleanup";
import type { ResumeStage } from "@/server/stages/resumeCommand";

const RESUME_STAGES: readonly ResumeStage[] = [
  "extractor",
  "review_extract",
  "solver",
  "verifier",
  "figure",
  "confirm",
  "builder",
  "cleaned",
  "image_replace",
] as const;

function asResumeStage(s: string): ResumeStage | null {
  return (RESUME_STAGES as readonly string[]).includes(s) ? (s as ResumeStage) : null;
}

const DATA_DIR = path.join(process.cwd(), "data/jobs");
const BASE_DIR = path.resolve(process.cwd(), "..");

interface ResumeArgs {
  /** Stage to resume from (e.g. "figure", "builder") */
  resumeFrom: string;
  /** Specific question numbers to target (from --q=N or --q=N,M,...) */
  targetQuestions?: number[];
}

/**
 * Parse a resume-style instruction string:
 *   "resume --from=figure"
 *   "resume --q=5 --from=solver"
 *   "resume --q=5,6,7 --from=extractor"
 *
 * If `--from` is absent, defaults to "extractor".
 */
function parseResumeArgs(instruction: string): ResumeArgs {
  const fromMatch = /--from=(\S+)/.exec(instruction);
  const resumeFrom = fromMatch?.[1] ?? "extractor";

  const qMatch = /--q=([\d,]+)/.exec(instruction);
  let targetQuestions: number[] | undefined;
  if (qMatch?.[1]) {
    targetQuestions = qMatch[1]
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (targetQuestions.length === 0) targetQuestions = undefined;
  }

  return { resumeFrom, targetQuestions };
}

/** Persist orchResult back to the job file, swallowing write errors. */
async function persistResult(
  jobFile: string,
  job: Record<string, unknown>,
  orchResult: OrchestratorResult
): Promise<void> {
  try {
    job.status = orchResult.status === "done" ? "done" : "failed";
    const followups = job.followups as Array<Record<string, unknown>> | undefined;
    const lastFollowup = followups?.[followups.length - 1];
    if (lastFollowup) lastFollowup.finishedAt = new Date().toISOString();
    if (orchResult.outputFile) job.outputFile = orchResult.outputFile;
    if (orchResult.resultSummary) job.resultSummary = orchResult.resultSummary;
    if (orchResult.providerTelemetry?.length) {
      job.providerTelemetry = [
        ...((job.providerTelemetry as unknown[]) ?? []),
        ...orchResult.providerTelemetry,
      ];
    }
    await writeFile(jobFile, JSON.stringify(job, null, 2));
  } catch {
    // ignore persistence errors
  }
}

/** Mark job as failed and stamp finishedAt, swallowing write errors. */
async function persistFailure(
  jobFile: string,
  job: Record<string, unknown>
): Promise<void> {
  try {
    job.status = "failed";
    const followups = job.followups as Array<Record<string, unknown>> | undefined;
    const lastFollowup = followups?.[followups.length - 1];
    if (lastFollowup) lastFollowup.finishedAt = new Date().toISOString();
    await writeFile(jobFile, JSON.stringify(job, null, 2));
  } catch {
    // ignore
  }
}

/** Wrap an async SSE producer into a streaming Response. */
function sseResponse(
  producer: (send: (e: SSEEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (sseEvent: SSEEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`)
        );
      };
      await producer(send);
      controller.close();
    },
    cancel() {},
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { instruction } = (await req.json()) as { instruction: string };

    if (!instruction?.trim()) {
      return new Response(JSON.stringify({ error: "No instruction" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load existing job
    const jobFile = path.join(DATA_DIR, `${jobId}.json`);
    if (!existsSync(jobFile)) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const job = JSON.parse(await readFile(jobFile, "utf-8")) as Record<string, unknown>;

    const stageOverrides: StageOverrideMap = normalizeStageOverrides(
      (job.stageOverrides as Record<string, unknown>) ?? {}
    );
    const jobMode: string = (job.mode as string) ?? "create";

    // Update job status + record followup
    job.status = "running";
    job.followups = (job.followups as unknown[]) ?? [];
    (job.followups as unknown[]).push({
      instruction,
      startedAt: new Date().toISOString(),
    });
    await writeFile(jobFile, JSON.stringify(job, null, 2));

    const meta = (job.meta as Record<string, unknown>) ?? {};

    // ── review mode ─────────────────────────────────────────────────────────
    if (jobMode === "review") {
      const hwpxPath: string | undefined =
        (job.outputFile as string | undefined) ??
        ((job.inputFiles as unknown[] | undefined) ?? []).find(
          (f): f is string => typeof f === "string" && f.toLowerCase().endsWith(".hwpx")
        );

      return sseResponse(async (send) => {
        send({
          event: "log",
          data: {
            stage: "system",
            message: `review followup → orchestrator 라우팅 (additionalInstruction 전달)`,
            timestamp: new Date().toISOString(),
            level: "info",
          },
        });

        try {
          const orchResult = await runStageOrchestrator({
            mode: "review",
            hwpxPath,
            additionalInstruction: instruction,
            meta,
            questionImages: [],
            stageOverrides,
            baseDir: BASE_DIR,
            send,
            isAborted: () => false,
          });
          await persistResult(jobFile, job, orchResult);
        } catch (err) {
          send({
            event: "error",
            data: {
              message: err instanceof Error ? err.message : "Orchestrator error",
            },
          });
          await persistFailure(jobFile, job);
        }
      });
    }

    // ── create / resume mode ─────────────────────────────────────────────────
    const isResumeCommand = /^\s*resume\b/.test(instruction.trim());
    const { resumeFrom, targetQuestions } = isResumeCommand
      ? parseResumeArgs(instruction)
      : { resumeFrom: "extractor", targetQuestions: undefined };

    const questionImagesDir = path.join(
      BASE_DIR,
      "inputs",
      "시험지 제작",
      "question_images"
    );

    // Collect question numbers: prefer --q list, else scan directory
    let questionNumbers: number[] = targetQuestions ?? [];
    if (questionNumbers.length === 0) {
      try {
        const files = await readdir(questionImagesDir);
        questionNumbers = files
          .map((f) => {
            const m = /^q(\d{2})\.png$/.exec(f);
            return m ? parseInt(m[1], 10) : NaN;
          })
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
      } catch {
        // question_images dir may not exist yet — orchestrator will handle gracefully
      }
    }

    // If still empty, fall back to a sensible default so orchestrator can proceed
    if (questionNumbers.length === 0) {
      questionNumbers = Array.from({ length: 20 }, (_, i) => i + 1);
    }

    const questionImages = questionNumbers.map((num) => {
      const padded = String(num).padStart(2, "0");
      return {
        number: num,
        path: path.join(questionImagesDir, `q${padded}.png`),
      };
    });

    return sseResponse(async (send) => {
      send({
        event: "log",
        data: {
          stage: "system",
          message: isResumeCommand
            ? `resume 명령 감지 → orchestrator 라우팅 (from=${resumeFrom}${targetQuestions ? `, q=[${targetQuestions.join(",")}]` : ""})`
            : `자유 텍스트 followup → orchestrator resume 라우팅 (from=extractor): ${instruction}`,
          timestamp: new Date().toISOString(),
          level: "info",
        },
      });

      try {
        if (isResumeCommand) {
          const stage = asResumeStage(resumeFrom);
          if (stage) {
            const cache = createStageCache(BASE_DIR);
            const result = await cleanupFromStage(cache, questionNumbers, stage);
            const deletedCount = result.deleted.length;
            if (deletedCount > 0) {
              send({
                event: "log",
                data: {
                  stage: "system",
                  message: `resume cleanup: ${stage} 기준 캐시 ${deletedCount}개 삭제`,
                  timestamp: new Date().toISOString(),
                  level: "info",
                },
              });
            }
          }
        }
        const orchResult = await runStageOrchestrator({
          mode: "resume",
          resumeFrom,
          meta,
          questionImages,
          stageOverrides,
          baseDir: BASE_DIR,
          send,
          isAborted: () => false,
        });
        await persistResult(jobFile, job, orchResult);
      } catch (err) {
        send({
          event: "error",
          data: {
            message: err instanceof Error ? err.message : "Orchestrator error",
          },
        });
        await persistFailure(jobFile, job);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Followup failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
