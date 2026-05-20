---
phase: 6
title: R-07 완전 codify + R-10 단항 minus parity 정렬 (양 언어)
status: pending
depends_on: [3]
scope:
  - equation.py
  - ngd-studio/lib/parts/normalize.ts
  - tests/test_parts_normalizer.py
  - ngd-studio/lib/parts/__tests__/normalize.test.ts
  - ngd-studio/tests/fixtures/parts_normalization/R-07-basic.json
  - ngd-studio/tests/fixtures/parts_normalization/R-07-internal-subscript-ok.json
  - ngd-studio/tests/fixtures/parts_normalization/R-07-leading-lsub.json
  - ngd-studio/tests/fixtures/parts_normalization/R-10-unary-minus.json
  - ngd-studio/tests/fixtures/parts_normalization/index.json
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
  - docs/planning/create-v4-deterministic-codification/rule-taxonomy.md
intervention_likely: false
intervention_reason: ""
---

# Phase 6: R-07 완전 codify + R-10 단항 minus parity 정렬 (양 언어)

> **범위**: Backend (Python + TS) + 선행 task 룰 문서
> **난이도**: M (R-07) + S (R-10 정렬)
> **의존성**: Phase 3 (orchestrator 안정화)
> **영향 파일**: `equation.py`, `normalize.ts`, fixture, rule-taxonomy.md, integration test

## 배경

본 phase는 두 가지 R-시리즈 회귀를 동시에 해결한다:

### 부분 1: R-07 leading `_` 완전 codify

선행 task `create-v4-deterministic-codification` Phase 1 워커가 R-07을 `codifiable: partial`로 분류하고 fixture를 no-op으로 설계:

```json
// R-07-basic.json
{"input": {"parts": [{"eq": "_n"}]}, "expected": {"parts": [{"eq": "_n"}]}}
```

이유: leading `_`이 R-08(`nCr`/`nPr`/`nHr` 패턴)에 매칭되는 경우는 R-08이 처리하므로, R-07 단독 변환이 모호하다는 판단.

본 phase는 **2-pass 알고리즘**으로 R-07을 완전 codify 가능함을 보인다:

1. R-08 먼저 적용 (기존 동작 — `_nC_r` → `{n}{rmC}{r}` 등)
2. 잔존 leading `_` 패턴 검출 + LSUB 변환

선행 task의 rule-taxonomy.md spec line 94: "수식이 `_` 로 시작하거나, 연산자 패턴 없이 순수 `_{token}` 이 맨 앞에 오는 경우 → `{prev} LSUB {token}` 형태로 재구성". 명확히 codifiable.

### 부분 2: R-10 단항 minus parity 정렬

본 task 시작 전 사후 검증(2026-05-20)에서 발견된 진짜 silent regression. 운영 19개 cached solved JSON에서 Python ↔ TS 출력 불일치:

```
input              Python             TS
"= -2"          →  "= - 2"            "=-2"           ← Python만 spacing
"k =-1"         →  "k = -1"           "k =-1"
"=-{1 over 6}"  →  "= - {1 over 6}"   "=-{1 over 6}"
```

원인: 선행 task Phase 3에서 TS의 `operatorSpaces`가 단항 minus를 "binary 연산자가 아님"으로 분류해 spacing 적용 안 함. Python `_add_operator_spaces_top_level` docstring도 동일하게 명시하지만 실제 구현은 spacing 적용.

영향:
- 현재 build 경로(`build_hwpx.py`)는 Python만 사용 → HWPX 출력 자체는 정상
- TS는 cache write 시점에 사용 → 같은 cache가 재build되면 Python이 추가 변환 → idempotency 명세 위반
- Phase 7 cross-language parity test가 합성 fixture로만 검증해 단항 minus 케이스 누락 → false sense of safety

이를 spec과 fixture 명확화 후 양 언어 동일 정렬.

## 설계

### 1. 2-pass 알고리즘

```
input = "_n"
  → R-08 적용: 매칭 안 됨 (C/P/H operator 없음) → "_n"
  → R-07 적용: leading `_` 발견 → LSUB 변환 → "{} LSUB {n}"

input = "_nC_r"
  → R-08 적용: 매칭 → "{n}{rmC}{r}" (또는 spec 형태)
  → R-07 적용: leading `_` 없음 → 변환 안 함

input = "x^2 + _3" (수식 중간에 leading 아님)
  → R-07은 "수식 시작 직후의 `_`만" 처리. 따라서 변환 안 함

input = "_{n+1}" (이미 LSUB 형태가 아닌 단순 첨자만 있는 경우)
  → R-07이 LSUB 변환 → "{} LSUB {n+1}"
```

명세 핵심: **R-07 적용 시점에 R-08은 이미 끝남**. 따라서 잔존 leading `_`은 안전하게 LSUB 변환.

### 2. Python 구현 (`equation.py`)

