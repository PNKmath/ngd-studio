import { NextRequest } from "next/server";
import { runClaude, transformToSSE, type SSEEvent } from "@/lib/claude";
import { readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { shouldUseCodeOrchestrator } from "@/server/stages/branchHelper";
import { runStageOrchestrator } from "@/server/stages/orchestrator";
import { normalizeStageOverrides, type StageOverrideMap } from "@/lib/ai/settings";

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

    const job = JSON.parse(await readFile(jobFile, "utf-8"));

    // Determine routing: resume command + code orchestrator → orchestrator path
    const isResumeCommand = /^\s*resume\b/.test(instruction.trim());
    const stageOverrides: StageOverrideMap = normalizeStageOverrides(
      job.stageOverrides ?? {}
    );
    const jobMode: string = job.mode ?? "create";
    const useCodeOrchestrator =
      isResumeCommand && shouldUseCodeOrchestrator(jobMode, stageOverrides);

    // Update job status + record followup
    job.status = "running";
    job.followups = job.followups ?? [];
    job.followups.push({
      instruction,
      startedAt: new Date().toISOString(),
    });
    await writeFile(jobFile, JSON.stringify(job, null, 2));

    if (useCodeOrchestrator) {
      const { resumeFrom, targetQuestions } = parseResumeArgs(instruction);

      // Build question image list.
      // If --q was given, use only those numbers; otherwise derive from cache
      // (orchestrator will auto-detect via resumeState).
      // We always produce paths for all known question images from the cache dir
      // so the orchestrator can look them up. targetQuestions is passed as
      // resumeFrom so the orchestrator filters per-question stages itself.
      const questionImagesDir = path.join(
        BASE_DIR,
        "inputs",
        "시험지 제작",
        "question_images"
      );

      // Collect question numbers: prefer --q list, else scan directory
      let questionNumbers: number[] = targetQuestions ?? [];
      if (questionNumbers.length === 0) {
        // Try to infer from the cache dir (same pattern as sse.ts / original create flow)
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

      const meta = (job.meta as Record<string, unknown> | undefined) ?? {};
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const send = (sseEvent: SSEEvent) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`)
            );
          };

          send({
            event: "log",
            data: {
              stage: "system",
              message: `resume 명령 감지 → orchestrator 라우팅 (from=${resumeFrom}${targetQuestions ? `, q=[${targetQuestions.join(",")}]` : ""})`,
              timestamp: new Date().toISOString(),
              level: "info",
            },
          });

          try {
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

            // Persist final status
            try {
              job.status = orchResult.status === "done" ? "done" : "failed";
              const lastFollowup = job.followups[job.followups.length - 1];
              if (lastFollowup) lastFollowup.finishedAt = new Date().toISOString();
              if (orchResult.outputFile)
                job.outputFile = orchResult.outputFile;
              if (orchResult.resultSummary)
                job.resultSummary = orchResult.resultSummary;
              if (orchResult.providerTelemetry?.length) {
                job.providerTelemetry = [
                  ...(job.providerTelemetry ?? []),
                  ...orchResult.providerTelemetry,
                ];
              }
              await writeFile(jobFile, JSON.stringify(job, null, 2));
            } catch {
              // ignore persistence errors
            }
          } catch (err) {
            send({
              event: "error",
              data: {
                message: err instanceof Error ? err.message : "Orchestrator error",
              },
            });
            try {
              job.status = "failed";
              const lastFollowup = job.followups[job.followups.length - 1];
              if (lastFollowup) lastFollowup.finishedAt = new Date().toISOString();
              await writeFile(jobFile, JSON.stringify(job, null, 2));
            } catch {
              // ignore
            }
          } finally {
            controller.close();
          }
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

    const nonEmptyInputs = (job.inputFiles ?? []).filter(
      (f: unknown): f is string => typeof f === "string" && f.trim().length > 0
    );

    const promptLines: string[] = [
      `이전 작업(${job.mode === "create" ? "시험지 제작" : "오검"})의 결과를 수정해줘.`,
    ];
    if (nonEmptyInputs.length > 0) {
      promptLines.push(`입력 파일: ${nonEmptyInputs.join(", ")}`);
    } else {
      promptLines.push(
        `작업 폴더: 현재 cwd의 \`inputs/시험지 제작/.v3cache/\` 캐시와 \`inputs/시험지 제작/question_images/\`를 사용해서 어떤 작업인지 자동 판별해.`
      );
    }
    promptLines.push(``, `추가 지시:`, instruction);
    if (isResumeCommand) {
      promptLines.push(``, `Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`);
    }
    const prompt = promptLines.join("\n");

    // Spawn Claude CLI
    const { process: proc, events } = runClaude(prompt, {
      cwd: BASE_DIR,
      maxTurns: 30,
    });

    const currentStage = { name: job.mode === "review" ? "reviewer" : "builder" };
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (sseEvent: SSEEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`)
          );
        };

        send({
          event: "stage",
          data: { name: currentStage.name, status: "running" },
        });
        send({
          event: "log",
          data: {
            stage: "system",
            message: `추가 지시: ${instruction}`,
            timestamp: new Date().toISOString(),
            level: "info",
          },
        });

        try {
          for await (const event of events) {
            const sseEvents = transformToSSE(event, currentStage);
            for (const sse of sseEvents) {
              send(sse);
            }
          }

          await new Promise<void>((resolve) => {
            proc.on("close", () => resolve());
          });
        } catch (err) {
          send({
            event: "error",
            data: {
              message: err instanceof Error ? err.message : "Unknown error",
            },
          });
        } finally {
          try {
            job.status = "done";
            const lastFollowup = job.followups[job.followups.length - 1];
            if (lastFollowup) lastFollowup.finishedAt = new Date().toISOString();
            await writeFile(jobFile, JSON.stringify(job, null, 2));
          } catch {
            // ignore
          }
          controller.close();
        }
      },
      cancel() {
        proc.kill("SIGTERM");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Followup failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
