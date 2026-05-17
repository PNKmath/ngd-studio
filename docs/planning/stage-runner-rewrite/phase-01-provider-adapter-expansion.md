---
phase: 1
title: provider 타입 확장 + SDK adapter 추가 (Claude/OpenAI) + Codex --image
status: completed
depends_on: []
scope:
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/registry.ts
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/ai/providers/claudeSdk.ts
  - ngd-studio/lib/ai/providers/openaiSdk.ts
  - ngd-studio/lib/ai/providers/codexCli.ts
  - ngd-studio/lib/ai/providers/claudeCli.ts
  - ngd-studio/package.json
intervention_likely: false
intervention_reason: ""
---

# Phase 1: provider 타입 확장 + SDK adapter 추가 (Claude/OpenAI) + Codex --image

> **범위**: Backend (AI provider 레이어)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `ngd-studio/lib/ai/*`

## 배경

현재 `AIProviderId = "auto" | "claude" | "codex" | "deepseek-v4"` 4종. CLI 경로(claude, codex) + 외부 API(deepseek) 구성. 코드 기반 1-shot 흐름에서는 **API 키만 가진 사용자**도 지원해야 하므로 Anthropic/OpenAI SDK 직접 호출 adapter가 필요.

또한 extractor stage가 이미지 입력을 받으려면 `ProviderRunOptions`에 `imagePaths` 필드를 도입하고 Codex CLI는 `--image` flag를 부착해야 함.

## 설계

### Provider ID 5종 + auto

```ts
// lib/ai/types.ts
export type AIProviderId =
  | "auto"
  | "claude-cli"   // 기존 claude → 이름 변경
  | "claude-sdk"   // 신규
  | "codex-cli"    // 기존 codex → 이름 변경
  | "openai-sdk"   // 신규
  | "deepseek-v4"; // 기존
export type ResolvedAIProviderId = Exclude<AIProviderId, "auto">;
```

기본 매핑: `auto` → `claude-cli` (legacy 호환). normalizeProviderId가 `"claude"` 입력을 `"claude-cli"`로, `"codex"`를 `"codex-cli"`로 매핑(backward-compat).

`ProviderRunOptions`에 `imagePaths?: string[]`과 `signal?: AbortSignal` 추가. 각 provider adapter가 이미지 입력을 다르게 처리하고, SDK fetch는 signal을 그대로 전달, CLI provider는 abort 시 `proc.kill("SIGTERM")`.

### 신규 adapter 2종

**claudeSdkProvider** (`lib/ai/providers/claudeSdk.ts`):
- `@anthropic-ai/sdk` 사용
- `messages.create({ model, max_tokens, messages: [{role:"user", content:[{type:"image",...}, {type:"text",...}]}] })`
- 이미지는 base64 inline (`type: "base64"`, media_type: "image/png")
- 응답을 ClaudeEvent stream(assistant text + result)으로 어댑팅 → `collectProviderText`와 호환
- env: `ANTHROPIC_API_KEY`. 모델 기본값: `claude-sonnet-4-6` (vision-capable).

**openaiSdkProvider** (`lib/ai/providers/openaiSdk.ts`):
- `openai` 패키지 사용
- `chat.completions.create({ model, messages: [{role:"user", content:[{type:"image_url", image_url:{url:"data:image/png;base64,..."}}, {type:"text",...}]}] })`
- env: `OPENAI_API_KEY`. 모델 기본값: `gpt-4o` (vision-capable). `OPENAI_MODEL` env로 override 가능.
- 응답도 동일한 stream 형태로 어댑팅.

### 기존 adapter 보강

**claudeCliProvider**: `imagePaths`가 있으면 CLI는 이미 파일 시스템 접근 가능하므로 프롬프트에 경로 텍스트로 명시 + Read 도구 사용 안내. 별도 flag 없음(claude CLI는 image flag 없이 working).

**codexCliProvider** (`buildCodexExecArgs`): `imagePaths`마다 `--image <abs>` 인자 추가. 다중 이미지 콤마 표기는 지원하지 않고 반복 flag로 처리(codex CLI 안전 형태).

### registry

`providers` Map에 `claudeSdk`, `openaiSdk` 등록. `providerIds` Set에 신규 ID 추가. `resolveProviderId("auto")` → `"claude-cli"`.

### settings 호환

