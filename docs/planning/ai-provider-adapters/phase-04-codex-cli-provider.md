---
phase: 4
title: Codex CLI provider
status: completed
depends_on: [2, 3]
scope:
  - ngd-studio/lib/ai/providers/codexCli.ts
  - ngd-studio/lib/ai/
  - ngd-studio/lib/prompts.ts
  - ngd-studio/lib/__tests__/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: Codex CLI provider

> **범위**: Backend provider
> **난이도**: L
> **의존성**: Phase 2, Phase 3
> **영향 파일**: `lib/ai/providers/codexCli.ts`, provider tests

## 배경

1차 목표는 Claude 기존 동작을 보존하면서 Codex CLI를 선택 가능하게 만드는 것이다. Codex는 로컬 파일 접근과 명령 실행이 가능한 CLI agent이므로 Claude 대체 후보로 가장 적합하다. 단, Claude의 `Skill` 도구와 같은 이벤트를 그대로 내보낸다고 가정하면 안 된다.

## 설계

TDD 순서로 진행한다.

1. `codex exec --json` JSONL fixture를 먼저 만든다.
2. Codex fixture를 공통 provider event 또는 직접 `SSEEvent`로 변환하는 테스트를 작성한다.
3. `CodexCliProvider`가 `codex exec --json --cd <BASE_DIR> --sandbox danger-full-access --ask-for-approval never` 형태로 실행되도록 구현한다.
4. prompt에는 `.claude/skills`와 `.claude/agents`를 그대로 읽고 동일 workflow를 수행하라는 provider-specific preamble을 추가한다.

Codex 이벤트에서 Claude의 `tool_use`와 1:1 매핑이 불가능한 경우, 텍스트 로그 기반 stage detection과 output file scan fallback을 우선 사용한다.

## 체크리스트

- [x] Codex JSONL fixture 기반 parser 테스트 작성
- [x] Codex provider 이벤트가 공통 `SSEEvent`로 변환되는 테스트 작성
- [x] `CodexCliProvider` spawn 구현
- [x] Codex prompt preamble에 `.claude/skills` reuse 지시 추가
- [x] provider registry에 `codex` 등록
- [x] Codex failure/exit code 처리 테스트 추가
- [x] Claude baseline 테스트가 계속 통과함

## 영향 범위

Codex provider는 신규 경로이며 기본값은 여전히 Claude다. 실제 Codex CLI 실행은 로컬 `codex` 설치와 인증 상태에 의존하므로, 단위 테스트는 fixture 중심으로 둔다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/provider*.test.ts --reporter=basic
pnpm test
codex --version
```

## 실행 결과

### 2026-05-16 — Phase 4

#### Summary
- `lib/ai/providers/codexCli.ts`에 Codex CLI provider, prompt preamble, `codex exec --json --cd ... --sandbox danger-full-access --ask-for-approval never` args builder를 추가했다.
- Codex JSONL을 Claude-compatible text/tool/result 이벤트로 낮춰 기존 `transformToSSE` stage/file/result 변환을 재사용하게 했다.
- provider registry에 `codex`를 등록하고 registry 테스트 기대값을 갱신했다.
- `providerCodex.test.ts`에서 JSONL parsing, SSE 변환, Bash/file fallback, failure result handling, malformed line 무시 동작을 fixture로 고정했다.

#### Scope Audit (orchestrator)
- pass — changed files are within Phase 4 scope: `ngd-studio/lib/ai/`, `ngd-studio/lib/__tests__/providerCodex.test.ts`, `ngd-studio/lib/__tests__/providerRegistry.test.ts`

#### Verification Re-run (orchestrator)
- pass — `npx vitest run lib/__tests__/provider*.test.ts --reporter=basic` (14 tests)
- pass — `pnpm test` (76 tests)
- pass — `codex --version` (`codex-cli 0.130.0`)
- pass — `npx tsc --noEmit`

#### Review (orchestrator)
- pass — Codex is now selectable via registry while default `auto` remains Claude.

#### Commit
- pending — commit will be recorded in `checklist.md` after local commit creation.
