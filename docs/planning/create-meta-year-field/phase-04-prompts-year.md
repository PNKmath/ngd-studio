---
phase: 4
title: extractor/solver/verifier 프롬프트에 year 컨텍스트 추가
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
  - ngd-studio/lib/prompts.ts
  - ngd-studio/server/stages/__tests__/prompts.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs: [create-v4-full-pipeline]
e2e_triggers: []
---

# Phase 4: extractor/solver/verifier 프롬프트에 year 컨텍스트 추가

> **범위**: Server (prompts)
> **난이도**: S
> **의존성**: Phase 1 (`ExamMeta.year` 타입 존재)
> **영향 파일**: `extractorPrompt.ts`, `lib/prompts.ts` + 테스트

## 배경

다른 연도 기출이 혼재할 수 있는 작업(특히 모의고사·신유형 도입 시점)에 solver/verifier 가 연도 컨텍스트를 모르면 시기별 교과과정 차이로 인한 잘못된 풀이를 만들 수 있다. UI 가 year 를 보내는 만큼 prompt 컨텍스트에도 명시적으로 노출한다.

## 설계

### `server/stages/prompts/extractorPrompt.ts:197-205`

`buildExtractorPrompt` 의 메타라인 생성부:

```ts
if (input.examMeta) {
  const metaLines: string[] = [];
  if (input.examMeta.school) metaLines.push(`학교: ${input.examMeta.school}`);
  if (input.examMeta.year) metaLines.push(`연도: ${input.examMeta.year}`);   // ← 추가
  if (input.examMeta.grade) metaLines.push(`학년: ${input.examMeta.grade}학년`);
  if (input.examMeta.subject) metaLines.push(`과목: ${input.examMeta.subject}`);
  if (input.examMeta.semester) metaLines.push(`학기: ${input.examMeta.semester}`);
  if (input.examMeta.examType) metaLines.push(`시험 종류: ${input.examMeta.examType}`);
  if (input.examMeta.range) metaLines.push(`범위: ${input.examMeta.range}`);
  ...
}
```

연도는 학교 다음, 학년 위에 배치 (자연스러운 한국어 어순).

### `lib/prompts.ts:28-29, 73-74`

`buildSolverPrompt` / `buildVerifierPrompt` 양쪽 동일하게:

```ts
if (meta.school) lines.push(`- 학교: ${meta.school}`);
if (meta.year) lines.push(`- 연도: ${meta.year}`);    // ← 추가
if (meta.grade) lines.push(`- 학년: ${meta.grade}`);
```

### `server/stages/__tests__/prompts.test.ts:28-44`

fixture 와 assertion 갱신:

```ts
examMeta: {
  school: "강북고",
  year: 2025,            // ← 추가
  grade: 2,
  ...
}
```

`includes examMeta fields when provided` 테스트의 단언에 `연도: 2025` 라인이 출력 prompt 에 포함되는지 expect.

## 체크리스트

- [x] `extractorPrompt.ts:197-205` 에 `연도: ${year}` 라인 추가 (학교 다음 위치)
- [x] `lib/prompts.ts` solver 프롬프트 (`:28-29` 근처) 에 `- 연도: ${year}` 추가
- [x] `lib/prompts.ts` verifier 프롬프트 (`:73-74` 근처) 에 `- 연도: ${year}` 추가
- [x] `prompts.test.ts` fixture 에 `year: 2025` 추가
- [x] `prompts.test.ts` assertion 에 `연도: 2025` 출력 검증
- [x] `npx vitest run server/stages/__tests__/prompts.test.ts --reporter=basic` 통과

## 영향 범위

- `examMeta` / `meta` 모두 모든 필드 optional → 호출부 변경 없음.
- 기존 작업물 prompt 와 차이는 `- 연도: YYYY` 라인 1개 추가뿐.
- legacy Claude CLI 흐름은 별도 prompt 빌더 안 거치므로 영향 없음.

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio/ngd-studio
npx vitest run server/stages/__tests__/prompts.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-21 02:46 KST) — 완료
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`extractorPrompt.ts`의 메타라인 생성부에 `연도: ${year}` 라인을 학교 다음에 추가했다. `lib/prompts.ts`의 `buildCreatePrompt`와 `buildResumePrompt` 양쪽 모두 `meta` 타입에 `year?: number` 필드를 추가하고 `- 연도: ${year}` 출력 라인을 학교 다음에 삽입했다. 테스트 fixture에 `year: 2025`를 추가하고, `연도: 2025` 출력 검증 assertion을 추가했다.

#### 변경 파일
- `ngd-studio/server/stages/prompts/extractorPrompt.ts` (수정, +1줄)
- `ngd-studio/lib/prompts.ts` (수정, +4줄: `buildCreatePrompt`에 타입+출력 각 1줄, `buildResumePrompt`에 타입+출력 각 1줄)
- `ngd-studio/server/stages/__tests__/prompts.test.ts` (수정, +2줄: fixture year 추가, assertion 추가)

#### 검증 결과
- [x] vitest 14 tests pass: `npx vitest run server/stages/__tests__/prompts.test.ts --reporter=basic` → pass (14 tests passed)

#### 추가 발견사항
스펙이 `lib/prompts.ts`의 solver/verifier 프롬프트를 참조했지만 실제 새 TS orchestrator 경로의 solver/verifier는 `server/stages/prompts/solverPrompt.ts`, `verifierPrompt.ts`에 있다. 이 두 파일은 scope 외이며 현재 `SolverPromptInput`/`VerifierPromptInput`에 `examMeta`/`year` 파라미터가 없다. 새 TS orchestrator 경로에도 year 컨텍스트가 필요하다면 별도 phase로 scope에 포함시켜 처리 권장.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 scope files edited (extractorPrompt.ts, lib/prompts.ts, prompts.test.ts) + PHASE_FILE self-edits. No out-of-scope writes.

#### Verification Re-run (orchestrator)
exit 0 — vitest 14 tests passed (prompts.test.ts).
