---
phase: 3
title: TS normalizer — solver/verifier 출력 정규화
status: pending
depends_on: [1]
scope:
  - ngd-studio/lib/parts/normalize.ts
  - ngd-studio/lib/parts/__tests__/normalize.test.ts
  - ngd-studio/server/stages/solver.ts
  - ngd-studio/server/stages/verifier.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 3: TS normalizer (solver/verifier 출력 정규화)

> **범위**: Backend (TS stage runners)
> **난이도**: M
> **의존성**: Phase 1 (fixture)
> **영향 파일**: `lib/parts/normalize.ts` (신규), solver.ts, verifier.ts, `lib/parts/__tests__/normalize.test.ts` (신규)

## 배경

`solver.ts:88`에서 validated output을 cache(`solverResultPath`)에 그대로 쓴다. 같은 패턴이 `verifier.ts`에도 있음. raw LLM 출력에 통수식/DEG 공백/bullet 등이 남아 있으면:

1. cache에 더러운 데이터가 남음
2. verifier가 그 cache를 읽고 통수식 위반을 감지 → fail → 재시도 (최대 3회 retry loop 낭비)

cache write 직전에 TS 측에서 정규화하면 두 문제 모두 해결됨. Python normalizer(Phase 2)는 safety net으로 남고, TS는 1차 방어선.

## 설계

### 1. `ngd-studio/lib/parts/normalize.ts` (신규)

```typescript
export type Part = { t: string } | { eq: string } | { br: true };

/**
 * Apply deterministic normalization rules to a parts array.
 * Idempotent. Rules implemented per
 * docs/planning/create-v4-deterministic-codification/rule-taxonomy.md.
 */
export function normalizeParts(parts: Part[]): Part[] {
  return splitEquationChains(parts).map(normalizePart);
}

function normalizePart(part: Part): Part {
  if ("eq" in part) {
    let s = part.eq;
    s = fixDeg(s);                       // R-02
    s = fixBulletToCdot(s);              // R-03
    s = wrapCdots(s);                    // R-04
    s = commaTilde(s);                   // R-05
    s = leftRightSpace(s);               // R-06
    s = leadingUnderscoreToLsub(s);      // R-07
    s = fixPermutationCombination(s);    // R-08
    s = operatorSpaces(s);               // R-10
    return { eq: s };
  }
  if ("t" in part) {
    return { t: enforceRmUnits(part.t) }; // R-09 (text-side)
  }
  return part;
}

function splitEquationChains(parts: Part[]): Part[] { /* R-01 — Phase 2 알고리즘 동치 */ }
function splitTopLevelEq(script: string): string[] { /* depth tracking */ }
// ... 각 R-NN 헬퍼
```

**핵심**: Phase 2의 Python `_split_top_level_eq`와 **동일 알고리즘**. 공유 fixture로 동치성 강제.

### 2. solver.ts / verifier.ts 통합

`solver.ts:88` 직전에 normalize 호출:

```typescript
const normalized: SolverStageOutput = {
  ...validation.output,
  explanation_parts: normalizeParts(validation.output.explanation_parts) as SolverExplanationPart[],
};
await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
```

verifier.ts도 동일 (output에 `solution.explanation_parts`가 있다면 같은 처리).

### 3. fixture-driven Vitest

`ngd-studio/lib/parts/__tests__/normalize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { normalizeParts } from "../normalize";

const FIXTURE_DIR = path.resolve(__dirname, "../../../tests/fixtures/parts_normalization");
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json") && f !== "index.json");

describe("normalizeParts fixtures", () => {
  for (const file of fixtures) {
    const fx = JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
    it(`${fx.id}: ${fx.description}`, () => {
      const actual = normalizeParts(fx.input.parts);
      expect(actual).toEqual(fx.expected.parts);
    });
  }
});

describe("idempotency", () => {
  for (const file of fixtures) {
    const fx = JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
    it(`${fx.id}`, () => {
      const once = normalizeParts(fx.input.parts);
      const twice = normalizeParts(once);
      expect(twice).toEqual(once);
    });
  }
});
```

### 4. 동치성

Phase 2와 Phase 3은 같은 fixture set으로 검증되므로, 두 구현이 fixture 통과 = 동치. 새 케이스 발견 시 fixture를 추가하고 양쪽 다 통과시켜야 한다.

## 체크리스트

- [ ] `ngd-studio/lib/parts/normalize.ts` 작성 — `normalizeParts(parts)` + 헬퍼 8개 (R-01~R-10)
- [ ] `splitTopLevelEq` depth tracking — Phase 2와 알고리즘 동일
- [ ] `solver.ts`에서 `writeFile` 직전 `normalizeParts` 호출 (`explanation_parts` 대상)
- [ ] `verifier.ts`에서 동일 처리 (출력 schema에 parts 있는 경우)
- [ ] `lib/parts/__tests__/normalize.test.ts` — fixture 전체 parametrize + idempotency
- [ ] `cd ngd-studio && pnpm tsc --noEmit` 통과
- [ ] `cd ngd-studio && pnpm test lib/parts` 전부 pass

## 영향 범위

- 신규 모듈 + solver.ts/verifier.ts 2줄 변경.
- 기존 solver/verifier 테스트는 normalize 후 출력으로 검증되므로, 기존 expectation이 raw 형태였다면 fixture에 맞게 조정 필요할 수 있음. (기존 tests 중 cache JSON 형태 hard-coded된 곳 확인)
- 캐시에 정규화된 데이터가 남으므로 verifier 재시도 시 입력이 깨끗 → fail 감소.

## 검증

```bash
cd ngd-studio
pnpm tsc --noEmit
pnpm test lib/parts/__tests__/normalize.test.ts --reporter=basic
pnpm test server/stages/__tests__/solver.test.ts --reporter=basic
pnpm test server/stages/__tests__/verifier.test.ts --reporter=basic
```

Phase 2와 동치성 확인:
```bash
# 같은 fixture로 양 언어 출력 비교 (스크립트로)
node -e "..."  # Phase 7에서 자동화
```
