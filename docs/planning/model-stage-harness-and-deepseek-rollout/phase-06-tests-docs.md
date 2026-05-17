---
phase: 6
title: Tests / docs 정리
status: completed
depends_on: [5]
scope:
  - ngd-studio/lib/__tests__/
  - docs/planning/model-stage-harness-and-deepseek-rollout/
  - docs/planning/deepseek-v4-provider-roadmap/
intervention_likely: false
intervention_reason: ""
executor: haiku
---

# Phase 6: Tests / docs 정리

> **범위**: Tests / Documentation
> **난이도**: S
> **의존성**: Phase 5
> **영향 파일**: `lib/__tests__/`, planning docs

## 배경

Model stage harness와 DeepSeek rollout은 정책/검증 조건이 중요하다. 전체 결과를 문서화하고 regression test를 보강해야 후속 extractor/reviewer rollout 판단이 가능하다.

## 설계

provider, recommendation, harness focused tests를 정리한다. README에는 DeepSeek를 repo edit agent로 만들지 않는 결정, verifier/solver 우선순위, extractor/reviewer 보류 조건을 기록한다.

## 체크리스트

- [x] verifier/solver harness focused test 추가 또는 보강
- [x] provider settings/recommendation test 통과
- [x] `pnpm test` 또는 합리적 focused Vitest 명령 통과
- [x] README에 DeepSeek 사용/비사용 stage 기준 기록
- [x] 후속 후보를 `review-report-draft-stage` 또는 `extractor-vision-contract`로 기록

## 영향 범위

테스트와 문서 정리 phase다. production behavior 변경은 이전 phase에서 끝난 상태여야 한다.

## 검증

```bash
pnpm test
```

## 실행 결과

### 2026-05-17 Phase 6

- README에 `AI_STAGE_KEYS` 전체 DeepSeek 허용과 deterministic 단계 제외 기준을 기록했다.
- DeepSeek roadmap 문서에 설정 UI 정책과 extractor/reviewer 후속 조건을 반영했다.
- 후속 후보를 `review-report-draft-stage`, `extractor-vision-contract`로 기록했다.
- 검증: `pnpm test` 통과.
