---
phase: 5
title: DeepSeek stage-by-stage 오케스트레이션
status: completed
depends_on: [4]
scope:
  - ngd-studio/server/sse.ts
  - ngd-studio/server/stages/orchestrator.ts (신규)
  - ngd-studio/server/stages/extractor.ts (신규)
  - ngd-studio/server/stages/solver.ts (기존 — 호출 연결)
  - ngd-studio/server/stages/verifier.ts (기존 — 호출 연결)
  - ngd-studio/server/stages/builder.ts (기존)
  - ngd-studio/server/stages/checker.ts (기존)
  - ngd-studio/lib/ai/providers/deepseekV4.ts (이미지 입력 지원 확인)
  - ngd-studio/lib/prompts.ts (per-stage 프롬프트)
intervention_likely: true
intervention_reason: "DeepSeek V4 API의 vision 지원 여부, figure 단계 트리거, 캐시/telemetry 전략 등 사용자 결정 필요"
---

# Phase 5: DeepSeek stage-by-stage 오케스트레이션

> **⚠ 흡수 알림 (2026-05-17)**
> 본 phase는 `docs/planning/stage-runner-rewrite/` task로 흡수 완료되었습니다.
> 코드 기반 orchestrator 흐름은 거기서 구현·검증되었습니다. 본 문서는 초기 설계 기록용으로 보존.
> (stage-runner-rewrite로 흡수)

> **범위**: SSE 서버에 stage 단위 오케스트레이션 경로 추가. DeepSeek가 시험지 제작을 실제로 실행할 수 있게 함.
> **난이도**: L (대형, 4~8시간 예상)
> **의존성**: Phase 4 검증 완료

## 배경

현재 `/api/run`은 mode가 `create`/`resume`일 때 `runLegacyPromptJob`을 단일 호출하여 **하나의 prompt + 하나의 provider**로 작업 전체를 위임한다. prompt 내용은 `"Skill 도구로 'ngd-exam-create' 스킬을 호출해서 진행해"`이고, 이는 Claude CLI 전용 Skill 시스템에 의존한다.

DeepSeek V4 API(`/chat/completions`)는 Skill/Task 도구가 없으므로 위 prompt를 받으면 자연어로 "진행하겠습니다"만 반환하고 실제 extractor/solver/verifier/figure/builder/checker는 **하나도 실행되지 않는다**.

`server/stages/solver.ts`, `server/stages/verifier.ts`에는 stage 단위 runner가 이미 정의돼 있으나 어디서도 호출되지 않는 데드코드 상태다 (live 테스트 외).

## 목표

`create.extractor` stage override가 `deepseek-v4`로 지정되면 (또는 미래에 다른 provider도) sse 서버가 **stage-by-stage runner**를 호출해 실제 파이프라인을 실행한다. 결과적으로:

- 추출 (이미지 → JSON): provider 호출 + JSON 검증
- 해설 (extracted → solver result): `runSolverStage` 호출
- 검증 (extracted + solved → verifier result): `runVerifierStage` 호출 (verifier↔solver feedback 루프 최대 3회)
- 그림 처리: 기존 Python script(`figure_processor.py`) 트리거
- 조립: `runBuilderStage` 호출 (deterministic builder)
- 검수: `runCheckerStage` 호출 (deterministic checker)

각 stage는 SSE `stage`/`progress`/`question`/`log` 이벤트를 emit해 기존 PipelineView/QuestionResultPanel과 호환된다.

## 설계

### 0. 분기 결정

`sse.ts`에서 mode + stageOverrides를 보고 분기:

```ts
const useStageOrchestrator =
  (mode === "create" || mode === "resume") &&
  AI_STAGE_KEYS.some((k) => k.startsWith("create.") && stageOverrides[k] === "deepseek-v4");

if (useStageOrchestrator) {
  await runStageOrchestrator({ ... });
} else if (deterministicBuilder) { ... }
else if (deterministicChecker) { ... }
else {
  await runLegacyPromptJob({ ... });  // 기존 Claude CLI 경로
}
```

