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

export type VerifierStatus = "pass" | "fail";
export type VerifierIssueSeverity = "info" | "warning" | "error";

export interface VerifierIssue {
  message: string;
  severity?: VerifierIssueSeverity;
  path?: string;
}

export interface VerifierStageInput {
  questionNumber: number;
  extracted: unknown;
  solved?: unknown;
  guidelineContext?: string;
  cache: StageCache;
  provider?: AIProviderAdapter;
  signal?: AbortSignal;
}

export interface VerifierStageOutput {
  status: VerifierStatus;
  issues: VerifierIssue[];
  feedback?: string;
}

export const verifierStageRunner: ModelStageRunner<VerifierStageInput, VerifierStageOutput> = {
  key: "create.verifier",
  run: runVerifierStage,
};

export async function runVerifierStage(input: VerifierStageInput): Promise<ModelStageResult<VerifierStageOutput>> {
  const startedAt = new Date().toISOString();
  const provider = input.provider ?? deepseekV4Provider;
  const prompt = buildVerifierPrompt(input);
  const providerResult = provider.run(prompt, { stageKey: "create.verifier", signal: input.signal });
  const { text, exitCode } = await collectProviderText(providerResult);

  if (exitCode !== 0) {
    return {
      status: "failed",
      error: {
        code: "verifier_provider_failed",
        message: `Verifier provider failed with exit code ${exitCode}`,
        retryable: true,
      },
      provider: {
        requestedProvider: providerResult.metadata.requestedProvider,
        provider: providerResult.metadata.provider,
        modelStageKey: "create.verifier",
        label: providerResult.metadata.label,
        externalCostUsd: providerResult.metadata.externalCostUsd,
      },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  const parsed = parseModelJsonOutput(text);
  if (!parsed.ok) {
    return toValidationFailure(parsed, providerResult.metadata, startedAt);
  }

  const validation = validateModelOutput(parsed.value, validateVerifierOutput);
  if (!validation.ok) {
    return toValidationFailure(validationFailure("verifier_validation_failed", validation.message, validation.details), providerResult.metadata, startedAt);
  }

  await input.cache.ensureCacheDir();
  const outputPath = input.cache.verifierResultPath(input.questionNumber);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(validation.output, null, 2)}\n`, "utf8");

  return {
    status: "completed",
    output: validation.output,
    files: [{ path: outputPath, kind: "cache", label: "Verifier result", mimeType: "application/json" }],
    validation: { ok: true, output: validation.output },
    provider: {
      requestedProvider: providerResult.metadata.requestedProvider,
      provider: providerResult.metadata.provider,
      modelStageKey: "create.verifier",
      label: providerResult.metadata.label,
      externalCostUsd: providerResult.metadata.externalCostUsd,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export function buildVerifierPrompt(input: Pick<VerifierStageInput, "extracted" | "solved" | "guidelineContext">): string {
  return [
    "Verify the extracted and solved exam-question data.",
    "Return only JSON with this schema: {\"status\":\"pass\"|\"fail\",\"issues\":[{\"message\":string,\"severity\"?:\"info\"|\"warning\"|\"error\",\"path\"?:string}],\"feedback\"?:string}.",
    "Do not edit files. Do not return markdown.",
    input.guidelineContext ? `Guidelines:\n${input.guidelineContext}` : undefined,
    `Extracted JSON:\n${JSON.stringify(input.extracted)}`,
    input.solved === undefined ? undefined : `Solved JSON:\n${JSON.stringify(input.solved)}`,
  ].filter(Boolean).join("\n\n");
}

export function validateVerifierOutput(value: unknown): ModelOutputValidation<VerifierStageOutput> {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "verifier output must be an object" };
  }

  const candidate = value as { status?: unknown; issues?: unknown; feedback?: unknown };
  if (candidate.status !== "pass" && candidate.status !== "fail") {
    return { ok: false, message: "verifier status must be pass or fail" };
  }
  if (!Array.isArray(candidate.issues)) {
    return { ok: false, message: "verifier issues must be an array" };
  }

  const issues: VerifierIssue[] = [];
  for (const issue of candidate.issues) {
    if (!issue || typeof issue !== "object" || typeof (issue as { message?: unknown }).message !== "string") {
      return { ok: false, message: "verifier issue message is required" };
    }
    const severity = (issue as { severity?: unknown }).severity;
    if (
      severity !== undefined &&
      severity !== "info" &&
      severity !== "warning" &&
      severity !== "error"
    ) {
      return { ok: false, message: "verifier issue severity is invalid" };
    }
    const issuePath = (issue as { path?: unknown }).path;
    issues.push({
      message: (issue as { message: string }).message,
      severity: severity as VerifierIssueSeverity | undefined,
      path: typeof issuePath === "string" ? issuePath : undefined,
    });
  }

  if (candidate.feedback !== undefined && typeof candidate.feedback !== "string") {
    return { ok: false, message: "verifier feedback must be a string" };
  }

  return {
    ok: true,
    output: {
      status: candidate.status,
      issues,
      feedback: candidate.feedback,
    },
  };
}

function toValidationFailure(
  failure: ReturnType<typeof validationFailure>,
  metadata: ReturnType<AIProviderAdapter["run"]>["metadata"],
  startedAt: string
): ModelStageResult<VerifierStageOutput> {
  return {
    status: "failed",
    validation: failure.validation,
    error: failure.error,
    provider: {
      requestedProvider: metadata.requestedProvider,
      provider: metadata.provider,
      modelStageKey: "create.verifier",
      label: metadata.label,
      externalCostUsd: metadata.externalCostUsd,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
