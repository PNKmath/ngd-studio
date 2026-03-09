import { NextRequest } from "next/server";
import { Readable, PassThrough } from "stream";
import { runClaude, transformToSSE, type SSEEvent } from "@/lib/claude";
import { buildCreatePrompt, buildReviewPrompt } from "@/lib/prompts";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data/jobs");
const BASE_DIR = path.resolve(process.cwd(), "..");
const HWPX_TEMPLATE = process.env.HWPX_TEMPLATE_PATH ?? "";

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

    // For create mode, use fixed template path from env
    const resolvedFiles = {
      pdf: files.pdf,
      hwpx: files.hwpx ?? HWPX_TEMPLATE,
    };

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
    const { process: proc, events, exitCode } = runClaude(prompt, {
      cwd: BASE_DIR,
      maxTurns: mode === "create" ? 100 : 50,
    });

    const currentStage = { name: "" };

    // Use Node.js PassThrough stream — avoids Next.js buffering of Web Streams
    const passthrough = new PassThrough();

    const send = (sseEvent: SSEEvent) => {
      passthrough.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
    };

    // Kill CLI process if client disconnects
    req.signal.addEventListener("abort", () => {
      proc.kill("SIGTERM");
      passthrough.end();
    });

    // Process events in background — don't block the response
    (async () => {
      try {
        for await (const event of events) {
          const sseEvents = transformToSSE(event, currentStage);
          for (const sse of sseEvents) {
            send(sse);
          }
        }

        // Process exited — check exit code
        const code = await exitCode;

        if (code !== 0 && !currentStage.name) {
          send({
            event: "error",
            data: { message: `Claude CLI exited with code ${code}` },
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
        passthrough.end();
      }
    })();

    // Convert Node stream to Web ReadableStream and return immediately
    const webStream = Readable.toWeb(passthrough) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
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
