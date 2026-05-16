---
phase: 6
title: Auto stage 추천 규칙
status: completed
depends_on: [5]
scope:
  - ngd-studio/lib/ai/registry.ts
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/ai/recommendation.ts
  - ngd-studio/lib/__tests__/providerRecommendation.test.ts
  - ngd-studio/app/settings/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 6: Auto stage 추천 규칙

> **범위**: Both
> **난이도**: M
> **의존성**: Phase 5
> **영향 파일**: `ngd-studio/lib/ai/recommendation.ts` 신규

## 배경

현재 `resolveProviderId("auto")`는 Claude로 고정된다. 로드맵은 충분한 provider별 관측치가 쌓인 stage부터 실패율, 평균 실행 시간, 재시도 발생률, checker/reviewer 수정 필요 빈도, 외부 API 비용을 기준으로 추천 규칙을 도입하라고 한다.

## 설계

`recommendation.ts`를 신규 추가해 stage 단위 추천 함수를 둔다. 입력은 Phase 5 telemetry summary와 settings의 stage override다. 명시적 override가 있으면 추천보다 우선한다. 관측치가 부족하거나 정책상 외부 API가 금지된 stage는 Claude 또는 기존 `auto` fallback을 유지한다.

registry의 전역 `auto` 동작을 갑자기 바꾸지 말고, stage-aware path에서만 추천 결과를 사용한다.

## 체크리스트

- [x] telemetry summary를 입력받는 stage provider 추천 함수를 추가
- [x] 명시적 stage override가 `auto`가 아니면 추천보다 우선함을 테스트
- [x] 관측치 부족, 높은 실패율, 비용 초과, 정책상 외부 API 금지 case를 테스트
- [x] `resolveProviderId("auto")`의 기존 Claude fallback이 유지됨을 테스트
- [x] settings UI에서 추천 provider를 읽기 전용 힌트로 표시하되 자동 변경은 하지 않음
- [x] `npx vitest run lib/__tests__/providerRecommendation.test.ts lib/__tests__/providerRegistry.test.ts --reporter=basic` 통과

## 영향 범위

추천은 stage-aware 경로에만 적용한다. 사용자가 명시적으로 고른 provider와 정책 제한을 우선한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/providerRecommendation.test.ts lib/__tests__/providerRegistry.test.ts --reporter=basic
npx tsc --noEmit
```

수동 확인:
- `/settings`에서 추천 힌트가 표시되지만 저장값을 자동으로 바꾸지 않는지 확인

## 실행 결과

### 1회차 (2026-05-16 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
stage provider 추천 순수 함수를 추가했다. 명시 override가 추천보다 우선하고, 관측치 부족/실패율/비용/외부 API 정책 조건을 테스트로 고정했다.

#### 변경 파일
- `ngd-studio/lib/ai/recommendation.ts` (신규)
- `ngd-studio/lib/ai/index.ts` (수정)
- `ngd-studio/app/settings/page.tsx` (수정)
- `ngd-studio/lib/__tests__/providerRecommendation.test.ts` (신규)

#### 검증 결과
- [x] recommendation/registry focused tests: `npx vitest run lib/__tests__/providerRecommendation.test.ts lib/__tests__/providerRegistry.test.ts --reporter=basic` → pass
- [x] 타입체크: `npx tsc --noEmit` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
