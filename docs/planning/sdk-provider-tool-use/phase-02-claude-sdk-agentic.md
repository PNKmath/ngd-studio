---
phase: 2
title: claude-sdk tool use + agentic loop (vanilla @anthropic-ai/sdk)
status: pending
depends_on: [1]
scope:
  - ngd-studio/lib/ai/providers/claudeSdk.ts
  - ngd-studio/lib/ai/__tests__/
executor: sonnet
intervention_likely: false
intervention_reason: ""
---

# Phase 2: claude-sdk tool use + agentic loop

> **범위**: Backend (TS)
> **난이도**: L
> **의존성**: Phase 1 완료 (host tool module + schema)
> **영향 파일**: `ngd-studio/lib/ai/providers/claudeSdk.ts`, 단위 테스트

## 배경

현재 `claudeSdk.ts` 는 `client.messages.create` 1-shot 호출만 함. tool_use 응답 처리 없음, supportsTools=false. extractor 호출 시 명시적 에러.

본 phase 는 vanilla `@anthropic-ai/sdk` 를 사용해 messages.create 를 **반복 호출** 하는 agentic loop 직접 구현 (Claude Agent SDK 도입 안 함).

## 결정 사항 (확정 — 2026-05-19)

- 구현 방식: **A. vanilla SDK + 자체 loop** (Claude Agent SDK 도입 안 함)
- tool schema: Phase 1 의 `TOOL_SCHEMAS_ANTHROPIC` 사용
- tool 실행: Phase 1 의 `executeHostTool` 호출
- `ProviderRunOptions.allowedTools` 필터링 호환 (e.g. `["Read", "Grep", "Glob"]` 만 모델에 전달)
- maxTurns 한도 (기본 5, options 로 override)
- `supportsTools: true` 로 전환

## 설계

### loop 의사 코드

```typescript
let messages: MessageParam[] = [{ role: "user", content: [...prompt + image blocks...] }];
let turns = 0;
const maxTurns = options?.maxTurns ?? 5;

while (turns < maxTurns) {
  turns++;
  const resp = await client.messages.create({
    model, max_tokens, system,
    tools: filteredAnthropicSchemas,
    messages,
  });
  // text 블록은 누적 (최종 응답용)
  // tool_use 블록 발견 시:
  //   - allowedTools 필터 통과 확인
  //   - executeHostTool 호출
  //   - tool_result 메시지로 append → 다음 turn
  // stop_reason === "end_turn" 이면 종료
}
```

### event stream 변환

기존 SDK provider 의 `events: AsyncIterable<ClaudeEvent>` 형태를 유지하기 위해:
- 각 turn 의 text 블록 → `assistant` event
- tool_use → `tool_use` event (UI/SSE 용)
- tool_result → `tool_result` event
- 종료 시 `result` event (success/error)

### 모델 / max_tokens

기존 1-shot 호출에서 사용하던 model 명 그대로 (claudeSdk.ts 상수). max_tokens 도 기존 유지 + agentic loop 의 각 turn 마다 사용.

### 에러 처리

- API 에러 → `result` event subtype="error" + 에러 메시지 stderr 로
- tool 실행 에러 → tool_result 에 error 메시지 담아 모델에 회신 (loop 계속)
- maxTurns 초과 → `result` event subtype="error" + "max turns exceeded"

## 체크리스트

- [ ] `claudeSdk.ts` — `messages.create` 호출을 agentic loop 로 교체
- [ ] tool_use 블록 파싱 + `executeHostTool` (Phase 1) 호출 + tool_result 회신
- [ ] `allowedTools` 옵션 honor — 미지정 시 빈 도구 목록 (1-shot 흐름과 동등) / 지정 시 해당 도구만 schema 전달
- [ ] `supportsTools: true` 로 전환
- [ ] 단위 테스트 — mock Anthropic client 로 (a) tool_use 시퀀스, (b) allowedTools 필터링, (c) maxTurns 초과 시 에러, (d) supportsTools=true 검증

## 영향 범위

- claudeSdk.ts 호출 흐름 변경 (1-shot → multi-turn)
- 1-shot 호환: `allowedTools` 미지정 + 모델이 tool_use 안 호출하면 1턴에 종료 → 기존 단순 텍스트 호출 케이스 영향 없음
- API 비용 증가 (multi-turn) — extractor 같은 tool-use stage 만 영향, solver/verifier 등은 기존대로

## 검증

```bash
cd ngd-studio && unset NODE_OPTIONS && npx tsc --noEmit
echo tsc=$?
npx vitest run lib/ai --reporter=basic
echo vitest=$?
cd ..

# claude-sdk provider 의 supportsTools 확인 + 1-shot fallback 동작
```

검증 통과 조건: tsc + vitest exit 0 + claudeSdk 단위 테스트 새 케이스 (a)~(d) 모두 pass + 기존 mock provider 의존 테스트 (orchestrator.*) 영향 없음.
