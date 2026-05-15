"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CropperWorkspace } from "@/components/cropper/CropperWorkspace";

const AUTO_SPLIT_LS_KEY = "cropper.auto-split-on-upload";

export default function CreateV4Page() {
  const router = useRouter();

  const [autoSplitEnabled, setAutoSplitEnabled] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTO_SPLIT_LS_KEY);
      if (stored === "true") setAutoSplitEnabled(true);
    } catch { /* localStorage unavailable */ }
  }, []);

  function handleAutoSplitToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setAutoSplitEnabled(next);
    try {
      localStorage.setItem(AUTO_SPLIT_LS_KEY, String(next));
    } catch { /* quota exceeded */ }
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleExtract = useCallback(
    async (items: { number: number; kind?: "regular" | "essay"; blob: Blob }[]) => {
      if (items.length === 0) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const formData = new FormData();

        // kind별 독립 카운터: "regular"(미지정 포함) → q{N}, "essay" → q_s{N}
        let rIdx = 0;
        let eIdx = 0;
        for (const item of items) {
          let key: string;
          if (item.kind === "essay") {
            eIdx++;
            key = `q_s${String(eIdx).padStart(2, "0")}`;
          } else {
            rIdx++;
            key = `q${String(rIdx).padStart(2, "0")}`;
          }
          const file = new File([item.blob], `${key}.png`, { type: "image/png" });
          formData.append(key, file);
        }

        const res = await fetch("/api/question-images", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        router.push("/create");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "제출 실패");
      } finally {
        setSubmitting(false);
      }
    },
    [router]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-background shrink-0 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoSplitEnabled}
            onChange={handleAutoSplitToggle}
            className="accent-primary"
          />
          <span className="text-muted-foreground">
            PDF 업로드 시 자동 분할 자동 실행
          </span>
        </label>

        {submitError && (
          <span className="text-destructive text-xs">
            오류: {submitError}
          </span>
        )}

        {submitting && (
          <span className="text-muted-foreground text-xs animate-pulse">
            시험지 제작 데이터 업로드 중...
          </span>
        )}
      </div>

      {/* CropperWorkspace */}
      <div className="flex-1 overflow-hidden">
        <CropperWorkspace
          onExtract={handleExtract}
          autoSplitOnUpload={autoSplitEnabled}
        />
      </div>
    </div>
  );
}
