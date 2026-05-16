import type { SSEEvent } from "../../lib/claude";
import type { WorkflowStageKey } from "./types";

export type StageEventStatus = "running" | "done" | "failed" | "skipped";
export type StageLogLevel = "info" | "warn" | "error";
export type StageResultStatus = "success" | "failed";

export interface StageEventFile {
  type: string;
  name: string;
  path: string;
}

export function stageEvent(name: WorkflowStageKey | string, status: StageEventStatus, extra?: Record<string, unknown>): SSEEvent {
  return {
    event: "stage",
    data: {
      name,
      status,
      ...extra,
    },
  };
}

export function logEvent(
  stage: WorkflowStageKey | string,
  message: string,
  level: StageLogLevel = "info",
  timestamp = new Date().toISOString()
): SSEEvent {
  return {
    event: "log",
    data: {
      stage,
      message,
      timestamp,
      level,
    },
  };
}

export function progressEvent(stage: WorkflowStageKey | string, percent: number, extra?: Record<string, unknown>): SSEEvent {
  return {
    event: "progress",
    data: {
      stage,
      percent: clampPercent(percent),
      ...extra,
    },
  };
}

export function fileEvent(file: StageEventFile): SSEEvent {
  return {
    event: "file",
    data: { ...file },
  };
}

export function resultEvent(status: StageResultStatus, result?: string, outputPath?: string): SSEEvent {
  return {
    event: "result",
    data: {
      status,
      result,
      outputPath,
    },
  };
}

export function errorEvent(message: string, stage: WorkflowStageKey | string = "system", extra?: Record<string, unknown>): SSEEvent {
  return {
    event: "error",
    data: {
      stage,
      message,
      ...extra,
    },
  };
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
