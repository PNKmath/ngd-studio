import { runClaude } from "../../claude";
import type { AIProviderAdapter, ProviderRunOptions, ProviderRunResult } from "../types";

export const claudeCliProvider: AIProviderAdapter = {
  id: "claude",
  label: "Claude CLI",
  run(prompt: string, options?: ProviderRunOptions): ProviderRunResult {
    const result = runClaude(prompt, {
      cwd: options?.cwd,
      maxTurns: options?.maxTurns,
    });

    return {
      ...result,
      metadata: {
        requestedProvider: "claude",
        provider: "claude",
        label: "Claude CLI",
      },
    };
  },
};
