"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetaForm, type MetaValue } from "@/components/upload/MetaForm";
import { QuestionSlotGrid } from "@/components/upload/QuestionSlotGrid";
import type { QuestionSlot } from "@/components/upload/QuestionSlotGrid";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { LogStream } from "@/components/log/LogStream";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { FollowupChat } from "@/components/shared/FollowupChat";
import { QuestionResultPanel } from "@/components/results/QuestionResultPanel";
import { useJobStore } from "@/lib/store";
import { useJobRunner } from "@/lib/useJobRunner";

type FigureStatus = { pending: boolean; done: boolean; success: number[]; failed: number[]; images: string[] };
type BuildStatus = {
  pending: boolean;
  status?: "running" | "retrying" | "fallback" | "success" | "failed";
  hwpx_path?: string;
  error?: string;
  retried?: { problem: number; agent: string }[];
  fallback?: boolean;
};

export default function CreatePage() {
  const { startJob, stopJob } = useJobRunner();
  const status = useJobStore((s) => s.status);
  const mode = useJobStore((s) => s.mode);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);
  const jobId = useJobStore((s) => s.jobId);
  const result = useJobStore((s) => s.result);
  const v3Meta = useJobStore((s) => s.v3Meta);
  const setV3Meta = useJobStore((s) => s.setV3Meta);

  const [questionSlots, setQuestionSlots] = useState<QuestionSlot[]>([]);
  const [filledSlotCount, setFilledSlotCount] = useState(0);

  const [meta, setMeta] = useState<MetaValue>({
    school: "",
    grade: 2,
    subject: "수학 I",
    semester: "1학기",
    examType: "중간",
    range: "",
  });

  const [existingImages, setExistingImages] = useState<{ count: number; hasClean: boolean } | null>(null);
  const [resumeFrom, setResumeFrom] = useState("extractor");
  const [showResumeForm, setShowResumeForm] = useState(false);

  const [figureStatus, setFigureStatus] = useState<FigureStatus | null>(null);
  const figureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const buildIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";
  const hasJob = isRunning || isDone;

  // 진행 중인 작업이 있으면 fetch 스킵 — store에 이미 jobId/status 있음
  useEffect(() => {
    if (hasJob) return;
    fetch("/api/question-images")
      .then((r) => r.json())
      .then((data) => {
        if (data.count > 0) setExistingImages({ count: data.count, hasClean: data.hasClean });
      })
      .catch(() => {});
  }, [hasJob]);

  // store v3Meta → 폼 자동 복원 (새로고침 후 idle 복귀 케이스)
  useEffect(() => {
    if (!v3Meta || hasJob) return; // 진행 중이면 폼 안 보임 → 복원 의미 없음
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

  const canStart = filledSlotCount > 0 && status === "idle";
  const canResume = status === "idle" && !!existingImages;

  const handleSlotsChange = useCallback((slots: QuestionSlot[]) => {
    setQuestionSlots(slots);
    setFilledSlotCount(slots.filter((s) => s.file !== null).length);
  }, []);

  const handleStart = useCallback(async () => {
    if (filledSlotCount === 0) return;

    // 신규 작업 시작: 이전 .v3cache를 .v3cache_prev로 백업 후 정리
    // (백엔드 스킬의 0-3 단계가 도달 전 중단되어도 우선순위 충돌이 생기지 않게)
    await fetch("/api/v3cache-reset", { method: "POST" }).catch(() => {});

    const filledSlots = questionSlots.filter((s) => s.file !== null);
    let questionImageNums: number[] = [];

    if (filledSlots.length > 0) {
      const formData = new FormData();
      for (const slot of filledSlots) {
        if (slot.file) {
          formData.append(`q${slot.number}`, slot.file);
        }
      }
      try {
        const res = await fetch("/api/question-images", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        questionImageNums = (data.images ?? []).map((img: { number: number }) => img.number);
      } catch {
        // Continue without question images
      }
    }

    const jobMeta = { ...meta, questionCount: filledSlotCount };
    setV3Meta(jobMeta);

    // 캐시에 메타 저장 — extractor 단계 이전 resume 시 자동 로드용
    await fetch("/api/v3cache-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    }).catch(() => {});

    await startJob("create", { pdf: "", questionImages: questionImageNums }, jobMeta);
  }, [filledSlotCount, questionSlots, startJob, meta, setV3Meta]);

  const handleResume = useCallback(async () => {
    if (!existingImages) return;

    // 캐시에서 시험 정보 로드, 없으면 폼 값 사용
    let cachedMeta: Record<string, unknown> = {};
    try {
      const r = await fetch("/api/v3cache-meta");
      const data = await r.json();
      if (data.found) cachedMeta = data;
    } catch { /* ignore */ }

    const jobMeta = {
      school: (cachedMeta.school as string) || meta.school,
      grade: (cachedMeta.grade as number) || meta.grade,
      subject: (cachedMeta.subject as string) || meta.subject,
      semester: (cachedMeta.semester as string) || meta.semester,
      examType: (cachedMeta.examType as string) || meta.examType,
      range: (cachedMeta.range as string) || meta.range,
      questionCount: existingImages.count,
      resumeFrom,
    };
    setV3Meta({ ...jobMeta });

    await startJob("resume", { pdf: "" }, jobMeta);
  }, [existingImages, meta, resumeFrom, startJob, setV3Meta]);

  // figure 백그라운드 처리 완료 대기 상태 — resumeFrom=figure job이 끝난 후
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

  // build_status.json 폴링 — 빌더가 실행 중이거나 완료된 경우
  const showBuildStatus = (isRunning || isDone) &&
    (mode === "create" || mode === "resume") &&
    v3Meta?.resumeFrom !== "figure";

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

  const handleConfirmFigure = useCallback(async () => {
    if (!v3Meta) return;
    const jobMeta = { ...v3Meta, resumeFrom: "confirm" };
    await startJob("resume", { pdf: "" }, jobMeta);
  }, [v3Meta, startJob]);

  // --- Idle: 입력 폼 ---
  if (!hasJob) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">시험 정보</h3>
              <MetaForm value={meta} onChange={setMeta} />
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={filledSlotCount > 0 ? "text-[var(--color-status-success)]" : ""}>
                  {filledSlotCount > 0 ? "✓" : "○"}
                </span>
                문제 이미지 {filledSlotCount > 0 ? `— ${filledSlotCount}개 삽입됨` : "(필수)"}
              </div>
              <Button onClick={handleStart} disabled={!canStart} className="w-full">
                제작 시작
              </Button>
            </Card>

            {existingImages && (
              <Card className="p-4 space-y-3 border-amber-500/40 bg-amber-500/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">이전 작업 재개</h3>
                  <button
                    onClick={() => setShowResumeForm((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showResumeForm ? "접기" : "펼치기"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  저장된 이미지 {existingImages.count}개{existingImages.hasClean ? " (정리본 있음)" : ""}
                </p>
                {showResumeForm && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground">재개 시작 단계</label>
                      <select
                        value={resumeFrom}
                        onChange={(e) => setResumeFrom(e.target.value)}
                        className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm"
                      >
                        {existingImages.hasClean && <option value="extractor">문제 추출 (extractor)</option>}
                        <option value="solver">해설 생성 (solver)</option>
                        <option value="verifier">해설 검증 (verifier)</option>
                        <option value="figure">그림 처리 (figure)</option>
                        <option value="builder">HWPX 조립 (builder)</option>
                      </select>
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleResume}
                  disabled={!canResume}
                  variant="outline"
                  className="w-full border-amber-500/60 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  재개 ({resumeFrom}부터)
                </Button>
              </Card>
            )}

            <Card className="p-3 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">파이프라인</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                이미지 기반 추출 → 문제별 독립 해설 생성 → 검증(최대 3회) → 그림 처리 → HWPX 조립 → 품질 검수
              </p>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <QuestionSlotGrid maxQuestions={18} onChange={handleSlotsChange} />
            </Card>
            <PipelineView mode="create" />
          </div>
        </div>
      </div>
    );
  }

  // --- Running / Done: 진행 상황 뷰 ---
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Left: Job info + Controls */}
        <div className="space-y-4">
          {/* Meta summary */}
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

          {/* Status + Controls */}
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
              <Button onClick={stopJob} variant="destructive" className="w-full">
                중단
              </Button>
            )}

            {isDone && jobId && (
              <DownloadButton jobId={jobId} disabled={result?.status !== "success"} />
            )}
          </Card>

          {/* Pipeline */}
          <PipelineView
            mode="create"
            stages={stages.length > 0 ? stages : undefined}
          />
        </div>

        {/* Right: Question Results (main area) */}
        <div className="space-y-6">
          <QuestionResultPanel />
          <LogStream logs={logs} />
        </div>
      </div>

      {/* Figure confirm panel — figure_processor.py 백그라운드 완료 대기 */}
      {showFigureConfirm && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">그림 처리 결과 확인</h3>
            {figureStatus?.done && (
              <span className="text-xs text-[var(--color-status-success)]">
                완료 {figureStatus.success.length}개
                {figureStatus.failed.length > 0 && ` / 실패 ${figureStatus.failed.length}개`}
              </span>
            )}
          </div>

          {!figureStatus || figureStatus.pending ? (
            <p className="text-xs text-muted-foreground animate-pulse">그림 처리 중... (백그라운드)</p>
          ) : figureStatus.done ? (
            <>
              {figureStatus.failed.length > 0 && (
                <p className="text-xs text-[var(--color-status-error)]">
                  실패한 문제: {figureStatus.failed.join(", ")} — 수동 확인 필요
                </p>
              )}
              {figureStatus.images.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {figureStatus.images.map((imgPath) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={imgPath}
                      src={`/api/file?path=${imgPath}`}
                      className="w-full rounded border object-contain bg-white"
                      alt={imgPath.split("/").pop()}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">그림 없음 (바로 조립 가능)</p>
              )}
              <Button onClick={handleConfirmFigure} className="w-full">
                확인 — HWPX 조립 시작
              </Button>
            </>
          ) : (
            <p className="text-xs text-[var(--color-status-error)]">그림 처리 실패 — 로그 확인 필요</p>
          )}
        </Card>
      )}

      {/* Build status panel */}
      {showBuildStatus && buildStatus && !buildStatus.pending && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">HWPX 조립</h3>
            <span className={`text-xs font-medium ${
              buildStatus.status === "success" ? "text-[var(--color-status-success)]" :
              buildStatus.status === "failed" ? "text-[var(--color-status-error)]" :
              "text-yellow-500"
            }`}>
              {buildStatus.status === "success" ? "완료" :
               buildStatus.status === "failed" ? "실패" :
               buildStatus.status === "retrying" ? "재처리 중..." :
               buildStatus.status === "fallback" ? "폴백 실행 중..." :
               buildStatus.status === "running" ? "조립 중..." : ""}
            </span>
          </div>

          {buildStatus.hwpx_path && (
            <p className="text-xs text-muted-foreground font-mono">{buildStatus.hwpx_path.split("/").pop()}</p>
          )}

          {buildStatus.retried && buildStatus.retried.length > 0 && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400 space-y-0.5">
              <p className="font-medium">재처리:</p>
              {buildStatus.retried.map((r, i) => (
                <p key={i}>Q{r.problem} — {r.agent}</p>
              ))}
            </div>
          )}

          {buildStatus.fallback && (
            <p className="text-xs text-amber-600 dark:text-amber-400">원본 builder 에이전트로 폴백 실행</p>
          )}

          {buildStatus.error && (
            <p className="text-xs text-[var(--color-status-error)] font-mono whitespace-pre-wrap">{buildStatus.error}</p>
          )}
        </Card>
      )}

      {/* Followup chat */}
      {isDone && !showFigureConfirm && <FollowupChat disabled={isRunning} />}
    </div>
  );
}
