"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useJobStore, type QuestionResult } from "@/lib/store";
import type { SSEEvent } from "@/lib/claude";

type Part = { t?: string; eq?: string; br?: boolean };

function renderParts(parts: Part[]) {
  return parts.map((p, i) => {
    if (p.br) return <br key={i} />;
    if (p.eq) return <code key={i} className="text-xs bg-muted px-1 rounded">{p.eq}</code>;
    return <span key={i}>{p.t}</span>;
  });
}

/** Send a resume/followup instruction via SSE */
async function sendResumeAction(
  jobId: string,
  instruction: string,
  store: ReturnType<typeof useJobStore.getState>,
) {
  store.setStatus("running");
  store.addLog({
    timestamp: new Date().toISOString(),
    stage: "system",
    message: instruction,
    level: "info",
  });

  try {
    const res = await fetch(`/api/run/${jobId}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });

    if (!res.ok || !res.body) {
      store.setStatus("failed");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const dataLine = line.trim();
        if (!dataLine.startsWith("data: ")) continue;
        try {
          const sseEvent: SSEEvent = JSON.parse(dataLine.slice(6));
          handleSSEEvent(sseEvent, store);
        } catch { /* skip */ }
      }
    }

    if (useJobStore.getState().status === "running") {
      store.setStatus("done");
    }
  } catch {
    store.setStatus("failed");
  }
}

function handleSSEEvent(event: SSEEvent, store: ReturnType<typeof useJobStore.getState>) {
  const data = event.data;
  switch (event.event) {
    case "log":
      store.addLog({
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
        stage: (data.stage as string) ?? "system",
        message: (data.message as string) ?? "",
        level: (data.level as "info" | "warn" | "error") ?? "info",
      });
      break;
    case "stage":
      store.updateStage(data.name as string, {
        status: data.status as "running" | "done",
        ...(data.status === "running" ? { startedAt: new Date().toISOString() } : {}),
        ...(data.status === "done" ? { finishedAt: new Date().toISOString() } : {}),
      });
      break;
    case "question":
      store.updateQuestionResult(
        data.number as number,
        data.phase as string,
        data.content as Record<string, unknown>,
      );
      break;
    case "result":
      store.setResult({
        status: data.status as string,
        outputPath: data.outputPath as string | undefined,
        summary: data.result as string | undefined,
      });
      store.setStatus((data.status as string) === "success" ? "done" : "failed");
      break;
    case "error":
      store.addLog({
        timestamp: new Date().toISOString(),
        stage: "system",
        message: (data.message as string) ?? "",
        level: "error",
      });
      store.setStatus("failed");
      break;
  }
}

function QuestionImages({ qNum }: { qNum: number }) {
  const padded = String(qNum).padStart(2, "0");
  // 원본: 프론트엔드 업로드 경로 (Windows Next.js에서 접근 가능)
  const originalSrc = `/api/file?path=${encodeURIComponent(`inputs/시험지 제작/question_images/q${padded}.png`)}`;
  // 정리본: CLI 작업 경로 (SSE 서버 경유 또는 outputs에 복사된 경우)
  const cleanedSrc = `/api/file?path=${encodeURIComponent(`inputs/시험지 제작/question_images/cleaned/q${padded}.png`)}`;
  const [showImages, setShowImages] = useState(false);
  const [cleanedError, setCleanedError] = useState(false);

  return (
    <div className="pt-2">
      <button
        onClick={() => setShowImages(!showImages)}
        className="text-xs text-blue-500 hover:underline"
      >
        {showImages ? "이미지 숨기기" : "원본/정리본 이미지 보기"}
      </button>
      {showImages && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground block mb-1">원본</span>
            <img
              src={originalSrc}
              alt={`문제 ${qNum} 원본`}
              className="w-full rounded border bg-white"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block mb-1">정리본</span>
            {!cleanedError ? (
              <img
                src={cleanedSrc}
                alt={`문제 ${qNum} 정리본`}
                className="w-full rounded border bg-white"
                onError={() => setCleanedError(true)}
              />
            ) : (
              <div className="text-xs text-muted-foreground p-4 border rounded bg-muted/30 text-center">
                정리본 없음
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const RESUME_ACTIONS = [
  { label: "이미지 재정리", from: "cleaned", color: "text-purple-600" },
  { label: "재추출", from: "extractor", color: "text-blue-600" },
  { label: "해설 재작성", from: "solver", color: "text-yellow-600" },
  { label: "검증 재실행", from: "verifier", color: "text-green-600" },
] as const;

function ActionButtons({ qNum }: { qNum: number }) {
  const jobId = useJobStore((s) => s.jobId);
  const status = useJobStore((s) => s.status);
  const store = useJobStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = useCallback(async (from: string) => {
    if (!jobId || status === "running") return;
    setLoading(from);
    const instruction = `V3 resume --q=${qNum} --from=${from}`;
    await sendResumeAction(jobId, instruction, store);
    setLoading(null);
  }, [jobId, status, qNum, store]);

  const disabled = !jobId || status === "running";

  return (
    <div className="flex flex-wrap gap-1 pt-2 border-t mt-2">
      {RESUME_ACTIONS.map((action) => (
        <Button
          key={action.from}
          variant="ghost"
          size="sm"
          disabled={disabled || loading !== null}
          onClick={() => handleAction(action.from)}
          className={`h-6 px-2 text-[10px] ${action.color} hover:bg-muted`}
        >
          {loading === action.from ? (
            <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function QuestionCard({ qr }: { qr: QuestionResult }) {
  const [expanded, setExpanded] = useState(false);
  const ext = qr.extracted as Record<string, unknown> | undefined;
  const sol = qr.solved as Record<string, unknown> | undefined;
  const ver = qr.verified as Record<string, unknown> | undefined;

  const phases: string[] = [];
  if (ext) phases.push("추출");
  if (sol) phases.push("해설");
  if (ver) phases.push("검증");

  const statusColor = ver
    ? "bg-[var(--color-status-success)]"
    : sol
    ? "bg-yellow-500"
    : ext
    ? "bg-blue-500"
    : "bg-muted";

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
        <span className="text-sm font-medium">{qr.number}번</span>
        <span className="text-xs text-muted-foreground">
          {ext && (ext as Record<string, unknown>).subtopic
            ? String((ext as Record<string, unknown>).subtopic)
            : ""}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {phases.join(" → ")}
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t bg-muted/20">
          {/* Images: original + cleaned */}
          <QuestionImages qNum={qr.number} />

          {/* Extracted */}
          {ext && (
            <div className="pt-2">
              <h5 className="text-xs font-medium text-blue-600 mb-1">추출 결과</h5>
              <div className="space-y-1 text-xs">
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-12 shrink-0">유형</span>
                  <span>{String(ext.type ?? "")} / {String(ext.score ?? "")}점 / {String(ext.difficulty ?? "")}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-12 shrink-0">단원</span>
                  <span>{String(ext.subtopic ?? "")}</span>
                </div>
                {Array.isArray(ext.parts) && (
                  <div className="flex gap-4">
                    <span className="text-muted-foreground w-12 shrink-0">본문</span>
                    <span className="leading-relaxed">{renderParts(ext.parts as Part[])}</span>
                  </div>
                )}
                {Array.isArray(ext.choices) && (
                  <div className="flex gap-4">
                    <span className="text-muted-foreground w-12 shrink-0">선지</span>
                    <div className="space-y-0.5">
                      {(ext.choices as Part[][]).map((c: Part[], i: number) => (
                        <div key={i}>
                          <span className="text-muted-foreground mr-1">{["①","②","③","④","⑤"][i]}</span>
                          {renderParts(c)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-12 shrink-0">정답</span>
                  <span className="font-medium">{String(ext.answer ?? "")}</span>
                </div>
                {Boolean(ext.has_figure) && (
                  <div className="flex gap-4">
                    <span className="text-muted-foreground w-12 shrink-0">그림</span>
                    <span>있음 — {String((ext.figure_info as Record<string, unknown>)?.description_en ?? "")}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Solved */}
          {sol && (
            <div>
              <h5 className="text-xs font-medium text-yellow-600 mb-1">해설</h5>
              <div className="text-xs leading-relaxed">
                {sol.explanation_parts
                  ? renderParts(sol.explanation_parts as Part[])
                  : <span className="text-muted-foreground">(해설 데이터 없음)</span>
                }
              </div>
            </div>
          )}

          {/* Verified */}
          {ver && (
            <div>
              <h5 className="text-xs font-medium text-green-600 mb-1">검증</h5>
              <div className="text-xs">
                <span className={`font-medium ${(ver as Record<string, unknown>).status === "pass" ? "text-green-600" : "text-red-600"}`}>
                  {String((ver as Record<string, unknown>).status ?? "").toUpperCase()}
                </span>
                {Array.isArray((ver as Record<string, unknown>).issues) && ((ver as Record<string, unknown>).issues as unknown[]).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {((ver as Record<string, unknown>).issues as Record<string, unknown>[]).map((issue, i) => (
                      <div key={i} className="text-red-600">
                        [{String(issue.category)}] {String(issue.description)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <ActionButtons qNum={qr.number} />
        </div>
      )}
    </div>
  );
}

export function QuestionResultPanel() {
  const questionResults = useJobStore((s) => s.questionResults);
  const jobId = useJobStore((s) => s.jobId);
  const status = useJobStore((s) => s.status);
  const store = useJobStore();
  const entries = Object.values(questionResults).sort((a, b) => a.number - b.number);
  const [globalLoading, setGlobalLoading] = useState<string | null>(null);

  if (entries.length === 0) return null;

  const doneCount = entries.filter((q) => q.verified || q.solved).length;
  const isDone = status === "done" || status === "failed";

  const handleGlobalAction = async (from: string, label: string) => {
    if (!jobId || status === "running") return;
    setGlobalLoading(from);
    const instruction = `V3 resume --from=${from}`;
    await sendResumeAction(jobId, instruction, store);
    setGlobalLoading(null);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">문제별 결과</h3>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{entries.length}문제 처리
        </span>
      </div>

      {/* Review confirmation + Global action buttons */}
      {isDone && (
        <div className="space-y-2 pb-2 border-b">
          {/* Review confirmation: 사용자 검증 완료 → 다음 단계 진행 */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={globalLoading !== null}
              onClick={() => handleGlobalAction("review", "검증 확인 → 다음 단계 진행")}
              className="h-8 text-xs flex-1"
            >
              {globalLoading === "review" ? (
                <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              검증 완료, 다음 단계 진행
            </Button>
          </div>

          {/* Phase 2 individual re-run buttons */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={globalLoading !== null}
              onClick={() => handleGlobalAction("figure", "그림 재처리")}
              className="h-7 text-xs"
            >
              {globalLoading === "figure" && (
                <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              그림 재처리
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={globalLoading !== null}
              onClick={() => handleGlobalAction("builder", "HWPX 재조립")}
              className="h-7 text-xs"
            >
              {globalLoading === "builder" && (
                <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              HWPX 재조립
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
        {entries.map((qr) => (
          <QuestionCard key={qr.number} qr={qr} />
        ))}
      </div>
    </Card>
  );
}
