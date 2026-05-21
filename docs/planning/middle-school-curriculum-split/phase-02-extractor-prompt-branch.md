---
phase: 2
title: 모델 프롬프트 학교급 분기 (extractor + solver + verifier)
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
  - ngd-studio/server/stages/prompts/solverPrompt.ts
  - ngd-studio/server/stages/prompts/verifierPrompt.ts
  - ngd-studio/server/stages/__tests__/prompts.test.ts
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/solver.ts
  - ngd-studio/server/stages/verifier.ts
  - ngd-studio/server/stages/orchestrator.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "extractorPrompt.ts 의 ## 중단원 분류 규칙 + JSON 예시 학교급 분기 (subtopic 매핑의 핵심 fix). solver/verifier 프롬프트는 학교급 context 1 줄 추가만 → 모델 톤·기법 안내."
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 2: 모델 프롬프트 학교급 분기 (extractor + solver + verifier)

> **범위**: Backend (3 개 prompt builder + 3 개 stage runner + orchestrator + tests)
> **난이도**: M
> **의존성**: Phase 1 (`unit_classification_middle.json` 존재 전제)
> **영향 파일**: `prompts/extractorPrompt.ts`, `prompts/solverPrompt.ts`, `prompts/verifierPrompt.ts`, `extractor.ts`, `solver.ts`, `verifier.ts`, `orchestrator.ts`, `__tests__/prompts.test.ts`

## 배경

### extractor

현 `extractorPrompt.ts:96-99, 117-118` 가 `unit_classification.json` (고등) 을 하드코딩으로 가리킴. Phase A 가 시험정보 블록에 `학교급: 중학교/고등학교` 라인은 추가했지만, 정작 단원표는 항상 고등을 보라고 안내함.

### solver / verifier (★Phase A 이후 발견된 비대칭★)

`extractorPrompt` 는 `ExamMeta` interface 보유 + `examMeta` 입력 받음. 반면 `solverPrompt.ts` / `verifierPrompt.ts` 는 examMeta 자체를 **받지 않음** — 같은 grep 으로 확인. 결과:
- solver 가 중학교 수준 문제를 풀 때도 "이게 중학교 문제다" 모름 → 고등 수준 표기·기법 (예: 미분 사용) 으로 풀이 생성 위험
- verifier 도 동일 — 풀이 검증 기준이 어긋날 수 있음

전체 파이프라인 parity 를 위해 두 prompt 도 examMeta (특히 schoolLevel) 를 받도록 동일 패턴으로 확장.

## 설계

### 1. extractor prompt 시스템 분기

```ts
// extractorPrompt.ts
function buildExtractorSystemPrompt(schoolLevel?: "중" | "고"): string {
  const classificationFile = schoolLevel === "중"
    ? "unit_classification_middle.json"
    : "unit_classification.json";
  const classificationDesc = schoolLevel === "중"
    ? "중학교 2022 개정교육과정 단원표"
    : "고등 2015 개정교육과정 단원표";
  return EXTRACTOR_SYSTEM_TEMPLATE
    .replace(/{{CLASSIFICATION_FILE}}/g, classificationFile)
    .replace(/{{CLASSIFICATION_DESC}}/g, classificationDesc);
}
```

`EXTRACTOR_SYSTEM_TEMPLATE` 은 기존 `EXTRACTOR_SYSTEM` 의 `unit_classification.json` 토큰 (2 곳) → `{{CLASSIFICATION_FILE}}`, 분류 규칙 섹션 첫 줄에 `({{CLASSIFICATION_DESC}})` 부연 추가.

`buildExtractorPrompt` 시그니처는 그대로 (`input.examMeta?.schoolLevel` 가 이미 있음). 내부에서 helper 호출만.

### 2. solver/verifier 가 examMeta 받도록 인터페이스 확장

```ts
// solverPrompt.ts (가설 — 실제 구조는 worker 가 확인)
export interface SolverPromptInput {
  ...기존 필드...
  examMeta?: ExamMeta;  // 신규
}
```

prompt builder 가 `examMeta.schoolLevel` 을 받아 system prompt 에 한 줄 추가:

- schoolLevel === "중" → `"이 문제는 중학교 수준입니다. 중학교 수준에 맞는 풀이 (예: 인수분해, 일차/이차방정식 등 사용; 미적분·삼각함수 사용 자제) 로 작성하세요."`
- schoolLevel === "고" → 기존 동작 (추가 안내 없음, 또는 `"이 문제는 고등학교 수준입니다."` 1 줄)

verifier 도 동일 패턴 — schoolLevel 안내 1 줄 + "중학교 풀이는 중학교 범위 안에서만 검증" 1 줄.

### 3. stage runner 가 examMeta 전달

```ts
// solver.ts (가설)
export interface SolverStageInput {
  ...
  examMeta?: ExamMeta;
}
```

orchestrator 의 `runSolverStage` / `runVerifierStage` 호출에 `examMeta: input.meta` 추가 (extractor 와 동일 패턴 — orchestrator.ts:300 에서 이미 적용된 형태).

### 4. ExamMeta 타입 공유

`extractorPrompt.ts:8-16` 의 `ExamMeta` 를 별도 모듈로 빼거나 (best) 또는 prompts/types.ts 등 공통 위치. 또는 `import type { ExamMeta } from "./extractorPrompt"` 로 재사용 (간단). worker 가 코드 구조 보고 결정.

## 체크리스트

