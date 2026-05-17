"use client";

import { useCallback, useEffect, useState } from "react";
import { CropperWorkspace } from "@/components/cropper/CropperWorkspace";
import { MetaForm, type MetaValue } from "@/components/upload/MetaForm";
import { parseExamMetaFromFilename } from "@/lib/pdf/filenameMeta";
import { useJobRunner } from "@/lib/useJobRunner";
import { useJobStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { QuestionResultPanel } from "@/components/results/QuestionResultPanel";
import { LogStream } from "@/components/log/LogStream";
import { DownloadButton } from "@/components/shared/DownloadButton";

const AUTO_SPLIT_LS_KEY = "cropper.auto-split-on-upload";
const META_LS_KEY = "create-v4.meta-form";
const DEFAULT_META: MetaValue = {
  school: "",
  grade: 2,
  subject: "수학 I",
  semester: "1학기",
  examType: "중간",
  range: "",
};

function readInitialAutoSplitEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTO_SPLIT_LS_KEY) === "true";
  } catch {
    return false;
  }
}

function readInitialMeta() {
  if (typeof window === "undefined") return DEFAULT_META;
  try {
    const raw = sessionStorage.getItem(META_LS_KEY);
    return raw ? { ...DEFAULT_META, ...JSON.parse(raw) } : DEFAULT_META;
  } catch {
    return DEFAULT_META;
  }
}

export default function CreateV4Page() {
  const { startJob, stopJob } = useJobRunner();

  // Store subscriptions
  const status = useJobStore((s) => s.status);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);
  const jobId = useJobStore((s) => s.jobId);
  const result = useJobStore((s) => s.result);
  const v3Meta = useJobStore((s) => s.v3Meta);
  const setV3Meta = useJobStore((s) => s.setV3Meta);

  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";
  const hasJob = isRunning || isDone;

  const [autoSplitEnabled, setAutoSplitEnabled] = useState(readInitialAutoSplitEnabled);

  function handleAutoSplitToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setAutoSplitEnabled(next);
    try {
      localStorage.setItem(AUTO_SPLIT_LS_KEY, String(next));
    } catch {}
  }

  const [meta, setMeta] = useState<MetaValue>(readInitialMeta);

  function handleMetaChange(next: MetaValue) {
    setMeta(next);
    try {
      sessionStorage.setItem(META_LS_KEY, JSON.stringify(next));
    } catch {}
  }

  const handlePdfSelected = useCallback((fileName: string) => {
    const parsed = parseExamMetaFromFilename(fileName);
    if (!parsed) return;

    setMeta((current) => {
      const next: MetaValue = {
        ...current,
        ...parsed,
        range: parsed.range ?? current.range,
      };
      try {
        sessionStorage.setItem(META_LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // v3Meta auto-restore: 이전 작업 메타를 폼에 복원 (idle 상태일 때만)
  useEffect(() => {
    if (!v3Meta || hasJob) return;
    queueMicrotask(() => {
      setMeta({
        school: v3Meta.school ?? "",
        grade: v3Meta.grade ?? 2,
        subject: v3Meta.subject ?? "수학 I",
        semester: v3Meta.semester ?? "1학기",
        examType: v3Meta.examType ?? "중간",
        range: v3Meta.range ?? "",
      });
    });
  }, [v3Meta, hasJob]);

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

      // 신규 작업 시작: 이전 .v3cache 정리 (create 페이지와 동일)
      await fetch("/api/v3cache-reset", { method: "POST" }).catch(() => {});

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

      // v3Meta를 store에 설정 (startJob 전)
      const jobMeta = { ...meta, questionCount: items.length };
      setV3Meta(jobMeta);

      try {
        const questionImageNums = items.map((it) => it.number);
        await startJob(
          "create",
          { pdf: "", questionImages: questionImageNums },
          jobMeta
        );
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "작업 시작 실패");
        setRecoveryHint("이미지/메타 모두 저장됐습니다. /create로 이동해 '이어 작업'을 클릭하시면 진행됩니다.");
        setSubmitting(false);
      }
    },
    [meta, isMetaComplete, startJob, setV3Meta]
  );

  // --- Idle 뷰 ---
  if (!hasJob) {
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
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">시험 정보</h3>
              <MetaForm
                value={meta}
                onChange={handleMetaChange}
                disabled={submitting}
              />
              {!isMetaComplete && (
                <p className="text-xs text-muted-foreground">
                  필수 필드를 모두 채워주세요.
                </p>
              )}
            </Card>

            <PipelineView mode="create" />
          </div>

          <div className="flex-1 overflow-hidden">
            <CropperWorkspace
              onExtract={handleExtract}
              autoSplitOnUpload={autoSplitEnabled}
              onPdfSelected={handlePdfSelected}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Running / Done 뷰 ---
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 border-r overflow-y-auto p-4 space-y-4">
          {/* 시험 정보 요약 */}
          {v3Meta && (
            <Card className="p-4 space-y-2">
              <h3 className="text-sm font-medium">시험 정보</h3>
              <div className="text-xs space-y-1 text-muted-foreground">
                {v3Meta.school && <div>{v3Meta.school}</div>}
                <div>
                  {v3Meta.grade && `${v3Meta.grade}학년 `}
                  {v3Meta.semester} {v3Meta.examType}
                </div>
                {v3Meta.subject && <div>{v3Meta.subject}</div>}
                {v3Meta.range && <div>{v3Meta.range}</div>}
                {v3Meta.questionCount && <div>문제 {v3Meta.questionCount}개</div>}
              </div>
            </Card>
          )}

          {/* 상태 + 제어 */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${
                isRunning ? "bg-yellow-500 animate-pulse" :
                result?.status === "success" ? "bg-[var(--color-status-success)]" :
                "bg-[var(--color-status-error)]"
              }`} />
              <span className="font-medium">
                {isRunning ? "제작 진행 중..." : result?.status === "success" ? "제작 완료" : "제작 실패"}
              </span>
            </div>

            {isRunning && (
              <Button onClick={stopJob} variant="destructive" className="w-full">중단</Button>
            )}

            {isDone && jobId && (
              <DownloadButton jobId={jobId} disabled={result?.status !== "success"} />
            )}
          </Card>

          {/* 라이브 파이프라인 */}
          <PipelineView mode="create" stages={stages.length > 0 ? stages : undefined} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <QuestionResultPanel />
          <LogStream logs={logs} />
        </div>
      </div>
    </div>
  );
}
