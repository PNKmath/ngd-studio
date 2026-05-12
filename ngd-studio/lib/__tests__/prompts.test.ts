import { describe, it, expect } from "vitest";
import {
  buildCreatePrompt,
  buildCreateV3Prompt,
  buildResumeV3Prompt,
  buildCropPrompt,
  buildReviewPrompt,
} from "../prompts";

describe("buildCreatePrompt", () => {
  it("calls ngd-exam-create skill", () => {
    const result = buildCreatePrompt({ pdf: "/tmp/test.pdf", hwpx: "/tmp/form.hwpx" });
    expect(result).toContain('Skill 도구로 "ngd-exam-create" 스킬을 호출');
  });

  it("includes pdf path when provided", () => {
    const result = buildCreatePrompt({ pdf: "/tmp/test.pdf", hwpx: "" });
    expect(result).toContain("/tmp/test.pdf");
  });

  it("image-only mode when no pdf", () => {
    const images = [{ number: 1, path: "/tmp/q1.jpg" }];
    const result = buildCreatePrompt({ pdf: "", hwpx: "" }, images);
    expect(result).toContain("이미지 전용 모드");
    expect(result).toContain('Skill 도구로 "ngd-exam-create" 스킬을 호출');
  });
});

describe("buildCreateV3Prompt", () => {
  it("calls ngd-exam-create-v3 skill", () => {
    const result = buildCreateV3Prompt(
      { hwpx: "/tmp/form.hwpx" },
      [{ number: 1, path: "/tmp/q1.jpg" }],
      {}
    );
    expect(result).toContain('Skill 도구로 "ngd-exam-create-v3" 스킬을 호출');
  });

  it("includes V3 mode header", () => {
    const result = buildCreateV3Prompt({ hwpx: "" }, [], {});
    expect(result).toContain("V3 모드로 시험지를 제작해줘");
  });
});

describe("buildResumeV3Prompt", () => {
  it("first line starts with V3 resume --from=", () => {
    const result = buildResumeV3Prompt({ hwpx: "" }, "solver", 20, {});
    const firstLine = result.split("\n")[0];
    expect(firstLine).toBe("V3 resume --from=solver");
  });

  it("calls ngd-exam-create-v3 skill", () => {
    const result = buildResumeV3Prompt({ hwpx: "" }, "builder", 20, {});
    expect(result).toContain('Skill 도구로 "ngd-exam-create-v3" 스킬을 호출');
  });

  it("embeds resumeFrom value", () => {
    const result = buildResumeV3Prompt({ hwpx: "" }, "figure", 10, {});
    expect(result).toContain("--from=figure");
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
