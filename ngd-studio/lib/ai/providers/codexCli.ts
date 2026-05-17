import { spawn, type ChildProcess } from "child_process";
import type { ClaudeEvent, ContentBlock } from "../../claude";
import type { AIProviderAdapter, ProviderRunOptions, ProviderRunResult } from "../types";

const CODEX_PREAMBLE = [
  "You are running inside ngd-studio as an alternate AI provider.",
  "Reuse the existing .claude/skills and .claude/agents workflow files when they are relevant.",
  "Preserve the same stage meanings and output file conventions used by the Claude provider.",
  "When you create or update files, report paths clearly so the SSE layer can surface progress.",
].join("\n");

export function buildCodexPrompt(prompt: string): string {
  return `${CODEX_PREAMBLE}\n\n--- USER TASK ---\n${prompt}`;
}

export function buildCodexExecArgs(prompt: string, cwd: string, imagePaths?: string[]): string[] {
  const imageArgs: string[] = [];
  for (const imgPath of imagePaths ?? []) {
    imageArgs.push("--image", imgPath);
  }

  // `--image <FILE>...` is variadic; without a `--` terminator clap would greedily
  // consume the trailing prompt as another image path. Insert `--` whenever images
  // are present so the prompt is unambiguously the positional argument.
  const separator = imageArgs.length > 0 ? ["--"] : [];

  return [
    "exec",
    "--json",
    "--cd",
    cwd,
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    ...imageArgs,
    ...separator,
    buildCodexPrompt(prompt),
  ];
}

export function parseCodexJsonLine(line: string): ClaudeEvent[] {
  if (!line.trim()) return [];
  try {
    return codexJsonToClaudeEvents(JSON.parse(line));
  } catch {
    return [];
  }
}

function codexJsonToClaudeEvents(value: unknown): ClaudeEvent[] {
  if (!isRecord(value)) return [];

  if (isRecord(value.item)) {
    return codexJsonToClaudeEvents(value.item);
  }

  const type = stringValue(value.type);
  const text = extractText(value);
  if (text) {
    return [assistantEvent([{ type: "text", text }])];
  }

  if (type === "tool_call" || type === "function_call") {
    const name = stringValue(value.name) || "Tool";
    return [assistantEvent([{ type: "tool_use", name, input: objectValue(value.input) ?? objectValue(value.arguments) ?? {} }])];
  }

  if (type === "exec_command" || type === "command") {
    const command = stringValue(value.command);
    if (command) {
      return [assistantEvent([{ type: "tool_use", name: "Bash", input: { command } }])];
    }
  }

  if (type === "result" || type === "task_complete" || type === "turn_complete") {
    const success = value.success !== false && value.status !== "failed" && value.status !== "error";
    return [{
      type: "result",
      subtype: success ? "success" : "error",
      result: stringValue(value.message) || stringValue(value.result) || stringValue(value.error) || "",
    }];
  }

  if (type === "error") {
    return [{ type: "result", subtype: "error", result: stringValue(value.message) || stringValue(value.error) || "Codex error" }];
  }

  return [];
}

function assistantEvent(content: ContentBlock[]): ClaudeEvent {
  return {
    type: "assistant",
    message: {
      role: "assistant",
      content,
    },
  };
}

function extractText(value: Record<string, unknown>): string {
  const direct = stringValue(value.message) || stringValue(value.text) || stringValue(value.output);
  if (direct) return direct;

  const content = value.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item)) return stringValue(item.text) || stringValue(item.output_text);
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function* parseCodexStream(proc: ChildProcess, stderrChunks: string[]): AsyncIterable<ClaudeEvent> {
  let buffer = "";

  if (proc.stdout) {
    for await (const chunk of proc.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        yield* parseCodexJsonLine(line);
      }
    }
  }

  for (const event of parseCodexJsonLine(buffer)) {
    yield event;
  }

  const stderr = stderrChunks.join("").trim();
  if (stderr) {
    yield {
      type: "result",
      subtype: "error",
      result: `Codex CLI error: ${stderr.slice(0, 500)}`,
    };
  }
}

export const codexCliProvider: AIProviderAdapter = {
  id: "codex-cli",
  label: "Codex CLI",
  run(prompt: string, options?: ProviderRunOptions): ProviderRunResult {
    const cwd = options?.cwd ?? process.cwd();
    const proc = spawn("codex", buildCodexExecArgs(prompt, cwd, options?.imagePaths), {
      cwd,
      env: options?.env ? { ...process.env, ...options.env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stderrChunks: string[] = [];
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    // signal: abort 시 프로세스 종료
    options?.signal?.addEventListener("abort", () => {
      proc.kill("SIGTERM");
    });

    return {
      process: proc,
      events: parseCodexStream(proc, stderrChunks),
      exitCode: new Promise<number>((resolve) => {
        proc.on("close", (code) => resolve(code ?? 1));
      }),
      metadata: {
        requestedProvider: "codex-cli",
        provider: "codex-cli",
        label: "Codex CLI",
      },
    };
  },
};
