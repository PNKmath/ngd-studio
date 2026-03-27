"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDropzone } from "@/components/upload/FileDropzone";
import type { UploadedFile } from "@/components/upload/FileDropzone";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { LogStream } from "@/components/log/LogStream";
import { GuidePanel, createGuidePages } from "@/components/shared/GuidePanel";
import { useJobStore } from "@/lib/store";
import { useJobRunner } from "@/lib/useJobRunner";

interface CropResult {
  number: number;
  image: string;          // 파일명 (q01.png)
  overrideUrl?: string;   // 수동 교체 시 object URL
}

export default function CreateV4Page() {
  const { startJob, stopJob } = useJobRunner();
  const status = useJobStore((s) => s.status);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [cropResults, setCropResults] = useState<CropResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [renumberTarget, setRenumberTarget] = useState<number | null>(null);
  const [renumberValue, setRenumberValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIdxRef = useRef<number | null>(null);

  const pdfFile = uploadedFiles.find((f) =>
    f.name.toLowerCase().endsWith(".pdf")
  );
  const canStart = !!pdfFile && status === "idle";
  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";

  const handleCrop = useCallback(async () => {
    if (!pdfFile?.path) return;
    setCropResults([]);
    setSelectedIdx(null);
    await startJob("crop", { pdf: pdfFile.path });
  }, [pdfFile, startJob]);

  // 크롭 완료 후 결과 로드
  useEffect(() => {
    if (status !== "done") return;
    const loadResults = async () => {
      try {
        const res = await fetch(
          `/api/file?path=${encodeURIComponent("inputs/시험지 제작/question_images/crop_results.json")}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.questions) {
          setCropResults(
            data.questions.map((q: { number: number; image: string }) => ({
              number: q.number,
              image: q.image,
            }))
          );
        }
      } catch { /* 파일이 없을 수 있음 */ }
    };
    loadResults();
  }, [status]);

  // 이미지 URL 생성
  const getImageUrl = (item: CropResult) => {
    if (item.overrideUrl) return item.overrideUrl;
    return `/api/file?path=${encodeURIComponent(
      `inputs/시험지 제작/question_images/${item.image}`
    )}`;
  };

  // 삭제
  const handleDelete = (idx: number) => {
    setCropResults((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  // 번호 재지정 시작
  const startRenumber = (idx: number) => {
    setRenumberTarget(idx);
    setRenumberValue(String(cropResults[idx].number));
  };

  // 번호 재지정 확정
  const confirmRenumber = () => {
    if (renumberTarget === null) return;
    const newNum = parseInt(renumberValue, 10);
    if (isNaN(newNum) || newNum < 1) {
      setRenumberTarget(null);
      return;
    }
    setCropResults((prev) =>
      prev.map((item, i) =>
        i === renumberTarget ? { ...item, number: newNum } : item
      )
    );
    setRenumberTarget(null);
  };

  // 수동 교체 — 파일 선택
  const startReplace = (idx: number) => {
    replaceIdxRef.current = idx;
    fileInputRef.current?.click();
  };

  const handleFileReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = replaceIdxRef.current;
    if (!file || idx === null) return;
    const url = URL.createObjectURL(file);
    setCropResults((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, overrideUrl: url, image: file.name } : item
      )
    );
    e.target.value = "";
  };

  // 붙여넣기로 교체 (선택된 슬롯에)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (selectedIdx === null) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const url = URL.createObjectURL(file);
          setCropResults((prev) =>
            prev.map((r, i) =>
              i === selectedIdx ? { ...r, overrideUrl: url, image: file.name } : r
            )
          );
          e.preventDefault();
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [selectedIdx]);

  // cleanup object URLs
  useEffect(() => {
    return () => {
      cropResults.forEach((r) => {
        if (r.overrideUrl) URL.revokeObjectURL(r.overrideUrl);
      });
    };
  }, [cropResults]);

  const selected = selectedIdx !== null ? cropResults[selectedIdx] : null;

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
              <Button onClick={stopJob} variant="destructive" className="w-full">
                중단
              </Button>
            ) : (
              <Button onClick={handleCrop} disabled={!canStart} className="w-full">
                자동 크롭 시작
              </Button>
            )}
          </Card>

          {/* 크롭 결과 요약 */}
          {isDone && cropResults.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">크롭 결과</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${
                  status === "done"
                    ? "bg-[var(--color-status-success)]"
                    : "bg-[var(--color-status-error)]"
                }`} />
                {cropResults.length}개 문제 감지
              </div>
              <p className="text-xs text-muted-foreground">
                클릭하여 확인, 우측 버튼으로 삭제/교체/번호변경 가능.
                슬롯 선택 후 Ctrl+V로 붙여넣기 교체도 가능합니다.
              </p>
            </Card>
          )}

          {/* 선택된 문제 조작 */}
          {selected && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">문제 {selected.number}번</h3>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => startReplace(selectedIdx!)}
                >
                  이미지 교체
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => startRenumber(selectedIdx!)}
                >
                  번호 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedIdx!)}
                >
                  삭제
                </Button>
              </div>
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
                {cropResults.map((q, idx) => (
                  <button
                    key={`${q.number}-${idx}`}
                    onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                    className={`relative border rounded-md p-1 cursor-pointer transition-colors ${
                      selectedIdx === idx
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    } ${q.overrideUrl ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                  >
                    {/* 번호 배지 */}
                    <div className="text-xs font-medium text-center mb-1">
                      {renumberTarget === idx ? (
                        <input
                          type="number"
                          value={renumberValue}
                          onChange={(e) => setRenumberValue(e.target.value)}
                          onBlur={confirmRenumber}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRenumber();
                            if (e.key === "Escape") setRenumberTarget(null);
                          }}
                          className="w-12 text-center text-xs border rounded px-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span>{q.number}번</span>
                      )}
                    </div>
                    {/* 이미지 */}
                    <img
                      src={getImageUrl(q)}
                      alt={`문제 ${q.number}`}
                      className="w-full h-24 object-contain bg-white rounded"
                    />
                    {/* 교체 표시 */}
                    {q.overrideUrl && (
                      <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] px-1 rounded-bl">
                        수정됨
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* 선택된 문제 확대 보기 */}
          {selected && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">
                문제 {selected.number}번 미리보기
                {selected.overrideUrl && (
                  <span className="ml-2 text-xs text-blue-500 font-normal">수동 교체됨</span>
                )}
              </h3>
              <div className="bg-white rounded-md p-2 flex justify-center">
                <img
                  src={getImageUrl(selected)}
                  alt={`문제 ${selected.number}`}
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

      {/* Hidden file input for replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileReplace}
      />
    </div>
  );
}
