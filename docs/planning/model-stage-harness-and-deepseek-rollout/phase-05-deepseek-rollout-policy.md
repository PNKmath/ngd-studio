---
phase: 5
title: DeepSeek rollout policy
status: pending
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

- [ ] DeepSeek 허용 stage 목록과 policy gate 명시
- [ ] settings UI가 external API opt-in/override 상태를 명확히 표현
- [ ] recommendation이 failure/cost/validation telemetry를 반영
- [ ] `/api/run` stage override 전달 경로 유지
- [ ] DeepSeek가 file mutation stage에 선택되지 않음
- [ ] provider settings/recommendation focused test 통과

## 영향 범위

외부 API 사용 정책과 UI 노출에 영향을 준다. 실행 전 정책 기준 확인이 필요할 수 있다.

## 검증

```bash
pnpm test -- --run lib/__tests__/providerSettings.test.ts lib/__tests__/providerRecommendation.test.ts
```
