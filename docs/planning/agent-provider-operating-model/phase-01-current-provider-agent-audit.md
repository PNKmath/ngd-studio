---
phase: 1
title: 현행 Provider/Agent 감사
status: completed
depends_on: []
scope:
  - docs/planning/agent-provider-operating-model/
  - CLAUDE.md
  - ngd-studio/lib/prompts.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/ai/
  - .claude/skills/ngd-exam-create/SKILL.md
  - .claude/skills/ngd-exam-review/SKILL.md
  - .claude/agents/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: 현행 Provider/Agent 감사

> **범위**: Documentation
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `current-provider-agent-audit.md` 신규

## 배경

현재 Studio는 provider adapter를 갖고 있지만, 실제 workflow는 `ngd-studio/lib/prompts.ts`가 만든 큰 prompt를 Claude/Codex CLI에 넘기고 `.claude/skills`와 `.claude/agents`가 수행한다. DeepSeek V4 같은 API provider는 같은 방식으로 workflow를 수행할 수 없다.

먼저 현재 구조를 추측 없이 문서화해야 이후 stage contract와 runner 설계를 정확히 할 수 있다.

## 설계

`current-provider-agent-audit.md`를 추가한다. 문서는 최소한 다음 항목을 포함한다.

- `/api/run` 요청이 `server/sse.ts`에서 어떻게 provider로 전달되는지
- `buildCreatePrompt`, `buildResumePrompt`, `buildCropPrompt`, `buildReviewPrompt`가 어떤 skill 호출 지시를 만드는지
- `claudeCliProvider`, `codexCliProvider`, `deepseekV4Provider`의 실행 능력 차이
- `.claude/skills/ngd-exam-create/SKILL.md`의 orchestration 책임
- `.claude/agents/*.md`의 stage별 파일/tool 사용 책임
- 현 구조에서 DeepSeek가 바로 대체할 수 없는 지점

## 체크리스트

- [x] `current-provider-agent-audit.md` 신규 작성
- [x] `ngd-studio/lib/prompts.ts`의 skill 호출 prompt 4개를 실제 함수명과 함께 기록
- [x] `server/sse.ts`의 provider 선택, retry, telemetry 경로를 요약
- [x] `lib/ai/providers/*`별 파일/tool 실행 가능 여부를 표로 정리
- [x] `.claude/skills`와 `.claude/agents`의 책임을 stage별로 정리
- [x] DeepSeek API provider가 기존 prompt 기반 workflow를 대체하지 못하는 이유를 명시

## 영향 범위

문서 phase다. 코드와 기존 phase 파일은 변경하지 않는다.

## 검증

```bash
test -f docs/planning/agent-provider-operating-model/current-provider-agent-audit.md
grep -n "buildCreatePrompt\\|server/sse.ts\\|claudeCliProvider\\|codexCliProvider\\|deepseekV4Provider\\|ngd-exam-create" docs/planning/agent-provider-operating-model/current-provider-agent-audit.md
```

## 실행 결과

### 2026-05-16

STATUS: completed

SUMMARY: 현행 `/api/run` provider 경로, prompt builder의 skill 호출, CLI/API provider 능력 차이, `.claude/skills`와 `.claude/agents`의 stage 책임을 `current-provider-agent-audit.md`에 문서화했다.

VERIFICATION: pass

#### Scope Audit (orchestrator)

pass - 문서 phase 범위 내 파일만 변경.

#### Verification Re-run (orchestrator)

pass - phase 검증 명령 exit 0.
