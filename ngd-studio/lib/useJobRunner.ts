"use client";

import { useCallback, useRef } from "react";
import { useJobStore, type JobState } from "./store";
import type { SSEEvent } from "./claude";
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

  const startJob = useCallback(
    async (mode: "create" | "review", files: { pdf: string; hwpx?: string }) => {
      const jobId = crypto.randomUUID();
      const abortController = new AbortController();
      abortRef.current = abortController;

      store.reset();
      store.setJobId(jobId);
      store.setMode(mode);
      store.setStatus("running");

      // Mark first stage as running
      const firstStage = mode === "create" ? "reader" : "reviewer";
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

      try {
        const res = await fetch(`${SSE_BASE}/api/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, files, jobId }),
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
        if (useJobStore.getState().status === "running") {
          store.setStatus("done");
          store.addLog({
            timestamp: new Date().toISOString(),
            stage: "system",
            message: "작업이 완료되었습니다.",
            level: "info",
          });

          // Parse review report from logs if in review mode
          if (mode === "review") {
            const state = useJobStore.getState();
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

  return { startJob, stopJob };
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