- [x] `extractorPrompt.ts` 의 `EXTRACTOR_SYSTEM` → template + helper 로 schoolLevel 분기 (분류 파일명·설명)
- [x] `solverPrompt.ts` 가 `examMeta?: ExamMeta` 받도록 인터페이스 확장 + system prompt 에 schoolLevel 안내 1-2 줄 추가
- [x] `verifierPrompt.ts` 가 `examMeta?: ExamMeta` 받도록 동일 확장
- [x] `solver.ts` / `verifier.ts` 의 stage input 에 `examMeta?` 추가, orchestrator 호출부에서 `examMeta: input.meta` 전달
- [x] `prompts.test.ts` 에 신규 케이스 4 개:
  - (a) extractor schoolLevel='중' → system 에 `unit_classification_middle.json` 포함 + 고등 파일명 미포함
  - (b) extractor schoolLevel='고' / 미지정 → 기존 `unit_classification.json` 포함
  - (c) solver schoolLevel='중' → system 에 중학교 수준 안내 포함
  - (d) verifier schoolLevel='중' → system 에 중학교 검증 안내 포함
- [x] `pnpm --filter ngd-studio exec tsc --noEmit` + 관련 vitest 통과

## 영향 범위

- **회귀 표면**:
  - 기존 고등 호출에서 system prompt 문구가 미세하게 바뀜 (한두 줄 추가). 기존 prompts.test 의 examMeta 필드 포함 테스트는 깨지지 않을 것.
  - solver/verifier 의 interface 가 optional `examMeta` 추가이므로 기존 호출자 변화 없으면 build 통과.
- **롤백**: 8 파일 영향 — phase revert 단순.

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run server/stages/__tests__/prompts.test.ts server/stages/__tests__/{solver,verifier,extractor}.test.ts server/stages/__tests__/orchestrator.test.ts --reporter=basic
```

수동 확인:
1. `buildExtractorPrompt({ examMeta:{ schoolLevel:"중" } }).system` 에 `unit_classification_middle.json` 포함
2. `buildSolverPrompt({ examMeta:{ schoolLevel:"중" } }).system` 에 "중학교" 키워드 포함
3. `buildVerifierPrompt({ examMeta:{ schoolLevel:"중" } }).system` 에 "중학교" 키워드 포함

## 실행 결과

### 1회차 (2026-05-21 12:00 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`extractorPrompt.ts`의 `EXTRACTOR_SYSTEM` 상수를 `EXTRACTOR_SYSTEM_TEMPLATE`으로 전환하고 `{{CLASSIFICATION_FILE}}`/`{{CLASSIFICATION_DESC}}` 플레이스홀더를 삽입, `buildExtractorSystemPrompt()` 헬퍼 함수로 schoolLevel 분기를 구현하였다. `solverPrompt.ts` / `verifierPrompt.ts` 각각에 `examMeta?: ExamMeta` 인터페이스 필드와 schoolLevel별 system prompt 안내 1줄 추가 헬퍼를 추가했다. `solver.ts` / `verifier.ts` stage input에 `examMeta?` 추가 후 `orchestrator.ts`의 solver(초기 + 재시도) · verifier 호출부에 `examMeta: input.meta`를 전달했다 (checker 호출부 미변경). `prompts.test.ts`에 schoolLevel 분기 4개 케이스를 추가하였으며 전체 111개 테스트가 통과한다.

#### 변경 파일
- `ngd-studio/server/stages/prompts/extractorPrompt.ts` (수정, +12/-3줄)
- `ngd-studio/server/stages/prompts/solverPrompt.ts` (수정, +14/-1줄)
- `ngd-studio/server/stages/prompts/verifierPrompt.ts` (수정, +14/-1줄)
- `ngd-studio/server/stages/solver.ts` (수정, +4/-1줄)
- `ngd-studio/server/stages/verifier.ts` (수정, +4/-1줄)
- `ngd-studio/server/stages/orchestrator.ts` (수정, +3/-0줄)
- `ngd-studio/server/stages/__tests__/prompts.test.ts` (수정, +39/-0줄)

#### 검증 결과
- [x] tsc --noEmit: `unset NODE_OPTIONS && npx tsc --noEmit` → pass (출력 없음)
- [x] vitest: `npx vitest run ... --reporter=basic` → 5 파일 111 테스트 all pass

#### 추가 발견사항
- `pnpm --filter ngd-studio exec tsc --noEmit`는 `NODE_OPTIONS` preload 모듈 오류로 직접 실행 불가 (CI 환경에서도 동일할 수 있음). `unset NODE_OPTIONS` 후 `npx tsc --noEmit`으로 동등하게 검증. 보고만 함.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 8 files in scope (extractorPrompt/solverPrompt/verifierPrompt.ts, solver.ts, verifier.ts, orchestrator.ts, prompts.test.ts, PHASE_FILE). unattributed 없음, Phase 3 영역(checker.ts) 미접촉.

#### Verification Re-run (orchestrator)
exit 0 — `env -u NODE_OPTIONS`: tsc pass, vitest 5파일 111/111 pass.

#### Simplify (orchestrator)
SIMPLIFIED: 2 — solver.ts/verifier.ts 중복 타입 캐스트를 단일 const + 구조 분해로 통합. VERIFY: pass. orchestrator label 삼항 통합은 새 추상화라 skip.

#### Review (orchestrator)
VERDICT: pass — 스펙 정확 구현 (헬퍼 + 플레이스홀더 + examMeta 전달), 회귀 위험 없음 (모두 optional). extractor.ts는 미변경 (이미 필드 보유 — 변경 불필요).
