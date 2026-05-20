"""Stage 1: Apply normalize_parts to real cached solver outputs and
analyze changes by rule category. API calls: 0."""

import json
import os
import sys
import re
from pathlib import Path

sys.path.insert(0, "/Users/junhyukpark/ngd/ngd-studio")
from equation import normalize_parts

CACHE = Path("/Users/junhyukpark/ngd/ngd-studio/inputs/시험지 제작/.v3cache")

# Rule signatures to attribute changes
RULE_SIGS = {
    "R-01 (split)": lambda b, a: len([p for p in a if "eq" in p]) > len([p for p in b if "eq" in p]),
    "R-02 (DEG)": lambda b, a: " DEG" in str(b) and " DEG" not in str(a),
    "R-03 (cdot)": lambda b, a: any(x in str(b) for x in ["·", "•", "⋅"]) and "cdot" in str(a),
    "R-04 (cdots bt)": lambda b, a: "cdots" in str(b) and "`cdots`" in str(a),
    "R-05 (comma~)": lambda b, a: re.search(r",\S", str(b)) and ", ~" in str(a),
    "R-06 (LEFT/RIGHT spc)": lambda b, a: ("LEFT(" in str(b) or "RIGHT)" in str(b)) and ("LEFT (" in str(a) or "RIGHT )" in str(a)),
    "R-09 (rm units)": lambda b, a: re.search(r"\d\s*(kg|m|s|cm|km)\b(?!\s*rm)", str(b)) and " rm " in str(a),
    "R-09 text-side": lambda b, a: any("t" in p and re.search(r"\d\s+(kg|m|s)", p.get("t", "")) for p in b) and any("rm" in p.get("t", "") for p in a if "t" in p),
    "R-10 (op spc)": lambda b, a: re.search(r"[a-z0-9]\s*[+\-=]\s*[a-z0-9]", str(b), re.I) and re.search(r" [+\-=] ", str(a)),
}

total_problems = 0
problems_changed = 0
part_changes = 0
rule_hits = {k: 0 for k in RULE_SIGS}
unattributed_changes = []
sample_diffs = []

for f in sorted(CACHE.glob("q*_solved.json"), key=lambda p: int(re.search(r"q(\d+)", p.name).group(1))):
    data = json.loads(f.read_text(encoding="utf-8"))
    before = data.get("explanation_parts", [])
    after = normalize_parts(before)
    total_problems += 1

    if json.dumps(before, ensure_ascii=False) == json.dumps(after, ensure_ascii=False):
        continue

    problems_changed += 1
    delta = len(after) - len(before)
    part_changes += abs(delta) if delta != 0 else 1

    attributed = False
    for rule, sig in RULE_SIGS.items():
        try:
            if sig(before, after):
                rule_hits[rule] += 1
                attributed = True
        except Exception:
            pass

    if not attributed:
        # Find first changed part for forensics
        bs = json.dumps(before, ensure_ascii=False)
        as_ = json.dumps(after, ensure_ascii=False)
        # Show concise diff
        for i, (b, a) in enumerate(zip(before, after)):
            if json.dumps(b) != json.dumps(a):
                unattributed_changes.append({
                    "file": f.name, "idx": i, "before": b, "after": a,
                })
                break
        else:
            if len(after) != len(before):
                unattributed_changes.append({
                    "file": f.name, "delta_parts": delta,
                    "before_len": len(before), "after_len": len(after),
                })

    if len(sample_diffs) < 3:
        # Save a sample diff for inspection
        diffs = []
        for i in range(min(len(before), len(after))):
            if json.dumps(before[i]) != json.dumps(after[i]):
                diffs.append({"idx": i, "before": before[i], "after": after[i]})
                if len(diffs) >= 2:
                    break
        if diffs:
            sample_diffs.append({"file": f.name, "diffs": diffs})

print(f"\n=== Stage 1: Normalizer on Real Solver Outputs ===")
print(f"Total problems scanned: {total_problems}")
print(f"Problems unchanged (idempotent):  {total_problems - problems_changed}")
print(f"Problems changed by normalizer:   {problems_changed}")
print(f"Total part-level changes:         {part_changes}")
print(f"\n--- Rule attribution ---")
for rule, n in rule_hits.items():
    if n > 0:
        print(f"  {rule}: {n} problems")
print(f"\n--- Unattributed changes: {len(unattributed_changes)} ---")
for u in unattributed_changes[:5]:
    print(f"  {u}")
print(f"\n--- Sample diffs (first 3 changed problems) ---")
for s in sample_diffs:
    print(f"\n[{s['file']}]")
    for d in s["diffs"]:
        print(f"  idx {d['idx']}:")
        print(f"    before: {json.dumps(d['before'], ensure_ascii=False)[:200]}")
        print(f"    after:  {json.dumps(d['after'], ensure_ascii=False)[:200]}")
