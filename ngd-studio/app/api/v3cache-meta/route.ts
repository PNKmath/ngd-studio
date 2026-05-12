import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const BASE_DIR = path.resolve(process.cwd(), "..");
const EXAM_DATA_PATH = path.join(BASE_DIR, "inputs", "시험지 제작", ".v3cache", "exam_data.json");
const SESSION_META_PATH = path.join(BASE_DIR, "inputs", "시험지 제작", "session_meta.json");

interface MetaResult {
  found: boolean;
  school?: string;
  grade?: number;
  subject?: string;
  semester?: string;
  examType?: string;
  range?: string;
}

function extractFromInfo(info: Record<string, unknown>): MetaResult {
  return {
    found: true,
    school: typeof info.school === "string" ? info.school : "",
    grade: typeof info.grade === "number" ? info.grade : 2,
    subject: typeof info.subject === "string" ? info.subject : "",
    semester: typeof info.semester === "string" ? info.semester : "1학기",
    examType: typeof (info.exam_type ?? info.examType) === "string"
      ? String(info.exam_type ?? info.examType)
      : "중간",
    range: typeof info.range === "string" ? info.range : "",
  };
}

export async function GET() {
  // 1순위: session_meta.json (신규 작업 시작 시 사용자가 입력한 최신 메타)
  try {
    const raw = await readFile(SESSION_META_PATH, "utf-8");
    const meta = JSON.parse(raw);
    if (meta) return NextResponse.json(extractFromInfo(meta));
  } catch { /* not found */ }

  // 2순위: exam_data.json (solver 완료 후 생성 — 폴백)
  try {
    const raw = await readFile(EXAM_DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (data?.info) return NextResponse.json(extractFromInfo(data.info));
  } catch { /* not found */ }

  return NextResponse.json({ found: false });
}

export async function POST(req: NextRequest) {
  try {
    const meta = await req.json();
    await mkdir(path.dirname(SESSION_META_PATH), { recursive: true });
    await writeFile(SESSION_META_PATH, JSON.stringify(meta, null, 2));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
