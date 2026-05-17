import { EventEmitter } from "events";
import { readFileSync } from "fs";
import type { ChildProcess } from "child_process";
import OpenAI from "openai";
import type { ClaudeEvent } from "../../claude";
import { getRuntimeEnvValue } from "../../server/runtimeEnv";
import type { AIProviderAdapter, ProviderRunOptions, ProviderRunResult } from "../types";

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_MAX_TOKENS = 8192;

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
  return { type: "result", subtype: status, result };
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildContentParts(prompt: string, imagePaths?: string[]): OpenAIContentPart[] {
  const parts: OpenAIContentPart[] = [];

  for (const imgPath of imagePaths ?? []) {
    try {
      const data = readFileSync(imgPath).toString("base64");
      parts.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${data}` },
      });
    } catch {
      // 이미지 파일 읽기 실패 시 무시 (텍스트만으로 진행)
    }
  }

  parts.push({ type: "text", text: prompt });
  return parts;
}

async function* runOpenaiSdk(
  prompt: string,
  options: ProviderRunOptions | undefined,
  close: (code: number) => void
): AsyncIterable<ClaudeEvent> {
  const apiKey = getRuntimeEnvValue("OPENAI_API_KEY");
  if (!apiKey) {
    yield resultEvent("error", "OPENAI_API_KEY is not configured.");
    close(1);
    return;
  }

  const model = getRuntimeEnvValue("OPENAI_MODEL") || DEFAULT_MODEL;
  const client = new OpenAI({ apiKey });

  try {
    const content = buildContentParts(prompt, options?.imagePaths);

    const response = await client.chat.completions.create(
      {
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [{ role: "user", content }],
      },
      { signal: options?.signal }
    );

    const choice = response.choices[0];
    const text = choice?.message?.content?.trim() ?? "";

    if (text) {
      yield {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text }],
        },
      };
      yield resultEvent("success", text);
      close(0);
    } else {
      const finishReason = choice?.finish_reason ?? "unknown";
      yield resultEvent(
        "error",
        `OpenAI SDK returned empty content (finish_reason=${finishReason}).`
      );
      close(1);
    }
  } catch (err) {
    if (options?.signal?.aborted) {
      yield resultEvent("error", "OpenAI SDK request was aborted.");
    } else {
      yield resultEvent("error", err instanceof Error ? err.message : "OpenAI SDK request failed.");
    }
    close(1);
  }
}

export const openaiSdkProvider: AIProviderAdapter = {
  id: "openai-sdk",
  label: "OpenAI SDK",
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

    options?.signal?.addEventListener("abort", () => close(1));

    return {
      process: proc,
      events: runOpenaiSdk(prompt, options, close),
      exitCode,
      metadata: {
        requestedProvider: "openai-sdk",
        provider: "openai-sdk",
        label: "OpenAI SDK",
      },
    };
  },
};
