import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";

const execFileAsync = promisify(execFile);
const BASE_DIR = path.resolve(process.cwd(), "..");
const CACHE_DIR = path.join(BASE_DIR, "outputs", ".pdf-preview-cache");

export async function POST(req: NextRequest) {
  try {
    const { pdfPath, page = 0, dpi = 150 } = await req.json();

    if (!pdfPath || typeof pdfPath !== "string") {
      return NextResponse.json({ error: "pdfPath is required" }, { status: 400 });
    }

    const fullPath = path.join(BASE_DIR, pdfPath);

    // Cache key based on file path, page, dpi
    const hash = crypto
      .createHash("md5")
      .update(`${pdfPath}:${page}:${dpi}`)
      .digest("hex");
    const cachePath = path.join(CACHE_DIR, `${hash}.png`);

    await mkdir(CACHE_DIR, { recursive: true });

    // Check cache
    try {
      await access(cachePath);
      const cached = await readFile(cachePath);
      return new NextResponse(cached, {
        headers: { "Content-Type": "image/png", "X-Cache": "hit" },
      });
    } catch {
      // Cache miss, render
    }

    // Use Python + PyMuPDF to render page
    const script = `
import fitz, sys, json
args = json.loads(sys.argv[1])
doc = fitz.open(args["path"])
if args["page"] >= len(doc):
    sys.exit(1)
pix = doc[args["page"]].get_pixmap(dpi=args["dpi"])
pix.save(args["out"])
print(json.dumps({"width": pix.width, "height": pix.height, "pages": len(doc)}))
`;

    const args = JSON.stringify({
      path: fullPath,
      page,
      dpi,
      out: cachePath,
    });

    const { stdout } = await execFileAsync("python3", ["-c", script, args], {
      timeout: 15000,
    });

    const meta = JSON.parse(stdout.trim());
    const imageBuffer = await readFile(cachePath);

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "X-Cache": "miss",
        "X-Pages": String(meta.pages),
        "X-Width": String(meta.width),
        "X-Height": String(meta.height),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
