import { useJobStore } from "@/lib/store";
import type { SSEEvent } from "@/lib/claude";

type Store = ReturnType<typeof useJobStore.getState>;

/** Send a resume/followup instruction via SSE */
export async function sendResumeAction(
  jobId: string,
  instruction: string,
  store: Store,
) {
  store.setStatus("running");
  store.addLog({
    timestamp: new Date().toISOString(),
    stage: "system",
    message: instruction,
    level: "info",
  });

  try {
    const res = await fetch(`/api/run/${jobId}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });

    if (!res.ok || !res.body) {
      store.setStatus("failed");
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
        } catch { /* skip */ }
      }
    }

    if (useJobStore.getState().status === "running") {
      store.setStatus("done");
    }
  } catch {
    store.setStatus("failed");
  }
}

function handleSSEEvent(event: SSEEvent, store: Store) {
  const data = event.data;
  switch (event.event) {
    case "log":
      store.addLog({
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
        stage: (data.stage as string) ?? "system",
        message: (data.message as string) ?? "",
        level: (data.level as "info" | "warn" | "error") ?? "info",
      });
      break;
    case "stage":
      store.updateStage(data.name as string, {
        status: data.status as "running" | "done",
        ...(data.status === "running" ? { startedAt: new Date().toISOString() } : {}),
        ...(data.status === "done" ? { finishedAt: new Date().toISOString() } : {}),
      });
      break;
    case "question":
      if (data.status === "ok") {
        store.updateQuestionResult(
          data.number as number,
          (data.stage as string) ?? (data.phase as string),
          (data.data as Record<string, unknown>) ?? (data.content as Record<string, unknown>),
        );
      }
      break;
    case "extraction_review": {
      const items = (data.items as { number: number; data: Record<string, unknown> }[]) ?? [];
      for (const it of items) {
        store.updateQuestionResult(it.number, "extracted", it.data);
      }
      store.setExtractionReviewActive(true);
      break;
    }
    case "result":
      store.setResult({
        status: data.status as string,
        outputPath: data.outputPath as string | undefined,
        summary: data.result as string | undefined,
      });
      store.setStatus((data.status as string) === "success" ? "done" : "failed");
      break;
    case "error":
      store.addLog({
        timestamp: new Date().toISOString(),
        stage: "system",
        message: (data.message as string) ?? "",
        level: "error",
      });
      store.setStatus("failed");
      break;
  }
}
