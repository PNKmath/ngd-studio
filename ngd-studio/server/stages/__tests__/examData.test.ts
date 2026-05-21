import { mkdtemp, readFile, rm, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildExamDataJson, aggregateVerifiedProblems } from "../examData";
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

  it("count match: problems.length === questionNumbers.length on full success", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    for (const n of [1, 2, 3]) {
      await writeFile(cache.verifierResultPath(n), JSON.stringify({ number: n }), "utf8");
    }

    const result = await buildExamDataJson({
      cache,
      meta: { school: "테스트고" },
      questionNumbers: [1, 2, 3],
    });

    // audit doc line 19 "count match" condition
    expect(result.problems).toHaveLength(3);
    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as { problems: unknown[] };
    expect(written.problems).toHaveLength(3);
  });

  it("schoolLevel='중' → filename_base 에 [중] 포함 + info.school_level === '중'", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.questionJsonPath(1), JSON.stringify({ number: 1 }), "utf8");

    const meta = {
      school: "테스트중학교",
      grade: 3,
      subject: "수학",
      semester: "1학기",
      exam_type: "중간",
      year: 2024,
      code: "NGD",
      region: "서울",
      schoolLevel: "중" as const,
    };

    const result = await buildExamDataJson({ cache, meta, questionNumbers: [1] });

    expect(result.info.school_level).toBe("중");
    expect(result.info.schoolLevel).toBe("중");
    expect(result.info.filename_base).toContain("[중]");
    expect(result.info.filename_base).not.toContain("[고]");
  });

  it("schoolLevel 미지정 → filename_base 에 [고] 포함 (legacy 회귀 없음)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.questionJsonPath(1), JSON.stringify({ number: 1 }), "utf8");

    const meta = {
      school: "테스트고등학교",
      grade: 2,
      subject: "수학 I",
      semester: "1학기",
      exam_type: "중간",
      year: 2025,
      code: "NGD",
      region: "경기",
      // schoolLevel 미지정 — default "고" 적용
    };

    const result = await buildExamDataJson({ cache, meta, questionNumbers: [1] });

    expect(result.info.school_level).toBe("고");
    expect(result.info.schoolLevel).toBe("고");
    expect(result.info.filename_base).toContain("[고]");
    expect(result.info.filename_base).not.toContain("[중]");
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

// ──────────────────────────────────────────────
// aggregateVerifiedProblems — Phase 3
// ──────────────────────────────────────────────

describe("aggregateVerifiedProblems", () => {
  it("aggregates all verified problems and returns AggregateResult", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    for (const n of [1, 2, 3]) {
      await writeFile(cache.verifierResultPath(n), JSON.stringify({ number: n, status: "pass" }), "utf8");
    }

    const result = await aggregateVerifiedProblems(cache, [1, 2, 3], { school: "테스트고" });

    expect(result.totalQuestions).toBe(3);
    expect(result.includedQuestions).toBe(3);
    expect(result.skippedQuestions).toHaveLength(0);
    expect(result.examDataPath).toBe(cache.paths.examData);

    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as { problems: unknown[] };
    expect(written.problems).toHaveLength(3);
  });

  it("skips missing questions and reports them in skippedQuestions (partial verified)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Q1 has verified, Q2 has only extracted, Q3 missing entirely
    await writeFile(cache.verifierResultPath(1), JSON.stringify({ number: 1 }), "utf8");
    await writeFile(cache.questionJsonPath(2), JSON.stringify({ number: 2 }), "utf8");
    // Q3: no file at all

    const result = await aggregateVerifiedProblems(cache, [1, 2, 3], { school: "학교" });

    expect(result.totalQuestions).toBe(3);
    expect(result.includedQuestions).toBe(2); // Q1 + Q2
    expect(result.skippedQuestions).toHaveLength(1);
    expect(result.skippedQuestions[0]?.number).toBe(3);
    expect(result.skippedQuestions[0]?.reason).toContain("Q3");
  });

  it("throws AggregateError when ALL questions are missing (typed error)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // No files written — all questions will fail
    await expect(
      aggregateVerifiedProblems(cache, [1, 2], { school: "학교" })
    ).rejects.toThrow(AggregateError);
  });

  it("AggregateError message mentions total and 'all skipped'", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    let thrown: unknown;
    try {
      await aggregateVerifiedProblems(cache, [5, 6], { school: "학교" });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).message).toContain("all skipped");
    expect((thrown as AggregateError).errors).toHaveLength(2);
  });

  it("falls back from verified → solved → extracted in priority order", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Q1: verified only
    await writeFile(cache.verifierResultPath(1), JSON.stringify({ number: 1, source: "verified" }), "utf8");
    // Q2: solved only
    await writeFile(cache.solverResultPath(2), JSON.stringify({ number: 2, source: "solved" }), "utf8");
    // Q3: extracted only
    await writeFile(cache.questionJsonPath(3), JSON.stringify({ number: 3, source: "extracted" }), "utf8");

    const result = await aggregateVerifiedProblems(cache, [1, 2, 3], {});

    expect(result.includedQuestions).toBe(3);
    expect(result.skippedQuestions).toHaveLength(0);

    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as {
      problems: Array<{ number: number; source: string }>;
    };
    expect(written.problems[0]).toMatchObject({ source: "verified" });
    expect(written.problems[1]).toMatchObject({ source: "solved" });
    expect(written.problems[2]).toMatchObject({ source: "extracted" });
  });
});
