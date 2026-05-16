---
phase: 5
title: Provider telemetry 축적
status: completed
depends_on: [4]
scope:
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/ai/retry.ts
  - ngd-studio/app/api/jobs/route.ts
  - ngd-studio/lib/__tests__/providerRetry.test.ts
  - ngd-studio/lib/__tests__/providerTelemetry.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 5: Provider telemetry 축적

> **범위**: Backend
> **난이도**: M
> **의존성**: Phase 4
> **영향 파일**: `ngd-studio/server/sse.ts`

## 배경

로드맵은 자동 추천을 바로 하드코딩하지 않고, provider별 품질/속도/비용 데이터를 작업 로그에 남긴 뒤 충분한 관측치가 쌓인 stage부터 추천 규칙을 도입하라고 한다.

현재 `server/sse.ts`는 job JSON에 `requestedProvider`, `provider`, `status`, `startedAt`, `finishedAt`, `outputFile`, `resultSummary` 정도를 기록한다. provider attempt/retry log도 존재하지만 telemetry 구조는 없다.

## 설계

job metadata JSON에 provider telemetry 배열을 추가한다. 각 항목은 stage key, requested provider, resolved provider, attempt, status, elapsed ms, retry 여부, error summary, 외부 API 비용 필드를 포함한다. 비용은 DeepSeek adapter가 값을 제공하지 못하면 `undefined`로 둔다.

Phase 5는 기록 구조와 조회 가능성을 만드는 작업이며, 추천 규칙은 Phase 6에서 다룬다.

## 체크리스트

- [x] provider attempt 시작/종료 시 elapsed ms를 측정해 job JSON에 기록
- [x] requested provider, resolved provider, attempt, retry 여부, final status를 telemetry 항목으로 저장
- [x] 외부 API provider 비용 필드를 optional로 설계하고 값이 없어도 JSON 저장이 깨지지 않음
- [x] `app/api/jobs/route.ts` 또는 기존 job 조회 경로가 telemetry 포함 JSON을 반환
- [x] provider retry 테스트에 telemetry에 필요한 상태 전이 case 추가
- [x] `npx vitest run lib/__tests__/providerRetry.test.ts lib/__tests__/providerTelemetry.test.ts --reporter=basic` 통과

## 영향 범위

job metadata schema가 확장된다. 기존 job JSON을 읽는 UI가 추가 필드를 무시할 수 있어야 한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/providerRetry.test.ts lib/__tests__/providerTelemetry.test.ts --reporter=basic
npx tsc --noEmit
```

수동 확인:
- 테스트 job 실행 후 `ngd-studio/data/jobs/<jobId>.json`에 telemetry 배열이 생성되는지 확인

## 실행 결과

### 1회차 (2026-05-16 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: codex

#### 요약
provider attempt telemetry 구조를 추가하고 SSE job JSON에 기록되게 했다. telemetry는 payload 본문 없이 provider, stage, attempt, elapsed ms, retry, status, optional cost만 저장한다.

#### 변경 파일
- `ngd-studio/server/sse.ts` (수정)
- `ngd-studio/lib/ai/retry.ts` (수정)
- `ngd-studio/lib/ai/index.ts` (수정)
- `ngd-studio/lib/__tests__/providerRetry.test.ts` (수정)
- `ngd-studio/lib/__tests__/providerTelemetry.test.ts` (신규)

#### 검증 결과
- [x] telemetry/retry focused tests: `npx vitest run lib/__tests__/providerRetry.test.ts lib/__tests__/providerTelemetry.test.ts --reporter=basic` → pass
- [x] 타입체크: `npx tsc --noEmit` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