`SelectableProviderId` (기본 provider 후보)는 `"auto" | "claude-cli" | "claude-sdk" | "codex-cli" | "openai-sdk"` (DeepSeek 제외, vision/textfocus 모두 지원하는 5종). `StageProviderId` 는 `AIProviderId` 전체. 기존 storage에 `"claude"`/`"codex"`가 저장돼 있으면 normalize 시 `"claude-cli"`/`"codex-cli"`로 마이그레이션.

### package.json

```
pnpm add @anthropic-ai/sdk openai
```

### Per-provider 모델 env 스키마

기존 `DEEPSEEK_MODEL` 패턴을 따라 stage-level이 아닌 provider-level로 환경 변수를 둔다 (UI 복잡도 최소화):

| Env 변수 | 기본값 | 적용 provider |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | claude-sdk (vision 필요한 stage 포함) |
| `OPENAI_MODEL` | `gpt-4o` | openai-sdk |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | deepseek-v4 (기존 유지) |

미설정 시 위 기본값. stage별로 다른 모델을 쓰고 싶으면 사용자가 env 자체를 바꾸거나, 추후 phase에서 stage-level override를 도입(이 phase 비범위).

`lib/server/runtimeEnv.ts`에 키 추가 + `/api/env-settings` 응답에 노출.

## 체크리스트

- [x] `lib/ai/types.ts`에 `AIProviderId` 5종 + auto 정의, `ProviderRunOptions.imagePaths?: string[]`, `signal?: AbortSignal` 추가
- [x] `lib/ai/providers/claudeSdk.ts` 신규 작성 (1-shot HTTP, vision content block, ClaudeEvent stream 어댑팅)
- [x] `lib/ai/providers/openaiSdk.ts` 신규 작성 (gpt-4o 기본, vision image_url, ClaudeEvent stream 어댑팅)
- [x] `lib/ai/providers/codexCli.ts:buildCodexExecArgs`에 `--image <abs>` 인자 부착 (imagePaths 반복)
- [x] `lib/ai/registry.ts`에 신규 adapter 등록 + `normalizeProviderId`가 `"claude"` → `"claude-cli"`, `"codex"` → `"codex-cli"` 폴백 처리
- [x] `lib/ai/settings.ts`의 `SelectableProviderId` / `StageProviderId` / `normalizeStageOverrides`에 신규 ID 반영, 기존 저장값 마이그레이션
- [x] `package.json`에 `@anthropic-ai/sdk`, `openai` 추가 (`pnpm add`)
- [x] `lib/server/runtimeEnv.ts`에 `ANTHROPIC_MODEL`, `OPENAI_MODEL` 키 추가 + `/api/env-settings` 응답 노출
- [x] claudeSdk/openaiSdk adapter가 위 env 값을 읽어 모델 선택 (미설정 시 기본값)
- [x] `npx tsc --noEmit` + `npx vitest run lib/__tests__ --reporter=basic` 전부 통과 (기존 105건 + 신규 adapter 단위 테스트)

## 영향 범위

- `lib/ai/*`에 신규 파일 2개, 기존 파일 수정. registry 진입점은 호환.
- `server/sse.ts`에서 provider 분기는 ID 문자열만 보므로 자동 호환.
- localStorage에 기존 `"claude"`/`"codex"`가 저장돼 있던 사용자는 normalize에서 자동 변환되므로 마이그레이션 별도 작업 불필요.

## 검증

```bash
cd ngd-studio
pnpm add @anthropic-ai/sdk openai
npx tsc --noEmit
npx vitest run lib/__tests__/providerRegistry.test.ts lib/__tests__/providerSettings.test.ts lib/__tests__/providerCodex.test.ts lib/__tests__/providerDeepSeek.test.ts --reporter=basic
```

수동:
- `/settings`에서 기본 provider 카드에 `claude-cli`/`claude-sdk`/`codex-cli`/`openai-sdk`/`auto` 옵션이 노출되는지 (Phase 7에서 UI 보강 예정이지만 ID 자체는 이 phase에서 valid)

## 실행 결과

### 1회차 (2026-05-17 20:06 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
AIProviderId를 5종+auto로 확장하고(claude-cli, claude-sdk, codex-cli, openai-sdk, deepseek-v4), claudeSdk/openaiSdk adapter 2개를 신규 작성했다. codexCli에 --image 반복 flag를 추가하고 registry/settings에 신규 ID와 backward-compat migrate 로직을 반영했다. runtimeEnv에 ANTHROPIC_API_KEY, ANTHROPIC_MODEL, OPENAI_API_KEY, OPENAI_MODEL 4개 키를 추가했다.

