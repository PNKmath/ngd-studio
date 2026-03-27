"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useJobStore, type QuestionResult } from "@/lib/store";

type Part = { t?: string; eq?: string; br?: boolean };

function renderParts(parts: Part[]) {
  return parts.map((p, i) => {
    if (p.br) return <br key={i} />;
    if (p.eq) return <code key={i} className="text-xs bg-muted px-1 rounded">{p.eq}</code>;
    return <span key={i}>{p.t}</span>;
  });
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
        </div>
      )}
    </div>
  );
}

export function QuestionResultPanel() {
  const questionResults = useJobStore((s) => s.questionResults);
  const entries = Object.values(questionResults).sort((a, b) => a.number - b.number);

  if (entries.length === 0) return null;

  const doneCount = entries.filter((q) => q.verified || q.solved).length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">문제별 결과</h3>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{entries.length}문제 처리
        </span>
      </div>
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
        {entries.map((qr) => (
          <QuestionCard key={qr.number} qr={qr} />
        ))}
      </div>
    </Card>
  );
}
