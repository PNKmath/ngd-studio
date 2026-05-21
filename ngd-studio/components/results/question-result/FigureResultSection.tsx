"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuestionResult } from "@/lib/store";

export function FigureResultSection({
  entries,
  jobId,
  globalLoading,
  onConfirm,
  onRetryFigure,
  onRetryAll,
}: {
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

  // 미완료 이미지 3초마다 폴링
  useEffect(() => {
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
  }, [figureProblems, loadedSet]);

  const handleRetry = (qNum: number) => {
    setLoadedSet((prev) => { const s = new Set(prev); s.delete(qNum); return s; });
    setRetryCount((prev) => ({ ...prev, [qNum]: (prev[qNum] ?? 0) + 1 }));
    onRetryFigure(qNum);
  };

  const allLoaded = figureProblems.length === 0 || figureProblems.every((q) => loadedSet.has(q.number));

  return (
    <div className="space-y-3">
      {figureProblems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground">
              그림 생성 결과 ({loadedSet.size}/{figureProblems.length})
            </h4>
            <button
              onClick={onRetryAll}
              disabled={!jobId || globalLoading !== null}
              className="text-[10px] text-orange-500 hover:underline disabled:opacity-50"
            >
              전체 재생성
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {figureProblems.map((q) => {
              const retry = retryCount[q.number] ?? 0;
              const src = `/api/file?path=${encodeURIComponent(`outputs/images/prob${q.number}_final.png`)}&_r=${retry}&v=${encodeURIComponent(q.updatedAt ?? "")}`;
              const loaded = loadedSet.has(q.number);
              return (
                <div key={q.number} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {q.number}번 {loaded ? "✓" : "생성 중..."}
                    </span>
                    <button
                      onClick={() => handleRetry(q.number)}
                      disabled={!jobId || globalLoading !== null}
                      className="text-[10px] text-orange-500 hover:underline disabled:opacity-50"
                    >
                      재생성
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`문제 ${q.number} 그림`}
                    className={`w-full rounded border bg-white transition-opacity ${loaded ? "opacity-100" : "opacity-20"}`}
                    onLoad={() => setLoadedSet((prev) => new Set([...prev, q.number]))}
                    onError={() => {/* 폴링이 자동 재시도 */}}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button
        size="sm"
        disabled={!jobId || globalLoading !== null || !allLoaded}
        onClick={onConfirm}
        className="h-8 text-xs w-full"
      >
        {globalLoading === "confirm" ? (
          <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : !allLoaded ? `그림 생성 중... (${loadedSet.size}/${figureProblems.length})` : "확인 → HWPX 조립 시작"}
      </Button>
    </div>
  );
}
