---
phase: 5
title: checker auto-fix 모드
status: pending
depends_on: [3]
scope:
  - ngd-studio/server/stages/checker.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/__tests__/checker.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 5: checker auto-fix 모드

> **범위**: Backend (checker + orchestrator)
> **난이도**: M
> **의존성**: Phase 3 (TS normalizer)
> **영향 파일**: checker.ts, orchestrator.ts

## 배경

`checker.ts:98`은 7개 결정적 룰을 detect만 하고 fix는 하지 않는다. 특히 `equation.run_on` (통수식)은 `fallbackRequired: true`만 표시 → 결국 LLM에 fallback이 필요해진다.

Phase 3의 `normalizeParts`가 이미 R-01 (통수식 split) 등을 결정적으로 수행하므로, 룰별 `fix()` 매핑을 추가하면 LLM 호출 없이 결정적 fix loop가 가능하다.

## 설계

### 1. checker.ts — `fix()` 매핑

```typescript
interface RuleHandler {
  detect: (xml: string, file: string) => CheckerIssue[];
  fix?: (xml: string) => string;  // optional — rule이 결정적 수정 가능할 때만
}

const RULES: Record<string, RuleHandler> = {
  "equation.run_on": {
    detect: checkRunOnEquations,
    fix: fixRunOnEquationsInXml,   // ← 신규
  },
  "text.difficulty_vocabulary": {
    detect: checkDifficultyVocabulary,
    // fix 없음 — value가 enum 밖이면 자동 수정 불가, 사람 판단 필요
  },
  // ... 7개 룰
};
```

### 2. `fixRunOnEquationsInXml`

XML 직접 mutation. `<hp:equation>` block을 찾아 안의 `<hp:script>` content를 `splitTopLevelEq`(Phase 3)로 분리 → 여러 `<hp:equation>`로 교체. 사이에 `<hp:t> </hp:t>` 글루 삽입.

핵심: parts 단계 정규화(Phase 2/3)가 1차 방어선이라 여기 도달하는 케이스는 드물어야 함. checker fix는 안전망.

대안: HWPX 재빌드. parts 단계에서 fix해서 `exam_data.json` 갱신 → `build_hwpx.py` 재실행. 더 안전(다른 룰도 자동 해결).

→ **선택**: checker fix는 **rebuild 트리거** 방식.
- checker가 위반 발견 + auto-fixable → cache parts 정규화 다시 적용 → `build_hwpx.py` 재실행 → 재검사.

```typescript
async function runCheckerWithAutoFix(input) {
  let attempt = 0;
  while (attempt < 2) {
    const result = await runCheckerStage(input);
    if (result.output.ok) return result;
    const fixable = result.output.issues.filter((i) => RULES[i.ruleId]?.fix);
    if (fixable.length === 0) return result;
    // rebuild from cache (Phase 3 normalizer가 자동 적용됨)
    await normalizeCacheAndRebuild(...);
    attempt++;
  }
  return runCheckerStage(input);  // 최종 결과
}
```

### 3. orchestrator 통합

`orchestrator.ts:651` checker 호출을 `runCheckerWithAutoFix`로 교체. fallback이 일어났는지 telemetry에 기록.

### 4. 회귀 테스트

`checker.test.ts`에 통수식 포함 XML fixture → fix 후 통과 시나리오 추가.
`orchestrator.pipeline.test.ts`에 build → check fail → autofix → check pass 시나리오 추가.

## 체크리스트

- [ ] `checker.ts`에 `RULES` map + `fix?` field 도입
- [ ] `fixRunOnEquationsInXml` 구현 (혹은 cache rebuild 방식 채택 시 `normalizeCacheAndRebuild`)
- [ ] `runCheckerWithAutoFix` wrapper 추가 — 최대 2회 fix 시도
- [ ] `orchestrator.ts:651` checker stage 호출을 wrapper로 교체
- [ ] checker.test.ts에 autofix 시나리오 추가
- [ ] `cd ngd-studio && pnpm test server/stages/__tests__/checker.test.ts` 통과

## 영향 범위

- checker 결과 의미 변경: ok=false라도 fix 가능하면 자동 처리 → ok=true 재반환.
- LLM fallback 호출 감소 (`fallbackRequired` 가 true 였던 케이스가 결정적 fix됨).
- Phase 2/3 정규화가 1차 방어선이므로 실제 fix 빈도는 낮을 것 — 그래도 safety net으로 둠.

## 검증

```bash
cd ngd-studio
pnpm tsc --noEmit
pnpm test server/stages/__tests__/checker.test.ts --reporter=basic
pnpm test server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic
```

수동: 통수식 포함 임의 HWPX 만들어서 checker fix 적용 → 분리된 HWPX 출력 확인.
