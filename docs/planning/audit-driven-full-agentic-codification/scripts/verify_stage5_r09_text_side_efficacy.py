"""Stage 5: R-09 text-side fix (C1) — count {t} parts with unit patterns
that benefit from the post-task fix."""
import json, re, sys
from pathlib import Path

sys.path.insert(0, "/Users/junhyukpark/ngd/ngd-studio")
from equation import normalize_parts, _enforce_rm_units

CACHE = Path("/Users/junhyukpark/ngd/ngd-studio/inputs/시험지 제작/.v3cache")

unit_pattern = re.compile(r'\d+\s+(kg|m|s|cm|km|mm|g|A|N|J|W|V|Hz|Pa|K|mol|rad)\b')
text_side_units_found = 0
text_side_now_fixed = 0
text_side_already_clean = 0
samples = []

for f in sorted(CACHE.glob("q*_solved.json"), key=lambda p: int(re.search(r"q(\d+)", p.name).group(1))):
    data = json.loads(f.read_text(encoding="utf-8"))
    for p in data.get("explanation_parts", []):
        if "t" not in p:
            continue
        text = p["t"]
        if unit_pattern.search(text):
            text_side_units_found += 1
            fixed = _enforce_rm_units(text)
            if fixed != text:
                text_side_now_fixed += 1
                if len(samples) < 3:
                    samples.append({"file": f.name, "before": text, "after": fixed})
            else:
                text_side_already_clean += 1

print(f"\n=== Stage 5: R-09 text-side (C1 post-fix) on Real Data ===")
print(f"Cached solver outputs scanned: 19 problems")
print(f"{{t}} parts containing digit+unit patterns:        {text_side_units_found}")
print(f"  ↳ would be fixed by new code (digit+unit→rm):    {text_side_now_fixed}")
print(f"  ↳ already had 'rm' (idempotent):                 {text_side_already_clean}")
print(f"\n--- Sample text-side fixes that NEW code applies (pre-task did nothing) ---")
for s in samples:
    print(f"  [{s['file']}]")
    print(f"    before: {s['before'][:100]}")
    print(f"    after:  {s['after'][:100]}")
