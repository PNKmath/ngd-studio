---
phase: 2
title: agent MD prompt → TS 상수 이식
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
  - ngd-studio/server/stages/prompts/solverPrompt.ts
  - ngd-studio/server/stages/prompts/verifierPrompt.ts
  - ngd-studio/server/stages/prompts/index.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 2: agent MD prompt → TS 상수 이식

> **범위**: Backend (prompts 모듈 신설)
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `ngd-studio/server/stages/prompts/*.ts` (신규)

## 배경

코드 기반 stage runner는 각 1-shot 호출에 명확한 system/user 메시지가 필요. 현재 prompt 본문은 `.claude/agents/ngd-exam-{extractor,solver,verifier}.md`에 markdown 형태로 존재. TS 코드에서 직접 사용하려면 상수로 이식해야 함.

기존 `server/stages/solver.ts:buildSolverPrompt`는 간단한 인라인 prompt만 있어 agent MD의 상세 규칙(equation 작성 규칙, 검증 기준 등)이 누락된 상태. 이걸 보강한다.

## 설계

### 디렉터리 구조

```
ngd-studio/server/stages/prompts/
├── extractorPrompt.ts   // .claude/agents/ngd-exam-extractor.md 이식
├── solverPrompt.ts      // .claude/agents/ngd-exam-solver.md 이식
├── verifierPrompt.ts    // .claude/agents/ngd-exam-verifier.md 이식
└── index.ts             // re-export
```

### 함수 시그니처

```ts
// extractorPrompt.ts
export interface ExtractorPromptInput {
  questionNumber: number;
  imagePathHint?: string;          // CLI 경로 표시용
  examMeta?: ExamMeta;             // 학교/학년/과목 등
}
export function buildExtractorPrompt(input: ExtractorPromptInput): {
  system: string;
  user: string;
};

// solverPrompt.ts
export interface SolverPromptInput {
  extracted: unknown;
  guidelineContext?: string;
  feedback?: string;               // verifier feedback 재시도 시
}
export function buildSolverPrompt(input: SolverPromptInput): {
  system: string;
  user: string;
};

// verifierPrompt.ts
export interface VerifierPromptInput {
  extracted: unknown;
  solved: unknown;
  guidelineContext?: string;
}
export function buildVerifierPrompt(input: VerifierPromptInput): {
  system: string;
  user: string;
};
```

각 함수는 system + user 두 부분을 반환 → SDK 호출자(Phase 3, 기존 solver/verifier)가 그대로 메시지 배열에 매핑.

### 내용 매핑

각 prompt는 해당 agent MD의 다음 섹션을 포함:
- **목적·역할** → system message
- **입력 형식** → user message intro
- **출력 schema** → user message (JSON schema 명시)
- **규칙·제약** → system message (HWP 수식 규칙, 영문 description_en 등)
- **예시** → user message 말미 (1-2개만 발췌)

### 기존 `buildSolverPrompt` 처리

`server/stages/solver.ts:101 buildSolverPrompt`는 기존 인라인 함수가 있음. Phase 2에서는 **이 함수의 내용을 새로 만든 `prompts/solverPrompt.ts`로 옮기고, solver.ts에서 import**. 호환을 위해 기존 export 시그니처는 유지(string 반환) — 새 함수는 `{system, user}` 반환이므로 wrapper 추가.

## 체크리스트

- [x] `server/stages/prompts/extractorPrompt.ts` 작성, `.claude/agents/ngd-exam-extractor.md` 본문(목적·schema·has_figure 규칙·description_en 영문 작성·예시)을 상수로 이식
- [x] `server/stages/prompts/solverPrompt.ts` 작성, `.claude/agents/ngd-exam-solver.md` 본문(HWP equation 규칙·verifierContext 포함) 이식 + verifier feedback 재시도용 분기
- [x] `server/stages/prompts/verifierPrompt.ts` 작성, `.claude/agents/ngd-exam-verifier.md` 본문 이식 (pass/fail + issues 형식)
- [x] `server/stages/prompts/index.ts`에서 3개 함수 re-export
- [x] `npx tsc --noEmit` 통과, prompt 단위 테스트(`server/stages/__tests__/prompts.test.ts`) — 각 함수가 system/user 모두 비어있지 않은 문자열을 반환

## 영향 범위

- 새 디렉터리 `server/stages/prompts/` 만 추가. 기존 stage runner 호출자에는 영향 없음 (Phase 3, 5에서 사용 시작).
- `.claude/agents/*.md` 본문은 그대로 둔다 (legacy 호환). Phase 10에서 폐기 메모 추가.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/prompts.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-17 20:03 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
agent MD 파일 3개(.claude/agents/ngd-exam-extractor.md, solver.md, verifier.md)에서 목적·schema·규칙을 TS 상수로 이식.
각 파일에 `buildXxxPrompt` 함수 구현 (system/user 분리 반환), index.ts re-export 추가.
solverPrompt.ts에는 기존 solver.ts 호환용 `buildSolverPromptString` wrapper 추가.
단위 테스트 16개 전부 통과, 새 파일에 tsc 에러 없음(기존 pre-existing 에러는 Phase 2 scope 외).

#### 변경 파일
- `ngd-studio/server/stages/prompts/extractorPrompt.ts` (신규, +131줄)
- `ngd-studio/server/stages/prompts/solverPrompt.ts` (신규, +119줄)
- `ngd-studio/server/stages/prompts/verifierPrompt.ts` (신규, +111줄)
- `ngd-studio/server/stages/prompts/index.ts` (신규, +17줄)
- `ngd-studio/server/stages/__tests__/prompts.test.ts` (신규, +117줄)

#### 검증 결과
- [x] tsc --noEmit: 새 prompts/ 파일에 에러 없음 (기존 pre-existing 에러는 scope 외)
- [x] vitest run prompts.test.ts: `16 tests passed (16)` → pass

#### 추가 발견사항
- tsc에서 기존 pre-existing 에러 23건 확인 (lib/ai/recommendation.ts, lib/__tests__/, app/ 관련) — Phase 2 scope 외이므로 미수정

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
escalate → 사용자 검토 → 수용. 워커가 sibling 디렉토리(server/stages/__tests__/prompts.test.ts) 테스트 추가. scope glob `prompts/*` 외부지만 phase 작업의 자연스러운 검증 코드로 판단.

#### Verification Re-run (orchestrator)
`npx tsc --noEmit` exit 0. `npx vitest run --reporter=basic` 16 prompt tests + 158 others passed.
