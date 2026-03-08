import { NextRequest } from "next/server";
import { runClaude, transformToSSE, type SSEEvent } from "@/lib/claude";
import { buildCreatePrompt, buildReviewPrompt } from "@/lib/prompts";
import { writeFile, mkdir, readdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data/jobs");
const BASE_DIR = path.resolve(process.cwd(), "..");

async function findHwpxTemplate(): Promise<string | null> {
  const dir = path.join(BASE_DIR, "inputs/시험지 제작");
  try {
    const entries = await readdir(dir);
    const hwpx = entries.find((f) => f.toLowerCase().endsWith(".hwpx"));
    if (hwpx) return `inputs/시험지 제작/${hwpx}`;
    const hwp = entries.find((f) => f.toLowerCase().endsWith(".hwp"));
    if (hwp) return `inputs/시험지 제작/${hwp}`;
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, files, jobId } = body as {
      mode: "create" | "review";
      files: { pdf: string; hwpx?: string };
      jobId: string;
    };

    if (!mode || !files?.pdf || !jobId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For review mode, hwpx is required
    if (mode === "review" && !files.hwpx) {
      return new Response(JSON.stringify({ error: "오검 모드에는 HWPX 파일이 필요합니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For create mode, auto-detect hwpx template if not provided
    let resolvedFiles = { pdf: files.pdf, hwpx: files.hwpx ?? "" };
    if (mode === "create" && !files.hwpx) {
      const template = await findHwpxTemplate();
      if (!template) {
        return new Response(
          JSON.stringify({ error: "양식 HWPX 파일을 inputs/시험지 제작/ 폴더에서 찾을 수 없습니다." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      resolvedFiles.hwpx = template;
    }

    const prompt =
      mode === "create"
        ? buildCreatePrompt(resolvedFiles)
        : buildReviewPrompt(resolvedFiles as { pdf: string; hwpx: string });

    // Save initial job data
    await mkdir(DATA_DIR, { recursive: true });
    const jobData = {
      id: jobId,
      mode,
      status: "running",
      inputFiles: [resolvedFiles.pdf, resolvedFiles.hwpx],
      stages: [],
      logs: [],
      startedAt: new Date().toISOString(),
    };
    await writeFile(
      path.join(DATA_DIR, `${jobId}.json`),
      JSON.stringify(jobData, null, 2)
    );

    // Spawn Claude CLI
    const { process: proc, events } = runClaude(prompt, {
      cwd: BASE_DIR,
      maxTurns: mode === "create" ? 100 : 50,
    });

    const currentStage = { name: "" };
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (sseEvent: SSEEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`)
          );
        };

        try {
          for await (const event of events) {
            const sseEvents = transformToSSE(event, currentStage);
            for (const sse of sseEvents) {
              send(sse);
            }
          }

          // Process exited — check exit code
          const exitCode = await new Promise<number>((resolve) => {
            proc.on("close", (code) => resolve(code ?? 1));
          });

          if (exitCode !== 0 && !currentStage.name) {
            send({
              event: "error",
              data: { message: `Claude CLI exited with code ${exitCode}` },
            });
          }
        } catch (err) {
          send({
            event: "error",
            data: {
              message: err instanceof Error ? err.message : "Unknown error",
            },
          });
        } finally {
          // Update job file
          try {
            const finalJob = {
              ...jobData,
              status: "done",
              finishedAt: new Date().toISOString(),
            };
            await writeFile(
              path.join(DATA_DIR, `${jobId}.json`),
              JSON.stringify(finalJob, null, 2)
            );
          } catch {
            // ignore write errors on cleanup
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
    const message = err instanceof Error ? err.message : "Run failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
