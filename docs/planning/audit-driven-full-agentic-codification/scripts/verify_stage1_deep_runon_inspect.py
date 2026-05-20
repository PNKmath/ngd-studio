"""Deeper inspection of q1, q2, q6 normalizer output."""
import json, sys
sys.path.insert(0, "/Users/junhyukpark/ngd/ngd-studio")
from equation import normalize_parts

for qn in [1, 2, 6]:
    f = f"/Users/junhyukpark/ngd/ngd-studio/inputs/시험지 제작/.v3cache/q{qn}_solved.json"
    data = json.loads(open(f).read())
    before = data["explanation_parts"]
    after = normalize_parts(before)
    print(f"\n=== q{qn}_solved: before={len(before)} parts, after={len(after)} parts ===")
    # Show the run-on equation + 3 surrounding parts
    for i, p in enumerate(before):
        if "eq" in p and p["eq"].count("=") >= 2:
            print(f"\n[before context idx {i-1}..{i+2}]")
            for j in range(max(0, i-1), min(len(before), i+3)):
                print(f"  {j}: {json.dumps(before[j], ensure_ascii=False)[:120]}")
            # Find equivalent area in after
            print(f"\n[after — entire list from approximately matching idx]")
            for j in range(max(0, i-1), min(len(after), i+8)):
                print(f"  {j}: {json.dumps(after[j], ensure_ascii=False)[:120]}")
            break
