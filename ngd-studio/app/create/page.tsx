"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDropzone } from "@/components/upload/FileDropzone";
import type { UploadedFile } from "@/components/upload/FileDropzone";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { LogStream } from "@/components/log/LogStream";
import { ResultTabs } from "@/components/results/ResultTabs";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { FollowupChat } from "@/components/shared/FollowupChat";
import { GuidePanel, createGuidePages } from "@/components/shared/GuidePanel";
import { useJobStore } from "@/lib/store";
import { useJobRunner } from "@/lib/useJobRunner";

export default function CreatePage() {
  const { startJob, stopJob } = useJobRunner();
  const status = useJobStore((s) => s.status);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);
  const jobId = useJobStore((s) => s.jobId);
  const result = useJobStore((s) => s.result);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const pdfFile = uploadedFiles.find((f) => f.name.toLowerCase().endsWith(".pdf"));
  const canStart = !!pdfFile && status === "idle";

  const handleStart = useCallback(async () => {
    if (!pdfFile?.path) return;
    await startJob("create", { pdf: pdfFile.path });
  }, [pdfFile, startJob]);

  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Left: Upload + Controls */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-medium">입력 파일</h3>
            <FileDropzone mode="create" onFilesChange={setUploadedFiles} />

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className={pdfFile ? "text-[var(--color-status-success)]" : ""}>
                  {pdfFile ? "✓" : "○"}
                </span>
                원본 PDF {pdfFile ? `— ${pdfFile.name}` : "(필수)"}
              </div>
            </div>

            {isRunning ? (
              <Button
                onClick={stopJob}
                variant="destructive"
                className="w-full"
              >
                중단
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={!canStart}
                className="w-full"
              >
                제작 시작
              </Button>
            )}
          </Card>

          {isDone && result && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">결과</h3>
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    result.status === "success"
                      ? "bg-[var(--color-status-success)]"
                      : "bg-[var(--color-status-error)]"
                  }`}
                />
                {result.status === "success" ? "제작 완료" : "제작 실패"}
              </div>
              {jobId && (
                <DownloadButton
                  jobId={jobId}
                  disabled={result.status !== "success"}
                />
              )}
            </Card>
          )}

          <GuidePanel label="참고사항" pages={createGuidePages} />
        </div>

        {/* Right: Pipeline */}
        <div className="space-y-6">
          <PipelineView
            mode="create"
            stages={stages.length > 0 ? stages : undefined}
          />
        </div>
      </div>

      {/* Bottom: Results + Log */}
      {(isRunning || isDone) && (
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          <ResultTabs />
          <LogStream logs={logs} />
        </div>
      )}

      {/* Followup chat */}
      {isDone && (
        <FollowupChat disabled={isRunning} />
      )}
    </div>
  );
}