```python
_LEADING_UNDERSCORE_RE = re.compile(r'^(\s*)_(\{[^}]+\}|[A-Za-z0-9]+)(.*)$', re.DOTALL)

def _leading_underscore_to_lsub(script: str) -> str:
    """R-07: leading '_' → '{} LSUB {token}' transform.
    
    Idempotent: '{} LSUB {n}' 형태는 다시 매칭 안 됨 (시작이 '{').
    R-08 이후 호출되므로 잔존 leading '_'만 처리.
    """
    m = _LEADING_UNDERSCORE_RE.match(script)
    if not m:
        return script
    prefix, token, rest = m.groups()
    # token이 {x} 형태면 중괄호 유지, 아니면 단일 토큰 그대로
    token_braced = token if token.startswith('{') else '{' + token + '}'
    return f"{prefix}{{}} LSUB {token_braced}{rest}"
```

### 3. TS 구현 (`normalize.ts`)

```typescript
function leadingUnderscoreToLsub(s: string): string {
  // R-08 already applied by call order in normalizePart.
  // Match leading '_' followed by braced or simple token.
  const m = s.match(/^(\s*)_(\{[^}]+\}|[A-Za-z0-9]+)(.*)$/s);
  if (!m) return s;
  const [, prefix, token, rest] = m;
  const tokenBraced = token.startsWith("{") ? token : `{${token}}`;
  return `${prefix}{} LSUB ${tokenBraced}${rest}`;
}
```

`normalizePart`의 R-07 호출 위치는 이미 R-08 직전 → R-08 직후로 이동:

```typescript
s = fixPermutationCombination(s);     // R-08
s = leadingUnderscoreToLsub(s);        // R-07 (now after R-08)
s = enforceRmUnits(s);                 // R-09
```

Python `_normalize_part`도 동일하게 R-08 → R-07 순서로 swap.

### 4. fixture 개정

- `R-07-basic.json`: input `{"eq": "_n"}` → expected `{"eq": "{} LSUB {n}"}`
- `R-07-internal-subscript-ok.json`: input `{"eq": "x^2_n"}` → expected `{"eq": "x^2_n"}` (no leading `_`)
- **신규** `R-07-leading-lsub.json`: input `{"eq": "_{n+1}"}` → expected `{"eq": "{} LSUB {n+1}"}`
- 기존 R-08 fixture는 변경 없음 (R-08이 먼저 매칭되어 R-07 무영향)
- `index.json` 업데이트 — R-07 항목 description 갱신 + 신규 fixture 등록

### 5. rule-taxonomy.md 수정

R-07 spec body의 `codifiable: partial`을 `codifiable: yes (2-pass after R-08)` 로 변경. 예시 절도 새 expected에 맞춰 갱신.

### 6. R-10 단항 minus 동작 명세 확정 + 양 언어 정렬

**결정**: 단항 minus 앞뒤에 공백 추가 (Python 현재 동작 follow, TS 정정).

근거: rule-taxonomy.md R-10이 "수식 연산자 앞뒤 공백" 정의. 단항 minus(예: `-2`)도 시각적 가독성을 위해 spacing 적용하는 것이 Python의 docstring 의도("Unary minus ... NOT touched")와 실제 동작 사이의 불일치를 실제 동작 쪽으로 정렬. NGD 운영 build 출력 19개 sample이 이미 Python 동작 기준으로 검증돼 안정성 입증.

대안(TS follow Python 안 하고 spec 변경)도 가능하나 운영 영향이 더 큼 → 선택 안 함.

**TS `operatorSpaces` 수정**:

```typescript
// before (단항 minus skip)
if (isOperator(c) && !isUnary(prev)) {
  // add spaces
}

// after (단항 minus도 spacing)
if (isOperator(c)) {
  // Always add spaces around operators at depth 0 (including unary).
  // Idempotent: existing spaces are collapsed.
}
```

`isUnary` 분기 제거 또는 `isOperator(prev)` 다음에 오는 minus도 spacing 추가.

**R-10 단항 minus fixture 신규**: `R-10-unary-minus.json`

```json
{
  "id": "R-10-unary-minus",
  "rule_ids": ["R-10"],
  "description": "단항 minus 앞뒤 공백 적용 — Python ↔ TS 동치",
  "input": { "parts": [
    {"eq": "= -2"},
    {"eq": "k =-1"},
    {"eq": "=-{1 over 6}a^3 + 6a geq 0"}
  ]},
  "expected": { "parts": [
    {"eq": "= - 2"},
    {"eq": "k = - 1"},
    {"eq": "= - {1 over 6}a^3 + 6a geq 0"}
  ]}
}
```

운영 데이터 기반 추가 fixture는 `__tests__/fixtures/operational-solver-outputs/`(신규 디렉터리 — 또는 fixture 디렉터리에 직접) 별도 등록 권고: 19개 cached `qN_solved.json` 중 R-10 변환이 발생하는 5개를 추출해 expected snapshot으로 저장. Phase 7 parity test가 이를 추가 검증.

### 7. integration test 확장

`orchestrator.integration.test.ts`의 Phase 7 parity describe 블록을 운영 sample fixture로 확장:

```typescript
// 기존: 28 합성 fixture
// 추가: 운영 데이터에서 추출한 5+ snapshot
const opCases = readdirSync(OP_DIR).filter(f => f.endsWith(".json"));
for (const f of opCases) {
  // same TS↔Python spawnSync byte compare
}
```

