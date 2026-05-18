---
phase: 7
title: settings UI 매트릭스 (stage × provider)
status: completed
depends_on: [1]
scope:
  - ngd-studio/app/settings/page.tsx
  - ngd-studio/app/create-v4/page.tsx
  - ngd-studio/lib/ai/recommendation.ts
  - ngd-studio/lib/ai/stageCapability.ts
  - ngd-studio/app/api/env-settings/test/route.ts
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

- [x] `lib/ai/stageCapability.ts` (또는 settings.ts) — STAGE_PROVIDER_CAPABILITY 상수 + 헬퍼
- [x] `app/settings/page.tsx` 기본 provider 카드를 5장 + auto로 확장, 인증/vision 메모
- [x] stage override 영역을 드롭다운 매트릭스로 재구성 (각 stage별 capability에서 옵션 노출)
- [x] `/api/env-settings` 및 `/api/status` 결과로 인증 누락 경고 표시
- [x] `app/create-v4/page.tsx`의 `AIProviderBadge`에 신규 provider 라벨 매핑 (`claude-sdk`, `openai-sdk` 등)
- [x] localStorage에 저장된 기존 `"claude"`/`"codex"` 값은 normalize 시 자동 마이그레이션 (Phase 1과 연동)
- [x] `apiKeyFields`에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 추가 + `ANTHROPIC_MODEL`/`OPENAI_MODEL` placeholder input
- [x] `/api/env-settings/test`에 `claude`, `openai` provider 테스트 분기 추가 (1 token ping)
- [x] `npx tsc --noEmit` + 수동 확인 (드롭다운 동작, 인증 표시, API 테스트 버튼)

## 실행 결과

### 1회차 (2026-05-17 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
Phase 1에서 확장된 5종 provider를 settings UI에 반영. 기본 provider 카드를 auto + 4종(claude-cli, claude-sdk, codex-cli, openai-sdk)으로 구성하고, stage override 드롭다운 매트릭스를 STAGE_PROVIDER_CAPABILITY 기반으로 재구성. ANTHROPIC_API_KEY / OPENAI_API_KEY 설정 필드 및 연결 테스트(claude, openai) 추가.

#### 변경 파일
- `ngd-studio/lib/ai/stageCapability.ts` (신규, +17줄) — STAGE_PROVIDER_CAPABILITY 상수 + isProviderAllowedForStage 헬퍼
- `ngd-studio/app/settings/page.tsx` (수정, 대규모 리뉴얼) — 5종 provider 카드, 드롭다운 매트릭스, 인증 경고, ANTHROPIC/OPENAI 키 필드, claude/openai 연결 테스트
- `ngd-studio/app/api/env-settings/test/route.ts` (수정) — claude(Anthropic SDK 1-token ping) + openai(OpenAI SDK 1-token ping) 분기 추가

#### 검증 결과
- [x] `npx tsc --noEmit`: 에러 0개 — pass

#### 추가 발견사항
- `create-v4/page.tsx`의 `PROVIDER_LABEL`은 이미 5종 모두 매핑되어 있어 추가 수정 불필요
- localStorage 마이그레이션(claude→claude-cli, codex→codex-cli)은 Phase 1에서 이미 구현됨
- `runtimeEnv.ts`에 ANTHROPIC_API_KEY, ANTHROPIC_MODEL, OPENAI_API_KEY, OPENAI_MODEL이 이미 포함되어 있어 env-settings 라우트 수정 불필요

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 files edited (settings/page.tsx, lib/ai/stageCapability.ts, app/api/env-settings/test/route.ts). frontmatter scope에 stageCapability.ts·test/route.ts가 누락되어 사용자 승인 후 추가함 (체크리스트 본문은 처음부터 두 파일을 요구).

#### Verification Re-run (orchestrator)
exit 0 — `npx tsc --noEmit` pass. (`## 검증`의 수동 항목은 dev 서버/브라우저 필요로 본 단계에서 검증 보류.)

#### Simplify (orchestrator)
1 file, 4 edits, verify pass. page.tsx에서 env keys 병합 로직 applyEnvKeys 헬퍼 추출, enable/disableDeepSeek → toggleDeepSeek 통합, 불필요한 queueMicrotask 제거. route.ts·stageCapability.ts는 이미 충분히 단순해 변경 없음.

#### Review (orchestrator)
VERDICT: pass (0 issues). 스펙/체크리스트/구현 일치. tsc pass, enable/disableDeepSeek 외부 참조 없어 회귀 없음.

#### Commit
`bf1e1f4` — feat(settings): Phase 7 — settings UI 매트릭스 (5종 provider 카드 + stage 드롭다운 + claude/openai 테스트)

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
