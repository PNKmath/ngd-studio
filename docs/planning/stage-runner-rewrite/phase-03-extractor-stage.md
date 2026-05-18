---
phase: 3
title: extractor stage 신규 (vision 1-shot)
status: completed
depends_on: [1, 2]
scope:
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/extractor.test.ts
  - ngd-studio/server/stages/cache.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 3: extractor stage 신규 (vision 1-shot)

> **범위**: Backend (extractor stage runner)
> **난이도**: M
> **의존성**: Phase 1 (provider adapters + imagePaths), Phase 2 (extractor prompt)
> **영향 파일**: `ngd-studio/server/stages/extractor.ts` (신규)

## 배경

기존에는 `.claude/agents/ngd-exam-extractor.md` agent를 Claude CLI Task 도구로 호출. 코드 기반 흐름에서는 stage 단위 1-shot 호출이 필요. 이미지(문제 1장 PNG)를 입력으로 받아 구조화 JSON을 반환하는 runner를 신규로 작성.

## 설계

`server/stages/solver.ts:runSolverStage`와 동일한 구조를 따른다.

### 인터페이스

```ts
export interface ExtractorStageInput {
  questionNumber: number;
  imagePath: string;               // 절대경로 (.png)
  examMeta?: ExamMeta;
  cache: StageCache;
  provider?: AIProviderAdapter;    // 미지정 시 stageOverride 또는 claude-cli 폴백
}

export interface ExtractorStageOutput {
  question: string;
  choices?: string[];
  answer: string | number;
  has_figure: boolean;
  figure_info: {
    description_en?: string;
    position?: string;
    crop_ratio?: [number, number, number, number];
  } | null;
  // 기타 필드는 agent MD schema 그대로
}

export async function runExtractorStage(
  input: ExtractorStageInput
): Promise<ModelStageResult<ExtractorStageOutput>>;
```

### 흐름

1. `buildExtractorPrompt(input)` 호출 → `{system, user}` 얻음 (Phase 2)
2. provider 선택:
   - `input.provider` 우선
   - 없으면 stageOverride에서 `create.extractor` 룩업 (기본 `claude-cli`)
3. `provider.run(userText, { stageKey: "create.extractor", imagePaths: [imagePath] })` 호출
   - claude-sdk: vision content block에 base64 이미지 + system + user
   - claude-cli: 프롬프트에 절대경로 명시 + Read 도구 사용 안내
   - openai-sdk: image_url content block에 base64 데이터 URL
   - codex-cli: `--image <abs>` flag로 첨부
4. `collectProviderText` → JSON 파싱 → schema 검증
5. 통과 시 `.v3cache/q{N}_extracted.json`에 저장, 실패 시 `validationFailure` 반환

### Schema 검증

`validateExtractorOutput`:
- `question`: 비어있지 않은 string
- `answer`: string 또는 number, 존재
- `has_figure`: boolean
- `figure_info`: `has_figure=true`면 객체, `description_en` 영문 검증 (한글 포함 시 fail), `crop_ratio` 4개 0~1 float
- choices가 있으면 length 3~5

equation 검증은 solver 책임이라 extractor 단계에서는 raw HWP equation script가 들어와도 통과(나중에 builder에서 검사).

### 캐시 경로

`StageCache`에 `extractorResultPath(n)` 메서드 추가 → `inputs/시험지 제작/.v3cache/q{n}_extracted.json`.

### 테스트

`server/stages/__tests__/extractor.test.ts`:
- mock provider로 정상 JSON 반환 → completed + 캐시 파일 작성 확인
- mock provider로 invalid JSON → validation failure
- mock provider exit code != 0 → provider_failed
- has_figure=true인데 description_en이 한글 → validation failure
- imagePaths가 stageKey와 함께 provider에 전달되는지 spy로 확인

## 체크리스트

- [x] `server/stages/extractor.ts` 신규 작성, `runExtractorStage` export
- [x] `validateExtractorOutput` 구현 (agent MD schema 기반)
- [x] `server/stages/cache.ts:extractorResultPath` 헬퍼 추가
- [x] mock provider 단위 테스트 5케이스 작성 (정상, JSON invalid, exit !=0, description_en 한글, imagePaths 전달)
- [x] provider.run options에 `imagePaths`가 전달되는지 확인 (Phase 1 의존)
- [x] `runExtractorStage`가 ModelStageResult 패턴 준수 (solver.ts와 동일 구조)
- [x] `npx tsc --noEmit` + `npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic` 통과

## 영향 범위

