import type { AIProviderId, AIStageKey } from "./types";

export type SelectableProviderId = Extract<
  AIProviderId,
  "auto" | "claude-cli" | "claude-sdk" | "codex-cli" | "openai-sdk"
>;
export type StageProviderId = AIProviderId;
export type StageOverrideMap = Partial<Record<AIStageKey, StageProviderId>>;

export const AI_SETTINGS_STORAGE_KEY = "ngd-studio.ai-settings";
export const AI_STAGE_KEYS: AIStageKey[] = [
  "create.extractor",
  "create.solver",
  "create.verifier",
  "review.reviewer",
];
// DeepSeek V4 (preview)는 이미지 입력 미지원이라 extractor는 제외한다.
// vision 출시 후 AI_STAGE_KEYS로 되돌릴 것.
export const DEEPSEEK_MODEL_STAGE_KEYS: AIStageKey[] = [
  "create.solver",
  "create.verifier",
  "review.reviewer",
];
export const DEFAULT_AI_SETTINGS: AISettings = {
  defaultProvider: "auto",
  stageOverrides: {},
  figureRegen: true,
};

export interface AISettings {
  defaultProvider: SelectableProviderId;
  stageOverrides: StageOverrideMap;
  /** Gemini(nano-banana)로 그림을 재생성할지 여부. false면 crop+워터마크만. */
  figureRegen: boolean;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** backward-compat: legacy stored provider strings → new IDs */
const legacySelectableAliases: Partial<Record<string, SelectableProviderId>> = {
  claude: "claude-cli",
  codex: "codex-cli",
};

const legacyStageAliases: Partial<Record<string, StageProviderId>> = {
  claude: "claude-cli",
  codex: "codex-cli",
};

const selectableProviders = new Set<SelectableProviderId>([
  "auto",
  "claude-cli",
  "claude-sdk",
  "codex-cli",
  "openai-sdk",
]);

const stageProviders = new Set<StageProviderId>([
  "auto",
  "claude-cli",
  "claude-sdk",
  "codex-cli",
  "openai-sdk",
  "deepseek-v4",
]);

const stageKeys = new Set<AIStageKey>(AI_STAGE_KEYS);

export function isSelectableProviderId(value: unknown): value is SelectableProviderId {
  if (typeof value !== "string") return false;
  // Accept legacy aliases
  if (legacySelectableAliases[value]) return true;
  return selectableProviders.has(value as SelectableProviderId);
}

export function isStageProviderId(value: unknown): value is StageProviderId {
  if (typeof value !== "string") return false;
  if (legacyStageAliases[value]) return true;
  return stageProviders.has(value as StageProviderId);
}

export function isAIStageKey(value: unknown): value is AIStageKey {
  return typeof value === "string" && stageKeys.has(value as AIStageKey);
}

/** Normalize a SelectableProviderId, migrating legacy values */
function normalizeSelectableProviderId(value: unknown): SelectableProviderId {
  if (typeof value !== "string") return DEFAULT_AI_SETTINGS.defaultProvider;
  const migrated = legacySelectableAliases[value];
  if (migrated) return migrated;
  if (selectableProviders.has(value as SelectableProviderId)) {
    return value as SelectableProviderId;
  }
  return DEFAULT_AI_SETTINGS.defaultProvider;
}

/** Normalize a StageProviderId, migrating legacy values */
function normalizeStageProviderId(value: unknown): StageProviderId | undefined {
  if (typeof value !== "string") return undefined;
  const migrated = legacyStageAliases[value];
  if (migrated) return migrated;
  if (stageProviders.has(value as StageProviderId)) {
    return value as StageProviderId;
  }
  return undefined;
}

export function normalizeStageOverrides(value: unknown): StageOverrideMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: StageOverrideMap = {};
  for (const [stageKey, provider] of Object.entries(value)) {
    if (!isAIStageKey(stageKey)) continue;
    const normalizedProvider = normalizeStageProviderId(provider);
    if (normalizedProvider) {
      normalized[stageKey] = normalizedProvider;
    }
  }
  return normalized;
}

export function createDeepSeekStageOverrides(): StageOverrideMap {
  return Object.fromEntries(
    DEEPSEEK_MODEL_STAGE_KEYS.map((stageKey) => [stageKey, "deepseek-v4"])
  ) as StageOverrideMap;
}

export function allModelStagesUseDeepSeek(stageOverrides: StageOverrideMap): boolean {
  return DEEPSEEK_MODEL_STAGE_KEYS.every((stageKey) => stageOverrides[stageKey] === "deepseek-v4");
}

export function readAISettings(storage = getBrowserStorage()): AISettings {
  if (!storage) return DEFAULT_AI_SETTINGS;

  try {
    const raw = storage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    return {
      defaultProvider: normalizeSelectableProviderId(parsed.defaultProvider),
      stageOverrides: normalizeStageOverrides(parsed.stageOverrides),
      figureRegen: parsed.figureRegen !== false,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function writeAISettings(settings: AISettings, storage = getBrowserStorage()): AISettings {
  const normalized: AISettings = {
    defaultProvider: normalizeSelectableProviderId(settings.defaultProvider),
    stageOverrides: normalizeStageOverrides(settings.stageOverrides),
    figureRegen: settings.figureRegen !== false,
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