### 1. 신규 `server/stages/orchestrator.ts`

```ts
export async function runStageOrchestrator(opts: {
  mode: "create" | "resume";
  resumeFrom?: string;
  meta: ExamMeta;
  questionImages: { number: number; path: string }[];
  stageOverrides: StageOverrideMap;
  baseDir: string;
  send: (event: SSEEvent) => void;
  isAborted: () => boolean;
}): Promise<OrchestratorResult>;
```

흐름:
1. `resumeFrom`에 따라 시작 stage 결정 (extractor / solver / verifier / figure / builder / checker)
2. extractor 단계
   - 각 문제 이미지를 병렬(또는 sequential) 호출
   - provider = `stageOverrides["create.extractor"]` (없으면 Claude CLI fallback)
   - `send(stageEvent("extractor", "running"))` + 문제별 `send(questionEvent(n, "extracted", json))`
   - 결과를 `.v3cache/q{N}_extracted.json`에 기록
3. solver 단계: `runSolverStage` 병렬 호출
4. verifier 단계: `runVerifierStage` 호출. verifier가 fail이면 solver 재호출(최대 3회).
5. figure 단계: 기존 figure_processor.py 또는 별도 모듈 호출. 백그라운드 + `figure_status.json` 폴링은 그대로.
6. builder: `runBuilderStage` 호출. 실패 시 legacy builder fallback.
7. checker: `runCheckerStage` 호출.

각 stage 시작/종료 시 `stageEvent`, 중간 진행률 `progressEvent`, 문제별 결과 `questionEvent`, 파일 생성 `fileEvent` emit.

### 2. extractor stage 신규 (`server/stages/extractor.ts`)

- 입력: 이미지 1장 + 시험 메타
- **확정 결론(2026-05-17): Option B 채택** — DeepSeek V4 public preview는 이미지 입력 미지원(공식 문서 + 2026-04-24 출시 안내 확인). 멀티모달은 "개발 중"으로만 명시.
  - `DEEPSEEK_ALLOWED_STAGES`와 `DEEPSEEK_MODEL_STAGE_KEYS`에서 `create.extractor`를 이미 제외 (Phase 4 사후 작업으로 반영 완료).
  - extractor는 **Claude / Codex / auto** 중에서만 선택.
- vision-capable provider 현황:
  - Claude CLI: Read 도구로 이미지 처리 가능 — 현재 동작.
  - Codex CLI: v0.115+(2026-03)부터 `--image` flag + `view_image` 도구 지원. 단, `codexCliProvider.ts:buildCodexExecArgs`가 아직 `--image`를 부착하지 않음 — extractor에 Codex를 쓰려면 이 adapter 확장 필요. ProviderRunOptions에 `imagePaths?: string[]` 도입.
- vision 후속(미래): DeepSeek OCRv3 또는 V4 vision 확장 출시 시 `DEEPSEEK_ALLOWED_STAGES`에 `create.extractor` 재추가하고 multimodal 메시지 포맷(`image_url` content block) 구현.

### 3. solver/verifier 연결

기존 `runSolverStage`, `runVerifierStage`는 provider를 input으로 받음 (`input.provider`). orchestrator가 stageOverrides로 lookup해서 주입:

```ts
const solverProvider = getProviderAdapter(stageOverrides["create.solver"] ?? "auto");
const result = await runSolverStage({ ..., provider: solverProvider });
```

verifier feedback 루프:
```ts
for (let attempt = 0; attempt < 3; attempt++) {
  const solved = await runSolverStage(...);
  const verified = await runVerifierStage({ ..., solved });
  if (verified.output?.status === "pass") break;
  // feedback을 다음 solver 호출에 주입 (guidelineContext에 추가)
}
```

### 4. figure 단계 트리거

기존 `runLegacyPromptJob` 흐름에서는 Claude가 Skill 호출로 `figure_processor.py`를 실행했다. orchestrator는 직접 `spawn("python3"|"python", ["scripts/figure_processor.py", ...])`로 실행하고 `figure_status.json`을 폴링하던 프론트 로직과 연동.

