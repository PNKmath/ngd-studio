---
phase: 7
title: reviewer 22개 체크리스트 자동검증 강화
status: pending
depends_on: [3]
scope:
  - ngd-studio/server/review/autoValidators.ts
  - ngd-studio/server/review/__tests__/autoValidators.test.ts
  - ngd-studio/server/review/__tests__/fixtures/auto-validator-cases/
  - ngd-studio/server/review/mutation.ts
  - ngd-studio/server/stages/reviewRunner.ts
  - .claude/agents/ngd-exam-reviewer.md
intervention_likely: true
intervention_reason: "reviewer agent prompt 재작성 — 자동검증 통과 항목은 issue draft 생성 금지. 잘못 분리하면 reviewer 운영 회귀."
---

# Phase 7: reviewer 22개 체크리스트 자동검증 강화

> **범위**: Backend (TS) + agent 문서
> **난이도**: L
> **의존성**: Phase 3 (orchestrator 안정화)
> **영향 파일**: `autoValidators.ts` (신규), `mutation.ts` (확장), `reviewer.md` (재작성)

## 배경

audit doc Group A11 + E1/E2 partial.

선행 task Phase 6에서 reviewer mutation은 분리됐지만, **22개 고정 체크리스트 항목 중 XML 분석만으로 자동 검증 가능한 항목**(`.claude/agents/ngd-exam-reviewer.md:80-90` 명시)이 여전히 reviewer agent의 issue draft 생성에 의존:

```
#1 배점 위치/수식
#4 확률과통계, 좌표 로마체
#5 therefore/because → `<hp:script>` 뒤 `~`
#6 cdots → 양쪽 `` ` ``
#7 괄호 → `left(` `right)`
#9 통수식 → `<hp:script>`에 `=` 2개 이상
#14 바탕글 → 스타일 개수
#15 독립수식 tab
#17 콤마 → 쉼표 뒤 `~`
#19 선지 간격
#20 미주-문제 간격
#22 해설 정렬
```

이 12개는 결정적 XML rule. 본 phase는:
- `autoValidators.ts`에 12개 검증 함수 코드화
- `ReviewIssueDraft`에 `auto_verified: boolean` 필드 추가
- reviewer agent는 자동검증 결과를 받아 **해당 항목은 issue draft 생성하지 않음** (중복 제거)
- agent는 자동검증 불가 항목(해설 완성도, PDF↔HWPX 비교 등)에만 집중

## 설계

### 1. `ngd-studio/server/review/autoValidators.ts` (신규)

```typescript
import type { ReviewIssueDraft } from "./mutation";

/**
 * 22개 체크리스트 중 코드로 검증 가능한 항목 ID → validator 함수.
 * 각 validator는 위반 발견 시 ReviewIssueDraft를 생성 (auto_verified: true 표시).
 */
export const AUTO_VALIDATORS: Record<string, (sectionXml: string) => ReviewIssueDraft[]> = {
  "#1": validateScoreLocation,
  "#4": validateProbStatRomanType,
  "#5": validateThereforeBecauseTilde,
  "#6": validateCdotsBackticks,
  "#7": validateParenthesesLeftRight,
  "#9": validateRunOnEquations,
  "#14": validateBatangStyleCount,
  "#15": validateIndependentEquationTab,
  "#17": validateCommaTilde,
  "#19": validateChoiceSpacing,
  "#20": validateEndnoteProblemSpacing,
  "#22": validateExplanationAlignment,
};

export function runAutoValidators(sectionXml: string): ReviewIssueDraft[] {
  return Object.values(AUTO_VALIDATORS).flatMap(fn => fn(sectionXml));
}

export const AUTO_VALIDATED_RULE_IDS = Object.keys(AUTO_VALIDATORS);
```

각 validator의 검사 로직은 reviewer 자연어 설명(`.claude/agents/ngd-exam-reviewer.md:80-90`)에 1:1 대응. checker.ts의 기존 룰과 일부 중복되지만 reviewer는 mutation 제안까지 포함하므로 별도 모듈.

### 2. `mutation.ts:ReviewIssueDraft` 확장

```typescript
export interface ReviewIssueDraft {
  issue_type: "typo" | "missing" | "checklist_violation";
  location: { file: string; xpath?: string; snippet: string };
  suggested_fix?: string;
  rule_id?: string;
  question_number?: number;
  /** true → autoValidators.ts가 생성한 deterministic issue. agent 중복 생성 방지용. */
  auto_verified?: boolean;
}
```

### 3. `reviewRunner.ts` 통합

```typescript
// reviewRunner.ts
import { runAutoValidators, AUTO_VALIDATED_RULE_IDS } from "../review/autoValidators";

