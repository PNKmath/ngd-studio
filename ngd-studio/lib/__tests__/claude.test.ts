import { describe, it, expect } from "vitest";
import { detectStageFromTool } from "../claude";

describe("detectStageFromTool", () => {
  it("Skill ngd-exam-create → extractor (V3 flow is now standard)", () => {
    expect(detectStageFromTool("Skill", { skill: "ngd-exam-create" })).toBe("extractor");
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

  it("Read file_path x.pdf → extractor (V3 entry stage)", () => {
    expect(detectStageFromTool("Read", { file_path: "x.pdf" })).toBe("extractor");
  });

  it("Write q01_extracted.json → extractor (V3 per-question artifact)", () => {
    expect(detectStageFromTool("Write", { file_path: "q01_extracted.json" })).toBe("extractor");
  });

  it("Write file_path section0.xml → builder", () => {
    expect(detectStageFromTool("Write", { file_path: "section0.xml" })).toBe("builder");
  });
});
