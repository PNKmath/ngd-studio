import { mkdir } from "fs/promises";
import path from "path";

export interface StageCachePaths {
  examDir: string;
  cacheDir: string;
  previousCacheDir: string;
  questionImagesDir: string;
  examData: string;
  figureStatus: string;
  buildStatus: string;
}

export interface StageCache {
  readonly paths: StageCachePaths;
  questionImagePath(questionNumber: number): string;
  questionJsonPath(questionNumber: number): string;
  extractorResultPath(questionNumber: number): string;
  solverResultPath(questionNumber: number): string;
  verifierResultPath(questionNumber: number): string;
  /** Returns the path to the combined exam_data.json output. */
  examDataPath(): string;
  ensureCacheDir(): Promise<void>;
  ensureQuestionImagesDir(): Promise<void>;
}

export function createStageCache(baseDir: string, examDir = path.join(baseDir, "inputs", "시험지 제작")): StageCache {
  return new FileBackedStageCache(examDir);
}

export class FileBackedStageCache implements StageCache {
  readonly paths: StageCachePaths;

  constructor(examDir: string) {
    const cacheDir = path.join(examDir, ".v3cache");
    this.paths = {
      examDir,
      cacheDir,
      previousCacheDir: path.join(examDir, ".v3cache_prev"),
      questionImagesDir: path.join(examDir, "question_images"),
      examData: path.join(cacheDir, "exam_data.json"),
      figureStatus: path.join(cacheDir, "figure_status.json"),
      buildStatus: path.join(cacheDir, "build_status.json"),
    };
  }

  private pad(n: number): string {
    return String(n).padStart(2, "0");
  }

  questionImagePath(questionNumber: number): string {
    return path.join(this.paths.questionImagesDir, `q${this.pad(questionNumber)}.png`);
  }

  questionJsonPath(questionNumber: number): string {
    return path.join(this.paths.cacheDir, `q${this.pad(questionNumber)}.json`);
  }

  extractorResultPath(questionNumber: number): string {
    return path.join(this.paths.cacheDir, `q${this.pad(questionNumber)}_extracted.json`);
  }

  solverResultPath(questionNumber: number): string {
    return path.join(this.paths.cacheDir, `q${this.pad(questionNumber)}_solved.json`);
  }

  verifierResultPath(questionNumber: number): string {
    return path.join(this.paths.cacheDir, `q${this.pad(questionNumber)}_verified.json`);
  }

  examDataPath(): string {
    return this.paths.examData;
  }

  async ensureCacheDir(): Promise<void> {
    await mkdir(this.paths.cacheDir, { recursive: true });
  }

  async ensureQuestionImagesDir(): Promise<void> {
    await mkdir(this.paths.questionImagesDir, { recursive: true });
  }
}
