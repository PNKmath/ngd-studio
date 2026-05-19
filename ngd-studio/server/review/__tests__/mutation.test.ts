/**
 * mutation.test.ts
 *
 * Phase 6 — reviewer mutation module unit tests.
 *
 * Tests:
 *  1. `zipReplaceHwpxSection` — replaces text inside a named zip entry.
 *  2. `zipReplaceHwpxSection` — throws on missing zip entry.
 *  3. `zipReplaceHwpxSection` — throws when snippet not found.
 *  4. `applyReviewMutations` — applies applicable drafts and collects failures.
 *  5. `applyReviewMutations` — draft without suggested_fix goes to failed list.
 *  6. `applyReviewMutations` — partial success: one ok, one missing snippet.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import JSZip from "jszip";
import {
  zipReplaceHwpxSection,
  applyReviewMutations,
  type ReviewIssueDraft,
} from "../mutation";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal HWPX ZIP in memory containing the given section0.xml text. */
async function buildFixtureHwpx(sectionXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("Contents/section0.xml", sectionXml);
  zip.file("mimetype", "application/hwp+zip");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Read Contents/section0.xml from an HWPX buffer. */
async function readSectionXml(hwpxBuf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(hwpxBuf);
  const entry = zip.file("Contents/section0.xml");
  if (!entry) throw new Error("section0.xml not found");
  return entry.async("string");
}

let tmpDir: string;
let hwpxPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "mutation-test-"));
  hwpxPath = path.join(tmpDir, "test.hwpx");
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Basic replacement
// ─────────────────────────────────────────────────────────────────────────────

describe("zipReplaceHwpxSection — basic replacement", () => {
  it("replaces text in the named zip entry", async () => {
    const originalXml =
      "<hp:p><hp:t>예순살</hp:t></hp:p>";
    await writeFile(hwpxPath, await buildFixtureHwpx(originalXml));

    await zipReplaceHwpxSection(hwpxPath, [
      {
        file: "Contents/section0.xml",
        oldText: "예순살",
        newText: "애순살",
      },
    ]);

    const buf = await readFile(hwpxPath);
    const xml = await readSectionXml(buf);
    expect(xml).toContain("애순살");
    expect(xml).not.toContain("예순살");
  });

  it("replaces XML fragment including tags", async () => {
    const originalXml =
      '<hp:equation><hp:script>a=b=c</hp:script></hp:equation>';
    await writeFile(hwpxPath, await buildFixtureHwpx(originalXml));

    await zipReplaceHwpxSection(hwpxPath, [
      {
        file: "Contents/section0.xml",
        oldText: "<hp:script>a=b=c</hp:script>",
        newText: "<hp:script>a=b</hp:script>",
      },
    ]);

    const buf = await readFile(hwpxPath);
    const xml = await readSectionXml(buf);
    expect(xml).toContain("<hp:script>a=b</hp:script>");
    expect(xml).not.toContain("a=b=c");
  });

  it("applies multiple replacements in one call", async () => {
    const originalXml =
      "<hp:p><hp:t>AAA</hp:t><hp:t>BBB</hp:t></hp:p>";
    await writeFile(hwpxPath, await buildFixtureHwpx(originalXml));

    await zipReplaceHwpxSection(hwpxPath, [
      { file: "Contents/section0.xml", oldText: "AAA", newText: "111" },
      { file: "Contents/section0.xml", oldText: "BBB", newText: "222" },
    ]);

    const buf = await readFile(hwpxPath);
    const xml = await readSectionXml(buf);
    expect(xml).toContain("111");
    expect(xml).toContain("222");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Missing zip entry throws
// ─────────────────────────────────────────────────────────────────────────────

describe("zipReplaceHwpxSection — missing zip entry", () => {
  it("throws StageError when the named entry does not exist", async () => {
    await writeFile(hwpxPath, await buildFixtureHwpx("<hp:p/>"));

    await expect(
      zipReplaceHwpxSection(hwpxPath, [
        { file: "Contents/nonexistent.xml", oldText: "x", newText: "y" },
      ])
    ).rejects.toMatchObject({ code: "review_mutation_missing_entry" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Snippet not found throws
// ─────────────────────────────────────────────────────────────────────────────

describe("zipReplaceHwpxSection — snippet not found", () => {
  it("throws StageError when oldText is not present in the entry", async () => {
    await writeFile(hwpxPath, await buildFixtureHwpx("<hp:p><hp:t>hello</hp:t></hp:p>"));

    await expect(
      zipReplaceHwpxSection(hwpxPath, [
        {
          file: "Contents/section0.xml",
          oldText: "DOES_NOT_EXIST",
          newText: "something",
        },
      ])
    ).rejects.toMatchObject({ code: "review_mutation_snippet_not_found" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. applyReviewMutations — all applied
// ─────────────────────────────────────────────────────────────────────────────

describe("applyReviewMutations — all applied", () => {
  it("applies each draft and returns them in applied list", async () => {
    const xml = "<hp:p><hp:t>오타A</hp:t><hp:t>오타B</hp:t></hp:p>";
    await writeFile(hwpxPath, await buildFixtureHwpx(xml));

    const drafts: ReviewIssueDraft[] = [
      {
        issue_type: "typo",
        location: { file: "Contents/section0.xml", snippet: "오타A" },
        suggested_fix: "수정A",
      },
      {
        issue_type: "typo",
        location: { file: "Contents/section0.xml", snippet: "오타B" },
        suggested_fix: "수정B",
      },
    ];

    const result = await applyReviewMutations(hwpxPath, drafts);

    expect(result.applied).toHaveLength(2);
    expect(result.failed).toHaveLength(0);

    const buf = await readFile(hwpxPath);
    const finalXml = await readSectionXml(buf);
    expect(finalXml).toContain("수정A");
    expect(finalXml).toContain("수정B");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. applyReviewMutations — draft without suggested_fix
// ─────────────────────────────────────────────────────────────────────────────

describe("applyReviewMutations — no suggested_fix", () => {
  it("puts draft without suggested_fix into failed list", async () => {
    await writeFile(hwpxPath, await buildFixtureHwpx("<hp:p><hp:t>text</hp:t></hp:p>"));

    const drafts: ReviewIssueDraft[] = [
      {
        issue_type: "missing",
        location: { file: "Contents/section0.xml", snippet: "text" },
        // no suggested_fix
      },
    ];

    const result = await applyReviewMutations(hwpxPath, drafts);

    expect(result.applied).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason).toMatch(/suggested_fix/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. applyReviewMutations — partial success
// ─────────────────────────────────────────────────────────────────────────────

describe("applyReviewMutations — partial success", () => {
  it("applies valid draft and puts unfindable draft into failed list", async () => {
    const xml = "<hp:p><hp:t>good</hp:t></hp:p>";
    await writeFile(hwpxPath, await buildFixtureHwpx(xml));

    const drafts: ReviewIssueDraft[] = [
      {
        issue_type: "typo",
        location: { file: "Contents/section0.xml", snippet: "good" },
        suggested_fix: "GOOD",
      },
      {
        issue_type: "typo",
        location: { file: "Contents/section0.xml", snippet: "DOES_NOT_EXIST_IN_DOC" },
        suggested_fix: "whatever",
      },
    ];

    const result = await applyReviewMutations(hwpxPath, drafts);

    expect(result.applied).toHaveLength(1);
    expect(result.failed).toHaveLength(1);

    const buf = await readFile(hwpxPath);
    const finalXml = await readSectionXml(buf);
    expect(finalXml).toContain("GOOD");
    expect(finalXml).not.toContain("good");
  });
});
