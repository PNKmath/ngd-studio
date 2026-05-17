---
phase: 5
title: DeepSeek rollout policy
status: completed
depends_on: [3, 4]
scope:
  - ngd-studio/lib/ai/recommendation.ts
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/app/settings/page.tsx
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/__tests__/providerRecommendation.test.ts
  - ngd-studio/lib/__tests__/providerSettings.test.ts
intervention_likely: true
intervention_reason: "DeepSeek를 자동 추천/기본 선택으로 노출할 정책 기준과 외부 API opt-in 범위 확인 필요"
executor: sonnet
---

# Phase 5: DeepSeek rollout policy

> **범위**: Frontend / Backend / AI policy
> **난이도**: M
> **의존성**: Phase 3, Phase 4
> **영향 파일**: `lib/ai/recommendation.ts`, `app/settings/page.tsx`

## 배경

DeepSeek provider plumbing과 stage override UI는 존재하지만, 자동 추천이나 stage rollout은 정책 리스크가 있다. 외부 API opt-in, 비용/실패율 telemetry, 허용 stage 목록을 명확히 해야 한다.

## 설계

DeepSeek 허용 stage를 verifier/solver 중심으로 제한하고, settings UI와 `recommendStageProvider()`가 external API policy를 반영하도록 정리한다. 자동 추천은 충분한 telemetry가 있을 때만 적용한다.

## 체크리스트

- [x] DeepSeek 허용 stage 목록과 policy gate 명시
- [x] settings UI가 external API opt-in/override 상태를 명확히 표현
- [x] recommendation이 failure/cost/validation telemetry를 반영
- [x] `/api/run` stage override 전달 경로 유지
- [x] DeepSeek가 file mutation stage에 선택되지 않음
- [x] provider settings/recommendation focused test 통과

## 영향 범위

외부 API 사용 정책과 UI 노출에 영향을 준다. 실행 전 정책 기준 확인이 필요할 수 있다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerSettings.test.ts lib/__tests__/providerRecommendation.test.ts
```

## 실행 결과

### 2026-05-17 Phase 5

- 정책을 `AI_STAGE_KEYS` 전체 DeepSeek 허용으로 정리했다.
- settings UI는 단계별 provider 선택 대신 DeepSeek를 AI 단계 전체에 적용/해제하는 단순 동작으로 바꿨다.
- `createDeepSeekStageOverrides()`와 `allModelStagesUseDeepSeek()`를 추가해 `/api/run`으로 전달되는 기존 stage override 경로를 유지했다.
- `builder`, `checker`, `cropper` 같은 deterministic 단계는 `normalizeStageOverrides()`에서 제거되어 DeepSeek 선택 대상이 되지 않음을 테스트했다.
- 검증: `pnpm test -- --run lib/__tests__/providerSettings.test.ts lib/__tests__/providerRecommendation.test.ts`, `pnpm exec tsc --noEmit` 통과.
