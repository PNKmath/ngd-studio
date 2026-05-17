import { EventEmitter } from "events";
import { readFileSync } from "fs";
import type { ChildProcess } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeEvent } from "../../claude";
import { getRuntimeEnvValue } from "../../server/runtimeEnv";
import type { AIProviderAdapter, ProviderRunOptions, ProviderRunResult } from "../types";

const DEFAULT_MODEL = "claude-sonnet-4-6";
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

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
        data: string;
      };
    };

function buildContentBlocks(prompt: string, imagePaths?: string[]): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];

  for (const imgPath of imagePaths ?? []) {
    try {
      const data = readFileSync(imgPath).toString("base64");
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data,
        },
      });
    } catch {
      // 이미지 파일 읽기 실패 시 무시 (텍스트만으로 진행)
    }
  }

  blocks.push({ type: "text", text: prompt });
  return blocks;
}

async function* runClaudeSdk(
  prompt: string,
  options: ProviderRunOptions | undefined,
  close: (code: number) => void
): AsyncIterable<ClaudeEvent> {
  const apiKey = getRuntimeEnvValue("ANTHROPIC_API_KEY");
  if (!apiKey) {
    yield resultEvent("error", "ANTHROPIC_API_KEY is not configured.");
    close(1);
    return;
  }

  const model = getRuntimeEnvValue("ANTHROPIC_MODEL") || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  try {
    const content = buildContentBlocks(prompt, options?.imagePaths);

    const response = await client.messages.create(
      {
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [{ role: "user", content }],
      },
      { signal: options?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

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
      const stopReason = response.stop_reason ?? "unknown";
      yield resultEvent(
        "error",
        `Claude SDK returned empty content (stop_reason=${stopReason}).`
      );
      close(1);
    }
  } catch (err) {
    if (options?.signal?.aborted) {
      yield resultEvent("error", "Claude SDK request was aborted.");
    } else {
      yield resultEvent("error", err instanceof Error ? err.message : "Claude SDK request failed.");
    }
    close(1);
  }
}

export const claudeSdkProvider: AIProviderAdapter = {
  id: "claude-sdk",
  label: "Claude SDK",
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
      events: runClaudeSdk(prompt, options, close),
      exitCode,
      metadata: {
        requestedProvider: "claude-sdk",
        provider: "claude-sdk",
        label: "Claude SDK",
      },
    };
  },
};
