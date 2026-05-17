import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";
import type { ClaudeEvent } from "../../claude";
import { getRuntimeEnvValue } from "../../server/runtimeEnv";
import type { AIProviderAdapter, AIStageKey, ProviderRunOptions, ProviderRunResult } from "../types";

export const DEEPSEEK_ALLOWED_STAGES: AIStageKey[] = [
  "create.extractor",
  "create.solver",
  "create.verifier",
  "review.reviewer",
];

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
}

export function isDeepSeekStageAllowed(stageKey: unknown): stageKey is AIStageKey {
  return typeof stageKey === "string" && DEEPSEEK_ALLOWED_STAGES.includes(stageKey as AIStageKey);
}

export function buildDeepSeekMessages(prompt: string, options?: ProviderRunOptions): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are running as the DeepSeek V4 external API provider for NGD Studio.",
        "Follow the existing stage instructions exactly and return concise, structured output.",
        `Stage: ${options?.stageKey ?? "unspecified"}`,
      ].join("\n"),
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

function createVirtualProcess(resolveExitCode: (code: number) => void): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;

  proc.kill = (() => {
    resolveExitCode(1);
    proc.emit("close", 1, null);
    proc.emit("exit", 1, null);
    return true;
  }) as ChildProcess["kill"];
  proc.stderr = null;
  proc.stdout = null;
  proc.stdin = null;
  return proc;
}

function resultEvent(status: "success" | "error", result: string): ClaudeEvent {
  return {
    type: "result",
    subtype: status,
    result,
  };
}

async function* runDeepSeek(prompt: string, options: ProviderRunOptions | undefined, close: (code: number) => void): AsyncIterable<ClaudeEvent> {
  if (!isDeepSeekStageAllowed(options?.stageKey)) {
    const stage = options?.stageKey ?? "unspecified";
    yield resultEvent("error", `DeepSeek V4 is not enabled for stage: ${stage}`);
    close(1);
    return;
  }

  const apiKey = getRuntimeEnvValue("DEEPSEEK_API_KEY");
  const baseUrl = getRuntimeEnvValue("DEEPSEEK_API_BASE_URL") || "https://api.deepseek.com";
  const model = getRuntimeEnvValue("DEEPSEEK_MODEL") || "deepseek-v4";
  if (!apiKey) {
    yield resultEvent("error", "DEEPSEEK_API_KEY is not configured.");
    close(1);
    return;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: buildDeepSeekMessages(prompt, options),
      }),
    });

    if (!response.ok) {
      yield resultEvent("error", `DeepSeek API request failed: ${response.status}`);
      close(1);
      return;
    }

    const json = await response.json() as DeepSeekChatResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (text) {
      yield {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text }],
        },
      };
    }
    yield resultEvent("success", text || "DeepSeek V4 completed without text output.");
    close(0);
  } catch (err) {
    yield resultEvent("error", err instanceof Error ? err.message : "DeepSeek API request failed.");
    close(1);
  }
}

export const deepseekV4Provider: AIProviderAdapter = {
  id: "deepseek-v4",
  label: "DeepSeek V4 API",
  run(prompt: string, options?: ProviderRunOptions): ProviderRunResult {
    let resolveExitCode: (code: number) => void = () => undefined;
    let closed = false;
    const exitCode = new Promise<number>((resolve) => {
      resolveExitCode = resolve;
    });
    const proc = createVirtualProcess(resolveExitCode);
    const close = (code: number) => {
      if (closed) return;
      closed = true;
      resolveExitCode(code);
      proc.emit("close", code, null);
      proc.emit("exit", code, null);
    };

    return {
      process: proc,
      events: runDeepSeek(prompt, options, close),
      exitCode,
      metadata: {
        requestedProvider: "deepseek-v4",
        provider: "deepseek-v4",
        label: "DeepSeek V4 API",
      },
    };
  },
};
