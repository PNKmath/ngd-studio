import { create } from "zustand";
import { PIPELINE_STAGES, type PipelineStageName } from "@/lib/pipelineStages";
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
  schoolLevel?: "중" | "고";
  school?: string;
  grade?: number;
  year?: number;
  subject?: string;
  semester?: string;
  examType?: string;
  range?: string;
  questionCount?: number;
  resumeFrom?: string;
}

export interface JobState {
  jobId: string | null;
  mode: "create" | "resume" | "crop" | "review" | null;
  status: "idle" | "uploading" | "running" | "paused" | "done" | "failed";
  stages: PipelineStage[];
  logs: LogEntry[];
  files: { name: string; size: number; path: string }[];
  intermediateFiles: { type: string; name: string; path: string }[];
  result: { status: string; outputPath?: string; summary?: string } | null;
  reviewItems: ReviewItem[];
  questionResults: Record<number, QuestionResult>;
  v3Meta: V3Meta | null;
  extractionReviewActive: boolean;
  /** master-detail UI에서 현재 선택된 문제 번호 */
  selectedQuestionNumber: number | null;

  // Actions
  reset: () => void;
  setJobId: (id: string) => void;
  setMode: (mode: "create" | "resume" | "crop" | "review", resumeFrom?: string) => void;
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
  setSelectedQuestionNumber: (n: number | null) => void;
}

const createStages: PipelineStage[] = [
  { name: "extractor", label: "문제 추출", status: "pending" },
  { name: "solver",    label: "해설 생성", status: "pending" },
  { name: "verifier",  label: "해설 검증", status: "pending" },
  { name: "figure",    label: "그림 처리", status: "pending" },
  { name: "builder",   label: "HWPX 조립", status: "pending" },
  { name: "checker",   label: "품질 검수", status: "pending" },
];

const STAGE_ORDER: PipelineStageName[] = [...PIPELINE_STAGES];

function buildResumeStages(resumeFrom?: string): PipelineStage[] {
  // "confirm" means figure is done, proceed to builder
  const effectiveFrom = resumeFrom === "confirm" ? "builder" : resumeFrom;
  const resumeIdx = effectiveFrom ? STAGE_ORDER.indexOf(effectiveFrom as PipelineStageName) : 0;
  return createStages.map((s) => ({
    ...s,
    status: (resumeIdx > 0 && STAGE_ORDER.indexOf(s.name as PipelineStageName) < resumeIdx) ? "done" as const : "pending" as const,
  }));
}

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
  selectedQuestionNumber: null,

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
      selectedQuestionNumber: null,
    }),

  setJobId: (id) => set({ jobId: id }),
  setMode: (mode, resumeFrom) =>
    set({
      mode,
      stages: mode === "create"
        ? createStages.map((s) => ({ ...s }))
        : mode === "resume"
        ? buildResumeStages(resumeFrom)
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
  setSelectedQuestionNumber: (n) => set({ selectedQuestionNumber: n }),

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
