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

// ──────────────────────────────────────────────
// Realistic per-question cache fixtures.
// Mirrors actual disjoint schemas:
//   extracted: problem definition (type/score/parts/choices/...)
//   solved   : { number, answer, explanation_parts }
//   verified : { number, status, issues, feedback }  — gating only
// ──────────────────────────────────────────────

function makeExtracted(n: number): Record<string, unknown> {
  return {
    number: n,
    type: "choice",
    score: "3.8",
    difficulty: "하",
    subtopic: "정적분",
    has_figure: false,
    figure_info: null,
    parts: [{ t: `Q${n} 본문` }, { eq: "x^2" }],
    choices: [
      [{ t: "① " }, { eq: "1" }],
      [{ t: "② " }, { eq: "2" }],
    ],
    condition_box: null,
    bogi_box: null,
    data_table: null,
    explanation_table: null,
  };
}

function makeSolved(n: number, answer = "⑤"): Record<string, unknown> {
  return {
    number: n,
    answer,
    explanation_parts: [
      { t: `Q${n} 풀이` },
      { eq: "x^2 + 1" },
      { br: true },
      { t: "따라서 정답." },
    ],
  };
}

function makeVerified(n: number, status: "pass" | "fail" = "pass"): Record<string, unknown> {
  return {
    number: n,
    status,
    issues: [],
    feedback: null,
  };
}

describe("buildExamDataJson — merge contract (A안: verifier = gating only)", () => {
  it("merges extracted (problem definition) + solved (answer/explanation) into one problem object", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "테스트고", year: 2025 },
      questionNumbers: [1],
    });

    const p = result.problems[0] as Record<string, unknown>;
    // Extractor-side fields survive
    expect(p.type).toBe("choice");
    expect(p.score).toBe("3.8");
    expect(p.parts).toEqual([{ t: "Q1 본문" }, { eq: "x^2" }]);
    expect(p.choices).toBeDefined();
    expect(p.has_figure).toBe(false);
    // Solver-side fields are layered on top
    expect(p.answer).toBe("⑤");
    expect(p.explanation_parts).toBeDefined();
    expect(Array.isArray(p.explanation_parts)).toBe(true);
  });

  it("solved fields override extracted on key conflict (number stays consistent)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Both files carry `number` — solved-side should win since merge is { ...extracted, ...solved }
    await writeFile(cache.extractorResultPath(2), JSON.stringify(makeExtracted(2)), "utf8");
    await writeFile(cache.solverResultPath(2), JSON.stringify(makeSolved(2, "③")), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "테스트고", year: 2025 },
      questionNumbers: [2],
    });
    const p = result.problems[0] as Record<string, unknown>;
    expect(p.number).toBe(2);
    expect(p.answer).toBe("③");
  });

  it("does NOT merge _verified.json into the problem body (verifier = gating ledger only)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(3), JSON.stringify(makeExtracted(3)), "utf8");
    await writeFile(cache.solverResultPath(3), JSON.stringify(makeSolved(3)), "utf8");
    // _verified carries gating fields that must NEVER appear on the problem
    await writeFile(cache.verifierResultPath(3), JSON.stringify(makeVerified(3, "pass")), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "테스트고", year: 2025 },
      questionNumbers: [3],
    });
    const p = result.problems[0] as Record<string, unknown>;

    // problem fields preserved
    expect(p.type).toBe("choice");
    expect(p.answer).toBe("⑤");
    // verifier-side fields must NOT leak into the problem body
    expect(p.status).toBeUndefined();
    expect(p.issues).toBeUndefined();
    expect(p.feedback).toBeUndefined();
  });

  it("throws when extracted is missing (problem definition unavailable)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Only solved — no extracted file at all
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

    await expect(
      buildExamDataJson({
        cache,
        meta: { school: "학교" },
        questionNumbers: [1],
      })
    ).rejects.toThrow(/Q1/);
  });

  it("throws when solved is missing (answer/explanation unavailable)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Only extracted — no solver result
    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");

    await expect(
      buildExamDataJson({
        cache,
        meta: { school: "학교" },
        questionNumbers: [1],
      })
    ).rejects.toThrow(/Q1/);
  });

  it("throws for a question with no cache files at all", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");
    // Q4 entirely missing

    await expect(
      buildExamDataJson({
        cache,
        meta: { school: "학교" },
        questionNumbers: [1, 4],
      })
    ).rejects.toThrow(/Q4/);
  });

  it("count match: problems.length === questionNumbers.length on full success", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    for (const n of [1, 2, 3]) {
      await writeFile(cache.extractorResultPath(n), JSON.stringify(makeExtracted(n)), "utf8");
      await writeFile(cache.solverResultPath(n), JSON.stringify(makeSolved(n)), "utf8");
    }

    const result = await buildExamDataJson({
      cache,
      meta: { school: "테스트고" },
      questionNumbers: [1, 2, 3],
    });

    expect(result.problems).toHaveLength(3);
    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as { problems: unknown[] };
    expect(written.problems).toHaveLength(3);
  });

  it("regression guard: assembled problem carries every field build_hwpx.py reads", async () => {
    // assemble.py:300-310 reads: type, score, parts, choices, answer, explanation_parts, has_figure, figure_info.
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "테스트고", year: 2025 },
      questionNumbers: [1],
    });
    const p = result.problems[0] as Record<string, unknown>;

    for (const key of ["type", "score", "parts", "choices", "answer", "explanation_parts", "has_figure"]) {
      expect(p[key], `field ${key} must survive into merged problem`).not.toBeUndefined();
    }
  });
});

