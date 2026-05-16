import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runBuilderStage, resolveBuilderScripts } from "../../server/stages/builder";
import { createStageCache } from "../../server/stages/cache";
import { runStageCommand, stageCommandToError } from "../../server/stages/commands";
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

  it("runs deterministic stage commands with typed stdout and timing", async () => {
    const result = await runStageCommand({
      command: process.execPath,
      args: ["-e", "process.stdout.write('ok')"],
    });

    expect(result).toMatchObject({
      status: "success",
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(stageCommandToError(result)).toBeUndefined();
  });

  it("converts non-zero stage commands into StageError-compatible data", async () => {
    const result = await runStageCommand({
      command: process.execPath,
      args: ["-e", "process.stderr.write('bad'); process.exit(7)"],
    });

    expect(result).toMatchObject({
      status: "non_zero_exit",
      stderr: "bad",
      exitCode: 7,
    });
    expect(stageCommandToError(result)).toMatchObject({
      code: "stage_command_failed",
      retryable: false,
      details: { exitCode: 7 },
    });
  });

  it("marks timed out stage commands as retryable", async () => {
    const result = await runStageCommand({
      command: process.execPath,
      args: ["-e", "setTimeout(() => {}, 1000)"],
      timeoutMs: 20,
    });

    expect(result.status).toBe("timeout");
    expect(stageCommandToError(result)).toMatchObject({
      code: "stage_command_timeout",
      retryable: true,
    });
  });

  it("runs the deterministic builder command sequence and writes build status", async () => {
    const baseDir = await makeTempDir();
    const cache = createStageCache(baseDir);
    const outputDir = path.join(baseDir, "outputs");
    const hwpxPath = path.join(outputDir, "built.hwpx");
    const calls: string[][] = [];

    await cache.ensureCacheDir();
    await writeFile(cache.paths.examData, JSON.stringify({ info: {}, problems: [] }), "utf8");

    const result = await runBuilderStage({
      baseDir,
      cache,
      outputDir,
      commandRunner: async ({ args }) => {
        calls.push(args);
        if (args[0].endsWith("build_hwpx.py")) {
          await writeFile(hwpxPath, "zip-like", "utf8");
          return {
            command: "python3",
            args,
            status: "success",
            stdout: `HWPX written: ${hwpxPath}\n`,
            stderr: "",
            exitCode: 0,
            signal: null,
            elapsedMs: 1,
          };
        }
        return {
          command: "python3",
          args,
          status: "success",
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          elapsedMs: 1,
        };
      },
    });

    expect(result.status).toBe("completed");
    expect(result.output?.hwpxPath).toBe(hwpxPath);
    expect(calls.map((args) => path.basename(args[0]))).toEqual([
      "build_hwpx.py",
      "fix_namespaces.py",
      "validate.py",
    ]);
    await expect(readFile(cache.paths.buildStatus, "utf8")).resolves.toContain('"status": "completed"');
  });

  it("resolves builder scripts from the repository root", () => {
    expect(resolveBuilderScripts("/repo")).toEqual({
      buildHwpx: path.join("/repo", "build_hwpx.py"),
      fixNamespaces: path.join("/repo", ".claude", "skills", "ngd-exam-create", "scripts", "fix_namespaces.py"),
      validateHwpx: path.join("/repo", ".claude", "skills", "ngd-exam-create", "scripts", "validate.py"),
    });
  });
});
