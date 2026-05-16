import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createStageCache } from "../../server/stages/cache";
import { errorEvent, fileEvent, logEvent, progressEvent, resultEvent, stageEvent } from "../../server/stages/events";
import { FileBackedJobStore } from "../../server/stages/jobStore";
import { createStageAttemptTelemetryEntry, toProviderTelemetryEntry } from "../../server/stages/telemetry";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stage-foundation-"));
  tempDirs.push(dir);
  return dir;
}

describe("stage foundation helpers", () => {
  it("keeps job JSON compatible with data/jobs/{jobId}.json", async () => {
    const jobsDir = await makeTempDir();
    const store = new FileBackedJobStore(jobsDir);

    await store.write({
      id: "job-1",
      mode: "create",
      status: "running",
      inputFiles: ["input.pdf", "template.hwpx"],
      stages: [],
      logs: [],
      startedAt: "2026-05-16T00:00:00.000Z",
    });

    await expect(store.read("job-1")).resolves.toMatchObject({
      id: "job-1",
      mode: "create",
      status: "running",
      inputFiles: ["input.pdf", "template.hwpx"],
    });
    expect(store.jobPath("job-1")).toBe(path.join(jobsDir, "job-1.json"));
  });

  it("centralizes v3 cache paths without creating a database dependency", () => {
    const cache = createStageCache("/repo");

    expect(cache.paths.cacheDir).toBe(path.join("/repo", "inputs", "시험지 제작", ".v3cache"));
    expect(cache.paths.previousCacheDir).toBe(path.join("/repo", "inputs", "시험지 제작", ".v3cache_prev"));
    expect(cache.paths.examData).toBe(path.join(cache.paths.cacheDir, "exam_data.json"));
    expect(cache.paths.figureStatus).toBe(path.join(cache.paths.cacheDir, "figure_status.json"));
    expect(cache.paths.buildStatus).toBe(path.join(cache.paths.cacheDir, "build_status.json"));
    expect(cache.questionImagePath(3)).toBe(path.join("/repo", "inputs", "시험지 제작", "question_images", "q03.png"));
    expect(cache.questionJsonPath(3)).toBe(path.join(cache.paths.cacheDir, "q03.json"));
  });

  it("emits SSE events with the existing client shape", () => {
    expect(stageEvent("create.extractor", "running")).toEqual({
      event: "stage",
      data: { name: "create.extractor", status: "running" },
    });
    expect(logEvent("system", "started", "info", "now")).toEqual({
      event: "log",
      data: { stage: "system", message: "started", timestamp: "now", level: "info" },
    });
    expect(progressEvent("builder", 101).data.percent).toBe(100);
    expect(fileEvent({ type: "hwpx", name: "out.hwpx", path: "outputs/out.hwpx" }).event).toBe("file");
    expect(resultEvent("success", "done", "outputs/out.hwpx").data.status).toBe("success");
    expect(errorEvent("failed").data.message).toBe("failed");
  });

  it("converts stage telemetry to provider telemetry when model metadata exists", () => {
    const entry = createStageAttemptTelemetryEntry({
      workflowStageKey: "create.verifier",
      modelStageKey: "create.verifier",
      requestedProvider: "deepseek-v4",
      resolvedProvider: "deepseek-v4",
      attempt: 2,
      status: "failed",
      elapsedMs: 12.6,
      retry: true,
      validation: { ok: false, message: "schema mismatch" },
      error: "x".repeat(400),
    });

    expect(entry).toMatchObject({
      elapsedMs: 13,
      errorSummary: "x".repeat(300),
      failureKind: "validation",
    });
    expect(toProviderTelemetryEntry(entry)).toMatchObject({
      stageKey: "create.verifier",
      workflowStageKey: "create.verifier",
      requestedProvider: "deepseek-v4",
      resolvedProvider: "deepseek-v4",
      status: "failed",
      validationOk: false,
      failureKind: "validation",
    });
  });
});
