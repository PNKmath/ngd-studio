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

  questionImagePath(questionNumber: number): string {
    const padded = String(questionNumber).padStart(2, "0");
    return path.join(this.paths.questionImagesDir, `q${padded}.png`);
  }

  questionJsonPath(questionNumber: number): string {
    const padded = String(questionNumber).padStart(2, "0");
    return path.join(this.paths.cacheDir, `q${padded}.json`);
  }

  async ensureCacheDir(): Promise<void> {
    await mkdir(this.paths.cacheDir, { recursive: true });
  }

  async ensureQuestionImagesDir(): Promise<void> {
    await mkdir(this.paths.questionImagesDir, { recursive: true });
  }
}
