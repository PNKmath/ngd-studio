---
phase: 5
title: StageRunner 아키텍처 초안
status: completed
depends_on: [4]
scope:
  - docs/planning/agent-provider-operating-model/
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/retry.ts
  - ngd-studio/lib/ai/recommendation.ts
  - ngd-studio/lib/prompts.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 5: StageRunner 아키텍처 초안

> **범위**: Documentation
> **난이도**: M
> **의존성**: Phase 4
> **영향 파일**: `stage-runner-architecture.md` 신규

## 배경

현재 `/api/run`은 전체 job prompt를 provider에 넘긴다. 목표 구조는 앱 서버가 stage를 직접 실행하고, 필요한 순간에만 Claude/Codex/DeepSeek model provider를 호출하는 것이다.

## 설계

`stage-runner-architecture.md`를 추가한다. 이 문서는 구현 가능한 TypeScript 인터페이스 초안을 포함한다.

다룰 항목:

- `StageRunner<Input, Output>` 후보 인터페이스
- `StageModelProvider` 또는 기존 `AIProviderAdapter` 확장 방향
- SSE event emission 책임
- job cache read/write 책임
- schema validation 위치
- deterministic validator 위치
- provider retry/fallback/telemetry 흐름
- 기존 prompt-based provider와의 migration path

코드는 작성하지 않지만, 후속 구현자가 바로 phase-init할 수 있을 정도로 파일/모듈 후보를 구체화한다.

## 체크리스트

- [x] `stage-runner-architecture.md` 신규 작성
- [x] `StageRunner` 인터페이스 초안 작성
- [x] model call provider와 file/tool agent provider의 타입 경계를 제안
- [x] SSE event, job metadata, cache write 책임을 서버 runner에 배치
- [x] schema validation과 deterministic validator 흐름을 설계
- [x] retry/fallback/telemetry 순서를 기존 `retry.ts`와 연결
- [x] prompt-based Claude/Codex workflow에서 stage runner로 가는 migration path를 제안

## 영향 범위

문서 phase다. 후속 구현 task의 기준 설계가 된다.

## 검증

```bash
test -f docs/planning/agent-provider-operating-model/stage-runner-architecture.md
grep -n "StageRunner\\|StageModelProvider\\|SSE\\|telemetry\\|fallback\\|migration" docs/planning/agent-provider-operating-model/stage-runner-architecture.md
```

## 실행 결과

### 2026-05-16

STATUS: completed

SUMMARY: `StageRunner`/`StageModelProvider` 타입 경계, SSE/cache/validation/retry/telemetry 책임, legacy prompt workflow migration path를 설계했다.

VERIFICATION: pass

#### Scope Audit (orchestrator)

pass - 문서 phase 범위 내 파일만 변경.

#### Verification Re-run (orchestrator)

pass - phase 검증 명령 exit 0.
