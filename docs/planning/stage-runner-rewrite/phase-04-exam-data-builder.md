---
phase: 4
title: exam_data.json 합치기 TS 이식
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/examData.ts
  - ngd-studio/server/stages/__tests__/examData.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 4: exam_data.json 합치기 TS 이식

> **범위**: Backend (exam_data 합치기)
> **난이도**: S
> **의존성**: 없음 (Phase 1, 2, 3과 병렬 가능)
> **영향 파일**: `ngd-studio/server/stages/examData.ts` (신규)

## 배경

`figure_processor.py`와 `runBuilderStage`는 `inputs/시험지 제작/.v3cache/exam_data.json` 합본 파일을 입력으로 사용. 현재 이 합치기 로직은 `.claude/skills/ngd-exam-create/SKILL.md`(line 544+)의 Python 코드 블록에 들어 있고 Claude CLI가 그 블록을 실행. 코드 기반 흐름에서는 TS가 직접 합쳐야 한다.

## 설계

### 함수 시그니처

```ts
// server/stages/examData.ts
export interface ExamMetaInput {
  school?: string;
  grade?: number;
  subject?: string;
  semester?: string;
  examType?: string;
  range?: string;
}

export interface ExamDataProblem {
  number: number;
  // extracted + solved + verified 합본 필드 (existing schema)
  ...
}

export interface ExamDataOutput {
  meta: ExamMetaInput;
  problems: ExamDataProblem[];
}

export async function buildExamDataJson(input: {
  cache: StageCache;            // .v3cache 디렉터리 인터페이스
  meta: ExamMetaInput;
  questionNumbers: number[];    // 처리 대상
}): Promise<ExamDataOutput>;
```

### 흐름

1. `questionNumbers` 각각에 대해 `cache.verifierResultPath(n)` (또는 fallback으로 `solverResultPath(n)` → `extractorResultPath(n)`) 읽기
2. 우선순위: verified > solved > extracted (skill MD와 동일 로직)
3. 한 문제도 못 읽으면 `throw new Error("missing extracted/solved/verified for Q{n}")`
4. 합치기: 각 문제의 extracted JSON + solved JSON의 (answer, explanation, verifierContext) merge
5. `meta` 객체에 시험 정보 포함
6. `inputs/시험지 제작/.v3cache/exam_data.json`에 `JSON.stringify(..., null, 2)` 로 저장
7. 반환값은 같은 객체

### 호환성

기존 figure_processor.py와 build_hwpx.py가 읽는 schema 그대로 유지 (`{ "meta": {...}, "problems": [{...}, ...] }`).

### 테스트

`server/stages/__tests__/examData.test.ts`:
- 가짜 cache (tmpDir에 q1_verified.json, q2_solved.json, q3_extracted.json) → 합본 잘 만들어지고 우선순위가 맞는지
- 누락된 문제(q4)는 throw
- meta 필드 정확히 포함

## 체크리스트

- [x] `server/stages/examData.ts` 신규 작성, `buildExamDataJson` export
- [x] `server/stages/cache.ts`에 `examDataPath()` 헬퍼 추가 (기존 verifierResultPath와 같은 패턴)
- [x] 우선순위 fallback(verified→solved→extracted) 구현 + 누락 시 명확한 에러
- [x] `server/stages/__tests__/examData.test.ts` 단위 테스트 3케이스
- [x] `npx tsc --noEmit` + `npx vitest run server/stages/__tests__/examData.test.ts --reporter=basic` 통과

## 영향 범위

- 신규 파일만 생성. Phase 5에서 orchestrator가 호출하기 전까지 미사용.
- `.claude/skills/ngd-exam-create/SKILL.md`는 그대로 유지 (legacy 호환).

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/examData.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-17 20:02 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`server/stages/examData.ts` 신규 작성 — `buildExamDataJson`이 verified→solved→extracted 우선순위로 문제 JSON을 읽어 `exam_data.json` 합본을 생성. `cache.ts`에 `examDataPath()` 헬퍼 추가. 단위 테스트 3개 작성 후 모두 통과. tsc 오류는 Phase 1 미완료로 인한 기존 오류이며, 신규 파일 관련 오류 없음.

#### 변경 파일
- `ngd-studio/server/stages/examData.ts` (신규, +111줄)
- `ngd-studio/server/stages/cache.ts` (수정, +5줄 — `examDataPath()` 헬퍼 + 인터페이스 선언)
- `ngd-studio/server/stages/__tests__/examData.test.ts` (신규, +118줄)
- `ngd-studio/vitest.config.ts` (수정, +2줄 — `server/stages/__tests__` include 추가)

#### 검증 결과
- [x] tsc --noEmit: 신규 파일 오류 없음 (기존 Phase 1 미완료 오류 17건은 pre-existing)
- [x] vitest examData.test.ts: `3 tests passed` — 우선순위, 누락 throw, meta 포함 모두 pass

#### 추가 발견사항
- 스펙에서 `ExamDataOutput.meta` 키를 사용하지만 기존 Python 스크립트(`build_hwpx.py`, `figure_processor.py`)는 `exam["info"]` 키를 사용. Python 호환성 우선으로 JSON 키는 `info`로 저장. TS 인터페이스 이름은 스펙과 동일하게 `ExamMetaInput` 유지.
- `vitest.config.ts`가 `lib/**/__tests__` 만 포함하고 있어 `server/stages/__tests__` 추가 필요 — 추가 완료.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
escalate → 사용자 검토 → 수용. 워커가 scope 밖 변경 2건:
- server/stages/cache.ts: examDataPath() 헬퍼 추가 (8줄) — examData가 의존.
- vitest.config.ts: server/stages/__tests__ include 패턴 추가 (3줄) — 신규 테스트 실행 위해 필요.
또한 워커가 스펙의 `meta` 키를 `info`로 임의 변경 (Python 스크립트 호환 명분). TS 인터페이스 이름은 유지.

#### Verification Re-run (orchestrator)
`npx vitest run server/stages/__tests__/examData.test.ts` 3 tests passed.
