import { writeFile } from "fs/promises";
import type { AIProviderAdapter } from "@/lib/ai/types";
import { claudeSdkProvider } from "@/lib/ai/providers/claudeSdk";
import type { StageCache } from "./cache";
import {
  collectProviderText,
  parseModelJsonOutput,
  validateModelOutput,
  validationFailure,
  type ModelOutputValidation,
} from "./modelHarness";
import type { ModelStageResult } from "./model";
import type { ExamMeta } from "./prompts/extractorPrompt";
import { buildExtractorPrompt } from "./prompts/extractorPrompt";

export type { ExamMeta };

export interface ExtractorFigureInfo {
  description_en?: string;
  position?: string;
  crop_ratio?: [number, number, number, number];
}

export interface ExtractorStageOutput {
  question?: string;
  choices?: string[];
  answer?: string | number;
  has_figure: boolean;
  figure_info: ExtractorFigureInfo | null;
  [key: string]: unknown;
}

export interface ExtractorStageInput {
  questionNumber: number;
  imagePath: string;
  examMeta?: ExamMeta;
  cache: StageCache;
  provider?: AIProviderAdapter;
  signal?: AbortSignal;
}

export async function runExtractorStage(
  input: ExtractorStageInput
): Promise<ModelStageResult<ExtractorStageOutput>> {
  const startedAt = new Date().toISOString();
  const provider = input.provider ?? claudeSdkProvider;

  const { system, user } = buildExtractorPrompt({
    questionNumber: input.questionNumber,
    imagePathHint: input.imagePath,
    examMeta: input.examMeta,
  });

  const combinedPrompt = system + "\n\n" + user;

  const providerResult = provider.run(combinedPrompt, {
    stageKey: "create.extractor",
    imagePaths: [input.imagePath],
    signal: input.signal,
  });

  const { text, exitCode } = await collectProviderText(providerResult);

  if (exitCode !== 0) {
    return {
      status: "failed",
      error: {
        code: "extractor_provider_failed",
        message: `Extractor provider failed with exit code ${exitCode}`,
        retryable: true,
      },
      provider: {
        requestedProvider: providerResult.metadata.requestedProvider,
        provider: providerResult.metadata.provider,
        modelStageKey: "create.extractor",
        label: providerResult.metadata.label,
        externalCostUsd: providerResult.metadata.externalCostUsd,
      },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  const parsed = parseModelJsonOutput(text);
  if (!parsed.ok) {
    return toExtractorValidationFailure(parsed, providerResult.metadata, startedAt);
  }

  const validation = validateModelOutput(parsed.value, validateExtractorOutput);
  if (!validation.ok) {
    return toExtractorValidationFailure(
      validationFailure("extractor_validation_failed", validation.message, validation.details),
      providerResult.metadata,
      startedAt
    );
  }

  await input.cache.ensureCacheDir();
  const outputPath = input.cache.extractorResultPath(input.questionNumber);
  await writeFile(outputPath, `${JSON.stringify(validation.output, null, 2)}\n`, "utf8");

  return {
    status: "completed",
    output: validation.output,
    files: [{ path: outputPath, kind: "cache", label: "Extractor result", mimeType: "application/json" }],
    validation: { ok: true, output: validation.output },
    provider: {
      requestedProvider: providerResult.metadata.requestedProvider,
      provider: providerResult.metadata.provider,
      modelStageKey: "create.extractor",
      label: providerResult.metadata.label,
      externalCostUsd: providerResult.metadata.externalCostUsd,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

const HAS_KOREAN = /[가-힣]/;

export function validateExtractorOutput(value: unknown): ModelOutputValidation<ExtractorStageOutput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "extractor output must be a non-null object" };
  }

  const candidate = value as Record<string, unknown>;

  // answer: extractor는 정답을 추출하지 않는다 (solver 책임). 응답에 포함돼 있으면 타입만 검사.
  if (candidate.answer !== undefined && candidate.answer !== null) {
    if (typeof candidate.answer !== "string" && typeof candidate.answer !== "number") {
      return { ok: false, message: "extractor answer must be a string or number" };
    }
  }

  // has_figure: boolean
  if (typeof candidate.has_figure !== "boolean") {
    return { ok: false, message: "extractor has_figure must be a boolean" };
  }

  // figure_info validation
  if (candidate.has_figure) {
    if (!candidate.figure_info || typeof candidate.figure_info !== "object" || Array.isArray(candidate.figure_info)) {
      return { ok: false, message: "extractor figure_info must be an object when has_figure is true" };
    }
    const fi = candidate.figure_info as Record<string, unknown>;

    // description_en must be present and in English (no Korean)
    if (fi.description_en !== undefined) {
      if (typeof fi.description_en !== "string") {
        return { ok: false, message: "extractor figure_info.description_en must be a string" };
      }
      if (HAS_KOREAN.test(fi.description_en)) {
        return {
          ok: false,
          message: "extractor figure_info.description_en must not contain Korean characters",
          details: { description_en: fi.description_en },
        };
      }
    }

    // crop_ratio: if present, must be [n, n, n, n] with values in [0, 1]
    if (fi.crop_ratio !== undefined) {
      if (!Array.isArray(fi.crop_ratio) || fi.crop_ratio.length !== 4) {
        return { ok: false, message: "extractor figure_info.crop_ratio must be an array of 4 numbers" };
      }
      for (const v of fi.crop_ratio) {
        if (typeof v !== "number" || v < 0 || v > 1) {
          return {
            ok: false,
            message: "extractor figure_info.crop_ratio values must be floats in [0, 1]",
            details: { crop_ratio: fi.crop_ratio },
          };
        }
      }
    }
  }

  // choices: if present, must have 3-5 items
  if (candidate.choices !== undefined && candidate.choices !== null) {
    if (!Array.isArray(candidate.choices) || candidate.choices.length < 3 || candidate.choices.length > 5) {
      return {
        ok: false,
        message: "extractor choices must be an array with 3 to 5 items",
        details: { choicesLength: Array.isArray(candidate.choices) ? candidate.choices.length : undefined },
      };
    }
  }

  // question: 프롬프트 스키마는 parts 배열만 정의하므로 question은 optional. 응답에 있으면 비어있지 않은 문자열인지만 검사.
  if (candidate.question !== undefined && candidate.question !== null) {
    if (typeof candidate.question !== "string" || candidate.question.trim() === "") {
      return { ok: false, message: "extractor question must be a non-empty string when present" };
    }
  }

  const figureInfo = candidate.has_figure
    ? (candidate.figure_info as ExtractorFigureInfo)
    : null;

  const output: ExtractorStageOutput = {
    ...candidate,
    has_figure: candidate.has_figure,
    figure_info: figureInfo,
  };

  if (candidate.choices !== undefined && candidate.choices !== null) {
    output.choices = candidate.choices as string[];
  }

  return { ok: true, output };
}

function toExtractorValidationFailure(
  failure: ReturnType<typeof validationFailure>,
  metadata: ReturnType<AIProviderAdapter["run"]>["metadata"],
  startedAt: string
): ModelStageResult<ExtractorStageOutput> {
  return {
    status: "failed",
    validation: failure.validation,
    error: failure.error,
    provider: {
      requestedProvider: metadata.requestedProvider,
      provider: metadata.provider,
      modelStageKey: "create.extractor",
      label: metadata.label,
      externalCostUsd: metadata.externalCostUsd,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