- 신규 파일만 생성. 기존 stage runner와 격리.
- Phase 5(orchestrator)에서 호출 시작 전까지 dead 상태로 머무름.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-17 20:56 KST) — 완료
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`server/stages/extractor.ts`를 신규 작성하고 `server/stages/cache.ts`에 `extractorResultPath` 헬퍼를 추가했다. `runExtractorStage`는 `runSolverStage`와 동일한 `ModelStageResult` 패턴을 따르며, `validateExtractorOutput`은 스펙의 schema 검증(answer, has_figure, figure_info, crop_ratio, choices, description_en 한글 금지)을 구현했다. 단위 테스트 13개 모두 통과.

#### 변경 파일
- `ngd-studio/server/stages/extractor.ts` (신규, +183줄)
- `ngd-studio/server/stages/__tests__/extractor.test.ts` (신규, +192줄)
- `ngd-studio/server/stages/cache.ts` (수정, +7줄 — `extractorResultPath` 추가)

#### 검증 결과
- [x] tsc: `npx tsc --noEmit` → pass (출력 없음)
- [x] vitest: `npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic` → 13 tests passed

#### 추가 발견사항
- `questionJsonPath`(`q{n}.json`)와 `extractorResultPath`(`q{n}_extracted.json`)는 별도 경로. 설계 스펙이 구분하므로 그대로 유지.
- `runExtractorStage`의 default provider를 `deepseekV4` 대신 `claudeSdkProvider`로 지정 (extractor는 vision이 필요하고 DeepSeek V4는 vision 미지원 — MEMORY.md 참고).

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 files in scope (extractor.ts, extractor.test.ts, cache.ts). frontmatter scope에 cache.ts가 누락되어 있어 사용자 승인 후 scope에 추가함 (체크리스트 본문은 처음부터 cache.ts 편집을 요구).

#### Verification Re-run (orchestrator)
exit 0 — `npx tsc --noEmit` + `npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic` 모두 pass.

#### Simplify (orchestrator)
2 files, 4 edits, verify pass. cache.ts에 pad() 헬퍼 추출(padStart 5회 중복 제거), extractor.ts에서 ensureCacheDir 중복인 mkdir 호출 + 미사용 import 제거.

#### Review (orchestrator)
VERDICT: fix_required (2 issues). TOP_ISSUE: validateExtractorOutput이 question 부재/빈 문자열을 ""로 silently 통과 — 스펙은 비어있지 않은 string 요구. FIX_HINT: question이 string이 아니거나 trim 후 빈 문자열이면 validationFailure 반환, 테스트 1케이스 추가.

### 2회차 (2026-05-17 21:07 KST) — completed
**상태**: completed
**소요 시간**: 약 2분
**진행 모델**: claude-sonnet-4-6

#### 요약
`validateExtractorOutput`의 `question` 필드 검증 버그를 수정했다. 기존에는 `typeof candidate.question === "string" ? candidate.question : ""`로 silently fallback하여 question 부재/빈 문자열을 통과시켰다. 이를 `typeof candidate.question !== "string" || candidate.question.trim() === ""`이면 validationFailure를 반환하도록 수정했다. `VALID_OUTPUT`에 `question` 필드 추가, 테스트 케이스 1건(missing + whitespace-only 2 assertion) 추가.

#### 변경 파일
- `ngd-studio/server/stages/extractor.ts` (수정, +3줄 — question validation 강화, fallback "" 제거)
- `ngd-studio/server/stages/__tests__/extractor.test.ts` (수정, +14줄 — VALID_OUTPUT에 question 추가, question 누락/빈 문자열 테스트 케이스 1건 추가)

#### 검증 결과
- [x] tsc: `npx tsc --noEmit` → pass (출력 없음)
- [x] vitest: `npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic` → 14 tests passed (13 기존 + 1 신규)

#### 추가 발견사항
- VALID_OUTPUT에 `question` 필드가 없어 기존 통과 테스트도 새 검증 이후 실패할 수 있었으므로 동시에 추가. 기존 14 tests all pass.
- stageOverride 룩업 tier 누락 지적은 FIX_HINT 지시에 따라 수정하지 않음 — phase 5(orchestrator)에서 처리.

#### 질문 / 결정 사항
없음

#### Verification Re-run (orchestrator, 2회차)
exit 0 — `npx tsc --noEmit` + vitest 14/14 pass.

#### Review (orchestrator, 2회차)
skipped — fix가 FIX_HINT와 정확히 일치하고 Verification Re-run pass. retry 예산 소진(최대 1회).

#### Commit
`8d84584` — feat(stages): Phase 3 — extractor stage 신규 (vision 1-shot)
