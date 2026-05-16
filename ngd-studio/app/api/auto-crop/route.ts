import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

export const maxDuration = 180;

const execFileAsync = promisify(execFile);
const BASE_DIR = path.resolve(process.cwd(), "..");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pdfPath } = body;

    if (!pdfPath || typeof pdfPath !== "string") {
      return NextResponse.json(
        { error: "pdfPath is required" },
        { status: 400 },
      );
    }

    const fullPath = path.join(BASE_DIR, pdfPath);
    const scriptPath = path.join(BASE_DIR, "workspaces", "crop", "gemini_crop.py");

    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    const { stdout, stderr } = await execFileAsync(
      pythonCmd,
      [scriptPath, fullPath, "--json-only"],
      { timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      const hint = stderr ? stderr.slice(0, 300) : stdout.slice(0, 300);
      return NextResponse.json(
        { error: "Failed to parse gemini_crop.py output", detail: hint },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const isExecError =
      err !== null &&
      typeof err === "object" &&
      "stderr" in err &&
      "code" in err;

    if (isExecError) {
      const execErr = err as { stderr?: string; code?: number | string; message?: string };
      const detail = execErr.stderr
        ? execErr.stderr.slice(0, 500)
        : (execErr.message ?? "Unknown error");
      return NextResponse.json(
        { error: "gemini_crop.py execution failed", detail },
        { status: 500 },
      );
    }

    const message =
      err instanceof Error ? err.message : "auto-crop failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