export async function runReview(...) {
  const sectionXml = await readSection(hwpxPath);
  const autoDrafts = runAutoValidators(sectionXml);                        // 결정적

  // agent에는 "이 rule_id들은 이미 코드로 검증됐으니 건드리지 마라" 신호 전달
  const agentDrafts = await runReviewerAgent(hwpxPath, {
    skipRuleIds: AUTO_VALIDATED_RULE_IDS,
  });

  // merge — auto 우선
  const drafts = [...autoDrafts, ...agentDrafts.filter(d => !AUTO_VALIDATED_RULE_IDS.includes(d.rule_id ?? ""))];
  // ... mutation/table/postprocess 이어 진행
}
```

### 4. `.claude/agents/ngd-exam-reviewer.md` 수정

`## Phase 4: 비교 + 체크리스트 검증` 절에 다음 추가:

```markdown
### 자동검증 항목 (생성 금지)

다음 rule_id에 대한 issue draft는 코드(`autoValidators.ts`)가 생성합니다. agent는 **건드리지 마세요**:
#1, #4, #5, #6, #7, #9, #14, #15, #17, #19, #20, #22

위 항목 위반을 발견해도 ReviewIssueDraft를 만들지 마세요 — 중복 생성됩니다.

agent의 책임은 다음에만 한정:
- PDF↔HWPX 내용 누락/오타 (다중모달 판단)
- #2, #3, #8, #10~#13, #16, #18, #21 등 자동검증 불가 항목
- 자동검증되지 않은 ad-hoc 오류
```

orchestrator 호출 시 `skipRuleIds` 옵션 전달 → agent prompt 동적 주입.

### 5. fixture HWPX 단편

`__tests__/fixtures/auto-validator-cases/` — 12개 rule 각각 pass + fail 케이스 (총 24 fixture).

## 영향 범위

- reviewer agent의 issue draft 수가 감소 (12개 항목이 agent 책임에서 빠짐) → 토큰 사용량 감소
- 자동검증 항목은 결정적 결과 → 운영 일관성 향상
- 기존 `reviewRunner.ts`의 mutation/table/postprocess 단계는 변경 없음 — draft 출처(agent/code)와 무관
- `ReviewIssueDraft.auto_verified` 신규 필드는 optional → 기존 소비자 영향 없음

## 체크리스트

- [ ] coverage-matrix.md의 A11, E1, E2 행에서 본 phase 인용 확인
- [ ] `autoValidators.ts` 신규 — 12개 validator 함수 구현 + `runAutoValidators` aggregate
- [ ] `mutation.ts` — `ReviewIssueDraft.auto_verified?: boolean` 추가
- [ ] `reviewRunner.ts` — autoValidators 결과 통합 + agent에 skipRuleIds 전달
- [ ] `__tests__/fixtures/auto-validator-cases/` — 12개 rule × pass/fail = 24 fixture
- [ ] `autoValidators.test.ts` — 24 fixture round-trip + 중복 issue 발생 안 함 검증
- [ ] `.claude/agents/ngd-exam-reviewer.md` — 자동검증 항목 명시 + skipRuleIds 처리 지침
- [ ] **agentic→code 동치성 검증**: 운영 HWPX sample 1건에서
  1. autoValidators 단독 실행 결과의 issue list가 사전에 손으로 작성한 expected list와 일치
  2. reviewer agent 호출 시 12개 rule에 대한 issue 생성이 0건 (orchestrator log 검증)
  3. 전체 review 결과(autoDrafts + agentDrafts merged)에 rule_id 중복 0건

## 검증

```bash
# 1. 단위 + 통합
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test server/review/__tests__/ --reporter=basic

# 2. agent.md skipRuleIds 지침 명시 확인
grep -E "#1.*#22|skipRuleIds|자동검증 항목" .claude/agents/ngd-exam-reviewer.md
# expected: 최소 1줄 매치

# 3. autoValidators 12개 함수 export 확인
grep -cE "^function validate[A-Z]" ngd-studio/server/review/autoValidators.ts
# expected: ≥12

# 4. fixture 24개
find ngd-studio/server/review/__tests__/fixtures/auto-validator-cases/ -name "*.xml" | wc -l
# expected: ≥24

# 5. agentic→code 동치성 spot check
# autoValidators.test.ts 안에 운영 sample fixture 1개 + 손으로 작성한 expected list
# autoValidators 결과 ↔ expected list deep equal
```
