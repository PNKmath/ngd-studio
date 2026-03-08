"use client";

import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  jobId: string;
  fileName?: string;
  disabled?: boolean;
}

export function DownloadButton({ jobId, fileName, disabled }: DownloadButtonProps) {
  const handleDownload = async () => {
    const res = await fetch(`/api/download/${jobId}`);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ?? "result.hwpx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button onClick={handleDownload} disabled={disabled} variant="default" size="sm">
      <svg
        className="w-4 h-4 mr-1.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
      >
        <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
        <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" />
      </svg>
      다운로드
    </Button>
  );
}
