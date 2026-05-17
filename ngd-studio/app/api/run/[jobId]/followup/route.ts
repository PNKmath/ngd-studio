import { NextRequest } from "next/server";
import { runClaude, transformToSSE, type SSEEvent } from "@/lib/claude";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const DATA_DIR = path.join(process.cwd(), "data/jobs");
const BASE_DIR = path.resolve(process.cwd(), "..");

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

    // Build followup prompt with context.
    // resume/v3cache 흐름은 inputFiles가 비어 있을 수 있으므로 빈 경로는 노출하지 않고
    // 작업 폴더 힌트로 대체한다. resume 명령류는 스킬을 명시 호출해 일반 응답 분기를 막는다.
    const isResumeLike = /^\s*resume\b/.test(instruction.trim());
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
    if (isResumeLike) {
      promptLines.push(``, `Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`);
    }
    const prompt = promptLines.join("\n");

    // Update job status
    job.status = "running";
    job.followups = job.followups ?? [];
    job.followups.push({
      instruction,
      startedAt: new Date().toISOString(),
    });
    await writeFile(jobFile, JSON.stringify(job, null, 2));

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
