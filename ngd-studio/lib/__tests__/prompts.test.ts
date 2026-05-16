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

  it("includes the HWPX template path when provided", () => {
    const result = buildCreatePrompt({ hwpx: "/tmp/template.hwpx" }, [], {});
    expect(result).toContain("- 양식 HWPX: /tmp/template.hwpx");
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

  it("omits empty optional meta fields", () => {
    const result = buildCreatePrompt({ hwpx: "" }, [], { subject: "수학", range: "" });
    expect(result).toContain("- 과목: 수학");
    expect(result).not.toContain("- 범위:");
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

  it("includes HWPX template and total question count", () => {
    const result = buildResumePrompt({ hwpx: "/tmp/form.hwpx" }, "solver", 17, {});
    expect(result).toContain("- 양식 HWPX: /tmp/form.hwpx");
    expect(result).toContain("- 총 문제 수: 17");
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

  it("includes source PDF and output directory", () => {
    const result = buildCropPrompt("/tmp/test.pdf", "/tmp/out");
    expect(result).toContain("- PDF 경로: /tmp/test.pdf");
    expect(result).toContain("- 출력 디렉토리: /tmp/out");
  });
});

describe("buildReviewPrompt", () => {
  it("calls ngd-exam-review skill", () => {
    const result = buildReviewPrompt({ pdf: "/tmp/test.pdf", hwpx: "/tmp/work.hwpx" });
    expect(result).toContain('Skill 도구로 "ngd-exam-review" 스킬을 호출');
  });

  it("includes original PDF and work HWPX paths", () => {
    const result = buildReviewPrompt({ pdf: "/tmp/test.pdf", hwpx: "/tmp/work.hwpx" });
    expect(result).toContain("- 원본 PDF: /tmp/test.pdf");
    expect(result).toContain("- 작업 HWPX: /tmp/work.hwpx");
  });
});
