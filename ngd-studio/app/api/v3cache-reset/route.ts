import { NextResponse } from "next/server";
import { rm, rename, mkdir, stat } from "fs/promises";
import path from "path";

const BASE_DIR = path.resolve(process.cwd(), "..");
const EXAM_DIR = path.join(BASE_DIR, "inputs", "시험지 제작");
const CACHE_DIR = path.join(EXAM_DIR, ".v3cache");
const PREV_DIR = path.join(EXAM_DIR, ".v3cache_prev");
const QIMG_DIR = path.join(EXAM_DIR, "question_images");
const QIMG_CLEANED_DIR = path.join(QIMG_DIR, "cleaned");

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// 신규 V3 작업 시작 시 호출 — 기존 .v3cache를 .v3cache_prev로 백업 후 비운다.
// session_meta.json도 .v3cache/ 안에 있으므로 자동 폐기됨 (L1 봉합).
// SKILL.md(0-3)의 캐시 초기화 로직과 동일하다.
export async function POST() {
  try {
    if (await exists(PREV_DIR)) {
      await rm(PREV_DIR, { recursive: true, force: true });
    }
    if (await exists(CACHE_DIR)) {
      await rename(CACHE_DIR, PREV_DIR);
    }
    await mkdir(CACHE_DIR, { recursive: true });

    if (await exists(QIMG_CLEANED_DIR)) {
      await rm(QIMG_CLEANED_DIR, { recursive: true, force: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
