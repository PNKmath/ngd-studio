import type { ChildProcess } from "child_process";
import path from "path";
import type { SSEEvent } from "../../lib/claude";
import { fromWslPath, transformToSSE } from "../../lib/claude";
import {
  MAX_PROVIDER_ATTEMPTS,
  createProviderAttemptLog,
  createProviderRetryLog,
  createProviderTelemetryEntry,
  runAIProvider,
  shouldRetryProviderAttempt,
  type AIProviderId,
  type AIStageKey,
  type ResolvedAIProviderId,
} from "../../lib/ai";
import type { ProviderTelemetryEntry } from "../../lib/ai/retry";
import { readRuntimeEnv } from "../../lib/server/runtimeEnv";

export interface LegacyPromptJobOptions {
  prompt: string;
  requestedProvider: AIProviderId;
  resolvedProvider: ResolvedAIProviderId;
  baseDir: string;
  mode: string;
  jobId: string;
  stageKey?: AIStageKey;
  send: (event: SSEEvent) => void;
  isResponseDestroyed: () => boolean;
  isClientDisconnected: () => boolean;
  setActiveProviderProcess: (process: ChildProcess | null) => void;
  activeProcesses: Set<ChildProcess>;
}

export interface LegacyPromptJobResult {
  status: "done" | "failed" | "cancelled";
  outputFile?: string;
  resultSummary?: string;
  providerMetadata: {
    requestedProvider: AIProviderId;
    provider: ResolvedAIProviderId;
  };
  providerTelemetry: ProviderTelemetryEntry[];
}

export async function runLegacyPromptJob({
  prompt,
  requestedProvider,
  resolvedProvider,
  baseDir,
  mode,
  jobId,
  stageKey,
  send,
  isResponseDestroyed,
  isClientDisconnected,
  setActiveProviderProcess,
  activeProcesses,
}: LegacyPromptJobOptions): Promise<LegacyPromptJobResult> {
  const currentStage = { name: "" };
  let outputFile = "";
  let resultSummary = "";
  let finalStatus: "done" | "failed" | "cancelled" = "done";
  let hadResultEvent = false;
  let providerMetadata = { requestedProvider, provider: resolvedProvider };
  const providerTelemetry: ProviderTelemetryEntry[] = [];

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const attemptStartedAt = Date.now();
    let providerFailed = false;
    let attemptErrorSummary = "";
    send({
      event: "log",
      data: {
        stage: "system",
        message: createProviderAttemptLog(resolvedProvider, attempt),
        timestamp: new Date().toISOString(),
        level: "info",
      },
    });

    const { process: proc, events, exitCode, metadata } = runAIProvider(prompt, {
      provider: requestedProvider,
      cwd: baseDir,
      env: readRuntimeEnv(),
      maxTurns: mode === "crop" ? 30 : (mode === "create" || mode === "resume") ? 200 : 50,
      mode,
      jobId,
      stageKey,
    });
    providerMetadata = {
      requestedProvider: metadata.requestedProvider,
      provider: metadata.provider,
    };
    setActiveProviderProcess(proc);
    activeProcesses.add(proc);
    proc.on("close", () => {
      activeProcesses.delete(proc);
      setActiveProviderProcess(null);
    });

    send({
      event: "log",
      data: {
        stage: "system",
        message: proc.pid !== undefined
          ? `CLI 프로세스 시작됨 (PID: ${proc.pid}). API 연결 대기중...`
          : `${metadata.label} 호출 시작. API 연결 대기중...`,
        timestamp: new Date().toISOString(),
        level: "info",
      },
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) {
        send({
          event: "log",
          data: {
            stage: "system",
            message: `[stderr] ${msg.slice(0, 300)}`,
            timestamp: new Date().toISOString(),
            level: "warn",
          },
        });
      }
    });

    for await (const event of events) {
      if (isResponseDestroyed()) break;
      const sseEvents = transformToSSE(event, currentStage);
      for (const sse of sseEvents) {
        if (sse.event === "file" && sse.data.type === "hwpx") {
          outputFile = fromWslPath(sse.data.path as string);
        }
        if (sse.event === "result") {
          hadResultEvent = true;
          resultSummary = (sse.data.result as string) ?? "";
          finalStatus = sse.data.status === "success" ? "done" : "failed";
          providerFailed = sse.data.status !== "success";
          if (providerFailed) attemptErrorSummary = resultSummary.slice(0, 300);
          if (sse.data.outputPath) {
            outputFile = fromWslPath(sse.data.outputPath as string);
          }
        }
        if (sse.event === "error") {
          finalStatus = "failed";
          providerFailed = true;
          attemptErrorSummary = ((sse.data.message as string) ?? "Provider error").slice(0, 300);
        }
        send(sse);
      }
    }

    const code = await exitCode;
    if (code !== 0) {
      finalStatus = "failed";
      if (!attemptErrorSummary) attemptErrorSummary = `${metadata.label} exited with code ${code}`;
    }

    const clientDisconnected = isClientDisconnected();
    const retry = shouldRetryProviderAttempt({ attempt, exitCode: code, providerFailed, aborted: clientDisconnected });
    providerTelemetry.push(createProviderTelemetryEntry({
      stageKey,
      requestedProvider: metadata.requestedProvider,
      resolvedProvider: metadata.provider,
      attempt,
      status: clientDisconnected ? "cancelled" : providerFailed || code !== 0 ? "failed" : "success",
      elapsedMs: Date.now() - attemptStartedAt,
      retry,
      errorSummary: attemptErrorSummary || undefined,
      externalCostUsd: metadata.externalCostUsd,
    }));

    if (!retry) {
      if (code !== 0 && !currentStage.name) {
        send({ event: "error", data: { message: `${metadata.label} exited with code ${code}` } });
        finalStatus = "failed";
      }
      break;
    }

    send({
      event: "log",
      data: {
        stage: "system",
        message: createProviderRetryLog(metadata.provider, attempt),
        timestamp: new Date().toISOString(),
        level: "warn",
      },
    });
  }

  if (!hadResultEvent && isClientDisconnected()) {
    finalStatus = "cancelled";
  }

  if (outputFile && path.isAbsolute(outputFile)) {
    outputFile = path.relative(baseDir, outputFile);
  }

  return {
    status: finalStatus,
    outputFile: outputFile || undefined,
    resultSummary: resultSummary || undefined,
    providerMetadata,
    providerTelemetry,
  };
}
