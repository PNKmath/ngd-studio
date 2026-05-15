"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CropperWorkspace } from "@/components/cropper/CropperWorkspace";
import { MetaForm, type MetaValue } from "@/components/upload/MetaForm";
import { useJobRunner } from "@/lib/useJobRunner";

const AUTO_SPLIT_LS_KEY = "cropper.auto-split-on-upload";
const META_LS_KEY = "create-v4.meta-form";

export default function CreateV4Page() {
  const router = useRouter();
  const { startJob } = useJobRunner();

  const [autoSplitEnabled, setAutoSplitEnabled] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTO_SPLIT_LS_KEY);
      if (stored === "true") setAutoSplitEnabled(true);
    } catch {}
  }, []);

  function handleAutoSplitToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setAutoSplitEnabled(next);
    try {
      localStorage.setItem(AUTO_SPLIT_LS_KEY, String(next));
    } catch {}
  }

  const [meta, setMeta] = useState<MetaValue>({
    school: "",
    grade: 2,
    subject: "수학 I",
    semester: "1학기",
    examType: "중간",
    range: "",
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(META_LS_KEY);
      if (raw) setMeta(JSON.parse(raw));
    } catch {}
  }, []);

  function handleMetaChange(next: MetaValue) {
    setMeta(next);
    try {
      sessionStorage.setItem(META_LS_KEY, JSON.stringify(next));
    } catch {}
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recoveryHint, setRecoveryHint] = useState<string | null>(null);

  const isMetaComplete =
    meta.school.trim().length > 0 &&
    meta.grade > 0 &&
    meta.subject.trim().length > 0 &&
    meta.semester.trim().length > 0 &&
    meta.examType.trim().length > 0 &&
    meta.range.trim().length > 0;

  const handleExtract = useCallback(
    async (items: { number: number; kind?: "regular" | "essay"; blob: Blob }[]) => {
      if (items.length === 0) return;

      if (!isMetaComplete) {
        setSubmitError("학교/학년/과목/학기/시험/범위 6개 필드를 모두 입력하세요.");
        return;
      }

      setSubmitting(true);
      setSubmitError(null);
      setRecoveryHint(null);

      const formData = new FormData();
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

      try {
        const res = await fetch("/api/question-images", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? `이미지 업로드 실패 (${res.status})`);
        }
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "이미지 업로드 실패");
        setSubmitting(false);
        return;
      }

      try {
        const res = await fetch("/api/v3cache-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meta),
        });
        if (!res.ok) throw new Error(`메타 저장 실패 (${res.status})`);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "메타 저장 실패");
        setRecoveryHint("이미지는 저장됐습니다. /create로 이동해 이어 작업하시면 진행됩니다.");
        setSubmitting(false);
        return;
      }

      try {
        const questionImageNums = items.map((it) => it.number);
        await startJob(
          "create",
          { pdf: "", questionImages: questionImageNums },
          {
            ...meta,
            questionCount: items.length,
          }
        );
        router.push("/create");
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "작업 시작 실패");
        setRecoveryHint("이미지/메타 모두 저장됐습니다. /create로 이동해 '이어 작업'을 클릭하시면 진행됩니다.");
        setSubmitting(false);
      }
    },
    [meta, isMetaComplete, startJob, router]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
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

        {recoveryHint && (
          <span className="text-amber-500 text-xs">
            {recoveryHint}{" "}
            <a href="/create" className="underline">
              /create로 이동
            </a>
          </span>
        )}

        {submitting && (
          <span className="text-muted-foreground text-xs animate-pulse">
            시험지 제작 데이터 업로드 중...
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 border-r overflow-y-auto p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-2">시험 정보</h2>
            <MetaForm
              value={meta}
              onChange={handleMetaChange}
              disabled={submitting}
            />
          </div>

          {!isMetaComplete && (
            <p className="text-xs text-muted-foreground">
              필수 필드를 모두 채워주세요.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <CropperWorkspace
            onExtract={handleExtract}
            autoSplitOnUpload={autoSplitEnabled}
          />
        </div>
      </div>
    </div>
  );
}
