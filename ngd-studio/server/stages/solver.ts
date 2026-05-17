import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { AIProviderAdapter } from "@/lib/ai/types";
import { deepseekV4Provider } from "@/lib/ai/providers/deepseekV4";
import type { StageCache } from "./cache";
import {
  collectProviderText,
  parseModelJsonOutput,
  validateModelOutput,
  validationFailure,
  type ModelOutputValidation,
} from "./modelHarness";
import type { ModelStageResult, ModelStageRunner } from "./model";

export type SolverExplanationSegmentKind = "text" | "equation";

export interface SolverExplanationSegment {
  kind: SolverExplanationSegmentKind;
  content: string;
}

export interface SolverStageInput {
  questionNumber: number;
  extracted: unknown;
  guidelineContext?: string;
  cache: StageCache;
  provider?: AIProviderAdapter;
  validateEquation?: (content: string) => string | undefined;
  signal?: AbortSignal;
}

export interface SolverStageOutput {
  answer: string;
  explanation: SolverExplanationSegment[];
  verifierContext?: Record<string, unknown>;
}

export const solverStageRunner: ModelStageRunner<SolverStageInput, SolverStageOutput> = {
  key: "create.solver",
  run: runSolverStage,
};

export async function runSolverStage(input: SolverStageInput): Promise<ModelStageResult<SolverStageOutput>> {
  const startedAt = new Date().toISOString();
  const provider = input.provider ?? deepseekV4Provider;
  const prompt = buildSolverPrompt(input);
  const providerResult = provider.run(prompt, { stageKey: "create.solver", signal: input.signal });
  const { text, exitCode } = await collectProviderText(providerResult);

  if (exitCode !== 0) {
    return {
      status: "failed",
      error: {
        code: "solver_provider_failed",
        message: `Solver provider failed with exit code ${exitCode}`,
        retryable: true,
      },
      provider: {
        requestedProvider: providerResult.metadata.requestedProvider,
        provider: providerResult.metadata.provider,
        modelStageKey: "create.solver",
        label: providerResult.metadata.label,
        externalCostUsd: providerResult.metadata.externalCostUsd,
      },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  const parsed = parseModelJsonOutput(text);
  if (!parsed.ok) {
    return toSolverValidationFailure(parsed, providerResult.metadata, startedAt);
  }

  const validation = validateModelOutput(parsed.value, (value) => validateSolverOutput(value, input.validateEquation));
  if (!validation.ok) {
    return toSolverValidationFailure(validationFailure("solver_validation_failed", validation.message, validation.details), providerResult.metadata, startedAt);
  }

  await input.cache.ensureCacheDir();
  const outputPath = input.cache.solverResultPath(input.questionNumber);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(validation.output, null, 2)}\n`, "utf8");

  return {
    status: "completed",
    output: validation.output,
    files: [{ path: outputPath, kind: "cache", label: "Solver result", mimeType: "application/json" }],
    validation: { ok: true, output: validation.output },
    provider: {
      requestedProvider: providerResult.metadata.requestedProvider,
      provider: providerResult.metadata.provider,
      modelStageKey: "create.solver",
      label: providerResult.metadata.label,
      externalCostUsd: providerResult.metadata.externalCostUsd,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export function buildSolverPrompt(input: Pick<SolverStageInput, "extracted" | "guidelineContext">): string {
  return [
    "Solve the extracted exam-question data.",
    "Return only JSON with this schema: {\"answer\":string,\"explanation\":[{\"kind\":\"text\"|\"equation\",\"content\":string}],\"verifierContext\"?:object}.",
    "Equation segments must contain HWP equation syntax only. Text segments must not contain raw equation XML.",
    "Do not edit files. Do not return markdown.",
    input.guidelineContext ? `Guidelines:\n${input.guidelineContext}` : undefined,
    `Extracted JSON:\n${JSON.stringify(input.extracted)}`,
  ].filter(Boolean).join("\n\n");
}

export function validateSolverOutput(
  value: unknown,
  validateEquation?: (content: string) => string | undefined
): ModelOutputValidation<SolverStageOutput> {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "solver output must be an object" };
  }

  const candidate = value as { answer?: unknown; explanation?: unknown; verifierContext?: unknown };
  if (typeof candidate.answer !== "string" || !candidate.answer.trim()) {
    return { ok: false, message: "solver answer is required" };
  }
  if (!Array.isArray(candidate.explanation) || candidate.explanation.length === 0) {
    return { ok: false, message: "solver explanation must be a non-empty array" };
  }

  const explanation: SolverExplanationSegment[] = [];
  for (const segment of candidate.explanation) {
    if (!segment || typeof segment !== "object") {
      return { ok: false, message: "solver explanation segment must be an object" };
    }
    const kind = (segment as { kind?: unknown }).kind;
    const content = (segment as { content?: unknown }).content;
    if (kind !== "text" && kind !== "equation") {
      return { ok: false, message: "solver explanation segment kind is invalid" };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, message: "solver explanation segment content is required" };
    }
    if (kind === "text" && /<hp:equation\b/i.test(content)) {
      return { ok: false, message: "solver text segment contains raw equation XML" };
    }
    if (kind === "equation") {
      const equationIssue = validateEquation?.(content);
      if (equationIssue) {
        return { ok: false, message: equationIssue, details: { segmentKind: kind } };
      }
    }
    explanation.push({ kind, content });
  }

  if (
    candidate.verifierContext !== undefined &&
    (!candidate.verifierContext || typeof candidate.verifierContext !== "object" || Array.isArray(candidate.verifierContext))
  ) {
    return { ok: false, message: "solver verifierContext must be an object" };
  }

  return {
    ok: true,
    output: {
      answer: candidate.answer,
      explanation,
      verifierContext: candidate.verifierContext as Record<string, unknown> | undefined,
    },
  };
}

function toSolverValidationFailure(
  failure: ReturnType<typeof validationFailure>,
  metadata: ReturnType<AIProviderAdapter["run"]>["metadata"],
  startedAt: string
): ModelStageResult<SolverStageOutput> {
  return {
    status: "failed",
    validation: failure.validation,
    error: failure.error,
    provider: {
      requestedProvider: metadata.requestedProvider,
      provider: metadata.provider,
      modelStageKey: "create.solver",
      label: metadata.label,
      externalCostUsd: metadata.externalCostUsd,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
