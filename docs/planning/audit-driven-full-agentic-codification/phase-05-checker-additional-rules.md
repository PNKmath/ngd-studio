---
phase: 5
title: checker 추가 룰 3개 — endNote / section style / vocabulary
status: pending
depends_on: [3]
scope:
  - ngd-studio/server/stages/checker.ts
  - ngd-studio/server/stages/__tests__/checker.test.ts
  - ngd-studio/server/stages/__tests__/fixtures/checker-additional/
intervention_likely: false
intervention_reason: ""
---

# Phase 5: checker 추가 룰 3개 — endNote / section style / vocabulary

> **범위**: Backend (TS)
> **난이도**: M
> **의존성**: Phase 3 (orchestrator 안정화)
> **영향 파일**: `checker.ts` (확장), `checker.test.ts` (신규 케이스)

## 배경

audit doc Group A9 + checker XML rule 9개 중 선행 task가 누락한 3개:
- D6 endNote 구조: suffixChar, autoNum, number 순서, `[정답]` 존재
- D8 section0 style count / lineBreak / bold 속성
- D9 중단원/과목/범위 vocabulary check

선행 task Phase 5의 RULES map (`ngd-studio/server/stages/checker.ts:52`) 7개:
```
xml.well_formed, xml.raw_escape, text.raw_equation_xml,
text.english_word, text.difficulty_vocabulary,
equation.run_on (with autofix), equation.permutation_combination
```

위 3개는 audit doc lines 88-91이 "즉시 코드화 가능"으로 분류했음에도 phase 스펙 자체에서 누락됨. 본 phase에서 채움.

## 설계

### 1. `endNote.structure` rule

HWPX endNote (각주) 구조 검증:
- `<hp:endNote>` 안에 `suffixChar` → `autoNum` → `number` 순서로 등장
- `[정답]` 텍스트 존재
- 미주-문제 띄어쓰기 없음 (이전 조건과 일관)

```typescript
function checkEndNoteStructure(sectionXml: string, file: string): CheckerIssue[];
```

### 2. `section.style_format` rule

`section0.xml` 형식 검사:
- 바탕글 스타일 1개만 (F6 규칙)
- `<hp:lineBreak>` 사용 검증 (정답 라인 2줄 외 금지)
- 정답 bold 금지 (charPr bold 속성 검사)

```typescript
function checkSectionStyleFormat(sectionXml: string, file: string): CheckerIssue[];
```

### 3. `text.vocabulary` rule

중단원/과목/범위 vocabulary 검증. 단원분류표 `.claude/data/unit_classification.json` 기반:
- `[중단원]` 값이 unit_classification의 알려진 중단원에 존재
- `[과목]` 값이 알려진 과목 목록에 존재
- `[범위]` 값이 과목-중단원 조합 내에서 유효

```typescript
function checkTextVocabulary(
  sectionXml: string,
  file: string,
  unitClassification: UnitClassification,
): CheckerIssue[];
```

`unit_classification.json` 로딩은 checker 진입점에서 1회 cache. 파일 없으면 rule skip + log warning.

### 4. RULES map 확장

```typescript
const RULES: Record<string, RuleHandler> = {
  "xml.well_formed": { detect: checkXmlWellFormed },
  "xml.raw_escape": { detect: checkRawEscapes },
  "text.raw_equation_xml": { detect: checkRawEquationXml },
  "text.english_word": { detect: checkEnglishWords },
  "text.difficulty_vocabulary": { detect: checkDifficultyVocabulary },
  "text.vocabulary": { detect: checkTextVocabulary },               // NEW
  "equation.run_on": { detect: checkRunOnEquations, fix: fixRunOnEquationsInXml },
  "equation.permutation_combination": { detect: checkPermutationCombination },
  "endNote.structure": { detect: checkEndNoteStructure },           // NEW
  "section.style_format": { detect: checkSectionStyleFormat },      // NEW
};
```

10개 룰로 확장.

### 5. fixture HWPX 단편

`__tests__/fixtures/checker-additional/` 디렉터리에 3종 fixture 각각의 pass/fail XML 단편:
- `endNote-pass.xml` / `endNote-fail-missing-answer.xml`
- `section-pass.xml` / `section-fail-bold-answer.xml`
- `vocabulary-pass.xml` / `vocabulary-fail-unknown-subject.xml`

## 영향 범위

- 기존 7개 룰 동작 불변
- `DETERMINISTIC_RULE_IDS = Object.keys(RULES)`로 자동 확장 → orchestrator/UI에서 별도 등록 불필요
- `runCheckerWithAutoFix` 재시도 루프는 신규 룰에 fix 핸들러 없으면 detect-only로 동작 (이전과 일관)

## 체크리스트

- [ ] coverage-matrix.md의 A9, D6, D8, D9 행에서 본 phase 인용 확인
- [ ] `checkEndNoteStructure` 구현 + fixture pass/fail 2종
- [ ] `checkSectionStyleFormat` 구현 + fixture pass/fail 2종
- [ ] `checkTextVocabulary` 구현 + `unit_classification.json` 로딩 + fixture pass/fail 2종
- [ ] RULES map에 3개 신규 entry 추가 (id 명명 규칙 일관)
- [ ] `checker.test.ts`에 신규 룰별 detect 케이스 추가 (각 3개 이상 — pass / fail / edge)
- [ ] **agentic→code 동치성 검증**: `ngd-exam-checker.md` 자연어 룰 9개 중 본 phase에서 코드화한 3개에 대해, 검사 항목 텍스트 1:1 대응 grep 증거. 운영 sample HWPX 1건을 코드 checker로 돌린 결과의 issue list가 (수동으로 식별한 기대 issue list)와 일치하는지 spot check.

## 검증

```bash
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test server/stages/__tests__/checker.test.ts --reporter=basic
cd ngd-studio && pnpm test server/stages/__tests__/orchestrator.pipeline.test.ts --reporter=basic
# 회귀 없음

# RULES map에 10개
grep -cE "\"[a-z][a-z._]*\":\s*\{" ngd-studio/server/stages/checker.ts
# expected: 10

# ngd-exam-checker.md 자연어 룰 ↔ 코드 룰 매핑 grep
for r in endNote section vocabulary; do
  grep -ni "$r" .claude/agents/ngd-exam-checker.md > /dev/null && \
    grep -ni "$r" ngd-studio/server/stages/checker.ts > /dev/null && \
    echo "OK $r" || echo "MISS $r"
done
# expected: 3개 OK
```
