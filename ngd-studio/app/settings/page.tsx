"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Cpu, KeyRound, Loader2, PlugZap, Settings2, Sparkles, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AI_STAGE_KEYS,
  DEFAULT_AI_SETTINGS,
  allModelStagesUseDeepSeek,
  createDeepSeekStageOverrides,
  readAISettings,
  writeAISettings,
  type AISettings,
  type SelectableProviderId,
} from "@/lib/ai/settings";
import { recommendStageProvider } from "@/lib/ai/recommendation";
import { cn } from "@/lib/utils";

const providerOptions: {
  id: SelectableProviderId;
  label: string;
  detail: string;
  resolved: string;
}[] = [
  {
    id: "auto",
    label: "자동",
    detail: "현재는 Claude로 실행하고, 이후 작업 특성 기반 추천으로 확장합니다.",
    resolved: "Claude",
  },
  {
    id: "claude",
    label: "Claude",
    detail: "기존 stream-json 기반 workflow를 그대로 사용합니다.",
    resolved: "Claude CLI",
  },
  {
    id: "codex",
    label: "Codex",
    detail: "로컬 Codex CLI provider를 사용합니다.",
    resolved: "Codex CLI",
  },
];

const stageLabels: Record<(typeof AI_STAGE_KEYS)[number], string> = {
  "create.extractor": "제작 추출",
  "create.solver": "제작 풀이",
  "create.verifier": "제작 검증",
  "review.reviewer": "오검 리뷰",
};

type SettingsTab = "engine" | "keys";

interface EnvKeyStatus {
  configured: boolean;
  value?: string;
}

type ApiTestProvider = "deepseek" | "gemini";

interface ApiTestState {
  status: "idle" | "running" | "success" | "error";
  message?: string;
}

