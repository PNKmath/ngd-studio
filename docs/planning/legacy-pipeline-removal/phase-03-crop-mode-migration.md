---
phase: 3
title: crop 모드 jobRunner 의존 제거 (inline helper 로 마이그레이션)
status: completed
depends_on: []
scope:
  - ngd-studio/server/sse.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - review-full-pipeline
e2e_triggers: []
---

# Phase 3: crop 모드 jobRunner 의존 제거

> **범위**: Backend (SSE server)
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `server/sse.ts`

## 배경

`mode === "crop"` 는 ngd-exam-crop skill (PDF → 문제 이미지 crop) 을 호출하는 단일 skill 흐름이다. 현재 sse.ts 의 분기 흐름:

1. `mode === "crop"` → `buildCropPrompt(pdf, outDir)` (lib/prompts.ts) 로 prompt 빌드
2. 최종 `else` (line 406) 의 `runLegacyPromptJob` 호출 → Claude CLI spawn + skill 실행

phase 5 에서 `runLegacyPromptJob` 을 삭제하려면 crop 모드의 이 의존을 끊어야 한다. crop 은 orchestrator 의 stage 모델에 맞지 않으므로 orchestrator 통합은 비범위. 대신 sse.ts crop 분기에 작은 인라인 헬퍼를 두고 `runAIProvider` (lib/ai/registry.ts) 를 직접 호출한다.

## 설계

### 1. 인라인 헬퍼

`server/sse.ts` 내부에서만 사용하는 작은 함수 (또는 sse.ts 내부 인라인 코드) 로 `runLegacyPromptJob` 의 책임 중 crop 에 필요한 만큼만 복제:

```ts
// sse.ts 내부
async function runCropJob({
  prompt,
  requestedProvider,
  baseDir,
  jobId,
  send,
  isClientDisconnected,
  setActiveProviderProcess,
  activeProcesses,
}: {
  prompt: string;
  requestedProvider: AIProviderId;
  baseDir: string;
  jobId: string;
  send: (e: SSEEvent) => void;
  isClientDisconnected: () => boolean;
  setActiveProviderProcess: (p: ChildProcess | null) => void;
  activeProcesses: Set<ChildProcess>;
}): Promise<{ status: "done" | "failed" | "cancelled"; resultSummary?: string; providerTelemetry: ProviderTelemetryEntry[] }> {
  // runAIProvider 1회 호출, MAX_PROVIDER_ATTEMPTS 재시도, transformToSSE 로 이벤트 변환
  // 후처리 (outputFile 추출, providerTelemetry append) 는 crop 만 필요한 최소 범위로
}
```

핵심 차이점:
- `runLegacyPromptJob` 은 mode=create/resume/review/crop 모든 케이스를 처리 (maxTurns 분기, outputFile 추출 등). 인라인 헬퍼는 **crop 에 필요한 최소 케이스만** (maxTurns: 30, outputFile 추출 불필요 — crop 은 hwpx 가 아님).
- `runLegacyPromptJob` 의존 import (`fromWslPath`, `transformToSSE`, `runAIProvider`, retry helpers) 는 인라인 헬퍼에서도 동일하게 import. 단 sse.ts 가 이미 이 import 들을 다른 분기에서 사용 중인지 확인.

### 2. crop 분기 갱신

```ts
if (mode === "crop") {
  const cropResult = await runCropJob({ prompt, requestedProvider, baseDir: BASE_DIR, jobId, send, ... });
  finalStatus = cropResult.status;
  resultSummary = cropResult.resultSummary ?? "";
  providerTelemetry = cropResult.providerTelemetry;
}
```

기존 `runLegacyPromptJob` 호출이 `mode === "crop"` 도 처리하던 분기에서 crop 케이스 제거. phase 4 에서 나머지 (create/resume/review) 도 함께 제거 → `runLegacyPromptJob` 호출 0건.

### 3. 다른 변경 없음

`buildCropPrompt` (lib/prompts.ts) 은 그대로 유지. phase 5 에서 다른 prompts 만 삭제.

## 체크리스트

- [x] sse.ts 내부에 `runCropJob` (또는 인라인 코드) 추가 — `runAIProvider` 직접 호출 + `transformToSSE` 변환 + 재시도 처리
- [x] sse.ts 의 crop 처리 분기 갱신 — `runLegacyPromptJob` 대신 `runCropJob` 호출
- [x] 기존 `runLegacyPromptJob` 호출이 `mode === "crop"` 케이스로 진입하지 않도록 분기 흐름 정리 (phase 4 와 충돌하지 않게 — 본 phase 는 crop 만 분리)
- [x] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] 수동 확인: crop 실행 시 SSE 이벤트 흐름이 기존과 동등 (log / stage / file / result)

## 영향 범위

- **crop 동작**: 변경 없음 (skill prompt 그대로, Claude CLI 호출 그대로).
- **legacy 코드**: phase 5 에서 `runLegacyPromptJob` 삭제 가능해짐.
- **provider 선택**: crop 도 `requestedProvider` 그대로 받아 처리 (auto / claude-cli / codex-cli 등 기존 가능 옵션 유지).

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 검증 (선택): crop 모드 1회 실행 — PDF 1개 업로드 → 문제 이미지 N개 생성 → outputs 확인. 본격 검증은 phase 06.

## 실행 결과

### 1회차 (2026-05-22 17:00 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`server/sse.ts`에 `runCropJob` 인라인 헬퍼 함수를 추가하고, 기존 `else` 분기로 흘러들어가던 crop 모드를 새로운 `else if (mode === "crop")` 분기로 분리했다. `runAIProvider`, `transformToSSE`, retry helpers (`MAX_PROVIDER_ATTEMPTS`, `createProviderAttemptLog`, `createProviderRetryLog`, `createProviderTelemetryEntry`, `shouldRetryProviderAttempt`) 및 `readRuntimeEnv`를 sse.ts 레벨 import로 추가했다. crop 은 HWPX outputFile 추출이 불필요하므로 최소 범위만 구현했다.

#### 변경 파일
- `ngd-studio/server/sse.ts` (수정, +163/-0줄): `runCropJob` 함수 추가 + import 보강 + crop 전용 분기 삽입

#### 검증 결과
- [x] TypeScript 타입 검사: `cd ngd-studio && npx tsc --noEmit` → pass (에러 없음)

#### 추가 발견사항
- `runCropJob` 시그니처는 `baseDir`를 파라미터로 받지 않고 모듈 레벨 `BASE_DIR` 상수를 직접 참조한다 (sse.ts 파일 내부 전용 함수이므로 스펙 설계와 동치).
- 수동 검증(crop 모드 실제 실행)은 본격 검증인 phase 06에서 처리.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (sse.ts)

#### Verification Re-run (orchestrator)
exit 0 — tsc 재현됨

#### Simplify (orchestrator)
SIMPLIFIED: 1, CHANGES: 1 file, 4 edits — ProviderTelemetryEntry inline import을 기존 import로 교체 + 반복 setActiveProviderProcess 람다를 named const로 추출. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass — runCropJob 인라인 헬퍼 + crop 분기 분리 스펙 완전 일치. 잔존 runLegacyPromptJob 호출은 phase 4에서 제거 예정 (스펙 의도 일치).
