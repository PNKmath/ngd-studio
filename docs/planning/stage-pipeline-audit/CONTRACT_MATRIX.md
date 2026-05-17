# Stage Contract 4-Way 매트릭스

> 생성일: 2026-05-18
> 목적: extractor / solver / verifier 각 stage의 프롬프트 schema · validator · TS output 타입 · 테스트 fixture 4-way 대조.
> Phase 2/3의 진실 소스. 코드 변경은 이 문서의 "채택" 결정을 따른다.
>
> **⚠️ 불일치 총합: extractor 4건, solver 6건, verifier 5건 → 총 15건**

---

## 1. Extractor

**진실 소스(현재 사용)**: `server/stages/extractor.ts` + `server/stages/prompts/extractorPrompt.ts:23-142`

### 1-A. 필드 매트릭스

| 필드 | 프롬프트 schema (`extractorPrompt.ts:111-138`) | validator (`extractor.ts:121-211`) | TS output 타입 (`extractor.ts:24-31`) | 테스트 fixture (`__tests__/fixtures/extracted/q0{1,2,3}.json`) | 일치? |
|------|----------------------------------------------|------------------------------------|-----------------------------------------|---------------------------------------------------------------|-------|
| `number` | required int | **없음** | **없음** (`[key: string]: unknown`으로 통과) | 없음 | ⚠️ 프롬프트엔 있는데 TS 타입·validator에 없음 |
| `type` | `"choice"` \| `"essay"` required | **없음** | `[key: string]: unknown`으로 통과 | 없음 | ⚠️ 프롬프트엔 있는데 validator에 없음 |
| `score` | required string | **없음** | unknown | 없음 | ⚠️ 프롬프트엔 있는데 validator에 없음 |
| `difficulty` | `"하"/"중"/"상"/"킬"` required | **없음** | unknown | 없음 | ⚠️ 프롬프트엔 있는데 validator에 없음 |
| `subtopic` | required string (unit_classification.json값) | **없음** | unknown | 없음 | ⚠️ 프롬프트엔 있는데 validator에 없음 |
| `parts` | `[{"t":string}\|{"eq":string}]` required | **없음** | `[key: string]: unknown`으로 통과 | 없음 (`question` 필드만 있음) | ⚠️ validator 부재 |
| `choices` | `[[{"t"}\|{"eq"}] \| null]` required | 3-5 items (`extractor.ts:179-187`) | `string[]?` ← **타입 wrong** | `string[]` (fixture는 `"① 1"` 같은 flattened string 형식) | ⚠️ TS 타입 wrong (객체 배열인데 `string[]` 선언) |
| `condition_box` | object \| null required | **없음** | unknown | 없음 (`null` 기대) | ⚠️ validator 부재 |
| `bogi_box` | `null` (항상) | **없음** | unknown | 없음 | ⚠️ 문서화 필요 |
| `data_table` | object \| null required | **없음** | unknown | 없음 (`null` 기대) | ⚠️ validator 부재 |
| `has_figure` | required boolean | required boolean (`extractor.ts:136-138`) | `has_figure: boolean` required | ✅ 포함 | ✅ |
| `figure_info` | object \| null | object when `has_figure` (`extractor.ts:141-176`) | `ExtractorFigureInfo \| null` | ✅ 포함 | ✅ |
| `answer` | **"정답(answer) 필드는 추출하지 않는다"** (`extractorPrompt.ts:139`) | optional — 있으면 string/number (`extractor.ts:129-133`) | `answer?: string \| number` | ✅ 포함 (fixture에 `"①"` 값 있음) | ✅ (fix됨, 40fa1f2) |
| `question` | **없음** (parts 배열만 정의됨) | optional — 있으면 non-empty string (`extractor.ts:190-193`) | `question?: string` | ✅ 포함 (fixture에 있음) | ✅ (fix됨, e642792) |

### 1-B. 불일치 요약

