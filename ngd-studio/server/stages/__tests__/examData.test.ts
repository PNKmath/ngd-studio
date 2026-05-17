import { mkdtemp, readFile, rm, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildExamDataJson } from "../examData";
import { FileBackedStageCache } from "../cache";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "exam-data-test-"));
  tempDirs.push(dir);
  return dir;
}

/**
 * Create a FileBackedStageCache pointing at a fresh temp examDir
 * and ensure its .v3cache directory exists.
 */
async function makeCache(baseDir: string): Promise<FileBackedStageCache> {
  const examDir = path.join(baseDir, "inputs", "시험지 제작");
  const cacheDir = path.join(examDir, ".v3cache");
  await mkdir(cacheDir, { recursive: true });
  return new FileBackedStageCache(examDir);
}

describe("buildExamDataJson", () => {
  it("merges verified, solved, and extracted with correct priority", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // q1: has verified
    const q1Verified = { number: 1, text: "Q1 text", answer: "1", source: "verified" };
    await writeFile(cache.verifierResultPath(1), JSON.stringify(q1Verified), "utf8");

    // q2: has only solved (no verified)
    const q2Solved = { number: 2, text: "Q2 text", answer: "2", source: "solved" };
    await writeFile(cache.solverResultPath(2), JSON.stringify(q2Solved), "utf8");

    // q3: has only extracted (no solved, no verified)
    const q3Extracted = { number: 3, text: "Q3 text", source: "extracted" };
    await writeFile(cache.questionJsonPath(3), JSON.stringify(q3Extracted), "utf8");

    const meta = {
      school: "테스트고등학교",
      grade: 2,
      subject: "수학 I",
      semester: "1학기",
      exam_type: "중간",
      year: 2025,
    };

    const result = await buildExamDataJson({
      cache,
      meta,
      questionNumbers: [1, 2, 3],
    });

    // Problems are in order
    expect(result.problems).toHaveLength(3);
    expect(result.problems[0]).toMatchObject({ number: 1, source: "verified" });
    expect(result.problems[1]).toMatchObject({ number: 2, source: "solved" });
    expect(result.problems[2]).toMatchObject({ number: 3, source: "extracted" });

    // Meta is included under `info` key
    expect(result.info).toMatchObject({
      school: "테스트고등학교",
      grade: 2,
      subject: "수학 I",
    });

    // File written correctly
    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as {
      info: typeof meta;
      problems: typeof result.problems;
    };
    expect(written.info).toMatchObject(meta);
    expect(written.problems).toHaveLength(3);
  });

  it("throws a clear error when a question number has no cache files", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // q1 exists
    await writeFile(
      cache.questionJsonPath(1),
      JSON.stringify({ number: 1, text: "Q1" }),
      "utf8"
    );
    // q4 does NOT exist

    await expect(
      buildExamDataJson({
        cache,
        meta: { school: "학교" },
        questionNumbers: [1, 4],
      })
    ).rejects.toThrow("missing extracted/solved/verified for Q4");
  });

  it("includes all meta fields in the output info object", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(
      cache.questionJsonPath(1),
      JSON.stringify({ number: 1 }),
      "utf8"
    );

    const meta = {
      school: "소명여자고등학교",
      grade: 1,
      subject: "수학",
      subject_code: "수학",
      semester: "2학기",
      exam_type: "기말",
      year: 2024,
      range: "집합과 명제",
      region: "경기부천시",
      code: "12345",
      total_pages: 4,
    };

    const result = await buildExamDataJson({
      cache,
      meta,
      questionNumbers: [1],
    });

    expect(result.info).toMatchObject(meta);
    expect(result.problems).toHaveLength(1);

    // normalizeMeta also injects camelCase + filename_base defaults
    expect(result.info.examType).toBe("기말");
    expect(result.info.filename_base).toBeTypeOf("string");

    // Verify the written file preserves all meta fields
    const written = JSON.parse(await readFile(cache.examDataPath(), "utf8")) as {
      info: typeof meta;
    };
    expect(written.info).toMatchObject(meta);
  });
});
