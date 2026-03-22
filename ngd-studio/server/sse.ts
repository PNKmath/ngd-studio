/**
 * Standalone SSE server for Claude CLI streaming.
 * Runs on a separate port to bypass Next.js response buffering.
 *
 * Usage: pnpm tsx server/sse.ts
 */
import http from "http";
import { writeFile, mkdir, readdir, stat } from "fs/promises";
import path from "path";

// Import from relative paths (tsx doesn't support @/ alias)
import { runClaude, transformToSSE, toWslPath, fromWslPath, type SSEEvent } from "../lib/claude";
import { buildCreatePrompt, buildReviewPrompt } from "../lib/prompts";

const PORT = parseInt(process.env.SSE_PORT ?? "3021", 10);
// Windows에서 import.meta.url → file:///C:/... → pathname이 /C:/... 가 되므로 fileURLToPath 사용
import { fileURLToPath } from "url";
const __server_file = fileURLToPath(import.meta.url);
const __server_dir = path.dirname(__server_file);
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

  // Claude CLI는 WSL에서 실행되므로 파일 경로를 WSL 형식으로 변환
  // 상대경로는 cwd(BASE_DIR) 기준이므로 절대경로로 만든 뒤 변환
  const toAbsWsl = (p: string) => {
    const abs = path.isAbsolute(p) ? p : path.join(BASE_DIR, p);
    return toWslPath(abs);
  };
  const wslFiles = {
    pdf: toAbsWsl(resolvedFiles.pdf),
    hwpx: toAbsWsl(resolvedFiles.hwpx),
  };

  const prompt =
    mode === "create"
      ? buildCreatePrompt(wslFiles)
      : buildReviewPrompt(wslFiles);

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

  send({ event: "log", data: { stage: "system", message: "CLI 프로세스를 시작합니다...", timestamp: new Date().toISOString(), level: "info" } });

  // Spawn Claude CLI
  const { process: proc, events, exitCode } = runClaude(prompt, {
    cwd: BASE_DIR,
    maxTurns: mode === "create" ? 100 : 50,
  });

  send({ event: "log", data: { stage: "system", message: `CLI 프로세스 시작됨 (PID: ${proc.pid}). API 연결 대기중...`, timestamp: new Date().toISOString(), level: "info" } });

  // Kill on client disconnect
  let clientDisconnected = false;
  req.on("close", () => {
    clientDisconnected = true;
    proc.kill("SIGTERM");
  });

  // Forward stderr as log messages (auth errors, warnings, etc.)
  proc.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) {
      send({ event: "log", data: { stage: "system", message: `[stderr] ${msg.slice(0, 300)}`, timestamp: new Date().toISOString(), level: "warn" } });
    }
  });

  const currentStage = { name: "" };
  let outputFile = "";
  let resultSummary = "";
  let finalStatus: "done" | "failed" | "cancelled" = "done";
  let hadResultEvent = false;

  try {
    for await (const event of events) {
      if (res.destroyed) break;
      const sseEvents = transformToSSE(event, currentStage);
      for (const sse of sseEvents) {
        // hwpx 파일 이벤트에서 outputFile 추적
        // CLI(WSL)가 보낸 경로는 /mnt/c/... 형태일 수 있으므로 즉시 변환
        if (sse.event === "file" && sse.data.type === "hwpx") {
          outputFile = fromWslPath(sse.data.path as string);
        }
        // result 이벤트에서 요약 텍스트 및 상태 추적
        if (sse.event === "result") {
          hadResultEvent = true;
          resultSummary = (sse.data.result as string) ?? "";
          finalStatus = sse.data.status === "success" ? "done" : "failed";
          if (sse.data.outputPath) {
            outputFile = fromWslPath(sse.data.outputPath as string);
          }
        }
        if (sse.event === "error") {
          finalStatus = "failed";
        }
        send(sse);
      }
    }

    const code = await exitCode;
    if (code !== 0 && !currentStage.name) {
      send({ event: "error", data: { message: `Claude CLI exited with code ${code}` } });
      finalStatus = "failed";
    }

    // result 이벤트 없이 정상 종료 + 클라이언트 중단 → cancelled
    if (!hadResultEvent && clientDisconnected) {
      finalStatus = "cancelled";
    }
  } catch (err) {
    send({
      event: "error",
      data: { message: err instanceof Error ? err.message : "Unknown error" },
    });
    finalStatus = "failed";
  } finally {
    // outputFile이 없으면 폴백: 모드별로 결과 파일 탐색
    if (!outputFile) {
      try {
        if (mode === "create") {
          // 제작 모드: outputs/ 폴더에서 최신 .hwpx 스캔
          const outputsDir = path.join(BASE_DIR, "outputs");
          const dirFiles = await readdir(outputsDir);
          const hwpxFiles = dirFiles.filter((f) => f.endsWith(".hwpx"));
          if (hwpxFiles.length > 0) {
            let latest = { name: "", mtime: 0 };
            for (const f of hwpxFiles) {
              const s = await stat(path.join(outputsDir, f));
              if (s.mtimeMs > latest.mtime) {
                latest = { name: f, mtime: s.mtimeMs };
              }
            }
            const jobStart = new Date(jobData.startedAt).getTime();
            if (latest.mtime > jobStart) {
              outputFile = `outputs/${latest.name}`;
            }
          }
        } else if (mode === "review") {
          // 오검 모드: 입력 HWPX를 직접 수정하므로 입력 파일이 곧 결과물
          outputFile = resolvedFiles.hwpx;
        }
      } catch { /* 폴더가 없을 수 있음 */ }
    }

    // outputFile 경로를 상대경로로 정규화
    if (outputFile) {
      // WSL 경로(/mnt/c/...)가 올 수 있으므로 Windows 경로로 변환
      outputFile = fromWslPath(outputFile);
      // 절대경로면 BASE_DIR 기준 상대경로로 변환
      if (path.isAbsolute(outputFile)) {
        outputFile = path.relative(BASE_DIR, outputFile);
      }
      // outputPath를 프론트엔드에 전달
      send({ event: "file", data: { type: "hwpx", name: path.basename(outputFile), path: outputFile } });
    }

    try {
      await writeFile(
        path.join(DATA_DIR, `${jobId}.json`),
        JSON.stringify({
          ...jobData,
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          outputFile: outputFile || undefined,
          resultSummary: resultSummary || undefined,
        }, null, 2)
      );
    } catch { /* ignore */ }
    res.end();
  }
}

server.listen(PORT, () => {
  console.log(`SSE server listening on http://localhost:${PORT}`);
});
