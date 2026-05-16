---
phase: 4
title: Provider 운영 정책
status: completed
depends_on: [3]
scope:
  - docs/planning/agent-provider-operating-model/
  - docs/planning/deepseek-v4-provider-roadmap/strategy-and-harness-decision.md
  - docs/planning/ai-provider-adapters/roadmap.md
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/registry.ts
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/ai/recommendation.ts
intervention_likely: true
intervention_reason: "Claude Code/Codex/DeepSeek의 장기 책임 경계와 auto 추천 의미를 사용자 정책으로 확정해야 함."
executor: sonnet
---

# Phase 4: Provider 운영 정책

> **범위**: Documentation
> **난이도**: M
> **의존성**: Phase 3
> **영향 파일**: `provider-operating-policy.md` 신규

## 배경

Claude Code, Codex, DeepSeek V4는 모두 “AI provider”로 보이지만 실행 능력이 다르다. 한 UI에서 동일한 provider처럼 취급하면 사용자가 기대하는 기능과 실제 기능이 어긋난다.

## 설계

`provider-operating-policy.md`를 추가한다. 이 문서는 provider별 허용/금지 역할을 정책으로 고정한다.

초안 방향:

- Claude Code: 기존 `.claude/skills`와 file/tool agent 실행 가능, 장기적으로 orchestration 의존도 축소
- Codex: 로컬 CLI agent provider, Claude 대체/검증 provider 가능, 동일하게 orchestration 의존도 축소
- DeepSeek V4: API model provider, repo edit/hwp 직접 수정 금지, schema-bound stage call만 허용
- auto: 전체 job provider fallback이 아니라 stage-aware recommendation
- 서버 코드: orchestration, deterministic runner, telemetry, validation 책임

## 체크리스트

- [x] `provider-operating-policy.md` 신규 작성
- [x] Claude Code의 허용 역할과 줄여야 할 의존 영역을 명시
- [x] Codex의 허용 역할과 Claude와의 차이를 명시
- [x] DeepSeek V4의 허용 stage와 금지 영역을 명시
- [x] `auto`의 의미를 stage-aware recommendation으로 재정의
- [x] provider fallback/retry의 소유자를 서버 코드로 명시

## 영향 범위

정책 문서 phase다. 사용자 결정이 필요한 phase이므로 `/phase-run` 시작 전 확인이 필요하다.

## 검증

```bash
test -f docs/planning/agent-provider-operating-model/provider-operating-policy.md
grep -n "Claude Code\\|Codex\\|DeepSeek\\|auto\\|fallback\\|stage-aware" docs/planning/agent-provider-operating-model/provider-operating-policy.md
```

## 실행 결과

### 2026-05-16

STATUS: completed

SUMMARY: Claude Code, Codex, DeepSeek V4, auto recommendation, retry/fallback 소유권을 `provider-operating-policy.md`에 정책으로 고정했다.

VERIFICATION: pass

#### Scope Audit (orchestrator)

pass - 문서 phase 범위 내 파일만 변경.

#### Verification Re-run (orchestrator)

pass - phase 검증 명령 exit 0.
