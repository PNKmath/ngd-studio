import { describe, it, expect, beforeEach } from "vitest";
import { useJobStore } from "../store";

beforeEach(() => {
  useJobStore.getState().reset();
});

describe("setMode('create')", () => {
  it("sets 6 stages in canonical order", () => {
    useJobStore.getState().setMode("create");
    const stages = useJobStore.getState().stages;
    expect(stages).toHaveLength(6);
    expect(stages.map((s) => s.name)).toEqual([
      "extractor",
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
  it("resumeFrom='extractor': all stages are pending (extractor is first)", () => {
    useJobStore.getState().setMode("resume", "extractor");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["extractor"]).toBe("pending");
    expect(byName["solver"]).toBe("pending");
    expect(byName["builder"]).toBe("pending");
  });

  it("resumeFrom='builder': stages before builder are done", () => {
    useJobStore.getState().setMode("resume", "builder");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["extractor"]).toBe("done");
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

  it("still returns 6 stages", () => {
    useJobStore.getState().setMode("resume", "solver");
    expect(useJobStore.getState().stages).toHaveLength(6);
  });

  it("resumeFrom='solver': extractor done, solver+ pending", () => {
    useJobStore.getState().setMode("resume", "solver");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["extractor"]).toBe("done");
    expect(byName["solver"]).toBe("pending");
    expect(byName["verifier"]).toBe("pending");
    expect(byName["figure"]).toBe("pending");
    expect(byName["builder"]).toBe("pending");
    expect(byName["checker"]).toBe("pending");
  });

  it("resumeFrom='verifier': extractor/solver done, verifier+ pending", () => {
    useJobStore.getState().setMode("resume", "verifier");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["extractor"]).toBe("done");
    expect(byName["solver"]).toBe("done");
    expect(byName["verifier"]).toBe("pending");
    expect(byName["figure"]).toBe("pending");
    expect(byName["builder"]).toBe("pending");
    expect(byName["checker"]).toBe("pending");
  });

  it("resumeFrom='figure': extractor/solver/verifier done, figure+ pending", () => {
    useJobStore.getState().setMode("resume", "figure");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["extractor"]).toBe("done");
    expect(byName["solver"]).toBe("done");
    expect(byName["verifier"]).toBe("done");
    expect(byName["figure"]).toBe("pending");
    expect(byName["builder"]).toBe("pending");
    expect(byName["checker"]).toBe("pending");
  });

  it("resumeFrom='checker': figure/builder done, checker pending", () => {
    useJobStore.getState().setMode("resume", "checker");
    const stages = useJobStore.getState().stages;
    const byName = Object.fromEntries(stages.map((s) => [s.name, s.status]));
    expect(byName["extractor"]).toBe("done");
    expect(byName["solver"]).toBe("done");
    expect(byName["verifier"]).toBe("done");
    expect(byName["figure"]).toBe("done");
    expect(byName["builder"]).toBe("done");
    expect(byName["checker"]).toBe("pending");
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

describe("updateStage progress", () => {
  it("updates progress field for a running stage", () => {
    useJobStore.getState().setMode("create");
    useJobStore.getState().updateStage("extractor", { status: "running", progress: 40 });
    const stages = useJobStore.getState().stages;
    const extractor = stages.find((s) => s.name === "extractor");
    expect(extractor?.status).toBe("running");
    expect(extractor?.progress).toBe(40);
  });

  it("progress updated incrementally", () => {
    useJobStore.getState().setMode("create");
    useJobStore.getState().updateStage("solver", { status: "running", progress: 0 });
    useJobStore.getState().updateStage("solver", { progress: 50 });
    useJobStore.getState().updateStage("solver", { progress: 100 });
    const stages = useJobStore.getState().stages;
    const solver = stages.find((s) => s.name === "solver");
    expect(solver?.progress).toBe(100);
  });

  it("other stages are not affected by progress update", () => {
    useJobStore.getState().setMode("create");
    useJobStore.getState().updateStage("extractor", { status: "running", progress: 75 });
    const stages = useJobStore.getState().stages;
    const solver = stages.find((s) => s.name === "solver");
    expect(solver?.progress).toBeUndefined();
  });
});