- ⚠️ **4건**: `number`/`type`/`score`/`difficulty`/`subtopic` — 프롬프트에 required인데 validator 없음 (phase spec의 5필드, 카운팅은 4 그룹)
- ⚠️ **1건**: `choices` — TS 타입 `string[]` vs 프롬프트 schema 객체 배열 `[{t}|{eq}]`
- ⚠️ **1건**: `parts`/`condition_box`/`data_table` — 프롬프트에 핵심 구조이나 validator에 전혀 없음
- ✅ **2건 fix됨**: `answer`, `question` (40fa1f2, e642792)

→ **처리 Phase**: Phase 3 (`phase-03-extractor-validator-sweep.md`)

---

## 2. Solver

**두 개의 prompt builder 공존 — 현재 사용은 legacy 영문**

| builder | 파일 | 함수 | 출력 형식 | 호출자 |
|---------|------|------|-----------|--------|
| **legacy 영문** (현재 실제 사용) | `server/stages/solver.ts:102-111` | `buildSolverPrompt` | 단일 string | `solver.ts:46` (`runSolverStage` 내부 직접 호출) |
| **NGD 한국어** (미사용 — dead code) | `server/stages/prompts/solverPrompt.ts:69-94` | `buildSolverPrompt` | `{system, user}` | `prompts/index.ts`로 export만 됨, `solver.ts`에서 **import 없음** |
| legacy string wrapper | `server/stages/prompts/solverPrompt.ts:100-109` | `buildSolverPromptString` | 단일 string | 테스트만 (`prompts.test.ts:3`) |

### 2-A. 필드 매트릭스

| 필드 | legacy prompt schema (`solver.ts:104-105`) | NGD prompt schema (`solverPrompt.ts:56-63`) | validator (`solver.ts:113-169`) | TS output 타입 (`solver.ts:32-36`) | 테스트 fixture (`fixtures/solved/q0{1,2,3}.json`) |
|------|---------------------------------------------|----------------------------------------------|----------------------------------|------------------------------------|---------------------------------------------------|
| `answer` | required string | required string (`"answer"`) | required non-empty string (`solver.ts:122-124`) | `answer: string` | ✅ 포함 (`"①"`, `"③"`, `"4"`) |
| `explanation` | required `[{kind:"text"\|"equation", content:string}]` | **이름 다름**: `explanation_parts:[{t}\|{eq}\|{br}]` | required non-empty array of `{kind,content}` (`solver.ts:125-151`) | `SolverExplanationSegment[]` (`kind`, `content`) | ✅ 포함 (`{kind, content}` 형식) |
| `verifierContext` | optional object | **없음** | optional object (`solver.ts:153-158`) | `verifierContext?: Record<string,unknown>` | 없음 (fixture에 없음) |
| `number` | **없음** | required int | **없음** | **없음** | 없음 |
| `explanation_parts` | **없음** | 핵심 필드 | **없음** | **없음** | 없음 |
| `{t}/{eq}/{br}` segments | **없음** | `{t:string}`, `{eq:string}`, `{br:true}` | **없음** | **없음** | 없음 (fixture은 `{kind,content}` 형식) |

### 2-B. 불일치 요약

- ⚠️ **1건**: explanation 필드명 불일치 — legacy `explanation[].{kind,content}` vs NGD `explanation_parts[].{t|eq|br}`
- ⚠️ **1건**: `verifierContext` — legacy에만 존재, NGD schema에 없음
- ⚠️ **1건**: `number` — NGD prompt에 required인데 validator·TS 타입에 없음
- ⚠️ **1건**: NGD prompt의 `{t}/{eq}/{br}` segment 형식을 validator가 전혀 모름 (legacy `{kind,content}` 검증 중)
- ⚠️ **1건**: `solver.ts`가 `prompts/solverPrompt.ts`를 import하지 않음 — NGD prompt는 dead code
- ⚠️ **1건**: 테스트 fixture가 legacy schema 형식 (`{kind,content}`) — NGD 채택 시 fixture 업데이트 필요

→ **처리 Phase**: Phase 2 (`phase-02-solver-verifier-prompts.md`) — NGD-rich로 통합, legacy 제거

---

## 3. Verifier

**두 개의 prompt builder 공존 — 현재 사용은 legacy 영문**

