"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Settings2, Sparkles, Workflow } from "lucide-react";
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const deepSeekEnabled = allModelStagesUseDeepSeek(settings.stageOverrides);

  useEffect(() => {
    setSettings(readAISettings());
  }, []);

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

  return (
    <div className="max-w-4xl space-y-6">
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
    </div>
  );
}
