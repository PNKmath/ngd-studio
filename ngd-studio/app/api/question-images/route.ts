import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm, readdir, readFile } from "fs/promises";
import path from "path";

const BASE_DIR = path.resolve(process.cwd(), "..");
const IMAGES_DIR = path.join(BASE_DIR, "inputs", "시험지 제작", "question_images");
const CACHE_DIR = path.join(BASE_DIR, "inputs", "시험지 제작", ".v3cache");
const FIGURE_STATUS_PATH = path.join(CACHE_DIR, "figure_status.json");

type FigurePhaseStatus = "ok" | "failed" | "boundary_uncertain";

interface QuestionCacheState {
  extracted: boolean;
  solved: boolean;
  verified: boolean;
  figure?: { status: FigurePhaseStatus; image?: string };
}

async function scanCacheState(numbers: number[]): Promise<Record<number, QuestionCacheState>> {
  let cacheFiles = new Set<string>();
  try {
    const entries = await readdir(CACHE_DIR);
    cacheFiles = new Set(entries);
  } catch { /* cache dir missing */ }

  let figureStatus: { questions?: Record<string, { status?: FigurePhaseStatus; image?: string }> } = {};
  try {
    const raw = await readFile(FIGURE_STATUS_PATH, "utf-8");
    figureStatus = JSON.parse(raw);
  } catch { /* figure_status.json missing → no figure state */ }

  const result: Record<number, QuestionCacheState> = {};
  for (const n of numbers) {
    const padded = String(n).padStart(2, "0");
    const state: QuestionCacheState = {
      extracted: cacheFiles.has(`q${padded}_extracted.json`),
      solved: cacheFiles.has(`q${padded}_solved.json`),
      verified: cacheFiles.has(`q${padded}_verified.json`),
    };
    const figQ = figureStatus.questions?.[String(n)] ?? figureStatus.questions?.[padded];
    if (figQ && figQ.status) {
      state.figure = { status: figQ.status, ...(figQ.image ? { image: figQ.image } : {}) };
    }
    result[n] = state;
  }
  return result;
}

export async function GET() {
  try {
    let files: string[] = [];
    try {
      files = await readdir(IMAGES_DIR);
    } catch { /* folder doesn't exist */ }

    const qRegex = /^q(\d+)\.(png|jpg|jpeg)$/i;
    const essayRegex = /^q_s(\d+)\.(png|jpg|jpeg)$/i;
    const numbers = files
      .map((f) => qRegex.exec(f))
      .filter(Boolean)
      .map((m) => parseInt(m![1], 10))
      .sort((a, b) => a - b);
    const essayNumbers = files
      .map((f) => essayRegex.exec(f))
      .filter(Boolean)
      .map((m) => parseInt(m![1], 10))
      .sort((a, b) => a - b);

    let cleanedFiles: string[] = [];
    try {
      cleanedFiles = await readdir(path.join(IMAGES_DIR, "cleaned"));
    } catch { /* no cleaned folder */ }
    const hasClean = cleanedFiles.some((f) => qRegex.test(f) || essayRegex.test(f));

    const cacheState = await scanCacheState([...numbers, ...essayNumbers]);

    return NextResponse.json({
      count: numbers.length + essayNumbers.length,
      numbers,
      essayNumbers,
      hasClean,
      cacheState,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const formData = await req.formData();
    const qNumStr = formData.get("qNum");
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "regular");

    if (!qNumStr || !(file instanceof File)) {
      return NextResponse.json({ error: "qNum and file required" }, { status: 400 });
    }

    const num = parseInt(String(qNumStr), 10);
    if (isNaN(num)) {
      return NextResponse.json({ error: "Invalid qNum" }, { status: 400 });
    }

    await mkdir(IMAGES_DIR, { recursive: true });

    const padded = String(num).padStart(2, "0");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const fileName = kind === "essay" ? `q_s${padded}.${ext}` : `q${padded}.${ext}`;
    const filePath = path.join(IMAGES_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({
      number: num,
      path: `inputs/시험지 제작/question_images/${fileName}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Replace failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    await mkdir(IMAGES_DIR, { recursive: true });

    // Clear previous images
    try {
      await rm(IMAGES_DIR, { recursive: true });
      await mkdir(IMAGES_DIR, { recursive: true });
    } catch { /* ignore */ }

    const saved: { number: number; kind: "regular" | "essay"; path: string }[] = [];

    for (const [key, value] of formData.entries()) {
      // Keys: "q1".."q30" (regular) or "q_s1".."q_s30" (essay).
      if (!(value instanceof File)) continue;
      const essay = key.startsWith("q_s");
      const numPart = essay ? key.slice(3) : key.startsWith("q") ? key.slice(1) : null;
      if (numPart === null) continue;
      const num = parseInt(numPart, 10);
      if (isNaN(num)) continue;

      const padded = String(num).padStart(2, "0");
      const ext = value.name.split(".").pop()?.toLowerCase() ?? "png";
      const fileName = essay ? `q_s${padded}.${ext}` : `q${padded}.${ext}`;
      const filePath = path.join(IMAGES_DIR, fileName);

      const buffer = Buffer.from(await value.arrayBuffer());
      await writeFile(filePath, buffer);

      saved.push({
        number: num,
        kind: essay ? "essay" : "regular",
        path: `inputs/시험지 제작/question_images/${fileName}`,
      });
    }

    return NextResponse.json({ images: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
