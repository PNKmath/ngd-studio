"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function QuestionImages({ qNum, version }: { qNum: number; version?: string }) {
  const padded = String(qNum).padStart(2, "0");
  const v = encodeURIComponent(version ?? "");
  const originalSrc = `/api/file?path=${encodeURIComponent(`inputs/시험지 제작/question_images/q${padded}.png`)}&v=${v}`;
  const cleanedSrc = `/api/file?path=${encodeURIComponent(`inputs/시험지 제작/question_images/cleaned/q${padded}.png`)}&v=${v}`;
  const [cleanedError, setCleanedError] = useState(false);

  useEffect(() => {
    setCleanedError(false);
  }, [qNum, version]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] font-bold bg-white/50">ORIGINAL</Badge>
          <span className="text-[10px] text-muted-foreground font-mono">q{padded}.png</span>
        </div>
        <div className="rounded-xl border bg-white p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalSrc}
            alt={`문제 ${qNum} 원본`}
            className="w-full h-auto rounded-lg"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] font-bold bg-blue-50 text-blue-600 border-blue-100 uppercase">Cleaned</Badge>
          {!cleanedError && <span className="text-[10px] text-muted-foreground font-mono">cleaned/q{padded}.png</span>}
        </div>
        <div className="rounded-xl border bg-white p-2 shadow-sm min-h-[100px] flex items-center justify-center">
          {!cleanedError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cleanedSrc}
              alt={`문제 ${qNum} 정리본`}
              className="w-full h-auto rounded-lg"
              onError={() => setCleanedError(true)}
            />
          ) : (
            <div className="text-[10px] text-muted-foreground italic p-4 text-center">
              정리본 이미지가 아직 생성되지 않았거나<br/>파일을 찾을 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
