/**
 * Standalone SSE server for Claude CLI streaming.
 * Runs on a separate port to bypass Next.js response buffering.
 *
 * Usage: pnpm tsx server/sse.ts
 */
import http from "http";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Import from relative paths (tsx doesn't support @/ alias)
import { runClaude, transformToSSE, type SSEEvent } from "../lib/claude";
import { buildCreatePrompt, buildReviewPrompt } from "../lib/prompts";

const PORT = parseInt(process.env.SSE_PORT ?? "3021", 10);
const __server_dir = path.dirname(new URL(import.meta.url).pathname);
const BASE_DIR = path.resolve(__server_dir, "../..");
const DATA_DIR = path.join(__server_dir, "../data/jobs");
const HWPX_TEMPLATE = process.env.HWPX_TEMPLATE_PATH ?? "";

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("Request handler error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
});

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // CORS for Next.js dev server
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/run") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Parse request body (use event-based reading, not for-await)
  const rawBody = await new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
  });

  let body: { mode: string; files: { pdf: string; hwpx?: string }; jobId: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const { mode, files, jobId } = body;

  if (!mode || !files?.pdf || !jobId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing required fields" }));
    return;
  }

  if (mode === "review" && !files.hwpx) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "오검 모드에는 HWPX 파일이 필요합니다." }));
    return;
  }

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

  // SSE headers — sent immediately, no buffering
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Flush headers right away
  res.flushHeaders();

  const send = (sseEvent: SSEEvent) => {
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
    }
  };

  // Spawn Claude CLI
  const { process: proc, events, exitCode } = runClaude(prompt, {
    cwd: BASE_DIR,
    maxTurns: mode === "create" ? 100 : 50,
  });

  // Kill on client disconnect
  req.on("close", () => {
    proc.kill("SIGTERM");
  });

  const currentStage = { name: "" };

  try {
    for await (const event of events) {
      if (res.destroyed) break;
      const sseEvents = transformToSSE(event, currentStage);
      for (const sse of sseEvents) {
        send(sse);
      }
    }

    const code = await exitCode;
    if (code !== 0 && !currentStage.name) {
      send({ event: "error", data: { message: `Claude CLI exited with code ${code}` } });
    }
  } catch (err) {
    send({
      event: "error",
      data: { message: err instanceof Error ? err.message : "Unknown error" },
    });
  } finally {
    try {
      await writeFile(
        path.join(DATA_DIR, `${jobId}.json`),
        JSON.stringify({ ...jobData, status: "done", finishedAt: new Date().toISOString() }, null, 2)
      );
    } catch { /* ignore */ }
    res.end();
  }
}

server.listen(PORT, () => {
  console.log(`SSE server listening on http://localhost:${PORT}`);
});
