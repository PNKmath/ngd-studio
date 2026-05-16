import type { AIProviderId } from "./types";

export type SelectableProviderId = Extract<AIProviderId, "auto" | "claude" | "codex">;

export const AI_SETTINGS_STORAGE_KEY = "ngd-studio.ai-settings";
export const DEFAULT_AI_SETTINGS: AISettings = {
  defaultProvider: "auto",
};

export interface AISettings {
  defaultProvider: SelectableProviderId;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const selectableProviders = new Set<SelectableProviderId>(["auto", "claude", "codex"]);

export function isSelectableProviderId(value: unknown): value is SelectableProviderId {
  return typeof value === "string" && selectableProviders.has(value as SelectableProviderId);
}

export function readAISettings(storage = getBrowserStorage()): AISettings {
  if (!storage) return DEFAULT_AI_SETTINGS;

  try {
    const raw = storage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    return {
      defaultProvider: isSelectableProviderId(parsed.defaultProvider)
        ? parsed.defaultProvider
        : DEFAULT_AI_SETTINGS.defaultProvider,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function writeAISettings(settings: AISettings, storage = getBrowserStorage()): AISettings {
  const normalized: AISettings = {
    defaultProvider: isSelectableProviderId(settings.defaultProvider)
      ? settings.defaultProvider
      : DEFAULT_AI_SETTINGS.defaultProvider,
  };

  storage?.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function readDefaultProvider(storage = getBrowserStorage()): SelectableProviderId {
  return readAISettings(storage).defaultProvider;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