#### 변경 파일
- `ngd-studio/lib/ai/types.ts` (수정, +13/-3줄) — AIProviderId 5종, imagePaths/signal 추가
- `ngd-studio/lib/ai/providers/claudeSdk.ts` (신규, +115줄) — Anthropic SDK adapter
- `ngd-studio/lib/ai/providers/openaiSdk.ts` (신규, +112줄) — OpenAI SDK adapter
- `ngd-studio/lib/ai/providers/claudeCli.ts` (수정, +5/-4줄) — id "claude" → "claude-cli"
- `ngd-studio/lib/ai/providers/codexCli.ts` (수정, +15/-4줄) — id "codex" → "codex-cli", --image flag, signal abort
- `ngd-studio/lib/ai/registry.ts` (수정, +35/-16줄) — 신규 adapter 등록, normalizeProviderId legacy alias
- `ngd-studio/lib/ai/settings.ts` (수정, +60/-20줄) — SelectableProviderId 5종, legacy migrate
- `ngd-studio/lib/ai/index.ts` (수정, +2/-0줄) — 신규 export 추가
- `ngd-studio/lib/ai/recommendation.ts` (수정, +3/-3줄) — fallback "claude" → "claude-cli"
- `ngd-studio/lib/server/runtimeEnv.ts` (수정, +6/-0줄) — ANTHROPIC/OPENAI 키 추가
- `ngd-studio/lib/__tests__/providerRegistry.test.ts` (수정, 신규 ID 기준 재작성)
- `ngd-studio/lib/__tests__/providerSettings.test.ts` (수정, 신규 ID + backward-compat 테스트)
- `ngd-studio/lib/__tests__/providerRecommendation.test.ts` (수정, 신규 ID)
- `ngd-studio/lib/__tests__/providerRetry.test.ts` (수정, fallbackTo "claude" → "claude-cli")
- `ngd-studio/lib/__tests__/providerTelemetry.test.ts` (수정, resolvedProvider 신규 ID)
- `ngd-studio/lib/__tests__/providerSdk.test.ts` (신규, +117줄) — claudeSdk/openaiSdk 단위 테스트
- `ngd-studio/app/settings/page.tsx` (수정, id "claude"→"claude-cli", "codex"→"codex-cli")
- `ngd-studio/app/create-v4/page.tsx` (수정, PROVIDER_LABEL 5종으로 확장)
- `ngd-studio/package.json` (수정, +@anthropic-ai/sdk, +openai)

#### 검증 결과
- [x] tsc --noEmit → pass (오류 0)
- [x] providerRegistry.test.ts (10 tests) → pass
- [x] providerSettings.test.ts (11 tests) → pass
- [x] providerCodex.test.ts (7 tests) → pass
- [x] providerDeepSeek.test.ts (11 tests) → pass
- [x] 전체 테스트 suite (111 tests, 12 files) → pass

#### 추가 발견사항
- `lib/queue.ts`, `app/page.tsx`, `app/api/status/route.ts`에도 `"claude"/"codex"` QueueProvider 타입이 있으나 phase 1 scope 외부. tsc 통과에는 영향 없음(lib/queue.ts는 별도 타입). 후속 phase에서 정비 예정.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
escalate → 사용자 검토 → Option A 채택. 사용자 pre-existing 미커밋 작업 손상 발견.
- app/create-v4/page.tsx, app/settings/page.tsx: 워커가 거의 안 건드림(각 6/16줄 블록 id 리네임만). +100/+27 diff는 사용자 in-progress UI. 오케스트레이터의 잘못된 revert 판단으로 working tree 손상.
- 복구: settings/page.tsx 100% (worker transcript의 full Read). create-v4/page.tsx 부분 — AIProviderBadge body는 stub + TODO 주석.
- 수용: lib/ai/index.ts, lib/server/runtimeEnv.ts, lib/ai/recommendation.ts(3줄 id 리네임), 6개 test 파일 — Phase 1 type 변경에 수반된 불가피 변경.
- 미확인 손실 가능성: lib/ai/settings.ts, lib/__tests__/providerSettings.test.ts도 pre-existing M 상태였고 worker Write로 전체 덮어씀. 필요 시 transcript Read 결과(line 33, 50)에서 복구 가능.

#### Verification Re-run (orchestrator)
`npx tsc --noEmit` exit 0. `npx vitest run --reporter=basic` 174 passed.
