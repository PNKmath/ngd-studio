// Stage 2: TS normalize on real cached solver outputs, then diff with Python output.
import { readFileSync, readdirSync, writeFileSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { normalizeParts } from "/Users/junhyukpark/ngd/ngd-studio/ngd-studio/lib/parts/normalize.ts";

const CACHE = "/Users/junhyukpark/ngd/ngd-studio/inputs/시험지 제작/.v3cache";
const files = readdirSync(CACHE).filter(f => /^q\d+_solved\.json$/.test(f));

const results = { total: 0, match: 0, mismatch: 0, mismatches: [] };

for (const f of files.sort()) {
  const data = JSON.parse(readFileSync(path.join(CACHE, f), "utf8"));
  const parts = data.explanation_parts ?? [];

  const tsOut = normalizeParts(parts);

  // Run Python normalize on the same input via spawnSync
  const tmpIn = `/tmp/parity_${f}`;
  writeFileSync(tmpIn, JSON.stringify(parts), "utf8");

  const py = spawnSync("python3", [
    "-c",
    `import sys, json
sys.path.insert(0, "/Users/junhyukpark/ngd/ngd-studio")
from equation import normalize_parts
data = json.load(open("${tmpIn}"))
print(json.dumps(normalize_parts(data), ensure_ascii=False))`
  ], { encoding: "utf8" });

  if (py.status !== 0) {
    console.error(`Python failed for ${f}: ${py.stderr}`);
    results.mismatch++;
    results.mismatches.push({ file: f, error: "python failed" });
    continue;
  }

  const pyOut = JSON.parse(py.stdout);
  results.total++;

  const tsJson = JSON.stringify(tsOut);
  const pyJson = JSON.stringify(pyOut);

  if (tsJson === pyJson) {
    results.match++;
  } else {
    results.mismatch++;
    // Find first diverging part
    for (let i = 0; i < Math.max(tsOut.length, pyOut.length); i++) {
      const t = JSON.stringify(tsOut[i] ?? null);
      const p = JSON.stringify(pyOut[i] ?? null);
      if (t !== p) {
        results.mismatches.push({
          file: f, idx: i, ts: t.slice(0, 150), py: p.slice(0, 150),
        });
        break;
      }
    }
  }
}

console.log(`\n=== Stage 2: Cross-Language Parity on Real Data ===`);
console.log(`Total: ${results.total}`);
console.log(`TS == Python: ${results.match}`);
console.log(`Mismatches: ${results.mismatch}`);
if (results.mismatches.length > 0) {
  console.log(`\n--- Mismatch details ---`);
  for (const m of results.mismatches.slice(0, 5)) console.log(JSON.stringify(m, null, 2));
}
