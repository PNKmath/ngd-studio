"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CropperWorkspace, type CropperWorkspaceRef } from "@/components/cropper/CropperWorkspace";
import { MetaForm, type MetaValue } from "@/components/upload/MetaForm";
import { parseExamMetaFromFilename } from "@/lib/pdf/filenameMeta";
import { useJobRunner } from "@/lib/useJobRunner";
import { useJobStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { QuestionList, QuestionDetailModal, QuestionPanelHeader } from "@/components/results/QuestionResultPanel";
import { LogStream } from "@/components/log/LogStream";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { FollowupChat } from "@/components/shared/FollowupChat";
import {
  AI_STAGE_KEYS,
  DEFAULT_AI_SETTINGS,
  readAISettings,
  type AISettings,
} from "@/lib/ai/settings";
import type { AIProviderId, AIStageKey } from "@/lib/ai";

type FigureStatus = { pending: boolean; done: boolean; success: number[]; failed: number[]; images: string[] };
type BuildStatus = {
  pending: boolean;
  status?: "running" | "retrying" | "fallback" | "success" | "failed";
  hwpx_path?: string;
  error?: string;
  retried?: { problem: number; agent: string }[];
  fallback?: boolean;
};

const AUTO_SPLIT_LS_KEY = "cropper.auto-split-on-upload";
const META_LS_KEY = "create-v4.meta-form";
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);
const DEFAULT_META: MetaValue = {
  school: "",
  grade: 2,
  year: CURRENT_YEAR,
  subject: "수학 I",
  semester: "1학기",
  examType: "중간",
  range: "",
};

function loadStoredAutoSplitEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTO_SPLIT_LS_KEY) === "true";
  } catch {
    return false;
  }
}

function loadStoredMeta(): MetaValue {
  if (typeof window === "undefined") return DEFAULT_META;
  try {
    const raw = sessionStorage.getItem(META_LS_KEY);
    return raw ? { ...DEFAULT_META, ...JSON.parse(raw) } : DEFAULT_META;
  } catch {
    return DEFAULT_META;
  }
}


