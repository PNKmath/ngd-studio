import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
const BASE_DIR = path.resolve(process.cwd(), "..");

export async function POST(req: NextRequest) {
  try {
    const { pdfPath, dpi = 200 } = await req.json();

    if (!pdfPath || typeof pdfPath !== "string") {
      return NextResponse.json({ error: "pdfPath is required" }, { status: 400 });
    }

    const fullPath = path.join(BASE_DIR, pdfPath);

    const script = `
import fitz, sys, json
args = json.loads(sys.argv[1])
doc = fitz.open(args["path"])
pages = len(doc)
if pages == 0:
    sys.exit(1)
# Get first page dimensions at the specified dpi
page0 = doc[0]
rect = page0.rect
# Scale by dpi ratio: dpi / 72 (default PDF resolution)
scale = args["dpi"] / 72.0
width = int(rect.width * scale)
height = int(rect.height * scale)
print(json.dumps({"pages": pages, "page0Width": width, "page0Height": height, "dpi": args["dpi"]}))
`;

    const args = JSON.stringify({
      path: fullPath,
      dpi,
    });

    const { stdout } = await execFileAsync("python3", ["-c", script, args], {
      timeout: 15000,
    });

    const meta = JSON.parse(stdout.trim());

    return NextResponse.json(meta);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF metadata extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
