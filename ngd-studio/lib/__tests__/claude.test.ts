import { describe, it, expect } from "vitest";
import { detectStageFromTool } from "../claude";

describe("detectStageFromTool", () => {
  it("Skill ngd-exam-create → reader (V1 orchestrator start)", () => {
    expect(detectStageFromTool("Skill", { skill: "ngd-exam-create" })).toBe("reader");
  });

  it("Skill ngd-exam-create-v3 → extractor (V3 orchestrator start)", () => {
    expect(detectStageFromTool("Skill", { skill: "ngd-exam-create-v3" })).toBe("extractor");
  });

  it("Skill ngd-exam-crop → cropper", () => {
    expect(detectStageFromTool("Skill", { skill: "ngd-exam-crop" })).toBe("cropper");
  });

  it("Skill nano-banana → figure", () => {
    expect(detectStageFromTool("Skill", { skill: "nano-banana" })).toBe("figure");
  });

  it("Agent subagent_type ngd-exam-extractor → extractor", () => {
    expect(detectStageFromTool("Agent", { subagent_type: "ngd-exam-extractor" })).toBe("extractor");
  });

  it("Agent subagent_type ngd-exam-solver → solver", () => {
    expect(detectStageFromTool("Agent", { subagent_type: "ngd-exam-solver" })).toBe("solver");
  });

  it("Agent subagent_type ngd-exam-builder → builder", () => {
    expect(detectStageFromTool("Agent", { subagent_type: "ngd-exam-builder" })).toBe("builder");
  });

  it("Read file_path x.pdf → reader", () => {
    expect(detectStageFromTool("Read", { file_path: "x.pdf" })).toBe("reader");
  });

  it("Write file_path section0.xml → builder", () => {
    expect(detectStageFromTool("Write", { file_path: "section0.xml" })).toBe("builder");
  });
});
