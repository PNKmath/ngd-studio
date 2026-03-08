import { create } from "zustand";
import type { PipelineStage } from "@/components/pipeline/PipelineView";
import type { LogEntry } from "@/components/log/LogStream";
import type { ReviewItem } from "@/lib/reviewParser";

export interface JobState {
  jobId: string | null;
  mode: "create" | "review" | null;
  status: "idle" | "uploading" | "running" | "done" | "failed";
  stages: PipelineStage[];
  logs: LogEntry[];
  files: { name: string; size: number; path?: string }[];
  intermediateFiles: { type: string; name: string; path: string }[];
  result: { status: string; outputPath?: string; summary?: string } | null;
  reviewItems: ReviewItem[];

  // Actions
  reset: () => void;
  setJobId: (id: string) => void;
  setMode: (mode: "create" | "review") => void;
  setStatus: (status: JobState["status"]) => void;
  setFiles: (files: JobState["files"]) => void;
  setStages: (stages: PipelineStage[]) => void;
  updateStage: (name: string, update: Partial<PipelineStage>) => void;
  addLog: (log: LogEntry) => void;
  addIntermediateFile: (file: { type: string; name: string; path: string }) => void;
  setResult: (result: JobState["result"]) => void;
  setReviewItems: (items: ReviewItem[]) => void;
}

const createStages: PipelineStage[] = [
  { name: "reader", label: "PDF 읽기", status: "pending" },
  { name: "solver", label: "해설 생성", status: "pending" },
  { name: "figure", label: "그림 처리", status: "pending" },
  { name: "builder", label: "HWPX 조립", status: "pending" },
  { name: "checker", label: "품질 검수", status: "pending" },
];

const reviewStages: PipelineStage[] = [
  { name: "reviewer", label: "오검 진행", status: "pending" },
];

export const useJobStore = create<JobState>((set) => ({
  jobId: null,
  mode: null,
  status: "idle",
  stages: [],
  logs: [],
  files: [],
  intermediateFiles: [],
  result: null,
  reviewItems: [],

  reset: () =>
    set({
      jobId: null,
      mode: null,
      status: "idle",
      stages: [],
      logs: [],
      files: [],
      intermediateFiles: [],
      result: null,
      reviewItems: [],
    }),

  setJobId: (id) => set({ jobId: id }),
  setMode: (mode) =>
    set({
      mode,
      stages: mode === "create"
        ? createStages.map((s) => ({ ...s }))
        : reviewStages.map((s) => ({ ...s })),
    }),
  setStatus: (status) => set({ status }),
  setFiles: (files) => set({ files }),
  setStages: (stages) => set({ stages }),

  updateStage: (name, update) =>
    set((state) => ({
      stages: state.stages.map((s) =>
        s.name === name ? { ...s, ...update } : s
      ),
    })),

  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),

  addIntermediateFile: (file) =>
    set((state) => ({
      intermediateFiles: [...state.intermediateFiles, file],
    })),

  setResult: (result) => set({ result }),
  setReviewItems: (items) => set({ reviewItems: items }),
}));
