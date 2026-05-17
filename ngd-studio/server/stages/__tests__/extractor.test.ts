import { mkdtemp, rm, readFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runExtractorStage, validateExtractorOutput } from "../extractor";
import { FileBackedStageCache } from "../cache";
import type { AIProviderAdapter, ProviderRunOptions } from "@/lib/ai/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "extractor-test-"));
  tempDirs.push(dir);
  return dir;
}

async function makeCache(baseDir: string): Promise<FileBackedStageCache> {
  const examDir = path.join(baseDir, "inputs", "시험지 제작");
  const cacheDir = path.join(examDir, ".v3cache");
  await mkdir(cacheDir, { recursive: true });
  return new FileBackedStageCache(examDir);
}

/** Minimal valid extractor output JSON */
const VALID_OUTPUT = {
  number: 1,
  type: "choice",
  score: "4.2",
  difficulty: "중",
  subtopic: "삼각함수",
  question: "다음 중 옳은 것은?",
  has_figure: false,
  figure_info: null,
  parts: [{ t: "다음 중 옳은 것은?" }],
  choices: [
    [{ eq: "1" }],
    [{ eq: "2" }],
    [{ eq: "3" }],
    [{ eq: "4" }],
    [{ eq: "5" }],
  ],
  condition_box: null,
  bogi_box: null,
  data_table: null,
  answer: "①",
};

/**
 * Build a mock AIProviderAdapter that returns the given JSON string (or raw
 * string) as the assistant message, then exits with exitCode.
 */
function makeMockProvider(
  responseJson: string,
  exitCode = 0,
  runSpy?: ReturnType<typeof vi.fn>
): AIProviderAdapter {
  const runFn = runSpy ?? vi.fn();

  return {
    id: "claude-sdk",
    label: "Mock Provider",
    run(prompt: string, options?: ProviderRunOptions) {
      runFn(prompt, options);

      let exitResolve: (code: number) => void = () => undefined;
      const exitCodePromise = new Promise<number>((resolve) => {
        exitResolve = resolve;
      });

      async function* events() {
        if (exitCode === 0) {
          yield {
            type: "assistant" as const,
            message: {
              role: "assistant" as const,
              content: [{ type: "text" as const, text: responseJson }],
            },
          };
        }
        yield { type: "result" as const, subtype: exitCode === 0 ? ("success" as const) : ("error" as const), result: responseJson };
        exitResolve(exitCode);
      }

      return {
        process: {} as import("child_process").ChildProcess,
        events: events(),
        exitCode: exitCodePromise,
        metadata: {
          requestedProvider: "claude-sdk",
          provider: "claude-sdk",
          label: "Mock Provider",
        },
      };
    },
  };
}

// ─── runExtractorStage ────────────────────────────────────────────────────────

describe("runExtractorStage", () => {
  it("returns completed and writes cache file on valid JSON response", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);
    const provider = makeMockProvider(JSON.stringify(VALID_OUTPUT));

    const result = await runExtractorStage({
      questionNumber: 1,
      imagePath: "/some/path/q01.png",
      cache,
      provider,
    });

    expect(result.status).toBe("completed");
    expect(result.output).toBeDefined();
    expect(result.output?.has_figure).toBe(false);

    // Cache file must have been written
    const cachePath = cache.extractorResultPath(1);
    const written = JSON.parse(await readFile(cachePath, "utf8")) as typeof VALID_OUTPUT;
    expect(written.answer).toBe("①");
  });

  it("returns failed on invalid JSON response (validation failure)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Completely non-JSON output
    const provider = makeMockProvider("이것은 JSON이 아닙니다.");

    const result = await runExtractorStage({
      questionNumber: 2,
      imagePath: "/some/path/q02.png",
      cache,
      provider,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("model_json_parse_failed");
  });

  it("returns failed with provider_failed code when exit code != 0", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    const provider = makeMockProvider("", 1);

    const result = await runExtractorStage({
      questionNumber: 3,
      imagePath: "/some/path/q03.png",
      cache,
      provider,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("extractor_provider_failed");
  });

  it("returns validation failure when has_figure=true but description_en contains Korean", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    const badOutput = {
      ...VALID_OUTPUT,
      has_figure: true,
      figure_info: {
        description_en: "그래프 그림",  // Korean characters — must fail
        position: "right",
        crop_ratio: [0.5, 0.1, 1.0, 0.9],
      },
    };

    const provider = makeMockProvider(JSON.stringify(badOutput));

    const result = await runExtractorStage({
      questionNumber: 4,
      imagePath: "/some/path/q04.png",
      cache,
      provider,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("Korean");
  });

  it("passes imagePaths and stageKey to provider.run", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    const spy = vi.fn();
    const provider = makeMockProvider(JSON.stringify(VALID_OUTPUT), 0, spy);

    const imagePath = "/abs/path/q01.png";

    await runExtractorStage({
      questionNumber: 1,
      imagePath,
      cache,
      provider,
    });

    expect(spy).toHaveBeenCalledOnce();
    const [, options] = spy.mock.calls[0] as [string, ProviderRunOptions];
    expect(options.stageKey).toBe("create.extractor");
    expect(options.imagePaths).toEqual([imagePath]);
  });
});

