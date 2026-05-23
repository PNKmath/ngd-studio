---
phase: 2
title: examData.ts dual emit 제거 + stripChoicePrefix 이전 + aggregateVerifiedProblems 삭제
status: pending
depends_on: [1]
scope:
  - ngd-studio/server/stages/examData.ts
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/examData.test.ts
  - ngd-studio/server/stages/__tests__/extractor.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 2: examData.ts dual emit 제거 + stripChoicePrefix 이전 + aggregateVerifiedProblems 삭제

> **범위**: Backend
> **난이도**: M
> **의존성**: P1
> **영향 파일**: `ngd-studio/server/stages/examData.ts`, `extractor.ts`

## 배경

P1에서 `ExamMeta` 단일 타입 확정. 이제 디스크 write 측을 정리한다.

### F-cleanup-1: `normalizeMeta` dual emit (`examData.ts:105-128`)
현재 `info`에 `schoolLevel`+`school_level`, `examType`+`exam_type` **둘 다** 영속화. P4에서 Python adapter가 camelCase만 읽도록 바꿀 거라, 여기서 디스크 키를 camelCase only로 좁힌다.

### F-cleanup-2: `aggregateVerifiedProblems` dead code (`examData.ts:244-283`)
호출처 0건(`grep -rn "aggregateVerifiedProblems" ngd-studio` 결과 정의·테스트만). `buildExamDataJson`과 거의 동일하지만 partial-skip 정책만 다름. 미래 oncall이 잘못 부르면 silent partial 산출 위험. 삭제.

### F-cleanup-3: `stripChoicePrefix` 밴드에이드 (`examData.ts:181-200`)
extractor 출력의 `[{"t":"① "}, {"eq":"-20"}]` 같은 contract 위반을 merge 단계에서 제거. 진짜 fix는 extractor validator. **`extractor.ts`로 이동** — extractor가 결과를 `qNN_extracted.json`에 쓰기 전에 prefix 제거.

## 설계

### 1) `examData.ts` 단순화

```ts
// Before: ExamMetaInput (alias 둘 다) + normalizeMeta (dual emit)
// After:  ExamMeta (camelCase only, from P1) + assertCompleteMeta
import type { ExamMeta } from "@/lib/exam/meta";
import { buildFilenameBase, isExamMetaComplete } from "@/lib/exam/meta";

export interface ExamDataOutput {
  info: ExamMeta;          // ← camelCase only
  problems: ExamDataProblem[];
}

function assertCompleteMeta(meta: ExamMetaInput): ExamMeta {
  if (!isExamMetaComplete(meta)) {
    throw new Error(`exam_data.json: meta missing required fields (schoolLevel/school/grade/year/subject/semester/examType/range)`);
  }
  const complete: ExamMeta = { ...meta };
  complete.filenameBase = meta.filenameBase ?? buildFilenameBase(complete);
  return complete;
}

export async function buildExamDataJson(input: {
  cache: StageCache;
  meta: ExamMetaInput;
  questionNumbers: number[];
}): Promise<ExamDataOutput> {
  const meta = assertCompleteMeta(input.meta);
  // ... 나머지는 기존과 동일하지만 normalizeMeta 호출 자리에 meta 그대로 사용
  const output: ExamDataOutput = { info: meta, problems };
  await writeFile(cache.paths.examData, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}
```

- `normalizeMeta` 함수 삭제.
- `ExamMetaInput` 로컬 정의 삭제 → `@/lib/exam/meta`에서 import.
- `aggregateVerifiedProblems` + `AggregateResult` + `AggregateError` 삭제.

### 2) `mergeQuestionSources` 단순화

```ts
async function mergeQuestionSources(cache, n, opts): Promise<ExamDataProblem> {
  const [extracted, solved] = await Promise.all([
    tryReadJson(cache.extractorResultPath(n)),
    tryReadJson(cache.solverResultPath(n)),
  ]);
  if (!extracted) throw new Error(`missing extracted for Q${n}`);
  if (opts.requireSolved && !solved) throw new Error(`missing solved for Q${n}`);
  return solved ? { ...extracted, ...solved } : extracted;
}
```