총 33+ fixture에서 cross-language parity 보장.

## 영향 범위

- R-07 fixture 3개 + 1개 신규 → 5+ 케이스
- R-08과 호출 순서 swap → R-08 fixture 출력 불변 (R-08이 먼저 매칭)
- 통합 회귀: orchestrator parity test(선행 task Phase 7)가 28 fixture 모두 TS↔Python 동치 → 본 phase 후에도 동치 유지
- rule-taxonomy.md(이전 task 디렉터리)는 룰 정의의 단일 source이므로 본 task에서도 갱신 정당

## 체크리스트

- [ ] coverage-matrix.md에 R-07, R-10 관련 행 추가 (또는 선행 task 룰 행 갱신 노트)
- [ ] `equation.py:_leading_underscore_to_lsub` 2-pass 구현 + 호출 순서 R-08 → R-07로 변경
- [ ] `normalize.ts:leadingUnderscoreToLsub` 2-pass 구현 + 호출 순서 변경
- [ ] R-07 fixture 3개 개정/신규 + index.json 갱신
- [ ] `normalize.ts:operatorSpaces` — 단항 minus도 spacing 적용 (Python 동작과 정렬)
- [ ] R-10 단항 minus fixture 신규 (`R-10-unary-minus.json`) + index.json 등록
- [ ] 운영 데이터 fixture 추출 — 19개 cached `qN_solved.json` 중 R-10 변환 발생 5개 → snapshot
- [ ] `test_parts_normalizer.py` + `normalize.test.ts` 통과 (기존 + R-07 신규 3 + R-10 신규 1)
- [ ] rule-taxonomy.md R-07 절 갱신 (`codifiable: yes`) + R-10 절에 단항 minus 명시
- [ ] integration test 확장 — Phase 7 parity describe에 운영 fixture 5개 추가
- [ ] **agentic→code 동치성 검증**: cross-language parity 테스트(`orchestrator.integration.test.ts:Phase 7 parity`)가 33+ fixture(기존 28 + R-07 신규 3 + R-10 단항 1 + 운영 5)에서 TS↔Python byte-level 일치. **운영 19개 cached solved JSON 전수에서도 parity 통과** (사후 검증 Stage 2의 회귀가 사라졌음을 입증)

## 검증

```bash
# Python 단위
cd /Users/junhyukpark/ngd/ngd-studio && python3 -m pytest tests/test_parts_normalizer.py --tb=short
# expected: 모든 fixture pass (R-07 + R-10 단항 신규 포함)

# TS 단위
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test lib/parts/__tests__/normalize.test.ts --reporter=basic

# Cross-language parity (선행 task Phase 7 테스트 확장)
cd ngd-studio && pnpm test server/stages/__tests__/orchestrator.integration.test.ts --reporter=basic
# expected: parity describe 블록 모든 fixture(28 합성 + 신규 R-07 3 + 신규 R-10 1 + 운영 5) TS↔Python 일치

# R-07 fixture가 no-op이 아닌 변환을 정의함
jq -r '.input.parts[0].eq + " → " + .expected.parts[0].eq' \
  ngd-studio/tests/fixtures/parts_normalization/R-07-basic.json
# expected: "_n → {} LSUB {n}"

# rule-taxonomy.md codifiable 갱신
grep -A1 "^### R-07" docs/planning/create-v4-deterministic-codification/rule-taxonomy.md | grep "codifiable"
# expected: "yes (2-pass after R-08)" 포함

# 운영 데이터 전수 parity (Stage 2 회귀 fix 입증)
cat <<'PY' | python3
import json, sys, subprocess, re
from pathlib import Path
sys.path.insert(0, "/Users/junhyukpark/ngd/ngd-studio")
from equation import normalize_parts
CACHE = Path("/Users/junhyukpark/ngd/ngd-studio/inputs/시험지 제작/.v3cache")
mismatch = 0
for f in sorted(CACHE.glob("q*_solved.json"), key=lambda p: int(re.search(r"q(\d+)", p.name).group(1))):
    parts = json.loads(f.read_text())["explanation_parts"]
    py_out = normalize_parts(parts)
    ts_out = json.loads(subprocess.run(
        ["npx", "tsx", "-e", f"import {{normalizeParts}} from '/Users/junhyukpark/ngd/ngd-studio/ngd-studio/lib/parts/normalize.ts'; console.log(JSON.stringify(normalizeParts({json.dumps(parts, ensure_ascii=False)})))"],
        capture_output=True, text=True, cwd="/Users/junhyukpark/ngd/ngd-studio/ngd-studio"
    ).stdout)
    if json.dumps(py_out, ensure_ascii=False) != json.dumps(ts_out, ensure_ascii=False):
        mismatch += 1
        print(f"MISMATCH: {f.name}")
print(f"\nOperational parity: 19 - {mismatch} = {19 - mismatch}/19 matched")
assert mismatch == 0, "operational parity failed"
PY
# expected: 19/19 matched
```