| builder | 파일 | 함수 | 출력 형식 | 호출자 |
|---------|------|------|-----------|--------|
| **legacy 영문** (현재 실제 사용) | `server/stages/verifier.ts:104-113` | `buildVerifierPrompt` | 단일 string | `verifier.ts:48` (`runVerifierStage` 내부 직접 호출) |
| **NGD 한국어** (미사용 — dead code) | `server/stages/prompts/verifierPrompt.ts:89-109` | `buildVerifierPrompt` | `{system, user}` | `prompts/index.ts`로 export만 됨, `verifier.ts`에서 **import 없음** |

### 3-A. 필드 매트릭스

| 필드 | legacy prompt schema (`verifier.ts:107`) | NGD prompt schema (`verifierPrompt.ts:65-84`) | validator (`verifier.ts:115-162`) | TS output 타입 (`verifier.ts:34-38`) | 테스트 fixture (`fixtures/verified/q0{1,2,3}.json`) |
|------|------------------------------------------|------------------------------------------------|------------------------------------|--------------------------------------|------------------------------------------------------|
| `status` | `"pass"\|"fail"` required | `"pass"\|"fail"` required | required enum check (`verifier.ts:121-123`) | `VerifierStatus` (`"pass"\|"fail"`) | ✅ 포함 (`"pass"`) |
| `issues` | `[{message, severity?, path?}]` | `[{category, description, location}]` — **구조 다름** | array of `{message, severity?, path?}` (`verifier.ts:124-148`) | `VerifierIssue[]` (`message, severity?, path?`) | ✅ 포함 (empty array) |
| `feedback` | optional string | required string (null when pass) | optional string (`verifier.ts:150-152`) | `feedback?: string` | ✅ 포함 (`null`) |
| `number` | **없음** | required int | **없음** | **없음** | 없음 |
| `issues[].category` | **없음** | required string | **없음** | **없음** | 없음 |
| `issues[].description` | **없음** | required string | **없음** | **없음** | 없음 |
| `issues[].location` | **없음** | required string | **없음** | **없음** | 없음 |
| `issues[].message` | required string | **없음** | required string | `message: string` | 없음 (empty issues) |
| `issues[].severity` | `"info"\|"warning"\|"error"` optional | **없음** | optional enum check | `VerifierIssueSeverity?` | 없음 |
| `issues[].path` | optional string | **없음** | optional string | `path?: string` | 없음 |

### 3-B. 불일치 요약

- ⚠️ **1건**: issues 객체 구조 — legacy `{message, severity?, path?}` vs NGD `{category, description, location}` — 완전 다른 schema
- ⚠️ **1건**: `number` — NGD prompt에 required인데 validator·TS 타입에 없음
- ⚠️ **1건**: `feedback` — NGD는 required (null when pass), legacy·validator는 optional
- ⚠️ **1건**: `verifier.ts`가 `prompts/verifierPrompt.ts`를 import하지 않음 — NGD prompt는 dead code
- ⚠️ **1건**: 테스트 fixture가 `{status, issues:[], feedback:null}` 형식 — NGD issues 구조와 무관하나, NGD 채택 시 `number` 필드 추가 필요

→ **처리 Phase**: Phase 2 (`phase-02-solver-verifier-prompts.md`) — NGD-rich로 통합, legacy 제거

---

## 4. 결론

### 채택 schema 결정

| Stage | 채택 prompt | 근거 | 처리 Phase |
|-------|------------|------|-----------|
| extractor | **NGD 한국어** (`extractorPrompt.ts`) — 이미 사용 중 | 현재 실제 사용, 가장 rich한 schema | Phase 3 (validator sweep) |
| solver | **NGD 한국어** (`solverPrompt.ts`) — 현재 dead code | `explanation_parts[{t/eq/br}]` 형식이 builder와 정합, 교과 컨텍스트 지원 | Phase 2 |
| verifier | **NGD 한국어** (`verifierPrompt.ts`) — 현재 dead code | `issues[{category, description, location}]` 형식이 더 구조화됨, category 기반 필터링 가능 | Phase 2 |

### Phase 2 작업 범위 (solver/verifier)

