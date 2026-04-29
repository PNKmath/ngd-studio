import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm, readdir } from "fs/promises";
import path from "path";

const BASE_DIR = path.resolve(process.cwd(), "..");
const IMAGES_DIR = path.join(BASE_DIR, "inputs", "시험지 제작", "question_images");

export async function GET() {
  try {
    let files: string[] = [];
    try {
      files = await readdir(IMAGES_DIR);
    } catch { /* folder doesn't exist */ }

    const qRegex = /^q(\d+)\.(png|jpg|jpeg)$/i;
    const numbers = files
      .map((f) => qRegex.exec(f))
      .filter(Boolean)
      .map((m) => parseInt(m![1], 10))
      .sort((a, b) => a - b);

    let cleanedFiles: string[] = [];
    try {
      cleanedFiles = await readdir(path.join(IMAGES_DIR, "cleaned"));
    } catch { /* no cleaned folder */ }
    const hasClean = cleanedFiles.some((f) => qRegex.test(f));

    return NextResponse.json({ count: numbers.length, numbers, hasClean });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Read failed";
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

    const saved: { number: number; path: string }[] = [];

    for (const [key, value] of formData.entries()) {
      // Keys are "q1", "q2", ... "q30"
      if (!key.startsWith("q") || !(value instanceof File)) continue;

      const num = parseInt(key.slice(1), 10);
      if (isNaN(num)) continue;

      const padded = String(num).padStart(2, "0");
      const ext = value.name.split(".").pop()?.toLowerCase() ?? "png";
      const fileName = `q${padded}.${ext}`;
      const filePath = path.join(IMAGES_DIR, fileName);

      const buffer = Buffer.from(await value.arrayBuffer());
      await writeFile(filePath, buffer);

      saved.push({
        number: num,
        path: `inputs/시험지 제작/question_images/${fileName}`,
      });
    }

    return NextResponse.json({ images: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
