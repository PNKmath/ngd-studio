import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { ExamMetaInput } from "@/lib/exam/meta";

const BASE_DIR = path.resolve(process.cwd(), "..");
const CACHE_DIR = path.join(BASE_DIR, "inputs", "시험지 제작", ".v3cache");
const SESSION_META_PATH = path.join(CACHE_DIR, "session_meta.json");

interface MetaResult {
  found: boolean;
  meta?: ExamMetaInput;
}

export async function GET(): Promise<NextResponse<MetaResult>> {
  try {
    const raw = await readFile(SESSION_META_PATH, "utf-8");
    const meta = JSON.parse(raw) as ExamMetaInput;
    return NextResponse.json({ found: true, meta });
  } catch {
    return NextResponse.json({ found: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const meta = (await req.json()) as ExamMetaInput;
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(SESSION_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
