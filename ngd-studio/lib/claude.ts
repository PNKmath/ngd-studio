import { spawn, type ChildProcess } from "child_process";
import path from "path";
import os from "os";

// --- Path Conversion (Windows ↔ WSL) ---

const IS_WINDOWS = os.platform() === "win32";

/**
 * Windows 경로를 WSL 경로로 변환.
 * 예: C:\NGD\inputs\file.pdf → /mnt/c/NGD/inputs/file.pdf
 * 이미 WSL 경로(/mnt/...)면 그대로 반환.
 */
export function toWslPath(winPath: string): string {
  if (!IS_WINDOWS) return winPath;
  if (winPath.startsWith("/mnt/")) return winPath;
  // 상대경로면 그대로 (cwd 기준으로 해석됨)
  if (!path.isAbsolute(winPath)) return winPath.replace(/\\/g, "/");
  // C:\foo → /mnt/c/foo
  const normalized = winPath.replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)/);
  if (match) {
    return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
  }
  return normalized;
}

/**
 * WSL 경로를 Windows 경로로 변환.
 * 예: /mnt/c/NGD/inputs/file.pdf → C:\NGD\inputs\file.pdf
 * Windows가 아니거나 WSL 경로가 아니면 그대로 반환.
 */
export function fromWslPath(wslPath: string): string {
  if (!IS_WINDOWS) return wslPath;
  const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)/);
  if (match) {
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, "\\")}`;
  }
  return wslPath;
}

/** Bash 쉘 이스케이프 — 작은따옴표로 감싸기 */
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

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

// 텍스트 기반 스테이지 감지 — 에이전트 이름 패턴 우선, 일반 키워드는 폴백
const stagePatterns: { name: string; patterns: RegExp[] }[] = [
  // 에이전트 이름 매칭 (가장 정확)
  { name: "reader",    patterns: [/ngd-exam-reader/i, /reader\s*(에이전트|agent)/i] },
  { name: "extractor", patterns: [/ngd-exam-extractor/i, /extractor\s*(에이전트|agent)/i] },
  { name: "solver",    patterns: [/ngd-exam-solver/i, /solver\s*(에이전트|agent)/i] },
  { name: "verifier",  patterns: [/ngd-exam-verifier/i, /verifier\s*(에이전트|agent)/i] },
  { name: "figure",    patterns: [/ngd-exam-figure/i, /figure\s*(에이전트|agent)/i] },
  { name: "builder",   patterns: [/ngd-exam-builder/i, /builder\s*(에이전트|agent)/i] },
  { name: "checker",   patterns: [/ngd-exam-checker/i, /checker\s*(에이전트|agent)/i] },
  { name: "reviewer",  patterns: [/ngd-exam-reviewer/i, /reviewer\s*(에이전트|agent)/i] },
];

// 일반 키워드 폴백 (에이전트 이름이 없을 때만)
const stageFallbackPatterns: { name: string; patterns: RegExp[] }[] = [
  { name: "reader",    patterns: [/PDF.*읽/i, /exam_data.*추출/i] },
  { name: "extractor", patterns: [/문제.*추출/i, /이미지.*추출/i, /extracted\.json/i] },
  { name: "solver",    patterns: [/해설.*생성/i, /해설.*보완/i, /풀이.*생성/i] },
  { name: "verifier",  patterns: [/해설.*검증/i, /verif/i, /검증.*결과/i] },
  { name: "figure",    patterns: [/그림.*처리/i, /crop/i, /nano-banana/i, /워터마크/i] },
  { name: "builder",   patterns: [/HWPX.*조립/i, /section0.*xml/i] },
  { name: "checker",   patterns: [/품질.*검수/i, /체크리스트.*검증/i] },
];

export function detectStage(text: string): string | null {
  // 1순위: 에이전트 이름 매칭
  for (const { name, patterns } of stagePatterns) {
    if (patterns.some((p) => p.test(text))) return name;
  }
  // 2순위: 일반 키워드 (더 엄격한 패턴)
  for (const { name, patterns } of stageFallbackPatterns) {
    if (patterns.some((p) => p.test(text))) return name;
  }
  return null;
}

// Agent subagent_type → stage 매핑
const agentTypeToStage: Record<string, string> = {
  "ngd-exam-reader":     "reader",
  "ngd-exam-extractor":  "extractor",
  "ngd-exam-solver":     "solver",
  "ngd-exam-verifier":   "verifier",
  "ngd-exam-figure":     "figure",
  "ngd-exam-builder":    "builder",
  "ngd-exam-checker":    "checker",
  "ngd-exam-reviewer":   "reviewer",
};

export function detectStageFromTool(toolName: string, input?: Record<string, unknown>): string | null {
  const filePath = (input?.file_path ?? input?.command ?? "") as string;

  if (toolName === "Read" && /\.pdf/i.test(filePath)) return "reader";
  if (toolName === "Write" && /exam_data.*\.json/i.test(filePath)) return "reader";
  if (toolName === "Agent") {
    // 1순위: subagent_type으로 정확히 매칭
    const subType = (input?.subagent_type ?? "") as string;
    if (agentTypeToStage[subType]) return agentTypeToStage[subType];

    // 2순위: description에서 에이전트 이름 매칭
    const desc = (input?.description ?? "") as string;
    for (const [agentName, stage] of Object.entries(agentTypeToStage)) {
      const shortName = agentName.replace("ngd-exam-", "");
      if (desc.toLowerCase().includes(shortName)) return stage;
    }

    // 3순위: prompt에서 에이전트 이름 패턴 매칭 (폴백)
    const prompt = (input?.prompt ?? "") as string;
    for (const [agentName, stage] of Object.entries(agentTypeToStage)) {
      if (prompt.includes(agentName)) return stage;
    }
  }
  if (toolName === "Skill") {
    const skillName = (input?.skill ?? "") as string;
    if (skillName === "ngd-exam-create") return "reader"; // V1 오케스트레이터 시작 = reader 시작
    if (skillName === "ngd-exam-create-v3") return "extractor"; // V3 오케스트레이터 시작 = extractor 시작
    if (skillName === "nano-banana") return "figure";
  }
  if (toolName === "Write" && /\.hwpx|section0|content\.hpf/i.test(filePath)) return "builder";
  return null;
}

// --- Claude CLI Runner ---

export function runClaude(
  prompt: string,
  options?: { maxTurns?: number; cwd?: string }
): { process: ChildProcess; events: AsyncIterable<ClaudeEvent>; exitCode: Promise<number> } {
  const claudeArgs = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
    "--max-turns", String(options?.maxTurns ?? 100),
  ];

  const cwd = options?.cwd ?? process.cwd();

  // Windows: wsl 경유로 claude 실행, cwd를 WSL 경로로 변환
  // bash -lc (login shell) 필수 — non-login shell은 Windows PATH를 상속하여
  // WSL claude 대신 Windows claude shim을 실행해 "node: not found" 에러 발생
  const proc = IS_WINDOWS
    ? spawn("wsl.exe", [
        "--", "bash", "-lc",
        `cd ${shellEscape(toWslPath(cwd))} && claude ${claudeArgs.map(shellEscape).join(" ")}`,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
      })
    : spawn("claude", claudeArgs, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

  const exitCode = new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

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

  if (event.type === "system" && event.subtype === "init") {
    results.push({
      event: "log",
      data: {
        stage: "system",
        message: `Claude CLI 시작됨 (model: ${(event as unknown as Record<string, unknown>).model ?? "unknown"})`,
        timestamp: new Date().toISOString(),
        level: "info",
      },
    });
    return results;
  }

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

        if (block.name === "Write" && block.input?.file_path) {
          const fp = block.input.file_path as string;
          if (/\.(png|jpg|jpeg|bmp)$/i.test(fp)) {
            results.push({ event: "file", data: { type: "image", name: fp.split("/").pop(), path: fp } });
          } else if (/\.json$/i.test(fp)) {
            results.push({ event: "file", data: { type: "json", name: fp.split("/").pop(), path: fp } });
          } else if (/\.hwpx$/i.test(fp)) {
            results.push({ event: "file", data: { type: "hwpx", name: fp.split("/").pop(), path: fp } });
          }
        }

        // Bash로 zip/cp/mv 등으로 .hwpx 생성하는 경우도 감지
        if (block.name === "Bash" && block.input?.command) {
          const cmd = block.input.command as string;
          const hwpxMatch = cmd.match(/(?:zip|cp|mv)\s+.*?([\w/.-]+\.hwpx)/i);
          if (hwpxMatch) {
            results.push({ event: "file", data: { type: "hwpx", name: hwpxMatch[1].split("/").pop(), path: hwpxMatch[1] } });
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
