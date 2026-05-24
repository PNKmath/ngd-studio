"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QuestionResult } from "@/lib/store";

export function FigureReviewModal({
  open,
  onClose,
  entries,
  jobId,
  globalLoading,
  onConfirm,
  onRetryFigure,
  onRetryAll,
}: {
  open: boolean;
  onClose: () => void;
  entries: QuestionResult[];
  jobId: string | null;
  globalLoading: string | null;
  onConfirm: () => void;
  onRetryFigure: (qNum: number) => void;
  onRetryAll: () => void;
}) {
  const figureProblems = useMemo(
    () => entries.filter((q) => (q.extracted as Record<string, unknown> | undefined)?.has_figure),
    [entries]
  );

  const [loadedSet, setLoadedSet] = useState<Set<number>>(new Set());
  const [retryCount, setRetryCount] = useState<Record<number, number>>({});

  // 미완료 이미지 3초마다 폴링 (모달이 열려 있을 때만)
  useEffect(() => {
    if (!open) return;
    if (figureProblems.length === 0) return;
    const unloaded = figureProblems.filter((q) => !loadedSet.has(q.number));
    if (unloaded.length === 0) return;
    const timer = setInterval(() => {
      setRetryCount((prev) => {
        const next = { ...prev };
        for (const q of unloaded) next[q.number] = (prev[q.number] ?? 0) + 1;
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [open, figureProblems, loadedSet]);

  const handleRetry = (qNum: number) => {
    setLoadedSet((prev) => {
      const s = new Set(prev);
      s.delete(qNum);
      return s;
    });
    setRetryCount((prev) => ({ ...prev, [qNum]: (prev[qNum] ?? 0) + 1 }));
    onRetryFigure(qNum);
  };

  // 전체 재생성: 개별 handleRetry와 동일하게 cache state를 비워야
  // 이미 onLoad된 이미지가 옛 src(URL 동일)로 캐싱된 채 남지 않는다.
  const handleRetryAll = () => {
    setLoadedSet(new Set());
    setRetryCount((prev) => {
      const next: Record<number, number> = { ...prev };
      for (const q of figureProblems) next[q.number] = (prev[q.number] ?? 0) + 1;
      return next;
    });
    onRetryAll();
  };

  const failedProblems = useMemo(
    () => figureProblems.filter((q) => q.figure?.status === "failed"),
    [figureProblems]
  );

  const allLoaded =
    figureProblems.length === 0 ||
    figureProblems.every((q) => loadedSet.has(q.number) || q.figure?.status === "failed");

  // ESC 닫기 (QuestionDetailModal 패턴 그대로)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border shadow-2xl w-[94vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 px-6 py-4 border-b flex items-center justify-between bg-muted/5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground tracking-tight">
              그림 결과 확인 ({loadedSet.size}/{figureProblems.length})
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] font-bold px-2 py-0 bg-muted/50 border-none text-muted-foreground uppercase tracking-widest"
            >
              Figure
            </Badge>
            {failedProblems.length > 0 && (
              <span className="text-[10px] font-bold text-destructive">
                실패 {failedProblems.length}개
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-transparent hover:border-border"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 영역 — 자체 스크롤 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {figureProblems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              그림이 있는 문제가 없습니다.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground">
                  그림 생성 결과 ({loadedSet.size}/{figureProblems.length})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryAll}
                  disabled={!jobId || globalLoading !== null}
                  className="h-7 text-xs"
                >
                  전체 재생성
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {figureProblems.map((q) => {
                  const retry = retryCount[q.number] ?? 0;
                  const finalSrc = `/api/file?path=${encodeURIComponent(
                    `outputs/images/prob${q.number}_final.png`
                  )}&_r=${retry}`;
                  const refSrc = `/api/file?path=${encodeURIComponent(
                    `inputs/시험지 제작/.v3cache/prob${q.number}_ref.jpg`
                  )}&_r=${retry}`;
                  const loaded = loadedSet.has(q.number);
                  const isFailed = q.figure?.status === "failed";
                  return (
                    <div
                      key={q.number}
                      className={`space-y-2 rounded-lg p-3 ${isFailed ? "border border-destructive/30 bg-destructive/5" : "border border-border/40"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${isFailed ? "text-destructive" : "text-foreground"}`}>
                          {q.number}번 {isFailed ? "✗ 생성 실패" : loaded ? "✓" : "생성 중..."}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(q.number)}
                          disabled={!jobId || globalLoading !== null}
                          className="h-7 text-xs"
                        >
                          재생성
                        </Button>
                      </div>
                      {isFailed ? (
                        <div className="rounded border border-destructive/20 bg-destructive/5 p-3 text-[10px] text-destructive/70 text-center min-h-[60px] flex items-center justify-center">
                          {q.figure?.error
                            ? <span className="font-mono break-all">{q.figure.error}</span>
                            : <span>figure_processor.py 실패</span>
                          }
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground text-center">크롭 원본</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={refSrc}
                              alt={`문제 ${q.number} 크롭 원본`}
                              className="w-full rounded border bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground text-center">생성된 그림</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={finalSrc}
                              alt={`문제 ${q.number} 생성 그림`}
                              className={`w-full rounded border bg-white transition-opacity ${
                                loaded ? "opacity-100" : "opacity-20"
                              }`}
                              onLoad={() =>
                                setLoadedSet((prev) => new Set([...prev, q.number]))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 확인 CTA — handleConfirmFigure(startJob, resumeFrom:"confirm") 경로 */}
          <div className="pt-2">
            <Button
              size="sm"
              disabled={!jobId || globalLoading !== null || !allLoaded}
              onClick={onConfirm}
              className="h-9 text-xs w-full"
            >
              {globalLoading === "confirm" ? (
                <svg
                  className="w-3 h-3 animate-spin mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : !allLoaded ? (
                `그림 생성 중... (${loadedSet.size}/${figureProblems.length})`
              ) : (
                "그림 확인 완료 — HWPX 조립 시작"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
