import { describe, it, expect, beforeEach } from "vitest";
import { useJobStore } from "../store";

beforeEach(() => {
  useJobStore.getState().reset();
});

describe("setMode('create')", () => {
  it("sets 8 stages in V3 (standard) order", () => {
    useJobStore.getState().setMode("create");
    const stages = useJobStore.getState().stages;
    expect(stages).toHaveLength(8);
    expect(stages.map((s) => s.name)).toEqual([
      "cleaned",
      "extractor",
      "review_extract",
      "solver",
      "verifier",
      "figure",
      "builder",
      "checker",
    ]);
  });

  it("all stages start as pending", () => {
    useJobStore.getState().setMode("create");
    const stages = useJobStore.getState().stages;
    stages.forEach((s) => expect(s.status).toBe("pending"));
  });
});

describe("setMode('resume')", () => {
  it("resumeFrom='extractor': cleaned is done, extractor+ are pending", () => {
    useJobStore.getState().setMode("resume", "extractor");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["cleaned"]).toBe("done");
    expect(byName["extractor"]).toBe("pending");
    expect(byName["solver"]).toBe("pending");
    expect(byName["builder"]).toBe("pending");
  });

  it("resumeFrom='builder': stages before builder are done", () => {
    useJobStore.getState().setMode("resume", "builder");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["cleaned"]).toBe("done");
    expect(byName["extractor"]).toBe("done");
    expect(byName["review_extract"]).toBe("done");
    expect(byName["solver"]).toBe("done");
    expect(byName["verifier"]).toBe("done");
    expect(byName["figure"]).toBe("done");
    expect(byName["builder"]).toBe("pending");
    expect(byName["checker"]).toBe("pending");
  });

  it("resumeFrom='confirm' treats as 'builder' (figure done, builder pending)", () => {
    useJobStore.getState().setMode("resume", "confirm");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["figure"]).toBe("done");
    expect(byName["builder"]).toBe("pending");
  });

  it("still returns 8 stages", () => {
    useJobStore.getState().setMode("resume", "solver");
    expect(useJobStore.getState().stages).toHaveLength(8);
  });
});

describe("setMode('crop')", () => {
  it("sets 1 stage: cropper", () => {
    useJobStore.getState().setMode("crop");
    const stages = useJobStore.getState().stages;
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe("cropper");
    expect(stages[0].status).toBe("pending");
  });
});

describe("setMode('review')", () => {
  it("sets 1 stage: reviewer", () => {
    useJobStore.getState().setMode("review");
    const stages = useJobStore.getState().stages;
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe("reviewer");
    expect(stages[0].status).toBe("pending");
  });
});
