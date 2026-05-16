---
phase: 3
title: Stage override 데이터 구조
status: completed
depends_on: [2]
scope:
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/__tests__/providerSettings.test.ts
  - ngd-studio/lib/__tests__/providerRegistry.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: Stage override 데이터 구조

> **범위**: Both
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `ngd-studio/lib/ai/settings.ts`, `ngd-studio/server/sse.ts`

## 배경

현재 설정은 `AISettings.defaultProvider` 하나만 저장한다. `useJobRunner.startJob`은 `provider ?? readDefaultProvider()` 값을 `/api/run` body에 전달하고, `server/sse.ts`는 body의 `provider`를 normalize/resolve해 전체 job provider로 사용한다.

로드맵의 3차 목표는 작업 전체 기본 provider와 stage override를 분리하는 것이다.

## 설계

stage key 타입을 추가한다. 초기 key는 `create.extractor`, `create.solver`, `create.verifier`, `review.reviewer`로 제한한다. `AISettings`에는 `defaultProvider`와 `stageOverrides`를 함께 저장하고, 기존 localStorage payload는 migration 없이 기본값으로 보정한다.

`/api/run` 요청 body에는 stage override map을 추가하되, SSE 서버는 Phase 3에서 metadata 저장과 validation까지만 담당한다. 실제 stage별 실행 분기는 Phase 4 이후 UI와 함께 검증 가능한 범위로 확장한다.

## 체크리스트

- [x] `AIStageKey` 또는 동등한 stage key 타입을 추가하고 허용 key를 테스트
- [x] `AISettings`에 `stageOverrides`를 추가하고 기존 저장값을 안전하게 읽도록 보정
- [x] `writeAISettings`가 invalid provider와 invalid stage key를 저장하지 않도록 테스트
- [x] `useJobRunner.ts`가 default provider와 stage override를 `/api/run` body에 함께 전달
- [x] `server/sse.ts`가 stage override map을 validate하고 job metadata JSON에 저장
- [x] 기존 `provider` 단일 요청 body가 계속 동작함을 테스트 또는 수동 검증
- [x] `npx vitest run lib/__tests__/providerSettings.test.ts --reporter=basic` 통과

## 영향 범위

설정 저장 구조와 SSE request body가 바뀐다. 기존 localStorage 사용자는 값이 없거나 구버전이어도 `DEFAULT_AI_SETTINGS`로 복구되어야 한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/providerSettings.test.ts --reporter=basic
npx tsc --noEmit
```

## 실행 결과

### 1회차 (2026-05-16 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
`AIStageKey`와 `stageOverrides` 설정 구조를 추가했다. 클라이언트는 `/api/run` body에 override map을 보내고, SSE 서버는 이를 검증해 job metadata에 저장한다.

#### 변경 파일
- `ngd-studio/lib/ai/types.ts` (수정)
- `ngd-studio/lib/ai/settings.ts` (수정)
- `ngd-studio/lib/useJobRunner.ts` (수정)
- `ngd-studio/server/sse.ts` (수정)
- `ngd-studio/lib/__tests__/providerSettings.test.ts` (수정)

#### 검증 결과
- [x] settings focused test: `npx vitest run lib/__tests__/providerSettings.test.ts --reporter=basic` → pass
- [x] 타입체크: `npx tsc --noEmit` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
