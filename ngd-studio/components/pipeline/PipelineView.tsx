"use client";

import { StageCard, type StageStatus } from "./StageCard";

export interface PipelineStage {
  name: string;
  label: string;
  status: StageStatus;
  summary?: string;
  progress?: number;
  startedAt?: string;
  finishedAt?: string;
}

const defaultCreateStages: PipelineStage[] = [
  { name: "reader", label: "PDF 읽기", status: "pending" },
  { name: "solver", label: "해설 생성", status: "pending" },
  { name: "figure", label: "그림 처리", status: "pending" },
  { name: "builder", label: "HWPX 조립", status: "pending" },
  { name: "checker", label: "품질 검수", status: "pending" },
];

const defaultCreateV3Stages: PipelineStage[] = [
  { name: "extractor", label: "문제 추출", status: "pending" },
  { name: "solver", label: "해설 생성", status: "pending" },
  { name: "verifier", label: "해설 검증", status: "pending" },
  { name: "figure", label: "그림 처리", status: "pending" },
  { name: "builder", label: "HWPX 조립", status: "pending" },
  { name: "checker", label: "품질 검수", status: "pending" },
];

const defaultReviewStages: PipelineStage[] = [
  { name: "reviewer", label: "오검 진행", status: "pending" },
];

interface PipelineViewProps {
  mode: "create" | "create-v3" | "review";
  stages?: PipelineStage[];
}

export function PipelineView({ mode, stages }: PipelineViewProps) {
  const defaults = mode === "create" ? defaultCreateStages : mode === "create-v3" ? defaultCreateV3Stages : defaultReviewStages;
  const displayStages = stages ?? defaults;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        파이프라인
      </h3>
      <div className="space-y-2">
        {displayStages.map((stage, i) => (
          <StageCard
            key={stage.name}
            stage={stage}
            isLast={i === displayStages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