// ─── validateExtractorOutput ──────────────────────────────────────────────────

describe("validateExtractorOutput", () => {
  it("passes for valid output with has_figure=false", () => {
    const result = validateExtractorOutput(VALID_OUTPUT);
    expect(result.ok).toBe(true);
  });

  it("passes for valid output with has_figure=true and English description_en", () => {
    const input = {
      ...VALID_OUTPUT,
      has_figure: true,
      figure_info: {
        description_en: "A graph showing a sine curve",
        position: "right",
        crop_ratio: [0.5, 0.0, 1.0, 0.5],
      },
    };
    const result = validateExtractorOutput(input);
    expect(result.ok).toBe(true);
  });

  it("fails when answer is missing", () => {
    const { answer: _, ...rest } = VALID_OUTPUT;
    const result = validateExtractorOutput(rest);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("answer");
  });

  it("fails when question is missing or empty string", () => {
    // missing question — omit from spread via override with undefined
    const withoutQuestion: Record<string, unknown> = { ...VALID_OUTPUT };
    delete withoutQuestion.question;
    const missingResult = validateExtractorOutput(withoutQuestion);
    expect(missingResult.ok).toBe(false);
    expect((missingResult as { ok: false; message: string }).message).toContain("question");

    // empty / whitespace-only question
    const emptyResult = validateExtractorOutput({ ...VALID_OUTPUT, question: "   " });
    expect(emptyResult.ok).toBe(false);
    expect((emptyResult as { ok: false; message: string }).message).toContain("question");
  });

  it("fails when has_figure is not boolean", () => {
    const result = validateExtractorOutput({ ...VALID_OUTPUT, has_figure: "yes" });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("has_figure");
  });

  it("fails when choices length is outside 3-5", () => {
    const result = validateExtractorOutput({ ...VALID_OUTPUT, choices: [[{ eq: "1" }]] });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("choices");
  });

  it("fails when crop_ratio has wrong number of elements", () => {
    const result = validateExtractorOutput({
      ...VALID_OUTPUT,
      has_figure: true,
      figure_info: {
        description_en: "A figure",
        crop_ratio: [0.1, 0.2],  // only 2 elements
      },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("crop_ratio");
  });

  it("fails when crop_ratio values are outside [0, 1]", () => {
    const result = validateExtractorOutput({
      ...VALID_OUTPUT,
      has_figure: true,
      figure_info: {
        description_en: "A figure",
        crop_ratio: [0.1, 0.2, 1.5, 0.9],  // 1.5 is out of range
      },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("crop_ratio");
  });

  it("fails when description_en contains Korean characters", () => {
    const result = validateExtractorOutput({
      ...VALID_OUTPUT,
      has_figure: true,
      figure_info: {
        description_en: "사인 곡선 그래프",
        position: "center",
      },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("Korean");
  });
});
