"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_AI_SETTINGS,
  readAISettings,
  writeAISettings,
  type SelectableProviderId,
} from "@/lib/ai/settings";
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

export default function SettingsPage() {
  const [defaultProvider, setDefaultProvider] = useState<SelectableProviderId>(
    DEFAULT_AI_SETTINGS.defaultProvider
  );

  useEffect(() => {
    setDefaultProvider(readAISettings().defaultProvider);
  }, []);

  const selectProvider = (provider: SelectableProviderId) => {
    setDefaultProvider(writeAISettings({ defaultProvider: provider }).defaultProvider);
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
              const selected = option.id === defaultProvider;

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

      <section className="rounded-lg border bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">현재 선택</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              다음 작업부터 `{defaultProvider}` provider가 요청 본문에 포함됩니다.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => selectProvider(DEFAULT_AI_SETTINGS.defaultProvider)}
          >
            자동으로 되돌리기
          </Button>
        </div>
      </section>
    </div>
  );
}
