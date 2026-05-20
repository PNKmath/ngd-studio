---
phase: 1
title: 타입 레이어 year 필드 추가
status: completed
depends_on: []
scope:
  - ngd-studio/components/upload/MetaForm.tsx
  - ngd-studio/lib/store.ts
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs: [create-v4-full-pipeline]
e2e_triggers: []
---

# Phase 1: 타입 레이어 year 필드 추가

> **범위**: Frontend + Server (타입만)
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `MetaForm.tsx`, `lib/store.ts`, `extractorPrompt.ts`

## 배경

UI 에서 연도를 입력받아 server orchestrator → exam_data.json → assemble.py 까지 흘려보내려면 세 곳의 타입에 `year` 필드가 먼저 존재해야 한다. 이 phase 는 타입만 추가하고 실제 값 흐름은 후속 phase 가 채운다.

## 설계

### `ngd-studio/components/upload/MetaForm.tsx:3-10`

```ts
export type MetaValue = {
  school: string;
  grade: number;
  year: number;        // ← 추가
  subject: string;
  semester: string;
  examType: string;
  range: string;
};
```

### `ngd-studio/lib/store.ts:15-24`

```ts
export interface V3Meta {
  school?: string;
  grade?: number;
  year?: number;       // ← 추가
  subject?: string;
  semester?: string;
  examType?: string;
  range?: string;
  questionCount?: number;
  resumeFrom?: string;
}
```

### `ngd-studio/server/stages/prompts/extractorPrompt.ts:8-15`

```ts
export interface ExamMeta {
  school?: string;
  grade?: number;
  year?: number;       // ← 추가
  subject?: string;
  semester?: string;
  examType?: string;
  range?: string;
}
```

`ExamMetaInput` (`server/stages/examData.ts:8-24`) 는 이미 `year?: number` 보유 → 무수정.

## 체크리스트

- [x] `MetaValue.year: number` 추가 (`MetaForm.tsx:3-10`)
- [x] `V3Meta.year?: number` 추가 (`lib/store.ts:15-24`)
- [x] `ExamMeta.year?: number` 추가 (`extractorPrompt.ts:8-15`)
- [x] `npx tsc --noEmit` 실행 — `MetaValue.year` 가 required 라 `DEFAULT_META` / `loadStoredMeta` 등에서 누락 에러가 발생할 수 있음. 에러가 나는 위치를 식별만 하고 fix 는 phase-02 에서 처리 (이 phase 에서는 에러 위치 로그만 `## 실행 결과` 에 남길 것)
- [x] phase-02 가 처리해야 할 누락 호출부 리스트를 `## 실행 결과` 에 명시

## 영향 범위

- `DEFAULT_META` (`app/create/page.tsx:37-44`) 는 `MetaValue` 와 호환되지 않아 컴파일 에러 예상 — phase-02 에서 처리.
- `loadStoredMeta` (`app/create/page.tsx:55-63`) 의 spread fallback 은 `MetaValue` 호환 위반 가능 — phase-02 에서 처리.
- 서버측은 `ExamMeta` 의 모든 필드가 optional 이므로 호출부 영향 없음.
- `V3Meta` 전 필드 optional 이므로 영향 없음.

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio/ngd-studio
npx tsc --noEmit
```

→ `MetaForm.tsx`, `app/create/page.tsx` 관련 누락 에러만 발생, 다른 영역 에러 없음.

## 실행 결과

### 1회차 (2026-05-21 22:54 KST) — completed
**상태**: completed
**소요 시간**: 약 2분
**진행 모델**: claude-haiku-4-5-20251001

#### 요약
타입 레이어의 세 위치에 `year` 필드를 성공적으로 추가했습니다. 예상된 대로 컴파일 에러가 `app/create/page.tsx`의 두 위치에서 발생했으며, 이는 phase-02에서 처리할 대상입니다.

#### 변경 파일
- `ngd-studio/components/upload/MetaForm.tsx` (수정, +1줄)
- `ngd-studio/lib/store.ts` (수정, +1줄)
- `ngd-studio/server/stages/prompts/extractorPrompt.ts` (수정, +1줄)

#### 검증 결과
- [x] 타입 추가: `MetaValue`, `V3Meta`, `ExamMeta`에 `year` 필드 추가 완료
- [x] `npx tsc --noEmit` 실행 → exit code 2 (예상된 컴파일 에러)

#### 추가 발견사항
**Phase-02 처리 대상** (누락 호출부):
1. `app/create/page.tsx:37-44` — `DEFAULT_META` 객체에 `year: 필드값` 추가 필요
2. `app/create/page.tsx:171-178` — `setMeta` 호출에 `year: v3Meta.year ?? 초기값` 추가 필요

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 scope files edited (MetaForm.tsx, store.ts, extractorPrompt.ts) + PHASE_FILE self-edits. No out-of-scope writes.

#### Verification Re-run (orchestrator)
exit 1 — spec-expected. `app/create/page.tsx` 두 위치(line 37, 171)에서 누락된 `year` 필드 에러 2건만 발생, 다른 영역 에러 없음. Phase 2 에서 해소 예정. Spec `## 검증` 본문이 정확히 이 결과를 expected 로 명시.
