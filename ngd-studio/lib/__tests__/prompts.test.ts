import { describe, it, expect } from "vitest";
import {
  buildCreatePrompt,
  buildResumePrompt,
  buildCropPrompt,
  buildReviewPrompt,
} from "../prompts";

describe("buildCreatePrompt", () => {
  it("calls ngd-exam-create skill", () => {
    const result = buildCreatePrompt(
      { hwpx: "/tmp/form.hwpx" },
      [{ number: 1, path: "/tmp/q1.jpg" }],
      {}
    );
    expect(result).toContain('Skill 도구로 "ngd-exam-create" 스킬을 호출');
  });

  it("includes 시험지 제작 header (V3 flow input)", () => {
    const result = buildCreatePrompt({ hwpx: "" }, [], {});
    expect(result).toContain("시험지를 제작해줘");
  });

  it("includes question images list", () => {
    const result = buildCreatePrompt(
      { hwpx: "" },
      [
        { number: 1, path: "/tmp/q1.jpg" },
        { number: 2, path: "/tmp/q2.jpg" },
      ],
      {}
    );
    expect(result).toContain("/tmp/q1.jpg");
    expect(result).toContain("/tmp/q2.jpg");
    expect(result).toContain("총 2문제");
  });

  it("includes meta fields when provided", () => {
    const result = buildCreatePrompt(
      { hwpx: "" },
      [],
      { school: "OO고", grade: 2, subject: "수학 I", semester: "1학기", examType: "중간", range: "지수~삼각" }
    );
    expect(result).toContain("OO고");
    expect(result).toContain("수학 I");
    expect(result).toContain("1학기");
  });
});

describe("buildResumePrompt", () => {
  it("first line is 'resume --from=<stage>'", () => {
    const result = buildResumePrompt({ hwpx: "" }, "solver", 20, {});
    const firstLine = result.split("\n")[0];
    expect(firstLine).toBe("resume --from=solver");
  });

  it("calls ngd-exam-create skill", () => {
    const result = buildResumePrompt({ hwpx: "" }, "builder", 20, {});
    expect(result).toContain('Skill 도구로 "ngd-exam-create" 스킬을 호출');
  });

  it("embeds resumeFrom value", () => {
    const result = buildResumePrompt({ hwpx: "" }, "figure", 10, {});
    expect(result).toContain("--from=figure");
  });

  it("does not emit legacy V3 keyword in resume command", () => {
    const result = buildResumePrompt({ hwpx: "" }, "extractor", 5, {});
    expect(result).not.toMatch(/\bV3\s+resume\b/);
  });
});

describe("buildCropPrompt", () => {
  it("calls ngd-exam-crop skill", () => {
    const result = buildCropPrompt("/tmp/test.pdf", "/tmp/out");
    expect(result).toContain('Skill 도구로 "ngd-exam-crop" 스킬을 호출');
  });
});

describe("buildReviewPrompt", () => {
  it("calls ngd-exam-review skill", () => {
    const result = buildReviewPrompt({ pdf: "/tmp/test.pdf", hwpx: "/tmp/work.hwpx" });
    expect(result).toContain('Skill 도구로 "ngd-exam-review" 스킬을 호출');
  });
});
