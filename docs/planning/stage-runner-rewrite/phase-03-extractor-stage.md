---
phase: 3
title: extractor stage 신규 (vision 1-shot)
status: pending
depends_on: [1, 2]
scope:
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/extractor.test.ts
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

- [ ] `server/stages/extractor.ts` 신규 작성, `runExtractorStage` export
- [ ] `validateExtractorOutput` 구현 (agent MD schema 기반)
- [ ] `server/stages/cache.ts:extractorResultPath` 헬퍼 추가
- [ ] mock provider 단위 테스트 5케이스 작성 (정상, JSON invalid, exit !=0, description_en 한글, imagePaths 전달)
- [ ] provider.run options에 `imagePaths`가 전달되는지 확인 (Phase 1 의존)
- [ ] `runExtractorStage`가 ModelStageResult 패턴 준수 (solver.ts와 동일 구조)
- [ ] `npx tsc --noEmit` + `npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic` 통과

## 영향 범위

- 신규 파일만 생성. 기존 stage runner와 격리.
- Phase 5(orchestrator)에서 호출 시작 전까지 dead 상태로 머무름.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic
```
