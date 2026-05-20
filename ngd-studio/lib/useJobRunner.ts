"use client";

import { useCallback, useRef } from "react";
import { useJobStore, type JobState } from "./store";
import type { SSEEvent } from "./claude";
import type { AIProviderId } from "./ai";
import { readAISettings } from "./ai/settings";
import { parseReviewReport } from "./reviewParser";

// SSE server runs on a separate port to avoid Next.js response buffering
const SSE_BASE = process.env.NEXT_PUBLIC_SSE_URL ?? "http://localhost:3021";

export function useJobRunner() {
  const store = useJobStore();
  const abortRef = useRef<AbortController | null>(null);

  const stopJob = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    store.setStatus("failed");
    store.addLog({
      timestamp: new Date().toISOString(),
      stage: "system",
      message: "작업이 중단되었습니다.",
      level: "warn",
    });
  }, [store]);

  const pauseJob = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    store.setStatus("paused");
    store.addLog({
      timestamp: new Date().toISOString(),
      stage: "system",
      message: "작업을 일시정지했습니다. 캐시된 결과는 보존되며 '재개' 버튼으로 이어 진행할 수 있습니다.",
      level: "info",
    });
  }, [store]);

  const startJob = useCallback(
    async (
      mode: "create" | "resume" | "crop" | "review",
      files: { pdf: string; hwpx?: string; questionImages?: number[] },
      meta?: { school?: string; grade?: number; subject?: string; semester?: string; examType?: string; range?: string; resumeFrom?: string; questionCount?: number },
      provider?: AIProviderId
    ) => {
      const jobId = crypto.randomUUID();
      const abortController = new AbortController();
      abortRef.current = abortController;

      // resume 모드에서는 호출자가 캐시 데이터를 questionResults에 미리 채워놓을 수 있다.
      // reset()이 그걸 비워버리지 않도록 snapshot 후 복원한다.
      const preloadedQuestionResults =
        mode === "resume" ? useJobStore.getState().questionResults : null;

      store.reset();
      store.setJobId(jobId);
      store.setMode(mode, meta?.resumeFrom);
      store.setStatus("running");
      // Re-set v3Meta after reset so it persists during job execution
      if (meta && (mode === "create" || mode === "resume")) {
        store.setV3Meta(meta);
      }
      if (preloadedQuestionResults && Object.keys(preloadedQuestionResults).length > 0) {
        useJobStore.setState({ questionResults: preloadedQuestionResults });
      }

      // Mark first stage as running
      const rawResumeFrom = meta?.resumeFrom ?? "extractor";
      // "confirm" triggers builder; use "builder" as the first visible stage
      const effectiveResumeFrom = rawResumeFrom === "confirm" ? "builder" : rawResumeFrom;
      const firstStage = mode === "crop" ? "cropper"
        : mode === "create" ? "extractor"
        : mode === "resume" ? effectiveResumeFrom
        : "reviewer";
      store.updateStage(firstStage, {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      store.addLog({
        timestamp: new Date().toISOString(),
        stage: "system",
        message: "작업을 시작합니다...",
        level: "info",
      });
      const aiSettings = readAISettings();
      const selectedProvider = provider ?? aiSettings.defaultProvider;

      try {
        const res = await fetch(`${SSE_BASE}/api/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            files,
            meta,
            jobId,
            provider: selectedProvider,
            stageOverrides: aiSettings.stageOverrides,
            figureRegen: aiSettings.figureRegen,
            checkerMaxAttempts: aiSettings.checkerMaxAttempts,
            stageSkip: aiSettings.stageSkip,
          }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          store.setStatus("failed");
          store.addLog({
            timestamp: new Date().toISOString(),
            stage: "system",
            message: `API 오류: ${res.status}`,
            level: "error",
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const dataLine = line.trim();
            if (!dataLine.startsWith("data: ")) continue;

            try {
              const sseEvent: SSEEvent = JSON.parse(dataLine.slice(6));
              handleSSEEvent(sseEvent, store);
            } catch {
              // skip malformed events
            }
          }
        }

        // If status is still running, mark as done
        const state = useJobStore.getState();
        if (state.status === "running") {
          if (!state.result) {
            store.setResult({ status: "success" });
          }
          store.setStatus("done");
          store.addLog({
            timestamp: new Date().toISOString(),
            stage: "system",
            message: "작업이 완료되었습니다.",
            level: "info",
          });

          // Parse review report from logs if in review mode
          if (mode === "review") {
            const allText = state.logs.map((l) => l.message).join("\n");
            const reviewItems = parseReviewReport(allText);
            store.setReviewItems(reviewItems);
          }
        }
      } catch (err) {
        // AbortError는 사용자가 중단한 것이므로 무시
        if (err instanceof DOMException && err.name === "AbortError") return;
        store.setStatus("failed");
        store.addLog({
          timestamp: new Date().toISOString(),
          stage: "system",
          message: `연결 오류: ${err instanceof Error ? err.message : "알 수 없음"}`,
          level: "error",
        });
      } finally {
        abortRef.current = null;
      }
    },
    [store]
  );

  return { startJob, stopJob, pauseJob };
}

function handleSSEEvent(event: SSEEvent, store: JobState) {
  const data = event.data;

  switch (event.event) {
    case "stage": {
      const name = data.name as string;
      const status = data.status as string;
      if (status === "running") {
        store.updateStage(name, {
          status: "running",
          startedAt: new Date().toISOString(),
        });
      } else if (status === "done") {
        store.updateStage(name, {
          status: "done",
          finishedAt: new Date().toISOString(),
          summary: (data.summary as string) ?? undefined,
        });
      } else if (status === "failed") {
        store.updateStage(name, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          summary: (data.summary as string) ?? undefined,
        });
      } else if (status === "skipped") {
        store.updateStage(name, {
          status: "pending",
          summary: (data.summary as string) ?? undefined,
        });
      }
      break;
    }
    case "log": {
      store.addLog({
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
        stage: (data.stage as string) ?? "system",
        message: (data.message as string) ?? "",
        level: (data.level as "info" | "warn" | "error") ?? "info",
      });
      break;
    }
    case "progress": {
      const name = data.stage as string;
      const percent = data.percent as number;
      store.updateStage(name, { progress: percent });
      break;
    }
    case "file": {
      store.addIntermediateFile({
        type: (data.type as string) ?? "unknown",
        name: (data.name as string) ?? "",
        path: (data.path as string) ?? "",
      });
      break;
    }
    case "result": {
      const status = data.status as string;
      store.setResult({
        status,
        outputPath: data.outputPath as string | undefined,
        summary: data.result as string | undefined,
      });
      store.setStatus(status === "success" ? "done" : "failed");
      break;
    }
    case "question": {
      // 서버(orchestrator)는 { number, stage, status: "ok"|"failed", data } 로 emit.
      // 구버전은 { number, phase, content(JSON string) }. 둘 다 처리.
      const num = data.number as number;
      const stage = (data.stage as string | undefined) ?? (data.phase as string | undefined);
      const status = data.status as string | undefined;
      if (!num || !stage) break;
      if (status && status !== "ok") break; // failed면 store에 결과 미반영
      const payload = (data.data as unknown) ?? (data.content as unknown);
      if (payload == null) break;
      if (typeof payload === "string") {
        try {
          store.updateQuestionResult(num, stage, JSON.parse(payload));
        } catch {
          store.updateQuestionResult(num, stage, { _raw: payload });
        }
      } else {
        store.updateQuestionResult(num, stage, payload as Record<string, unknown>);
      }
      break;
    }
    case "extraction_review": {
      if (Array.isArray(data.items)) {
        // legacy 일괄
        const items = data.items as { number: number; data: Record<string, unknown> }[];
        for (const item of items) {
          store.updateQuestionResult(item.number, "extracted", item.data);
        }
      } else if (typeof data.number === "number" && data.data) {
        // incremental per-question
        store.updateQuestionResult(data.number as number, "extracted", data.data as Record<string, unknown>);
      }
      store.setExtractionReviewActive(true);
      break;
    }
    case "error": {
      store.addLog({
        timestamp: new Date().toISOString(),
        stage: "system",
        message: (data.message as string) ?? "알 수 없는 오류",
        level: "error",
      });
      store.setStatus("failed");
      break;
    }
  }
}
