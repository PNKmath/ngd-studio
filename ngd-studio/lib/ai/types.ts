import type { ChildProcess } from "child_process";
import type { ClaudeEvent } from "../claude";

export type AIProviderId = "auto" | "claude" | "codex" | "deepseek-v4";
export type ResolvedAIProviderId = Exclude<AIProviderId, "auto">;
// Provider/model-call stage keys. Broader workflow stages are defined in server/stages/types.ts.
// Model-stage contracts live in server/stages/model.ts so provider adapters do not own file mutation.
export type AIStageKey = "create.extractor" | "create.solver" | "create.verifier" | "review.reviewer";

export interface ProviderRunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  maxTurns?: number;
  mode?: "create" | "resume" | "crop" | "review" | string;
  jobId?: string;
  stageKey?: AIStageKey;
}

export interface ProviderSelectionRunOptions extends ProviderRunOptions {
  provider?: AIProviderId;
}

export interface ProviderRunMetadata {
  requestedProvider: AIProviderId;
  provider: ResolvedAIProviderId;
  label: string;
  externalCostUsd?: number;
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