const apiKeyFields = [
  {
    key: "DEEPSEEK_API_KEY",
    label: "DeepSeek API Key",
    placeholder: "sk-...",
  },
  {
    key: "GEMINI_API_KEY",
    label: "Nano Banana / Gemini API Key",
    placeholder: "AIza...",
  },
  {
    key: "DEEPSEEK_API_BASE_URL",
    label: "DeepSeek API Base URL",
    placeholder: "https://api.deepseek.com",
  },
  {
    key: "DEEPSEEK_MODEL",
    label: "DeepSeek Model",
    placeholder: "deepseek-v4-pro",
  },
] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("engine");
  const [settings, setSettings] = useState<AISettings>(() => readAISettings());
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [envStatus, setEnvStatus] = useState<Record<string, EnvKeyStatus>>({});
  const [envMessage, setEnvMessage] = useState("");
  const [apiTests, setApiTests] = useState<Record<ApiTestProvider, ApiTestState>>({
    deepseek: { status: "idle" },
    gemini: { status: "idle" },
  });
  const deepSeekEnabled = allModelStagesUseDeepSeek(settings.stageOverrides);

  const loadEnvSettings = useCallback(async () => {
    const response = await fetch("/api/env-settings");
    if (!response.ok) return;
    const data = await response.json() as { keys?: Record<string, EnvKeyStatus> };
    setEnvStatus(data.keys ?? {});
    setEnvValues((current) => ({
      ...current,
      DEEPSEEK_API_BASE_URL: data.keys?.DEEPSEEK_API_BASE_URL?.value ?? current.DEEPSEEK_API_BASE_URL ?? "",
      DEEPSEEK_MODEL: data.keys?.DEEPSEEK_MODEL?.value ?? current.DEEPSEEK_MODEL ?? "",
    }));
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadEnvSettings());
  }, [loadEnvSettings]);

  const selectProvider = (provider: SelectableProviderId) => {
    setSettings(writeAISettings({ ...settings, defaultProvider: provider }));
  };

  const enableDeepSeek = () => {
    setSettings(writeAISettings({
      ...settings,
      stageOverrides: createDeepSeekStageOverrides(),
    }));
  };

  const disableDeepSeek = () => {
    setSettings(writeAISettings({
      ...settings,
      stageOverrides: {},
    }));
  };

  const resetSettings = () => {
    setSettings(writeAISettings(DEFAULT_AI_SETTINGS));
  };

  const saveEnvSettings = async () => {
    setEnvMessage("");
    const values = Object.fromEntries(
      Object.entries(envValues).filter(([key, value]) => !key.endsWith("_API_KEY") || value.trim())
    );
    const response = await fetch("/api/env-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      setEnvMessage("저장에 실패했습니다.");
      return;
    }

    const data = await response.json() as { keys?: Record<string, EnvKeyStatus> };
    setEnvStatus(data.keys ?? {});
    setEnvValues((current) => ({
      ...current,
      DEEPSEEK_API_KEY: "",
      GEMINI_API_KEY: "",
      DEEPSEEK_API_BASE_URL: data.keys?.DEEPSEEK_API_BASE_URL?.value ?? current.DEEPSEEK_API_BASE_URL ?? "",
      DEEPSEEK_MODEL: data.keys?.DEEPSEEK_MODEL?.value ?? current.DEEPSEEK_MODEL ?? "",
    }));
    setEnvMessage("저장되었습니다.");
  };

  const testApiConnection = async (provider: ApiTestProvider) => {
    setApiTests((current) => ({
      ...current,
      [provider]: { status: "running", message: "테스트 중..." },
    }));

    const response = await fetch("/api/env-settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, values: envValues }),
    });
    const data = await response.json().catch(() => undefined) as { ok?: boolean; message?: string; detail?: string } | undefined;
    const message = [data?.message, data?.detail].filter(Boolean).join(" · ") || "테스트 실패";

    setApiTests((current) => ({
      ...current,
      [provider]: {
        status: response.ok && data?.ok ? "success" : "error",
        message,
      },
    }));
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex w-fit rounded-lg border bg-card p-1">
        {([
          { id: "engine", label: "AI 엔진", icon: Cpu },
          { id: "keys", label: "API 키", icon: KeyRound },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "engine" ? (
        <>
          <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Cpu className="size-4" />
          AI 엔진
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
            <div className="space-y-1">
              <h2 className="text-base font-medium">기본 실행 엔진</h2>
              <p className="text-sm text-muted-foreground">
                새 작업을 시작할 때 `/api/run`에 전달할 provider 기본값입니다.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Settings2 className="size-3.5" />
              localStorage
            </div>
          </div>

          <div className="grid gap-2 p-4 md:grid-cols-3">
            {providerOptions.map((option) => {
              const selected = option.id === settings.defaultProvider;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectProvider(option.id)}
                  className={cn(
                    "min-h-32 rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 text-transparent"
                      )}
                      aria-hidden="true"
                    >
                      <Check className="size-3.5" />
                    </span>
                  </div>
                  <p className="min-h-10 text-sm leading-5 text-muted-foreground">
                    {option.detail}
                  </p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    실행: <span className="text-foreground">{option.resolved}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Workflow className="size-4" />
          Stage override
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
            <div>
              <h2 className="text-base font-medium">AI 단계 DeepSeek</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                제작 추출, 풀이, 검증, 오검 리뷰 단계에만 적용됩니다.
              </p>
            </div>
            <Button
              variant={deepSeekEnabled ? "secondary" : "default"}
              onClick={deepSeekEnabled ? disableDeepSeek : enableDeepSeek}
            >
              <Sparkles className="size-4" />
              {deepSeekEnabled ? "자동으로 전환" : "DeepSeek 사용"}
            </Button>
          </div>

          <div className="grid gap-2 p-4 md:grid-cols-2">
            {AI_STAGE_KEYS.map((stageKey) => {
              const recommendation = recommendStageProvider({
                stageKey,
                stageOverrides: settings.stageOverrides,
                telemetry: [],
              });
              const active = settings.stageOverrides[stageKey] === "deepseek-v4";

              return (
                <div
                  key={stageKey}
                  className={cn(
                    "flex min-h-20 items-center justify-between gap-3 rounded-lg border px-4 py-3",
                    active ? "border-primary bg-primary/5" : "border-border bg-background"
                  )}
                >
                  <div>
                    <div className="text-sm font-medium">{stageLabels[stageKey]}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {stageKey} · 실행 {recommendation.provider}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-transparent"
                    )}
                    aria-hidden="true"
                  >
                    <Check className="size-3.5" />
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            builder, checker, cropper는 로컬 deterministic runner가 처리합니다.
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">현재 선택</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              다음 작업부터 `{settings.defaultProvider}` provider와 AI 단계 설정이 요청 본문에 포함됩니다.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={resetSettings}
          >
            자동으로 되돌리기
          </Button>
        </div>
      </section>
        </>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <KeyRound className="size-4" />
            API 키
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-4">
              <h2 className="text-base font-medium">로컬 API 키</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                입력한 값은 이 앱의 `.env.local`에 저장되고 다음 실행부터 바로 사용됩니다.
              </p>
            </div>

            <div className="grid gap-4 p-4">
              {apiKeyFields.map((field) => {
                const configured = Boolean(envStatus[field.key]?.configured);
                const isSecret = field.key.endsWith("_API_KEY");

                return (
                  <label key={field.key} className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{field.label}</span>
                      <span className={cn(
                        "rounded-md px-2 py-1 text-xs",
                        configured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {configured ? "설정됨" : "미설정"}
                      </span>
                    </div>
                    <input
                      type={isSecret ? "password" : "text"}
                      value={envValues[field.key] ?? ""}
                      onChange={(event) => setEnvValues({
                        ...envValues,
                        [field.key]: event.target.value,
                      })}
                      placeholder={isSecret && configured ? "새 값 입력 시 교체" : field.placeholder}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-4 py-4">
              <p className="text-sm text-muted-foreground">
                빈 API key 입력란은 기존 값을 유지합니다.
              </p>
              <div className="flex items-center gap-3">
                {envMessage ? <span className="text-sm text-muted-foreground">{envMessage}</span> : null}
                <Button onClick={saveEnvSettings}>
                  <KeyRound className="size-4" />
                  저장
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-4">
              <h2 className="text-base font-medium">연결 테스트</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                현재 입력값 또는 저장된 값을 사용해 provider 인증을 확인합니다.
              </p>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-2">
              {([
                { provider: "deepseek", label: "DeepSeek" },
                { provider: "gemini", label: "Nano Banana / Gemini" },
              ] as const).map((item) => {
                const state = apiTests[item.provider];
                const running = state.status === "running";

                return (
                  <div key={item.provider} className="rounded-lg border px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className={cn(
                          "mt-1 text-xs",
                          state.status === "success" ? "text-primary" : state.status === "error" ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {state.message ?? "아직 테스트하지 않음"}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => testApiConnection(item.provider)}
                        disabled={running}
                      >
                        {running ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                        테스트
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