describe("buildExamDataJson — info / meta normalization", () => {
  it("schoolLevel='중' → filename_base contains [중] + info.school_level === '중'", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

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

  it("schoolLevel unspecified → filename_base contains [고] (legacy default)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

    const meta = {
      school: "테스트고등학교",
      grade: 2,
      subject: "수학 I",
      semester: "1학기",
      exam_type: "중간",
      year: 2025,
      code: "NGD",
      region: "경기",
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

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

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

    const result = await buildExamDataJson({ cache, meta, questionNumbers: [1] });

    expect(result.info).toMatchObject(meta);
    expect(result.problems).toHaveLength(1);

    expect(result.info.examType).toBe("기말");
    expect(result.info.filename_base).toBeTypeOf("string");

    const written = JSON.parse(await readFile(cache.examDataPath(), "utf8")) as { info: typeof meta };
    expect(written.info).toMatchObject(meta);
  });
});

// ──────────────────────────────────────────────
// aggregateVerifiedProblems — Phase 3 (partial-skip policy)
// ──────────────────────────────────────────────

describe("aggregateVerifiedProblems — merge contract (verifier = gating only)", () => {
  it("aggregates all problems when extracted + solved exist for every question", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    for (const n of [1, 2, 3]) {
      await writeFile(cache.extractorResultPath(n), JSON.stringify(makeExtracted(n)), "utf8");
      await writeFile(cache.solverResultPath(n), JSON.stringify(makeSolved(n)), "utf8");
      // verifier presence is irrelevant — should never affect output
      await writeFile(cache.verifierResultPath(n), JSON.stringify(makeVerified(n, "pass")), "utf8");
    }

    const result = await aggregateVerifiedProblems(cache, [1, 2, 3], { school: "테스트고" });

    expect(result.totalQuestions).toBe(3);
    expect(result.includedQuestions).toBe(3);
    expect(result.skippedQuestions).toHaveLength(0);
    expect(result.examDataPath).toBe(cache.paths.examData);

    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as {
      problems: Array<Record<string, unknown>>;
    };
    expect(written.problems).toHaveLength(3);
    // Each problem must carry merged fields, none of the verifier fields
    for (const p of written.problems) {
      expect(p.type).toBe("choice");
      expect(p.parts).toBeDefined();
      expect(p.answer).toBeDefined();
      expect(p.status).toBeUndefined();
      expect(p.issues).toBeUndefined();
    }
  });

  it("includes extracted-only problems (partial progress surface), skips questions without extracted", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Q1 fully OK → included with merged answer
    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");
    // Q2 extracted-only (solver in progress) → included to surface partial progress
    await writeFile(cache.extractorResultPath(2), JSON.stringify(makeExtracted(2)), "utf8");
    // Q3 absent entirely → skipped
    // Q4 verified-only (no problem definition) → skipped (no extracted to base the merge on)
    await writeFile(cache.verifierResultPath(4), JSON.stringify(makeVerified(4, "pass")), "utf8");

    const result = await aggregateVerifiedProblems(cache, [1, 2, 3, 4], { school: "학교" });

    expect(result.totalQuestions).toBe(4);
    expect(result.includedQuestions).toBe(2);
    const skippedNums = result.skippedQuestions.map((s) => s.number).sort();
    expect(skippedNums).toEqual([3, 4]);

    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as {
      problems: Array<Record<string, unknown>>;
    };
    // Q1 has answer; Q2 carries problem definition but no answer (extracted-only)
    const q1 = written.problems.find((p) => p.number === 1)!;
    const q2 = written.problems.find((p) => p.number === 2)!;
    expect(q1.answer).toBe("⑤");
    expect(q2.answer).toBeUndefined();
    expect(q2.type).toBe("choice");
  });

  it("throws AggregateError when ALL questions are missing the required sources", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // verifier-only fixture is intentionally insufficient
    await writeFile(cache.verifierResultPath(1), JSON.stringify(makeVerified(1, "pass")), "utf8");
    await writeFile(cache.verifierResultPath(2), JSON.stringify(makeVerified(2, "pass")), "utf8");

    await expect(
      aggregateVerifiedProblems(cache, [1, 2], { school: "학교" })
    ).rejects.toThrow(AggregateError);
  });

  it("AggregateError message mentions 'all skipped' and lists each cause", async () => {
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

  it("strips leading circled-number prefix from choices (assemble.py contract)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    // Simulates the 경북여고 cache: extractor included `① ` prefix in choices,
    // which makes assemble.py emit duplicate "① ①" AND force the 5-row layout.
    const extracted = {
      number: 1,
      type: "choice",
      score: "3.4",
      difficulty: "하",
      subtopic: "정적분",
      has_figure: false,
      figure_info: null,
      parts: [{ t: "Q1 본문" }],
      choices: [
        [{ t: "① " }, { eq: "-20" }],
        [{ t: "② " }, { eq: "-10" }],
        [{ t: "③ " }, { eq: "0" }],
        [{ t: "④ " }, { eq: "10" }],
        [{ t: "⑤ " }, { eq: "20" }],
      ],
      condition_box: null,
      bogi_box: null,
      data_table: null,
      explanation_table: null,
    };
    await writeFile(cache.extractorResultPath(1), JSON.stringify(extracted), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "경북여고", year: 2025 },
      questionNumbers: [1],
    });

    const p = result.problems[0] as { choices: Array<Array<Record<string, unknown>>> };
    expect(p.choices).toEqual([
      [{ eq: "-20" }],
      [{ eq: "-10" }],
      [{ eq: "0" }],
      [{ eq: "10" }],
      [{ eq: "20" }],
    ]);
  });

  it("preserves choices that have no circled-number prefix (no-op)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    const extracted = {
      number: 2,
      type: "choice",
      score: "3.4",
      parts: [{ t: "Q2" }],
      choices: [[{ eq: "1 over 6" }], [{ eq: "1 over 3" }]],
      has_figure: false,
      figure_info: null,
      condition_box: null,
      bogi_box: null,
      data_table: null,
      explanation_table: null,
    };
    await writeFile(cache.extractorResultPath(2), JSON.stringify(extracted), "utf8");
    await writeFile(cache.solverResultPath(2), JSON.stringify(makeSolved(2)), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "학교", year: 2025 },
      questionNumbers: [2],
    });

    const p = result.problems[0] as { choices: unknown };
    expect(p.choices).toEqual([[{ eq: "1 over 6" }], [{ eq: "1 over 3" }]]);
  });

  it("strips circled prefix when t carries trailing text (keeps remainder)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    const extracted = {
      number: 3,
      type: "choice",
      score: "3.4",
      parts: [{ t: "Q3" }],
      choices: [
        [{ t: "① 가" }],
        [{ t: "② 나" }],
      ],
      has_figure: false,
      figure_info: null,
      condition_box: null,
      bogi_box: null,
      data_table: null,
      explanation_table: null,
    };
    await writeFile(cache.extractorResultPath(3), JSON.stringify(extracted), "utf8");
    await writeFile(cache.solverResultPath(3), JSON.stringify(makeSolved(3)), "utf8");

    const result = await buildExamDataJson({
      cache,
      meta: { school: "학교", year: 2025 },
      questionNumbers: [3],
    });

    const p = result.problems[0] as { choices: unknown };
    expect(p.choices).toEqual([[{ t: "가" }], [{ t: "나" }]]);
  });

  it("does not merge verifier fields into included problems (regression guard)", async () => {
    const base = await makeTempDir();
    const cache = await makeCache(base);

    await writeFile(cache.extractorResultPath(1), JSON.stringify(makeExtracted(1)), "utf8");
    await writeFile(cache.solverResultPath(1), JSON.stringify(makeSolved(1)), "utf8");
    await writeFile(
      cache.verifierResultPath(1),
      JSON.stringify({ number: 1, status: "fail", issues: [{ category: "math_accuracy", description: "x" }], feedback: "redo" }),
      "utf8"
    );

    const result = await aggregateVerifiedProblems(cache, [1], { school: "학교" });
    expect(result.includedQuestions).toBe(1);

    const written = JSON.parse(await readFile(cache.paths.examData, "utf8")) as {
      problems: Array<Record<string, unknown>>;
    };
    const p = written.problems[0];
    expect(p.status).toBeUndefined();
    expect(p.issues).toBeUndefined();
    expect(p.feedback).toBeUndefined();
  });
});