export default function CreateV4Page() {
  const reset = useJobStore((s) => s.reset);
  const { startJob, stopJob, pauseJob } = useJobRunner();
  const cropperRef = useRef<CropperWorkspaceRef>(null);

  // Store subscriptions
  const status = useJobStore((s) => s.status);
  const mode = useJobStore((s) => s.mode);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);
  const jobId = useJobStore((s) => s.jobId);
  const result = useJobStore((s) => s.result);
  const v3Meta = useJobStore((s) => s.v3Meta);
  const setV3Meta = useJobStore((s) => s.setV3Meta);
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isFailed = status === "failed";
  const isDone = status === "done" || status === "failed";
  const hasJob = isRunning || isDone || isPaused;

  const resumeOrRetry = useCallback(async () => {
    const base = v3Meta ?? {};
    const jobMeta = { ...base, resumeFrom: "auto" };
    setV3Meta(jobMeta);

    // Pre-load all question data from cache
    fetch("/api/question-images")
      .then((r) => r.json())
      .then(async (existingImages) => {
        const qNums = [...(existingImages.numbers || []), ...(existingImages.essayNumbers || [])];
        const phases = ["extracted", "solved", "verified"];
        for (const num of qNums) {
          for (const phase of phases) {
            try {
              const res = await fetch(`/api/v3cache-data?q=${num}&phase=${phase}`);
              if (res.ok) {
                const data = await res.json();
                useJobStore.getState().updateQuestionResult(num, phase, data);
              }
            } catch { /* ignore */ }
          }
        }
        await startJob("resume", { pdf: "" }, jobMeta);
      })
      .catch(() => {});
  }, [v3Meta, startJob, setV3Meta]);

  const [autoSplitEnabled, setAutoSplitEnabled] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);

  useEffect(() => {
    setAutoSplitEnabled(loadStoredAutoSplitEnabled());
    setAiSettings(readAISettings());
    const onFocus = () => setAiSettings(readAISettings());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const deepSeekStages = AI_STAGE_KEYS.filter(
    (key) => aiSettings.stageOverrides[key] === "deepseek-v4"
  );
  const deepSeekBlocksCreate = deepSeekStages.includes("create.extractor");

  function handleAutoSplitToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setAutoSplitEnabled(next);
    try {
      localStorage.setItem(AUTO_SPLIT_LS_KEY, String(next));
    } catch {}
  }

  const [meta, setMeta] = useState<MetaValue>(DEFAULT_META);

  useEffect(() => {
    setMeta(loadStoredMeta());
  }, []);

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
        year: v3Meta.year ?? CURRENT_YEAR,
        subject: v3Meta.subject ?? "수학 I",
        semester: v3Meta.semester ?? "1학기",
        examType: v3Meta.examType ?? "중간",
        range: v3Meta.range ?? "",
      });
    });
  }, [v3Meta, hasJob]);

  // 이전 작업 재개 상태
  const [existingImages, setExistingImages] = useState<{ count: number; hasClean: boolean; numbers: number[]; essayNumbers: number[] } | null>(null);
  const [resumeFrom] = useState("auto");

  // figure 상태 + 폴링
  const [figureStatus, setFigureStatus] = useState<FigureStatus | null>(null);
  const figureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // build 상태 + 폴링
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const buildIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recoveryHint, setRecoveryHint] = useState<string | null>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  const isMetaComplete =
    meta.school.trim().length > 0 &&
    meta.grade > 0 &&
    meta.year > 0 &&
    meta.subject.trim().length > 0 &&
    meta.semester.trim().length > 0 &&
    meta.examType.trim().length > 0 &&
    meta.range.trim().length > 0;

  // 이전 작업 재개 이미지 fetch (진행 중인 작업이 없을 때만)
  useEffect(() => {
    if (hasJob) return;
    fetch("/api/question-images")
      .then((r) => r.json())
      .then((data) => {
        if (data.count > 0) setExistingImages(data);
      })
      .catch(() => {});
  }, [hasJob]);

  const handleResume = useCallback(async () => {
    if (!existingImages) return;
    let cachedMeta: Record<string, unknown> = {};
    try {
      const r = await fetch("/api/v3cache-meta");
      const data = await r.json();
      if (data.found) cachedMeta = data;
    } catch { /* ignore */ }

    const jobMeta = {
      school: (cachedMeta.school as string) || meta.school,
      grade: (cachedMeta.grade as number) || meta.grade,
      year: (cachedMeta.year as number) || meta.year,
      subject: (cachedMeta.subject as string) || meta.subject,
      semester: (cachedMeta.semester as string) || meta.semester,
      examType: (cachedMeta.examType as string) || meta.examType,
      range: (cachedMeta.range as string) || meta.range,
      questionCount: existingImages.count,
      resumeFrom,
    };
    setV3Meta({ ...jobMeta });

    // Pre-load all question data from cache
    const qNums = [...(existingImages.numbers || []), ...(existingImages.essayNumbers || [])];
    const phases = ["extracted", "solved", "verified"];

    for (const num of qNums) {
      for (const phase of phases) {
        try {
          const res = await fetch(`/api/v3cache-data?q=${num}&phase=${phase}`);
          if (res.ok) {
            const data = await res.json();
            useJobStore.getState().updateQuestionResult(num, phase, data);
          }
        } catch { /* ignore */ }
      }
    }

    await startJob("resume", { pdf: "" }, jobMeta);
  }, [existingImages, meta, resumeFrom, startJob, setV3Meta]);

  const canResume = status === "idle" && !!existingImages;

  // figure 확인 패널 표시 여부
  const showFigureConfirm = isDone
    && (mode === "resume" || mode === "create")
    && v3Meta?.resumeFrom === "figure";

  // figure_status.json 폴링
  useEffect(() => {
    if (!showFigureConfirm) {
      if (figureIntervalRef.current) {
        clearInterval(figureIntervalRef.current);
        figureIntervalRef.current = null;
      }
      queueMicrotask(() => setFigureStatus(null));
      return;
    }

    const poll = async () => {
      try {
        const r = await fetch("/api/figure-status");
        const data: FigureStatus = await r.json();
        setFigureStatus(data);
        if (data.done && figureIntervalRef.current) {
          clearInterval(figureIntervalRef.current);
          figureIntervalRef.current = null;
        }
      } catch { /* ignore */ }
    };

    poll();
    figureIntervalRef.current = setInterval(poll, 2000);
    return () => {
      if (figureIntervalRef.current) {
        clearInterval(figureIntervalRef.current);
        figureIntervalRef.current = null;
      }
    };
  }, [showFigureConfirm]);

  const handleConfirmFigure = useCallback(async () => {
    if (!v3Meta) return;
    const jobMeta = { ...v3Meta, resumeFrom: "confirm" };
    await startJob("resume", { pdf: "" }, jobMeta);
  }, [v3Meta, startJob]);

  // build 상태 패널 표시 여부
  const showBuildStatus = (isRunning || isDone) &&
    (mode === "create" || mode === "resume") &&
    v3Meta?.resumeFrom !== "figure";

  // build_status.json 폴링
  useEffect(() => {
    if (!showBuildStatus) {
      if (buildIntervalRef.current) {
        clearInterval(buildIntervalRef.current);
        buildIntervalRef.current = null;
      }
      queueMicrotask(() => setBuildStatus(null));
      return;
    }

    const poll = async () => {
      try {
        const r = await fetch("/api/build-status");
        const data: BuildStatus = await r.json();
        setBuildStatus(data);
        if (!data.pending && (data.status === "success" || data.status === "failed")) {
          if (buildIntervalRef.current) {
            clearInterval(buildIntervalRef.current);
            buildIntervalRef.current = null;
          }
        }
      } catch { /* ignore */ }
    };

    poll();
    buildIntervalRef.current = setInterval(poll, 2000);
    return () => {
      if (buildIntervalRef.current) {
        clearInterval(buildIntervalRef.current);
        buildIntervalRef.current = null;
      }
    };
  }, [showBuildStatus]);

  const handleExtract = useCallback(
    async (items: { number: number; kind?: "regular" | "essay"; blob: Blob }[]) => {
      if (items.length === 0) return;

      if (!isMetaComplete) {
        setSubmitError("학교/학년/학년도/과목/학기/시험/범위 7개 필드를 모두 입력하세요.");
        return;
      }

      if (deepSeekBlocksCreate) {
        setSubmitError(
          "현재 'create.extractor' stage가 DeepSeek로 지정돼 있습니다. DeepSeek V4는 이미지 입력을 지원하지 않으므로 /settings에서 해당 stage를 Claude/Codex로 되돌리세요."
        );
        return;
      }

      setSubmitting(true);
      setSubmitError(null);
      setRecoveryHint(null);

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
        setRecoveryHint("이미지는 저장됐습니다. 페이지를 새로고침하면 '이전 작업 재개' 카드에서 이어 작업할 수 있습니다.");
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
        setRecoveryHint("이미지/메타 모두 저장됐습니다. 페이지를 새로고침하면 '이전 작업 재개' 카드에서 이어 작업할 수 있습니다.");
        setSubmitting(false);
      }
    },
    [meta, isMetaComplete, deepSeekBlocksCreate, startJob, setV3Meta]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden bg-background text-foreground">
      {/* Sophisticated Studio Control Center (Top Bar) */}
      <div className="shrink-0 border rounded-2xl mb-5 bg-card shadow-sm flex items-start p-1 overflow-hidden">
        {/* Section 1: Exam Configuration (The Form) */}
        <div className="px-5 py-3 flex-[3] min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Exam Configuration</span>
            {!hasJob && <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
            {hasJob && <span className="text-[9px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">LOCKED</span>}
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {/* Column 1: Core Info */}
            <div className="flex flex-col gap-2.5 min-w-[200px]">
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">학교</span>
                <input
                  type="text"
                  value={hasJob ? (v3Meta?.school || "") : meta.school}
                  onChange={(e) => handleMetaChange({ ...meta, school: e.target.value })}
                  placeholder="학교명 입력"
                  disabled={submitting || isRunning || hasJob}
                  className="flex-1 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none transition-colors placeholder:text-muted-foreground/40 disabled:opacity-70"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">학년</span>
                <select
                  value={hasJob ? (v3Meta?.grade || 2) : meta.grade}
                  onChange={(e) => handleMetaChange({ ...meta, grade: Number(e.target.value) })}
                  disabled={submitting || isRunning || hasJob}
                  className="w-24 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none cursor-pointer disabled:opacity-70"
                >
                  {[1, 2, 3].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">학년도</span>
                <select
                  value={hasJob ? (v3Meta?.year || meta.year) : meta.year}
                  onChange={(e) => handleMetaChange({ ...meta, year: Number(e.target.value) })}
                  disabled={submitting || isRunning || hasJob}
                  className="w-24 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none cursor-pointer disabled:opacity-70"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Column 2: Subject & Semester */}
            <div className="flex flex-col gap-2.5 min-w-[180px]">
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">과목</span>
                <select
                  value={hasJob ? (v3Meta?.subject || "수학 I") : meta.subject}
                  onChange={(e) => handleMetaChange({ ...meta, subject: e.target.value })}
                  disabled={submitting || isRunning || hasJob}
                  className="flex-1 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none cursor-pointer disabled:opacity-70"
                >
                  {["수학", "수학 I", "수학 II", "확률과 통계", "미적분", "기하"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">학기</span>
                <select
                  value={hasJob ? (v3Meta?.semester || "1학기") : meta.semester}
                  onChange={(e) => handleMetaChange({ ...meta, semester: e.target.value })}
                  disabled={submitting || isRunning || hasJob}
                  className="w-24 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none cursor-pointer disabled:opacity-70"
                >
                  <option value="1학기">1학기</option>
                  <option value="2학기">2학기</option>
                </select>
              </div>
            </div>

            {/* Column 3: Exam & Range */}
            <div className="flex flex-col gap-2.5 min-w-[200px]">
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">시험</span>
                <select
                  value={hasJob ? (v3Meta?.examType || "중간") : meta.examType}
                  onChange={(e) => handleMetaChange({ ...meta, examType: e.target.value })}
                  disabled={submitting || isRunning || hasJob}
                  className="w-24 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none cursor-pointer disabled:opacity-70"
                >
                  <option value="중간">중간</option>
                  <option value="기말">기말</option>
                  <option value="모의">모의</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-muted-foreground font-semibold">범위</span>
                <input
                  type="text"
                  value={hasJob ? (v3Meta?.range || "") : meta.range}
                  onChange={(e) => handleMetaChange({ ...meta, range: e.target.value })}
                  placeholder="예: 지수~로그"
                  disabled={submitting || isRunning || hasJob}
                  className="flex-1 px-0 py-0.5 text-sm bg-transparent border-b border-transparent focus:border-primary outline-none transition-colors placeholder:text-muted-foreground/40 disabled:opacity-70"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Partial Separator */}
        <div className="w-px h-16 bg-border/40 self-center mx-2" />

        {/* Section 2: AI Config */}
        <div className="px-6 py-3 min-w-[160px]">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">AI Provider</div>
          <div className="flex flex-col gap-2">
            {AI_STAGE_KEYS.slice(0, 3).map((stageKey) => {
              const provider = aiSettings.stageOverrides[stageKey] ?? aiSettings.defaultProvider;
              const isDeepSeek = provider === "deepseek-v4";
              return (
                <div key={stageKey} className="flex items-center justify-between gap-6">
                  <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tight">{STAGE_LABEL[stageKey]}</span>
                  <span className={cn("text-[10px] font-mono", isDeepSeek ? "text-blue-500 font-bold" : "text-foreground/80")}>
                    {isDeepSeek ? "DS-V4" : (PROVIDER_LABEL[provider as AIProviderId] ?? "Auto")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Partial Separator */}
        <div className="w-px h-16 bg-border/40 self-center mx-2" />

        {/* Section 3: Job Status */}
        <div className="px-6 py-3 min-w-[130px]">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Status</div>
          <div className="flex items-center gap-2.5">
            <span className={cn("w-2 h-2 rounded-full ring-4 ring-offset-0", 
              isRunning ? "bg-yellow-500 animate-pulse ring-yellow-500/20" :
              isPaused ? "bg-blue-500 ring-blue-500/20" :
              !hasJob ? "bg-muted-foreground/20 ring-transparent" :
              result?.status === "success" ? "bg-green-500 ring-green-500/20" : "bg-destructive ring-destructive/20"
            )} />
            <span className="text-xs font-bold tracking-tight uppercase">
              {isRunning ? "Running" : isPaused ? "Paused" : !hasJob ? "Idle" : result?.status === "success" ? "Success" : "Failed"}
            </span>
          </div>
        </div>

        {/* Section 4: Global Actions */}
        <div className="px-6 py-3 bg-muted/10 self-stretch flex flex-col justify-center gap-3 min-w-[240px] rounded-r-2xl border-l">
          <div className="flex items-center gap-2">
            {!hasJob ? (
              <>
                <Button 
                  onClick={() => cropperRef.current?.openFilePicker()} 
                  disabled={submitting} 
                  variant="outline"
                  size="sm" 
                  className="h-9 flex-1 text-xs font-bold border-primary text-primary hover:bg-primary/5 transition-all shadow-sm active:scale-95 gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  PDF 열기
                </Button>
                {existingImages && (
                  <Button onClick={handleResume} disabled={submitting} size="sm" className="h-9 flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md active:scale-95">
                    작업 재개
                  </Button>
                )}
              </>
            ) : (
              <div className="flex gap-2 w-full">
                {isRunning && (
                  <>
                    <Button onClick={pauseJob} variant="outline" size="sm" className="flex-1 h-9 text-xs font-bold border-muted-foreground/30">일시 정지</Button>
                    <Button onClick={stopJob} variant="destructive" size="sm" className="flex-1 h-9 text-xs font-bold">중단</Button>
                  </>
                )}
                {(isPaused || isFailed) && (
                  <>
                    <Button onClick={resumeOrRetry} size="sm" className="flex-1 h-9 text-xs font-bold bg-primary shadow-lg shadow-primary/20">작업 재개</Button>
                    <Button onClick={reset} variant="outline" size="sm" className="flex-1 h-9 text-xs font-bold border-muted-foreground/30">초기화</Button>
                  </>
                )}
                {status === "done" && !isFailed && (
                  <>
                    <DownloadButton jobId={jobId ?? ""} disabled={result?.status !== "success"} />
                    <Button onClick={reset} variant="outline" size="sm" className="flex-1 h-9 text-xs font-bold">새 작업</Button>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={autoSplitEnabled} onChange={handleAutoSplitToggle} className="accent-primary w-3.5 h-3.5" />
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-bold uppercase tracking-tight">Auto-Split</span>
            </label>
            {!hasJob && !existingImages && <span className="text-[9px] text-muted-foreground font-mono opacity-50 uppercase">Ready</span>}
          </div>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex gap-5 overflow-hidden">
        {/* Left Sidebar: Project Navigator */}
        <div className="w-[400px] shrink-0 flex flex-col border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="shrink-0 px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Navigator
            </span>
            {hasJob && v3Meta?.questionCount && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {Object.keys(useJobStore.getState().questionResults).length} / {v3Meta.questionCount}
              </span>
            )}
          </div>

          {hasJob && (
            <div className="shrink-0 px-5 py-1.5 border-b bg-muted/10 flex items-center gap-3 text-[9px] text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1" title="추출 단계 완료 여부">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70" />추출
              </span>
              <span className="flex items-center gap-1" title="풀이(해설) 단계 완료 여부">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />풀이
              </span>
              <span className="flex items-center gap-1" title="검증 단계 — pass / 적색 fail">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)]/70" />검증
              </span>
              <span className="flex items-center gap-1 opacity-70" title="그림이 필요한 문제(has_figure)">
                <span className="w-1.5 h-1.5 rounded-full bg-muted border border-border" />그림
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!hasJob ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-40">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center rotate-3 border-2 border-dashed border-muted-foreground/30">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No Active Session</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    상단에서 PDF를 업로드하거나<br/>이전 작업을 재개하세요.
                  </p>
                </div>
              </div>
            ) : (
              <QuestionList onItemClick={() => setQuestionModalOpen(true)} />
            )}
          </div>

          {!hasJob && !isMetaComplete && (
             <div className="p-5 bg-amber-500/[0.03] border-t border-amber-500/10">
               <div className="p-3 rounded-xl border border-amber-500/20 bg-card text-[11px] text-amber-700 leading-normal flex gap-2.5 shadow-sm">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span>모든 필수 설정을 완료해야<br/>추출을 시작할 수 있습니다.</span>
               </div>
             </div>
          )}
        </div>

        {/* Right Workspace: The Interactive Area */}
        <div className="flex-1 flex flex-col border rounded-xl bg-card overflow-hidden shadow-sm">
          {/* Fixed Workspace Pipeline */}
          <div className="shrink-0 border-b px-4 py-3 bg-muted/5">
            <PipelineView 
              mode="create" 
              stages={stages.length > 0 ? stages : undefined} 
              orientation="horizontal" 
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {!hasJob ? (
              <CropperWorkspace
                ref={cropperRef}
                onExtract={handleExtract}
                autoSplitOnUpload={autoSplitEnabled}
                onPdfSelected={handlePdfSelected}
              />
            ) : (
              <div className="flex flex-col h-full">
                <div className="shrink-0 border-b px-6 py-3 bg-background/50">
                  <QuestionPanelHeader />
                </div>
                <div className="shrink-0 px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Activity Log</span>
                  <span className="text-[9px] text-muted-foreground/60">문제 클릭 → 팝업으로 상세 보기</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <LogStream logs={logs} />
                </div>
              </div>
            )}

            {!hasJob && existingImages && (
              <div className="absolute top-4 right-4 pointer-events-none">
                <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                  이전 작업이 존재합니다. 상단 "작업 재개"를 클릭하세요.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Question Detail Modal — 네비게이터 클릭 시 표시 */}
      <QuestionDetailModal
        open={questionModalOpen && hasJob}
        onClose={() => setQuestionModalOpen(false)}
      />

      {/* Bottom Panel — figure 확인 / build 결과 / followup chat 같은 이벤트성 UI 전용 */}
      {hasJob && (showFigureConfirm || (showBuildStatus && buildStatus && !buildStatus.pending) || (isDone && !showFigureConfirm)) && (
        <div className="shrink-0 mt-3 border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col max-h-[220px]">
          <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pipeline Action</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Figure confirm panel */}
            {showFigureConfirm && (
              <Card className="p-4 space-y-4 border-amber-500/30 bg-amber-500/5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    그림 처리 결과 확인
                  </h3>
                  {figureStatus?.done && (
                    <span className="text-xs font-medium text-green-600">
                      완료 {figureStatus.success.length}개
                      {figureStatus.failed.length > 0 && ` / 실패 ${figureStatus.failed.length}개`}
                    </span>
                  )}
                </div>

                {!figureStatus || figureStatus.pending ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground">그림 처리 중...</p>
                  </div>
                ) : figureStatus.done ? (
                  <div className="space-y-4">
                    {figureStatus.images.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2 max-h-[160px] overflow-y-auto p-1">
                        {figureStatus.images.map((imgPath) => (
                          <div key={imgPath} className="group relative aspect-square">
                            <img src={`/api/file?path=${imgPath}`} className="w-full h-full rounded border object-contain bg-white hover:border-amber-500 transition-colors" alt="crop" />
                          </div>
                        ))}
                      </div>
                    )}
                    <Button onClick={handleConfirmFigure} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                      그림 확인 완료 — HWPX 조립 시작
                    </Button>
                  </div>
                ) : null}
              </Card>
            )}

            {/* Build status panel */}
            {showBuildStatus && buildStatus && !buildStatus.pending && (
              <Card className={cn(
                "p-4 border shadow-sm",
                buildStatus.status === "success" ? "border-green-500/30 bg-green-500/5" :
                buildStatus.status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5"
              )}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">HWPX Build Status</h3>
                  <span className={cn("text-xs font-bold uppercase",
                    buildStatus.status === "success" ? "text-green-600" :
                    buildStatus.status === "failed" ? "text-destructive" : "text-yellow-600"
                  )}>
                    {buildStatus.status}
                  </span>
                </div>
                {buildStatus.error && <p className="text-[10px] text-destructive mt-2 font-mono whitespace-pre-wrap">{buildStatus.error}</p>}
              </Card>
            )}

            {isDone && !showFigureConfirm && <FollowupChat disabled={isRunning} />}
          </div>
        </div>
      )}
    </div>
  );
}

const PROVIDER_LABEL: Record<AIProviderId, string> = {
  auto: "auto",
  "claude-cli": "Claude CLI",
  "claude-sdk": "Claude SDK",
  "codex-cli": "Codex CLI",
  "openai-sdk": "OpenAI SDK",
  "deepseek-v4": "DeepSeek V4",
};

const STAGE_LABEL: Record<AIStageKey, string> = {
  "create.extractor": "추출",
  "create.solver": "해설",
  "create.verifier": "검증",
  "review.reviewer": "오검",
};

// TODO(복구): 원본 AIProviderBadge body는 transcript에 보존되지 않아 stub으로 재작성됨.
function AIProviderBadge({
  settings,
  deepSeekStages,
  deepSeekBlocksCreate,
}: {
  settings: AISettings;
  deepSeekStages: AIStageKey[];
  deepSeekBlocksCreate: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-3 flex flex-col justify-between transition-colors",
        deepSeekBlocksCreate ? "border-destructive/40 bg-destructive/5" : "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">AI Provider</h3>
        {deepSeekBlocksCreate && <span className="text-[10px] font-bold text-destructive animate-pulse">ERROR</span>}
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px]">
        {AI_STAGE_KEYS.slice(0, 3).map((stageKey) => {
          const provider = settings.stageOverrides[stageKey] ?? settings.defaultProvider;
          const isDeepSeek = provider === "deepseek-v4";
          return (
            <div key={stageKey} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-medium uppercase text-[8px]">{STAGE_LABEL[stageKey]}</span>
              <span className={cn(
                "font-mono truncate",
                isDeepSeek ? "text-blue-500 font-bold" : "text-foreground"
              )}>
                {PROVIDER_LABEL[provider as AIProviderId] ?? provider}
              </span>
            </div>
          );
        })}
      </div>
      {deepSeekBlocksCreate ? (
        <p className="text-[9px] text-destructive leading-tight mt-1 font-medium">
          ⚠ extractor는 이미지 지원 Provider 필수
        </p>
      ) : deepSeekStages.length > 0 ? (
        <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
          DeepSeek 활성: {deepSeekStages.map((k) => STAGE_LABEL[k]).join(", ")}
        </p>
      ) : (
        <p className="text-[9px] text-muted-foreground mt-1 italic">Default: {PROVIDER_LABEL[settings.defaultProvider as AIProviderId]}</p>
      )}
    </Card>
  );
}
