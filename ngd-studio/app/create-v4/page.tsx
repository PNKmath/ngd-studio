"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const mode = useJobStore((s) => s.mode);
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
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);

  useEffect(() => {
    setAiSettings(readAISettings());
    const onFocus = () => setAiSettings(readAISettings());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const deepSeekStages = AI_STAGE_KEYS.filter(
    (key) => aiSettings.stageOverrides[key] === "deepseek-v4"
  );
  const deepSeekActive = deepSeekStages.length > 0;
  const deepSeekBlocksCreate = deepSeekStages.includes("create.extractor");

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

  // 이전 작업 재개 상태
  const [existingImages, setExistingImages] = useState<{ count: number; hasClean: boolean } | null>(null);
  const [resumeFrom, setResumeFrom] = useState("extractor");
  const [showResumeForm, setShowResumeForm] = useState(false);

  // figure 상태 + 폴링
  const [figureStatus, setFigureStatus] = useState<FigureStatus | null>(null);
  const figureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // build 상태 + 폴링
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const buildIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // 이전 작업 재개 이미지 fetch (진행 중인 작업이 없을 때만)
  useEffect(() => {
    if (hasJob) return;
    fetch("/api/question-images")
      .then((r) => r.json())
      .then((data) => {
        if (data.count > 0) setExistingImages({ count: data.count, hasClean: data.hasClean });
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
        setSubmitError("학교/학년/과목/학기/시험/범위 6개 필드를 모두 입력하세요.");
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
              {recoveryHint}
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

            <AIProviderBadge
              settings={aiSettings}
              deepSeekStages={deepSeekStages}
              deepSeekBlocksCreate={deepSeekBlocksCreate}
            />

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

          <AIProviderBadge
            settings={aiSettings}
            deepSeekStages={deepSeekStages}
            deepSeekBlocksCreate={deepSeekBlocksCreate}
          />

          {/* 라이브 파이프라인 */}
          <PipelineView mode="create" stages={stages.length > 0 ? stages : undefined} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <QuestionResultPanel />
          <LogStream logs={logs} />

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
      </div>
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
// 사용자 의도 확인 후 디자인 다듬을 것.
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
      className={`p-3 space-y-2 ${
        deepSeekBlocksCreate ? "border-destructive/40 bg-destructive/5" : ""
      }`}
    >
      <div className="text-xs font-medium text-muted-foreground">AI Provider</div>
      <div className="space-y-1 text-xs">
        {AI_STAGE_KEYS.map((stageKey) => {
          const provider = settings.stageOverrides[stageKey] ?? settings.defaultProvider;
          return (
            <div key={stageKey} className="flex justify-between">
              <span className="text-muted-foreground">{STAGE_LABEL[stageKey]}</span>
              <span className="font-mono">
                {PROVIDER_LABEL[provider as AIProviderId] ?? provider}
              </span>
            </div>
          );
        })}
      </div>
      {deepSeekBlocksCreate && (
        <p className="text-xs text-destructive">
          ⚠ extractor가 DeepSeek로 지정돼 있어 작업 시작이 차단됩니다.
        </p>
      )}
      {!deepSeekBlocksCreate && deepSeekStages.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          DeepSeek 사용 stage: {deepSeekStages.map((k) => STAGE_LABEL[k]).join(", ")}
        </p>
      )}
    </Card>
  );
}