### 5. 캐시 & telemetry

- `createStageCache(BASE_DIR)`를 orchestrator에 주입.
- stage별 `createProviderTelemetryEntry`로 telemetry 누적 → `jobStore.write`에 기록.
- 비용/시간 측정용.

### 6. resume 모드

`meta.resumeFrom` 값에 따라 시작 stage를 골라 partial 실행:
- `extractor`: 처음부터
- `solver`: 캐시된 extracted.json부터
- `verifier`: 캐시된 solved.json부터
- `figure`: 캐시된 검증 통과 결과부터 figure 단계
- `builder`: figure 완료 후 조립만
- `confirm`: builder만
- `checker`: builder 완료 후 검수만

orchestrator가 cache.ts를 통해 이전 stage 산출물을 읽고 다음 stage로 진행.

### 7. UI 영향

- create-v4 페이지는 변경 없음 (기존 stage/progress/question 이벤트를 그대로 받음).
- Phase 4의 provider 배지는 stage별 provider를 노출하므로 사용자가 어느 stage에 DeepSeek가 적용되는지 확인 가능.
- `create.extractor`에 DeepSeek 지정 시 차단 경고는 Phase 4에서 이미 적용.

## 체크리스트

- [ ] DeepSeek V4 API의 vision 지원 여부 확인 (지원 안 하면 옵션 B 채택)
- [ ] `server/stages/orchestrator.ts` 신규 작성 (entry/dispatch)
- [ ] `server/stages/extractor.ts` 신규 작성 (Claude vision으로 위임 + JSON 검증)
- [ ] `runSolverStage` 호출부 연결 + 병렬 처리 + feedback 루프
- [ ] `runVerifierStage` 호출부 연결
- [ ] figure 단계 spawn + 폴링 호환성 확인
- [ ] `runBuilderStage` 연결 (이미 deterministic builder 분기 있음 — 재사용)
- [ ] `runCheckerStage` 연결 (이미 deterministic checker 분기 있음 — 재사용)
- [ ] resume 모드 stage 시작점 분기 처리
- [ ] telemetry 집계 및 jobStore 기록
- [ ] orchestrator unit/integration 테스트 (mock fetch)
- [ ] `lib/queue.ts` enqueue 호출부 활성화 또는 데드코드 제거 결정

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run server/stages --reporter=basic
# live test (DEEPSEEK_API_KEY 필요):
npx vitest run lib/__tests__/providerDeepSeekLive.test.ts --reporter=basic
# 수동:
# 1. /settings에서 solver/verifier만 deepseek-v4로 지정 (extractor는 Claude)
# 2. /create-v4에서 신규 작업 → 추출(Claude) → 해설(DeepSeek) → 검증(DeepSeek) → figure → builder → checker
# 3. PipelineView가 stage별 라이브 업데이트
# 4. outputs/에 HWPX 생성, 다운로드 동작
```

## 비범위

- DeepSeek 외 외부 API provider 추가 (Gemini, OpenAI 등)
- create-v4 UI 추가 변경 (Phase 4 배지로 충분)
- `/create` 페이지 폐기 (별도 작업)
- `lib/queue.ts` 큐 시스템 전면 재설계 — 호출부 연결 또는 제거만 결정

## 위험 / 결정 사항

1. **DeepSeek vision 지원 불확실** — 가장 큰 변수. 답에 따라 extractor 전략이 달라짐.
2. **figure 단계 spawn 환경** — Windows/macOS 양쪽에서 동작 보장 (CLAUDE.md 규칙).
3. **stage 단위 cancel** — 사용자가 중단 클릭 시 진행 중인 stage의 fetch + 큐된 다음 stage 모두 abort.
4. **legacy 경로 호환성** — DeepSeek 미지정 시 기존 `runLegacyPromptJob` 그대로 사용. 두 경로가 같은 SSE 이벤트 스키마를 emit해야 함.
