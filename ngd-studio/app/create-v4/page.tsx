"use client";

import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDropzone } from "@/components/upload/FileDropzone";
import type { UploadedFile } from "@/components/upload/FileDropzone";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { LogStream } from "@/components/log/LogStream";
import { GuidePanel, createGuidePages } from "@/components/shared/GuidePanel";
import { useJobStore } from "@/lib/store";
import { useJobRunner } from "@/lib/useJobRunner";

const SSE_BASE = process.env.NEXT_PUBLIC_SSE_URL ?? "http://localhost:3021";

interface CropResult {
  number: number;
  image: string;
  width: number;
  height: number;
}

export default function CreateV4Page() {
  const { startJob, stopJob } = useJobRunner();
  const status = useJobStore((s) => s.status);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [cropResults, setCropResults] = useState<CropResult[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);

  const pdfFile = uploadedFiles.find((f) =>
    f.name.toLowerCase().endsWith(".pdf")
  );
  const canStart = !!pdfFile && status === "idle";
  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";

  // 크롭 작업 시작
  const handleCrop = useCallback(async () => {
    if (!pdfFile?.path) return;
    setCropResults([]);
    setSelectedQuestion(null);
    await startJob("crop", { pdf: pdfFile.path });
  }, [pdfFile, startJob]);

  // 크롭 완료 후 결과 로드
  useEffect(() => {
    if (status !== "done") return;

    // crop_results.json에서 결과 로드
    const loadResults = async () => {
      try {
        const res = await fetch(
          `/api/file?path=${encodeURIComponent("inputs/시험지 제작/question_images/crop_results.json")}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.questions) {
          setCropResults(
            data.questions.map((q: { number: number; image: string; crop_box?: { width: number; height: number } }) => ({
              number: q.number,
              image: q.image,
              width: q.crop_box?.width ?? 0,
              height: q.crop_box?.height ?? 0,
            }))
          );
        }
      } catch {
        // 파일이 없을 수 있음
      }
    };
    loadResults();
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Left: Upload + Controls */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-medium">PDF 자동 크롭</h3>
            <p className="text-xs text-muted-foreground">
              PDF를 업로드하면 Claude가 각 문제를 자동으로 감지하여 개별 이미지로 크롭합니다.
            </p>
            <FileDropzone
              mode="create"
              onFilesChange={setUploadedFiles}
            />

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
                onClick={handleCrop}
                disabled={!canStart}
                className="w-full"
              >
                자동 크롭 시작
              </Button>
            )}
          </Card>

          {/* 크롭 결과 요약 */}
          {isDone && cropResults.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">크롭 결과</h3>
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === "done"
                      ? "bg-[var(--color-status-success)]"
                      : "bg-[var(--color-status-error)]"
                  }`}
                />
                {cropResults.length}개 문제 감지
              </div>
              <p className="text-xs text-muted-foreground">
                크롭된 이미지를 확인 후 V3 제작 페이지에서 사용할 수 있습니다.
              </p>
            </Card>
          )}

          <GuidePanel label="참고사항" pages={createGuidePages} />
        </div>

        {/* Right: Pipeline + Results */}
        <div className="space-y-6">
          <PipelineView
            mode="create"
            stages={stages.length > 0 ? stages : undefined}
          />

          {/* 크롭 결과 그리드 */}
          {cropResults.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">
                문제별 크롭 결과 ({cropResults.length}문제)
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {cropResults.map((q) => (
                  <button
                    key={q.number}
                    onClick={() =>
                      setSelectedQuestion(
                        selectedQuestion === q.number ? null : q.number
                      )
                    }
                    className={`relative border rounded-md p-1 cursor-pointer transition-colors ${
                      selectedQuestion === q.number
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="text-xs font-medium text-center mb-1">
                      {q.number}번
                    </div>
                    <img
                      src={`/api/file?path=${encodeURIComponent(
                        `inputs/시험지 제작/question_images/${q.image}`
                      )}`}
                      alt={`문제 ${q.number}`}
                      className="w-full h-24 object-contain bg-white rounded"
                    />
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* 선택된 문제 확대 보기 */}
          {selectedQuestion && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">
                문제 {selectedQuestion}번 미리보기
              </h3>
              <div className="bg-white rounded-md p-2 flex justify-center">
                <img
                  src={`/api/file?path=${encodeURIComponent(
                    `inputs/시험지 제작/question_images/q${String(
                      selectedQuestion
                    ).padStart(2, "0")}.png`
                  )}`}
                  alt={`문제 ${selectedQuestion}`}
                  className="max-w-full max-h-[600px] object-contain"
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom: Log */}
      {(isRunning || isDone) && (
        <LogStream logs={logs} />
      )}
    </div>
  );
}
