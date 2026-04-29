import { create } from "zustand";
import type { PipelineStage } from "@/components/pipeline/PipelineView";
import type { LogEntry } from "@/components/log/LogStream";
import type { ReviewItem } from "@/lib/reviewParser";

export interface QuestionResult {
  number: number;
  extracted?: Record<string, unknown>;
  solved?: Record<string, unknown>;
  verified?: Record<string, unknown>;
  updatedAt: string;
}

export interface V3Meta {
  school?: string;
  grade?: number;
  subject?: string;
  semester?: string;
  examType?: string;
  range?: string;
  questionCount?: number;
  resumeFrom?: string;
}

export interface JobState {
  jobId: string | null;
  mode: "create" | "create-v3" | "resume-v3" | "crop" | "review" | null;
  status: "idle" | "uploading" | "running" | "done" | "failed";
  stages: PipelineStage[];
  logs: LogEntry[];
  files: { name: string; size: number; path: string }[];
  intermediateFiles: { type: string; name: string; path: string }[];
  result: { status: string; outputPath?: string; summary?: string } | null;
  reviewItems: ReviewItem[];
  questionResults: Record<number, QuestionResult>;
  v3Meta: V3Meta | null;
  extractionReviewActive: boolean;

  // Actions
  reset: () => void;
  setJobId: (id: string) => void;
  setMode: (mode: "create" | "create-v3" | "resume-v3" | "crop" | "review") => void;
  setStatus: (status: JobState["status"]) => void;
  setFiles: (files: JobState["files"]) => void;
  setStages: (stages: PipelineStage[]) => void;
  updateStage: (name: string, update: Partial<PipelineStage>) => void;
  addLog: (log: LogEntry) => void;
  addIntermediateFile: (file: { type: string; name: string; path: string }) => void;
  setResult: (result: JobState["result"]) => void;
  setReviewItems: (items: ReviewItem[]) => void;
  updateQuestionResult: (number: number, phase: string, content: Record<string, unknown>) => void;
  setV3Meta: (meta: V3Meta) => void;
  setExtractionReviewActive: (active: boolean) => void;
}

const createStages: PipelineStage[] = [
  { name: "reader", label: "PDF 읽기", status: "pending" },
  { name: "solver", label: "해설 생성", status: "pending" },
  { name: "figure", label: "그림 처리", status: "pending" },
  { name: "builder", label: "HWPX 조립", status: "pending" },
  { name: "checker", label: "품질 검수", status: "pending" },
];

const createV3Stages: PipelineStage[] = [
  { name: "cleaned", label: "이미지 정리", status: "pending" },
  { name: "extractor", label: "문제 추출", status: "pending" },
  { name: "review_extract", label: "추출 편집", status: "pending" },
  { name: "solver", label: "해설 생성", status: "pending" },
  { name: "verifier", label: "해설 검증", status: "pending" },
  { name: "figure", label: "그림 처리", status: "pending" },
  { name: "builder", label: "HWPX 조립", status: "pending" },
  { name: "checker", label: "품질 검수", status: "pending" },
];

// resume-v3: cleaned 이미지 이미 완료된 상태로 시작
const resumeV3Stages: PipelineStage[] = [
  { name: "cleaned", label: "이미지 정리", status: "done" },
  { name: "extractor", label: "문제 추출", status: "pending" },
  { name: "review_extract", label: "추출 편집", status: "pending" },
  { name: "solver", label: "해설 생성", status: "pending" },
  { name: "verifier", label: "해설 검증", status: "pending" },
  { name: "figure", label: "그림 처리", status: "pending" },
  { name: "builder", label: "HWPX 조립", status: "pending" },
  { name: "checker", label: "품질 검수", status: "pending" },
];

const cropStages: PipelineStage[] = [
  { name: "cropper", label: "PDF 크롭", status: "pending" },
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
  questionResults: {},
  v3Meta: null,
  extractionReviewActive: false,

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
      questionResults: {},
      v3Meta: null,
      extractionReviewActive: false,
    }),

  setJobId: (id) => set({ jobId: id }),
  setMode: (mode) =>
    set({
      mode,
      stages: mode === "create"
        ? createStages.map((s) => ({ ...s }))
        : mode === "create-v3"
        ? createV3Stages.map((s) => ({ ...s }))
        : mode === "resume-v3"
        ? resumeV3Stages.map((s) => ({ ...s }))
        : mode === "crop"
        ? cropStages.map((s) => ({ ...s }))
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

  setV3Meta: (meta) => set({ v3Meta: meta }),
  setExtractionReviewActive: (active) => set({ extractionReviewActive: active }),

  updateQuestionResult: (number, phase, content) =>
    set((state) => {
      const prev = state.questionResults[number] ?? { number, updatedAt: "" };
      return {
        questionResults: {
          ...state.questionResults,
          [number]: {
            ...prev,
            [phase]: content,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }),
}));
