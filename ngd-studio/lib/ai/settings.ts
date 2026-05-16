import type { AIProviderId, AIStageKey } from "./types";

export type SelectableProviderId = Extract<AIProviderId, "auto" | "claude" | "codex">;
export type StageProviderId = AIProviderId;
export type StageOverrideMap = Partial<Record<AIStageKey, StageProviderId>>;

export const AI_SETTINGS_STORAGE_KEY = "ngd-studio.ai-settings";
export const AI_STAGE_KEYS: AIStageKey[] = [
  "create.extractor",
  "create.solver",
  "create.verifier",
  "review.reviewer",
];
export const DEFAULT_AI_SETTINGS: AISettings = {
  defaultProvider: "auto",
  stageOverrides: {},
};

export interface AISettings {
  defaultProvider: SelectableProviderId;
  stageOverrides: StageOverrideMap;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const selectableProviders = new Set<SelectableProviderId>(["auto", "claude", "codex"]);
const stageProviders = new Set<StageProviderId>(["auto", "claude", "codex", "deepseek-v4"]);
const stageKeys = new Set<AIStageKey>(AI_STAGE_KEYS);

export function isSelectableProviderId(value: unknown): value is SelectableProviderId {
  return typeof value === "string" && selectableProviders.has(value as SelectableProviderId);
}

export function isStageProviderId(value: unknown): value is StageProviderId {
  return typeof value === "string" && stageProviders.has(value as StageProviderId);
}

export function isAIStageKey(value: unknown): value is AIStageKey {
  return typeof value === "string" && stageKeys.has(value as AIStageKey);
}

export function normalizeStageOverrides(value: unknown): StageOverrideMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: StageOverrideMap = {};
  for (const [stageKey, provider] of Object.entries(value)) {
    if (isAIStageKey(stageKey) && isStageProviderId(provider)) {
      normalized[stageKey] = provider;
    }
  }
  return normalized;
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
      stageOverrides: normalizeStageOverrides(parsed.stageOverrides),
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
    stageOverrides: normalizeStageOverrides(settings.stageOverrides),
  };

  storage?.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function readDefaultProvider(storage = getBrowserStorage()): SelectableProviderId {
  return readAISettings(storage).defaultProvider;
}

export function readStageOverrides(storage = getBrowserStorage()): StageOverrideMap {
  return readAISettings(storage).stageOverrides;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