- `normalizeProblem` / `stripChoicePrefix` 호출 제거 (extractor에서 사전 처리되므로 더 이상 필요 없음).
- 단, 기존 캐시 호환 위해 **단 한 줄 방어** 옵션 — 권장 안 함. P9 fixture 재생성으로 깨끗하게.

### 3) `extractor.ts`에 prefix 제거 추가

extractor 결과 검증 끝 또는 디스크 write 직전에:

```ts
// extractor.ts validator 통과 후
const CHOICE_PREFIX_RE = /^[①②③④⑤]\s*/;

function sanitizeExtractedChoices(extracted: ExtractorOutput): ExtractorOutput {
  if (!Array.isArray(extracted.choices)) return extracted;
  const normalized = extracted.choices.map((choice) => {
    if (!Array.isArray(choice) || choice.length === 0) return choice;
    const first = choice[0];
    if (!first || typeof first !== "object" || !("t" in first)) return choice;
    const t = (first as { t: unknown }).t;
    if (typeof t !== "string" || !CHOICE_PREFIX_RE.test(t)) return choice;
    const stripped = t.replace(CHOICE_PREFIX_RE, "");
    if (stripped.length === 0) return choice.slice(1);
    return [{ ...(first as Record<string, unknown>), t: stripped }, ...choice.slice(1)];
  });
  return { ...extracted, choices: normalized };
}
```

`runExtractorStage` 마지막에 `output = sanitizeExtractedChoices(output)` 후 `writeFile`.

### 4) 테스트 갱신

- `examData.test.ts`:
  - 기존 `aggregateVerifiedProblems` 케이스 전부 삭제
  - `normalizeMeta` dual emit 케이스 삭제
  - 신규: `buildExamDataJson`이 camelCase only로 디스크 작성 확인 + `filenameBase` 자동 채움 확인
  - 신규: `meta` 불완전 시 throw
- `extractor.test.ts` (없으면 신설):
  - `sanitizeExtractedChoices` 단위 테스트 (① prefix가 들어있는 입력 → 제거 확인)

## 체크리스트
- [ ] `examData.ts`에서 `normalizeMeta`, `stripChoicePrefix`, `normalizeProblem`, `aggregateVerifiedProblems`, `AggregateError`, `AggregateResult`, 로컬 `ExamMetaInput` 모두 삭제
- [ ] `buildExamDataJson`이 `assertCompleteMeta`로 검증 + camelCase only 작성, `filenameBase` 자동 채움
- [ ] `extractor.ts`에 `sanitizeExtractedChoices` 추가하고 디스크 write 직전 호출
- [ ] `examData.test.ts` 갱신: dual emit / aggregate 케이스 제거, 새 컨트랙트 검증
- [ ] `extractor.test.ts`에 `sanitizeExtractedChoices` 단위 케이스 추가
- [ ] 저장소 루트에서 `cd ngd-studio && npx vitest run server/stages/__tests__/examData.test.ts server/stages/__tests__/extractor.test.ts --reporter=basic` 통과

## 영향 범위

- `.v3cache/exam_data.json` `info` 키가 camelCase only로 바뀐다.
- **Python 측(figure_processor, assemble)은 아직 snake_case를 읽는 상태**라 이 phase 종료 직후 build 단계가 깨질 수 있다. **P3 → P4가 끝나야 Python read가 정합**된다.
- 즉 P2/P3/P4는 **하나의 contract change 묶음** — 셋이 다 끝나기 전에 신규 작업 흐름을 실 사용자에게 노출하면 안 됨 (개발자 본인 manual smoke 금지 구간).

## 검증

```bash
cd ngd-studio
npx vitest run server/stages/__tests__/examData.test.ts server/stages/__tests__/extractor.test.ts --reporter=basic
npx tsc --noEmit
```

manual:
```bash
grep -rn "normalizeMeta\|aggregateVerifiedProblems\|stripChoicePrefix" ngd-studio --include="*.ts"
# 결과 0건
```
