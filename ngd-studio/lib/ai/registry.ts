import { claudeCliProvider } from "./providers/claudeCli";
import type {
  AIProviderAdapter,
  AIProviderId,
  ProviderRunResult,
  ProviderSelectionRunOptions,
  ResolvedAIProviderId,
} from "./types";

const providers = new Map<ResolvedAIProviderId, AIProviderAdapter>([
  [claudeCliProvider.id, claudeCliProvider],
]);

const providerIds = new Set<AIProviderId>(["auto", "claude", "codex", "deepseek-v4"]);

export function normalizeProviderId(provider: unknown): AIProviderId {
  if (provider === undefined || provider === null || provider === "") return "auto";
  if (typeof provider === "string" && providerIds.has(provider as AIProviderId)) {
    return provider as AIProviderId;
  }
  throw new Error(`Invalid AI provider: ${String(provider)}`);
}

export function resolveProviderId(provider: AIProviderId = "auto"): ResolvedAIProviderId {
  if (provider === "auto") return "claude";
  if (providers.has(provider)) return provider;
  throw new Error(`AI provider is not registered yet: ${provider}`);
}

export function getProviderAdapter(provider: AIProviderId = "auto"): AIProviderAdapter {
  return providers.get(resolveProviderId(provider)) ?? claudeCliProvider;
}

export function listProviderAdapters(): AIProviderAdapter[] {
  return Array.from(providers.values());
}

export function runAIProvider(prompt: string, options?: ProviderSelectionRunOptions): ProviderRunResult {
  const requestedProvider = normalizeProviderId(options?.provider);
  const adapter = getProviderAdapter(requestedProvider);
  const result = adapter.run(prompt, options);

  return {
    ...result,
    metadata: {
      ...result.metadata,
      requestedProvider,
      provider: adapter.id,
    },
  };
}

export { claudeCliProvider };
