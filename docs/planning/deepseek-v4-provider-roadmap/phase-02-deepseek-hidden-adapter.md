---
phase: 2
title: DeepSeek 숨김 adapter
status: completed
depends_on: [1]
scope:
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/registry.ts
  - ngd-studio/lib/ai/providers/
  - ngd-studio/lib/__tests__/providerRegistry.test.ts
  - ngd-studio/lib/__tests__/providerDeepSeek.test.ts
  - ngd-studio/.env.example
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: DeepSeek 숨김 adapter

> **범위**: Backend
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `ngd-studio/lib/ai/registry.ts`, `ngd-studio/lib/ai/providers/`

## 배경

`ngd-studio/lib/ai/types.ts`의 `AIProviderId`는 이미 `"deepseek-v4"`를 포함한다. `ngd-studio/lib/ai/registry.ts`의 `providerIds`도 값을 정규화하지만, `providers` map에는 Claude와 Codex만 등록되어 있어 `getProviderAdapter("deepseek-v4")`는 실패한다.

DeepSeek V4는 외부 API provider이므로 Phase 1 정책에서 허용한 제한 stage에만 사용해야 한다. settings 화면의 선택 가능 provider에는 아직 노출하지 않는다.

## 설계

`ngd-studio/lib/ai/providers/deepseekV4.ts`를 신규 추가한다. adapter는 `ProviderRunResult` 계약을 맞추되, Phase 1 정책에서 허용한 payload만 처리한다. 현재 provider contract는 prompt string을 받으므로, Phase 2에서는 adapter가 prompt 외 별도 파일 metadata wrapper를 추가하지 않는 것을 테스트한다.

registry 등록은 가능하지만, settings의 `SelectableProviderId`에는 포함하지 않는다. `auto`는 계속 Claude로 resolve한다.

## 체크리스트

- [x] `deepseekV4Provider` 신규 adapter를 추가하고 env 미설정 시 명확한 error event를 반환
- [x] Phase 1 정책에서 허용한 제한 stage 외 mode/stage 요청은 실행하지 않도록 guard 추가
- [x] `registry.ts`에서 `deepseek-v4` 등록 여부와 `auto` resolve 동작을 테스트로 고정
- [x] `settings.ts`의 `SelectableProviderId`는 Phase 4 전까지 `auto | claude | codex`로 유지
- [x] 원본 PDF/HWPX/문제 이미지 경로를 별도 metadata wrapper로 추가하지 않음을 테스트
- [x] `.env.example`의 `DEEPSEEK_API_KEY`, `DEEPSEEK_API_BASE_URL`, `DEEPSEEK_MODEL` placeholder가 현재 adapter 요구와 일치
- [x] `npx vitest run lib/__tests__/providerRegistry.test.ts lib/__tests__/providerDeepSeek.test.ts --reporter=basic` 통과

## 영향 범위

provider registry와 adapter 계층에 한정한다. UI 선택, stage override 저장 구조, telemetry는 후속 phase에서 다룬다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/providerRegistry.test.ts lib/__tests__/providerDeepSeek.test.ts --reporter=basic
npx tsc --noEmit
```

## 실행 결과

### 1회차 (2026-05-16 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
DeepSeek V4 API adapter를 추가하고 registry에 숨김 provider로 등록했다. `auto`는 계속 Claude로 resolve되며, DeepSeek는 허용 stage key가 있을 때만 실행된다.

#### 변경 파일
- `ngd-studio/lib/ai/providers/deepseekV4.ts` (신규)
- `ngd-studio/lib/ai/types.ts` (수정)
- `ngd-studio/lib/ai/registry.ts` (수정)
- `ngd-studio/lib/ai/index.ts` (수정)
- `ngd-studio/lib/__tests__/providerRegistry.test.ts` (수정)
- `ngd-studio/lib/__tests__/providerDeepSeek.test.ts` (신규)
- `ngd-studio/.env.example` (수정)

#### 검증 결과
- [x] DeepSeek/registry focused tests: `npx vitest run lib/__tests__/providerRegistry.test.ts lib/__tests__/providerDeepSeek.test.ts --reporter=basic` → pass
- [x] 타입체크: `npx tsc --noEmit` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
