---
phase: 6
title: Roadmap 보정과 다음 task 후보
status: completed
depends_on: [5]
scope:
  - docs/planning/agent-provider-operating-model/
  - docs/planning/deepseek-v4-provider-roadmap/README.md
  - docs/planning/deepseek-v4-provider-roadmap/strategy-and-harness-decision.md
  - docs/planning/ai-provider-adapters/roadmap.md
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 6: Roadmap 보정과 다음 task 후보

> **범위**: Documentation
> **난이도**: S
> **의존성**: Phase 5
> **영향 파일**: `implementation-roadmap.md` 신규

## 배경

DeepSeek V4 provider roadmap은 API 호출 배관 prototype으로는 의미가 있지만, 실제 workflow 대체 계획으로는 부족하다. 새 operating model을 기준으로 기존 roadmap을 보정하고 다음 구현 task를 작게 나눠야 한다.

## 설계

`implementation-roadmap.md`를 추가한다. 문서는 다음 후보 task를 포함한다.

- `stage-runner-foundation`
- `deterministic-builder-runner`
- `deterministic-checker-rules`
- `verifier-model-harness`
- `solver-model-harness`
- `review-report-draft-harness`

각 후보 task마다 목표, 선행 조건, 제외 범위, 검증 기준을 간단히 적는다.

필요하면 기존 `deepseek-v4-provider-roadmap/README.md`와 `ai-provider-adapters/roadmap.md`에 새 문서 링크를 추가한다. 기존 완료 상태를 되돌리지는 않는다.

## 체크리스트

- [x] `implementation-roadmap.md` 신규 작성
- [x] 기존 DeepSeek provider 작업을 prototype plumbing으로 재라벨링
- [x] 다음 구현 task 후보를 4개 이상 작성
- [x] 각 후보 task의 선행 조건과 제외 범위를 명시
- [x] `deepseek-v4-provider-roadmap`과 `ai-provider-adapters` 문서에 새 operating model 링크 추가
- [x] 다음에 바로 `/phase-init`할 수 있는 추천 task 1개를 명시

## 영향 범위

문서 phase다. 기존 완료된 phase 상태를 되돌리지 않는다.

## 검증

```bash
test -f docs/planning/agent-provider-operating-model/implementation-roadmap.md
grep -n "stage-runner-foundation\\|deterministic-builder-runner\\|verifier-model-harness\\|prototype plumbing" docs/planning/agent-provider-operating-model/implementation-roadmap.md
```

## 실행 결과

### 2026-05-16

STATUS: completed

SUMMARY: 기존 DeepSeek/provider roadmap을 prototype plumbing으로 보정하고, `stage-runner-foundation` 등 다음 구현 task 후보와 추천 순서를 정리했다.

VERIFICATION: pass

#### Scope Audit (orchestrator)

pass - phase scope 내 문서만 변경.

#### Verification Re-run (orchestrator)

pass - phase 검증 명령 exit 0.
