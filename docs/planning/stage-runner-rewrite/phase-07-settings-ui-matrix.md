---
phase: 7
title: settings UI 매트릭스 (stage × provider)
status: pending
depends_on: [1]
scope:
  - ngd-studio/app/settings/page.tsx
  - ngd-studio/app/create-v4/page.tsx
  - ngd-studio/lib/ai/recommendation.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 7: settings UI 매트릭스 (stage × provider)

> **범위**: Frontend (settings + create-v4 배지)
> **난이도**: M
> **의존성**: Phase 1 (provider 타입 5종 확정)
> **영향 파일**: `ngd-studio/app/settings/page.tsx`, `ngd-studio/app/create-v4/page.tsx`

## 배경

Phase 1에서 provider 5종(claude-cli, claude-sdk, codex-cli, openai-sdk, deepseek-v4)이 정의됨. 현재 settings UI는 DeepSeek on/off 토글만 제공 → stage별 provider 선택 매트릭스로 확장.

## 설계

### 기본 provider 카드 (기존 3장 → 5장)

`providerOptions`에 5종 + auto 추가. 각 카드에:
- 라벨 ("Claude CLI", "Claude SDK", "Codex CLI", "OpenAI SDK", "DeepSeek V4", "자동")
- 인증 요구 표시 ("claude auth login 또는 ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY 필요", ...)
- vision 지원 여부 (이미 Phase에서 메모 추가)
- 인증 누락 시 빨간색 경고

`SelectableProviderId` = `"auto" | "claude-cli" | "claude-sdk" | "codex-cli" | "openai-sdk"` (DeepSeek는 vision 불가라 기본값 후보에서 제외 — 기존 정책 유지).

### Stage override 매트릭스

기존 1행 4열(create.extractor / solver / verifier / review.reviewer) → 각 stage마다 **드롭다운**으로 provider 선택:

```
┌────────────────────────────────────────────────────────┐
│ 제작 추출 (create.extractor)                            │
│   provider: [▼ auto (Claude CLI)            ]          │
│   사용 가능: claude-cli, claude-sdk, codex-cli, openai-sdk │
│   비활성: deepseek-v4 (이미지 입력 미지원)              │
├────────────────────────────────────────────────────────┤
│ 제작 풀이 (create.solver)                               │
│   provider: [▼ auto (Claude CLI)            ]          │
│   사용 가능: 전체 5종                                    │
└────────────────────────────────────────────────────────┘
```

`isDeepSeekStageAllowed`처럼 각 stage별 가용 provider 집합 정의:

```ts
// lib/ai/settings.ts (or new lib/ai/stageCapability.ts)
export const STAGE_PROVIDER_CAPABILITY: Record<AIStageKey, AIProviderId[]> = {
  "create.extractor": ["auto", "claude-cli", "claude-sdk", "codex-cli", "openai-sdk"],
  "create.solver":    ["auto", "claude-cli", "claude-sdk", "codex-cli", "openai-sdk", "deepseek-v4"],
  "create.verifier":  ["auto", "claude-cli", "claude-sdk", "codex-cli", "openai-sdk", "deepseek-v4"],
  "review.reviewer":  ["auto", "claude-cli", "claude-sdk", "codex-cli", "openai-sdk", "deepseek-v4"],
};
```

드롭다운 옵션은 이 capability에서 가져옴.

### "DeepSeek 일괄 사용" 버튼 유지

현재 `enableDeepSeek`는 text-only stage 3개만 일괄 deepseek-v4로 지정. 그대로 유지. 추가로 "OpenAI SDK 일괄" 등 빠른 토글이 필요할 수 있지만 이 phase 비범위.

### 인증 상태 표시

`/api/env-settings`에서 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` 보유 여부 조회. 카드 옆에 ✓/⚠ 표시. CLI는 `/api/status` 결과(claude/codex CLI 가용) 활용.

### API key 입력 + 테스트 확장

`app/settings/page.tsx`의 `apiKeyFields`에 신규 항목 추가:
- `ANTHROPIC_API_KEY` (Claude SDK용)
- `OPENAI_API_KEY` (OpenAI SDK용)
- 기존: DEEPSEEK_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_BASE_URL, DEEPSEEK_MODEL
- 신규 모델 input(선택): `ANTHROPIC_MODEL`, `OPENAI_MODEL` placeholder만 노출

`/api/env-settings/test/route.ts`의 `provider` enum에 `claude`, `openai` 추가:
- `claude`: anthropic SDK로 `messages.create({ max_tokens: 1, messages: [{role:"user", content:"ping"}] })` 시도 → 200이면 success
- `openai`: openai SDK로 `chat.completions.create({ max_tokens: 1, messages: [{role:"user", content:"ping"}], model: OPENAI_MODEL or "gpt-4o-mini" })` 시도

### create-v4 배지

기존 `AIProviderBadge`에서 stage별 provider 노출이 이미 있음 → 새 provider ID 라벨만 매핑 추가.

## 체크리스트

- [ ] `lib/ai/stageCapability.ts` (또는 settings.ts) — STAGE_PROVIDER_CAPABILITY 상수 + 헬퍼
- [ ] `app/settings/page.tsx` 기본 provider 카드를 5장 + auto로 확장, 인증/vision 메모
- [ ] stage override 영역을 드롭다운 매트릭스로 재구성 (각 stage별 capability에서 옵션 노출)
- [ ] `/api/env-settings` 및 `/api/status` 결과로 인증 누락 경고 표시
- [ ] `app/create-v4/page.tsx`의 `AIProviderBadge`에 신규 provider 라벨 매핑 (`claude-sdk`, `openai-sdk` 등)
- [ ] localStorage에 저장된 기존 `"claude"`/`"codex"` 값은 normalize 시 자동 마이그레이션 (Phase 1과 연동)
- [ ] `apiKeyFields`에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 추가 + `ANTHROPIC_MODEL`/`OPENAI_MODEL` placeholder input
- [ ] `/api/env-settings/test`에 `claude`, `openai` provider 테스트 분기 추가 (1 token ping)
- [ ] `npx tsc --noEmit` + 수동 확인 (드롭다운 동작, 인증 표시, API 테스트 버튼)

## 영향 범위

- `app/settings/page.tsx` 큰 리뉴얼. 기존 토글 동작은 유지.
- `app/create-v4/page.tsx`의 배지는 라벨만 추가.
- localStorage 호환은 Phase 1 normalize가 책임.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
# 수동: /settings에서
# - 5개 provider 카드 + auto 표시
# - 각 stage 드롭다운에서 capability 외 provider는 안 보임
# - ANTHROPIC_API_KEY 미설정 시 Claude SDK 카드에 ⚠ 표시
# - 변경 후 새로고침해도 유지
```