1. `solver.ts`: 내부 `buildSolverPrompt` 제거 → `prompts/solverPrompt.ts`의 `buildSolverPrompt` import하여 `{system, user}` 형식 사용
2. `solver.ts`: `SolverStageOutput.explanation` → `explanation_parts` 개명 + segment 타입 `{t}|{eq}|{br}` 로 변경
3. `solver.ts`: `validateSolverOutput` 업데이트 — NGD schema 검증 (`number` 추가, `explanation_parts[].t|eq|br`)
4. `verifier.ts`: 내부 `buildVerifierPrompt` 제거 → `prompts/verifierPrompt.ts` import
5. `verifier.ts`: `VerifierIssue` 타입 변경 — `{category, description, location}` 구조
6. `verifier.ts`: `validateVerifierOutput` 업데이트 — NGD schema 검증 (`number` 추가, issues 새 구조)
7. 테스트 fixture (`fixtures/solved/`, `fixtures/verified/`) — NGD schema로 업데이트
8. `prompts/solverPrompt.ts`: `buildSolverPromptString` (legacy wrapper) 제거 또는 deprecated 표기

### Phase 3 작업 범위 (extractor)

1. `extractor.ts`: `validateExtractorOutput`에 `number`, `type`, `score`, `difficulty`, `subtopic` 검증 추가
2. `extractor.ts`: `choices` — TS 타입 `string[]` → `Array<Array<{t:string}|{eq:string}>>` 수정
3. `extractor.ts`: `parts` 필드 검증 추가 (required array)
4. `extractor.ts`: `condition_box`, `data_table` 검증 추가 (present or null)
5. 테스트 fixture (`fixtures/extracted/`) — NGD full schema로 업데이트 (`parts` 필드 포함)

### 코드 참조 인덱스

| 심볼 | 파일 | 라인 |
|------|------|------|
| `ExtractorStageOutput` 인터페이스 | `server/stages/extractor.ts` | 24-31 |
| `validateExtractorOutput` 함수 | `server/stages/extractor.ts` | 121-211 |
| `buildExtractorPrompt` (NGD, 사용 중) | `server/stages/prompts/extractorPrompt.ts` | 144-175 |
| `EXTRACTOR_SYSTEM` (프롬프트 body) | `server/stages/prompts/extractorPrompt.ts` | 23-142 |
| extractor 출력 JSON 형식 | `server/stages/prompts/extractorPrompt.ts` | 111-138 |
| `SolverStageOutput` 인터페이스 | `server/stages/solver.ts` | 32-36 |
| `buildSolverPrompt` (legacy 영문, 현재 사용) | `server/stages/solver.ts` | 102-111 |
| `validateSolverOutput` 함수 | `server/stages/solver.ts` | 113-169 |
| `buildSolverPrompt` (NGD 한국어, dead code) | `server/stages/prompts/solverPrompt.ts` | 69-94 |
| `buildSolverPromptString` (legacy wrapper) | `server/stages/prompts/solverPrompt.ts` | 100-109 |
| solver 출력 JSON 형식 (NGD) | `server/stages/prompts/solverPrompt.ts` | 56-63 |
| `VerifierStageOutput` 인터페이스 | `server/stages/verifier.ts` | 34-38 |
| `buildVerifierPrompt` (legacy 영문, 현재 사용) | `server/stages/verifier.ts` | 104-113 |
| `validateVerifierOutput` 함수 | `server/stages/verifier.ts` | 115-162 |
| `buildVerifierPrompt` (NGD 한국어, dead code) | `server/stages/prompts/verifierPrompt.ts` | 89-109 |
| verifier 출력 JSON 형식 pass/fail (NGD) | `server/stages/prompts/verifierPrompt.ts` | 65-84 |
| `VerifierIssue` 인터페이스 | `server/stages/verifier.ts` | 18-22 |
| prompts/index.ts (re-export) | `server/stages/prompts/index.ts` | 1-15 |
| orchestrator solver 호출 | `server/stages/orchestrator.ts` | 477 |
| orchestrator verifier 호출 | `server/stages/orchestrator.ts` | 575 |
| extracted fixture q01 | `server/stages/__tests__/fixtures/extracted/q01.json` | — |
| solved fixture q01 | `server/stages/__tests__/fixtures/solved/q01.json` | — |
| verified fixture q01 | `server/stages/__tests__/fixtures/verified/q01.json` | — |
