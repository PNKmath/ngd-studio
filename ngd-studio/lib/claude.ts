import { spawn, type ChildProcess } from "child_process";

// --- Types ---

export interface ClaudeEvent {
  type: "system" | "assistant" | "result";
  subtype?: string;
  message?: {
    role: string;
    content: ContentBlock[];
  };
  result?: string;
  session_id?: string;
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface SSEEvent {
  event: "stage" | "log" | "progress" | "file" | "result" | "error";
  data: Record<string, unknown>;
}

// --- Stage Detection ---

const stagePatterns: { name: string; patterns: RegExp[] }[] = [
  { name: "reader",  patterns: [/reader/i, /PDF.*읽/i, /추출/i, /exam_data/i] },
  { name: "solver",  patterns: [/solver/i, /해설/i, /풀이/i, /보완/i] },
  { name: "figure",  patterns: [/figure/i, /그림/i, /이미지/i, /crop/i, /nano-banana/i, /워터마크/i] },
  { name: "builder", patterns: [/builder/i, /HWPX/i, /조립/i, /XML/i, /section0/i] },
  { name: "checker", patterns: [/checker/i, /검수/i, /검증/i, /품질/i] },
];

export function detectStage(text: string): string | null {
  for (const { name, patterns } of stagePatterns) {
    if (patterns.some((p) => p.test(text))) return name;
  }
  return null;
}

// --- Tool-based stage detection ---

export function detectStageFromTool(toolName: string, input?: Record<string, unknown>): string | null {
  const filePath = (input?.file_path ?? input?.command ?? "") as string;

  if (toolName === "Read" && /\.pdf/i.test(filePath)) return "reader";
  if (toolName === "Write" && /exam_data.*\.json/i.test(filePath)) return "reader";
  if (toolName === "Agent") {
    const prompt = (input?.prompt ?? "") as string;
    if (/figure|그림/i.test(prompt)) return "figure";
    if (/solver|해설/i.test(prompt)) return "solver";
    if (/builder|HWPX/i.test(prompt)) return "builder";
    if (/checker|검수/i.test(prompt)) return "checker";
  }
  if (toolName === "Write" && /\.hwpx|section0|content\.hpf/i.test(filePath)) return "builder";
  return null;
}

// --- Claude CLI Runner ---

export function runClaude(
  prompt: string,
  options?: { maxTurns?: number; cwd?: string }
): { process: ChildProcess; events: AsyncIterable<ClaudeEvent>; exitCode: Promise<number> } {
  const proc = spawn("claude", [
    "-p", prompt,
    "--output-format", "stream-json",
    "--max-turns", String(options?.maxTurns ?? 100),
  ], {
    cwd: options?.cwd ?? process.cwd(),
    env: { ...process.env },
  });

  // Capture exit code early so we never miss the close event
  const exitCode = new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  // Collect stderr for error reporting
  const stderrChunks: string[] = [];
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const events = parseStreamJson(proc, stderrChunks);
  return { process: proc, events, exitCode };
}

async function* parseStreamJson(proc: ChildProcess, stderrChunks: string[]): AsyncIterable<ClaudeEvent> {
  let buffer = "";

  for await (const chunk of proc.stdout!) {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch {
          // non-JSON lines ignored
        }
      }
    }
  }

  // If no stdout was produced, yield an error from stderr
  if (stderrChunks.length > 0) {
    const stderr = stderrChunks.join("").trim();
    if (stderr) {
      yield {
        type: "result",
        subtype: "error",
        result: `CLI error: ${stderr.slice(0, 500)}`,
      } as ClaudeEvent;
    }
  }
}

// --- Stream-to-SSE Transformer ---

export function transformToSSE(event: ClaudeEvent, currentStage: { name: string }): SSEEvent[] {
  const results: SSEEvent[] = [];

  if (event.type === "assistant" && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === "text" && block.text) {
        const detected = detectStage(block.text);
        if (detected && detected !== currentStage.name) {
          if (currentStage.name) {
            results.push({ event: "stage", data: { name: currentStage.name, status: "done" } });
          }
          currentStage.name = detected;
          results.push({ event: "stage", data: { name: detected, status: "running" } });
        }
        results.push({
          event: "log",
          data: {
            stage: currentStage.name || "system",
            message: block.text.slice(0, 200),
            timestamp: new Date().toISOString(),
            level: "info",
          },
        });
      }

      if (block.type === "tool_use" && block.name) {
        const detected = detectStageFromTool(block.name, block.input);
        if (detected && detected !== currentStage.name) {
          if (currentStage.name) {
            results.push({ event: "stage", data: { name: currentStage.name, status: "done" } });
          }
          currentStage.name = detected;
          results.push({ event: "stage", data: { name: detected, status: "running" } });
        }
        results.push({
          event: "log",
          data: {
            stage: currentStage.name || "system",
            message: `[${block.name}] ${summarizeToolInput(block.name, block.input)}`,
            timestamp: new Date().toISOString(),
            level: "info",
          },
        });

        // Detect file creation
        if (block.name === "Write" && block.input?.file_path) {
          const fp = block.input.file_path as string;
          if (/\.(png|jpg|jpeg|bmp)$/i.test(fp)) {
            results.push({ event: "file", data: { type: "image", name: fp.split("/").pop(), path: fp } });
          } else if (/\.json$/i.test(fp)) {
            results.push({ event: "file", data: { type: "json", name: fp.split("/").pop(), path: fp } });
          }
        }
      }
    }
  }

  if (event.type === "result") {
    if (currentStage.name) {
      results.push({ event: "stage", data: { name: currentStage.name, status: "done" } });
    }
    results.push({
      event: "result",
      data: {
        status: event.subtype === "success" ? "success" : "failed",
        result: event.result?.slice(0, 500),
      },
    });
  }

  return results;
}

function summarizeToolInput(name: string, input?: Record<string, unknown>): string {
  if (!input) return "";
  if (name === "Read" || name === "Write" || name === "Edit") {
    const fp = (input.file_path ?? "") as string;
    return fp.split("/").pop() ?? fp;
  }
  if (name === "Bash") {
    const cmd = (input.command ?? "") as string;
    return cmd.slice(0, 80);
  }
  if (name === "Agent") {
    const desc = (input.description ?? "") as string;
    return desc.slice(0, 60);
  }
  return "";
}
