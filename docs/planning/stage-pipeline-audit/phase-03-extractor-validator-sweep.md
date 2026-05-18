---
phase: 3
title: extractor validator sweep + 타입 정합
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/extractor.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 3: extractor validator sweep + 타입 정합

> **범위**: Backend (extractor validator)
> **난이도**: S
> **의존성**: Phase 1 (매트릭스 결론)
> **영향 파일**: `server/stages/extractor.ts`, `__tests__/extractor.test.ts`

## 배경

`answer`와 `question`은 이미 optional로 patch됨(40fa1f2, e642792). Phase 1의 매트릭스는 잔여 drift를 enumerate한다:

- `choices: string[]` TS 타입과 실제 데이터(`{t|eq}[][]`) 불일치 — runtime은 통과(cast)지만 downstream에서 정수 index access 시 잘못 동작 위험.
- `parts: [{t|eq}]` — prompt가 required로 요구하지만 validator는 검사 없음.
- `condition_box`, `data_table` — prompt schema 정의됐으나 validator 부재 (null 허용 케이스 많아 strict 검사는 어려움).

이 phase는 **현실적인 최소 검증만** 추가한다 (parts 존재 + 타입). 너무 strict하면 codex 응답이 부서지기 쉬움.

## 설계

### choices 타입 정합

```ts
// 현재
choices?: string[];
output.choices = candidate.choices as string[]; // wrong

// 변경
export type ExtractorPartObject = { t: string } | { eq: string };
export type ExtractorChoice = ExtractorPartObject[];

choices?: ExtractorChoice[];
// validator: array of arrays, 각 inner element는 {t} or {eq} object. 길이 3-5는 유지.
```

### parts 검증 (NEW)

```ts
// validator 추가
if (candidate.parts !== undefined) {
  if (!Array.isArray(candidate.parts)) {
    return { ok: false, message: "extractor parts must be an array when present" };
  }
  // element shape는 strict 검사하지 않음 (codex의 자유도 보존). length > 0 정도만.
}
```

타입:
```ts
parts?: ExtractorPartObject[];
```

### condition_box / data_table

- validator 추가 안 함 (null/undefined 허용 폭이 너무 넓고 downstream에서 type-narrow 시 처리).
- 단, 타입 hint를 `unknown`으로 유지 (현재 `[key: string]: unknown`이 흡수).

### 테스트

- VALID_OUTPUT의 `choices`를 새 타입 (객체 배열의 배열) 으로 명시. 기존 fixture가 이미 그 모양인지 확인.
- "passes when parts is missing" / "fails when parts is not array" 케이스 추가.
- 기존 모든 케이스 통과 유지.

## 체크리스트

- [x] `ExtractorPartObject` / `ExtractorChoice` 타입 정의 + export
- [x] `ExtractorStageOutput.choices` 타입 변경 (`string[]` → `ExtractorChoice[]`), output cast 제거
- [x] validator에 parts array 검사 추가 (존재 시 array)
- [x] extractor.test.ts에 parts 케이스 2개 추가 (missing OK / non-array fail)
- [x] 전체 테스트 통과: `npx vitest run server/stages/__tests__/extractor.test.ts`

## 영향 범위

- choices 타입 변경 → downstream consumer (builder가 choices를 어떻게 읽는지 확인). 현재 `string[]` 가정이면 buildExamDataJson에서 cast 또는 transformer 추가 필요.
  - **사전 확인**: `grep -n "choices" ngd-studio/server/stages/examData.ts` → 사용 시 동기 수정.
- 다른 stage / 캐시 invalidation 영향 없음.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-18 01:11 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`ExtractorPartObject` / `ExtractorChoice` 타입을 정의·export하고, `ExtractorStageOutput.choices`를 `string[]` → `ExtractorChoice[]`로 변경했다. validator에 parts 배열 존재 시 array 검사를 추가했으며, `output.choices` cast를 `as string[]` → `as ExtractorChoice[]`로 수정했다. `ExtractorStageOutput`에 `parts?: ExtractorPartObject[]` 필드도 추가했다.

#### 변경 파일
- `ngd-studio/server/stages/extractor.ts` (수정, +10/-3줄)
- `ngd-studio/server/stages/__tests__/extractor.test.ts` (수정, +14줄)

#### 검증 결과
- [x] tsc --noEmit: extractor 관련 신규 오류 없음 (pre-existing solver 오류만 존재)
- [x] vitest extractor.test.ts: 18 tests passed (기존 16 + 신규 2)

#### 추가 발견사항
- examData.ts 및 다른 server 파일에서 choices를 사용하지 않음 — downstream 영향 없음.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)

pass — 2 files in scope (extractor.ts, __tests__/extractor.test.ts). 다른 파일 변경 없음.

#### Verification Re-run (orchestrator)

exit 0 — `npx tsc --noEmit` 0 errors, `vitest extractor.test.ts` 18/18 pass.

#### Simplify (orchestrator)

SIMPLIFIED: 1 — extractor.ts: 중복된 `choices` 조건부 재할당 3줄 제거 (spread copies already). Verify pass.

#### Review (orchestrator)

VERDICT: pass — ExtractorPartObject/ExtractorChoice 타입·validator·테스트 모두 스펙 일치, 18/18 통과.

#### Commit

00d1762
