import type { ChildProcess } from "child_process";
import type { ClaudeEvent } from "../claude";

export type AIProviderId = "auto" | "claude" | "codex" | "deepseek-v4";
export type ResolvedAIProviderId = Exclude<AIProviderId, "auto">;

export interface ProviderRunOptions {
  cwd?: string;
  maxTurns?: number;
  mode?: "create" | "resume" | "crop" | "review" | string;
  jobId?: string;
}

export interface ProviderSelectionRunOptions extends ProviderRunOptions {
  provider?: AIProviderId;
}

export interface ProviderRunMetadata {
  requestedProvider: AIProviderId;
  provider: ResolvedAIProviderId;
  label: string;
}

export interface ProviderRunResult {
  process: ChildProcess;
  events: AsyncIterable<ClaudeEvent>;
  exitCode: Promise<number>;
  metadata: ProviderRunMetadata;
}

export interface AIProviderAdapter {
  id: ResolvedAIProviderId;
  label: string;
  run(prompt: string, options?: ProviderRunOptions): ProviderRunResult;
}
