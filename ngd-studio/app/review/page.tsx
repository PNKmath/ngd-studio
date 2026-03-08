"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { LogStream } from "@/components/log/LogStream";
import { ReviewReport } from "@/components/results/ReviewReport";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { useJobStore } from "@/lib/store";
import { useJobRunner } from "@/lib/useJobRunner";
import { summarizeReport } from "@/lib/reviewParser";

export default function ReviewPage() {
  const { startJob } = useJobRunner();
  const status = useJobStore((s) => s.status);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);
  const jobId = useJobStore((s) => s.jobId);
  const result = useJobStore((s) => s.result);
  const reviewItems = useJobStore((s) => s.reviewItems);

  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; size: number; path?: string }[]
  >([]);

  const pdfFile = uploadedFiles.find((f) =>
    f.name.toLowerCase().endsWith(".pdf")
  );
  const hwpxFile = uploadedFiles.find(
    (f) =>
      f.name.toLowerCase().endsWith(".hwpx") ||
      f.name.toLowerCase().endsWith(".hwp")
  );
  const canStart = !!pdfFile && !!hwpxFile && status === "idle";

  const handleStart = useCallback(async () => {
    if (!pdfFile?.path || !hwpxFile?.path) return;
    await startJob("review", { pdf: pdfFile.path, hwpx: hwpxFile.path });
  }, [pdfFile, hwpxFile, startJob]);

  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";

  const summary = reviewItems.length > 0 ? summarizeReport(reviewItems) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Left: Upload + Controls */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-medium">입력 파일</h3>
            <FileDropzone mode="review" onFilesChange={setUploadedFiles} />

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    pdfFile ? "text-[var(--color-status-success)]" : ""
                  }
                >
                  {pdfFile ? "✓" : "○"}
                </span>
                원본 PDF {pdfFile ? `— ${pdfFile.name}` : "(필수)"}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    hwpxFile ? "text-[var(--color-status-success)]" : ""
                  }
                >
                  {hwpxFile ? "✓" : "○"}
                </span>
                작업 HWPX {hwpxFile ? `— ${hwpxFile.name}` : "(필수)"}
              </div>
            </div>

            <Button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full"
            >
              {isRunning ? "검수 진행중..." : "검수 시작"}
            </Button>
          </Card>

          {/* Result summary card */}
          {isDone && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">검수 결과</h3>
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    result?.status === "success"
                      ? "bg-[var(--color-status-success)]"
                      : status === "failed"
                        ? "bg-[var(--color-status-error)]"
                        : "bg-[var(--color-status-success)]"
                  }`}
                />
                {status === "failed" ? "검수 실패" : "검수 완료"}
              </div>
              {summary && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>수정 {summary.fixed}건</div>
                  <div>경고 {summary.warnings}건</div>
                  <div>통과 {summary.passed}건</div>
                </div>
              )}
              {jobId && (
                <DownloadButton
                  jobId={jobId}
                  fileName="reviewed.hwpx"
                  disabled={status === "failed"}
                />
              )}
            </Card>
          )}
        </div>

        {/* Right: Pipeline */}
        <div>
          <PipelineView
            mode="review"
            stages={stages.length > 0 ? stages : undefined}
          />
        </div>
      </div>

      {/* Bottom: Report + Log */}
      {(isRunning || isDone) && (
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              오검 리포트
            </h3>
            <ReviewReport items={reviewItems} />
          </div>
          <LogStream logs={logs} />
        </div>
      )}
    </div>
  );
}
