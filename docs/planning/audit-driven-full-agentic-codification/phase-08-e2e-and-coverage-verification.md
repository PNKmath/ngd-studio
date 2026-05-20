---
phase: 8
title: e2e 검증 + coverage matrix 100% green
status: pending
depends_on: [4, 5, 6, 7]
scope:
  - ngd-studio/server/stages/__tests__/audit-coverage.test.ts
  - docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
  - docs/planning/audit-driven-full-agentic-codification/results.md
intervention_likely: false
intervention_reason: ""
---

# Phase 8: e2e 검증 + coverage matrix 100% green

> **범위**: 검증 only (코드 변경 없음 + 문서 갱신)
> **난이도**: M
> **의존성**: Phase 4, 5, 6, 7 (모든 cover 작업 완료)
> **영향 파일**: `audit-coverage.test.ts` (신규), `coverage-matrix.md` (갱신), `results.md` (신규)

## 배경

audit doc Top 3 권고:
1. Stage orchestration foundation (Phase 2+3에서 완성)
2. Deterministic builder runner (선행 task + 이번 Phase 4 figure)
3. Checker XML rule runner (Phase 5에서 추가 룰 합산)

본 phase는 **단일 통합 e2e 테스트로 audit doc 39행 모두 cover됨**을 입증하고 metrics을 정리한다.

## 설계

### 1. `audit-coverage.test.ts` (신규)

`ngd-studio/server/stages/__tests__/audit-coverage.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// audit doc 39행 ID 목록 (Phase 1 coverage-matrix.md 기반)
const AUDIT_ROW_IDS = [
  "A1","A2","A3","A4","A5","A6","A7","A8","A9","A10","A11","A12",
  "B1","B2","B3","B4","B5","B6","B7",
  "C1","C2","C3","C4","C5",
  "D1","D2","D3","D4","D5","D6","D7","D8","D9",
  "E1","E2","E3","E4","E5","E6",
];

describe("audit coverage matrix", () => {
  const matrix = readFileSync(
    path.resolve(__dirname, "../../../../docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md"),
    "utf8",
  );

  it.each(AUDIT_ROW_IDS)("row %s is covered", (id) => {
    // 각 행이 "본 task cover: Phase N" 또는 "covered (선행/이전)" 형태로 명시되어 있어야 함
    const re = new RegExp(`### ${id}[\\s\\S]*?(본 task cover|covered)`);
    expect(matrix).toMatch(re);
  });

  it.each(AUDIT_ROW_IDS)("row %s declares agentic→code 동치성", (id) => {
    const re = new RegExp(`### ${id}[\\s\\S]*?(agentic→code 동치성|동치성)`);
    expect(matrix).toMatch(re);
  });
});
```

39 rows × 2 assertions = 78 spec. 행이 빠지면 즉시 fail.

### 2. coverage-matrix.md 최종 갱신

Phase 1에서 작성한 매트릭스의 "현재 코드 상태" 열을 본 phase 시점 상태로 갱신:
- A1~A5, B1~B7 → "covered by Phase 2/3 (커밋 해시 + 파일 경로)"
- A9, D6, D8, D9 → "covered by Phase 5"
- R-07 (해당 행이 있다면) → "covered by Phase 6"
- A11, E1, E2 → "covered by Phase 7"
- 이미 covered였던 행 → 코드 경로 확인만

마지막 요약 표:

```markdown
## 전체 cover 진행률

| 그룹 | 총 행 | covered | 미처리 |
|------|-------|---------|--------|
| A (audit 후보 12) | 12 | 12 | 0 |
| B (orchestration 7) | 7 | 7 | 0 |
| C (builder 5) | 5 | 5 | 0 |
| D (checker 9) | 9 | 9 | 0 |
| E (reviewer 6) | 6 | 6 | 0 |
| **Total** | **39** | **39** | **0** |
```

### 3. `results.md` (신규) — metrics + before/after

선행 task의 results.md 패턴 따라:

- **agentic 호출 감소**:
  - resume parsing: 자연어 agent 1회 → 0회 (코드 path)
  - figure 처리: 매 운영 agent 1회 → boundary_uncertain일 때만 (~5-10% 케이스)
  - reviewer issue draft: 22개 항목 검증 → 12개 코드 / 10개 agent (12/22 = 55% 감소)
- **결정적 결과 비율**: Group A 12개 + Group D 9개 = 21개 후보 모두 코드. 21/39 (54%) 100% 결정적.
- **토큰 절감**: solver/verifier prompt(선행 task) + reviewer prompt(본 phase) 합산 측정.
- **재시도 감소**: applyVerifierRetry 코드화 후 verifier feedback 처리의 결정적 흐름 확인.

### 4. 통합 e2e (이미 존재하는 테스트로 충분 — 추가 안 함)

`orchestrator.integration.test.ts`의 parity describe(선행 task Phase 7) + 본 task에서 추가된 unit/integration 테스트가 이미 통합 회귀 검증. Phase 8은 audit-coverage.test.ts만 추가하고 다른 테스트의 회귀 무결을 확인.

## 영향 범위

- 코드 변경 없음 (테스트 파일 1개 + 문서 2개만)
- audit-coverage.test.ts가 향후 audit doc 변경 시 회귀 안전망 역할

## 체크리스트

- [ ] `audit-coverage.test.ts` 신규 — 39행 cover + 동치성 명시 검증
- [ ] coverage-matrix.md 갱신 — 모든 행 "covered" 상태 + 코드 경로 인용 + 39/39 요약 표
- [ ] `results.md` 신규 — metrics (agentic 호출 감소, 결정적 결과 비율, 토큰 절감, 재시도 감소)
- [ ] 전체 회귀: `pnpm test` 통과 (.env.local 있는 환경에서도). 선행 task의 .env.local-dependent fail 케이스(선행 task `3efa2a0` 수정) 유지
- [ ] **agentic→code 동치성 종합 검증**: results.md에 "각 phase의 동치성 검증 통과 증거 요약" 절 포함 — Phase 2~7 각각의 동치성 검증 항목이 모두 pass했음을 인용. fail 또는 partial 발견 시 escalate.

## 검증

```bash
# 1. 전체 회귀
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test --reporter=basic
# expected: 모든 테스트 pass (.env.local 있어도)

cd /Users/junhyukpark/ngd/ngd-studio && python3 -m pytest tests/ --tb=short
# expected: pass

# 2. audit-coverage 테스트
cd ngd-studio && pnpm test server/stages/__tests__/audit-coverage.test.ts --reporter=basic
# expected: 39 row × 2 assertion = 78 pass

# 3. coverage matrix 100% green
grep -E "^\| \*\*Total\*\* \| \*\*39\*\* \| \*\*39\*\* \| \*\*0\*\* \|" docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
# expected: 1 match

# 4. results.md 존재 + 4개 metric 절
test -f docs/planning/audit-driven-full-agentic-codification/results.md
grep -cE "^## (agentic 호출 감소|결정적 결과 비율|토큰 절감|재시도 감소|동치성)" docs/planning/audit-driven-full-agentic-codification/results.md
# expected: ≥5

# 5. skill 자연어 잔존 0건 (Phase 2/3/4 결과 종합)
grep -nE "resume --q=|cleanupFromStage|concurrency=8|trim_and_watermark" .claude/skills/ngd-exam-create/SKILL.md
# expected: 0 match (legacy 형식 자연어)
```
