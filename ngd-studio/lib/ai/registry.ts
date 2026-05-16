import { claudeCliProvider } from "./providers/claudeCli";
import type { AIProviderAdapter, AIProviderId, ResolvedAIProviderId } from "./types";

const providers = new Map<ResolvedAIProviderId, AIProviderAdapter>([
  [claudeCliProvider.id, claudeCliProvider],
]);

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

export { claudeCliProvider };
