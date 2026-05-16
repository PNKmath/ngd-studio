---
phase: 4
title: Stage override 설정 UI
status: completed
depends_on: [3]
scope:
  - ngd-studio/app/settings/page.tsx
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/__tests__/providerSettings.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: Stage override 설정 UI

> **범위**: Frontend
> **난이도**: M
> **의존성**: Phase 3
> **영향 파일**: `ngd-studio/app/settings/page.tsx`

## 배경

현재 settings 화면은 기본 실행 엔진 카드 3개만 제공한다. DeepSeek V4는 외부 API provider이므로 사용자 opt-in과 stage별 override 없이 전역 선택으로 노출하면 안 된다.

## 설계

기존 settings 페이지의 조용한 관리 화면 톤을 유지한다. 기본 provider 섹션 아래에 stage override 섹션을 추가하고, Phase 1 정책에서 허용한 stage에 대해서만 `deepseek-v4` 선택지를 노출한다. 각 stage row는 stage 이름, 현재 provider, 정책/opt-in 상태를 표시한다.

DeepSeek 선택은 정책 문서 조건을 UI text로 과하게 설명하지 않고, 필요한 경우 짧은 상태 문구와 disabled state로 제한한다.

## 체크리스트

- [x] settings 화면에 `create.extractor`, `create.verifier`, `review.reviewer` 등 stage override 컨트롤 추가
- [x] Phase 1 정책에서 허용되지 않은 stage는 DeepSeek 선택지를 disabled 또는 미노출 처리
- [x] `defaultProvider` 변경과 `stageOverrides` 변경이 같은 localStorage payload에 저장됨
- [x] `auto`, `claude`, `codex`, 허용된 `deepseek-v4` 선택 상태가 모바일/데스크톱에서 깨지지 않음
- [x] `providerSettings.test.ts`가 UI 저장 로직의 타입/normalization 전제를 계속 만족
- [x] `npx tsc --noEmit` 통과

## 영향 범위

settings UI만 변경한다. `/api/run` stage override 전달은 Phase 3에서 이미 구현되어 있어야 한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/providerSettings.test.ts --reporter=basic
npx tsc --noEmit
```

수동 확인:
- `/settings`에서 stage override 값을 바꾸고 새로고침 후 유지되는지 확인
- DeepSeek가 허용 stage에서만 선택 가능한지 확인

## 실행 결과

### 1회차 (2026-05-16 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
설정 화면에 stage override 섹션을 추가했다. 기본 provider는 기존 선택지만 유지하고, DeepSeek는 stage별 opt-in 선택지로만 노출된다.

#### 변경 파일
- `ngd-studio/app/settings/page.tsx` (수정)
- `ngd-studio/lib/ai/settings.ts` (수정)
- `ngd-studio/lib/__tests__/providerSettings.test.ts` (수정)

#### 검증 결과
- [x] settings focused test: `npx vitest run lib/__tests__/providerSettings.test.ts --reporter=basic` → pass
- [x] 타입체크: `npx tsc --noEmit` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
