---
phase: 3
title: openai-sdk tool use + agentic loop (Chat Completions function calling)
status: pending
depends_on: [1]
scope:
  - ngd-studio/lib/ai/providers/openaiSdk.ts
  - ngd-studio/lib/ai/__tests__/
executor: sonnet
intervention_likely: false
intervention_reason: ""
---

# Phase 3: openai-sdk tool use + agentic loop

> **범위**: Backend (TS)
> **난이도**: L
> **의존성**: Phase 1 완료 (host tool module + schema)
> **영향 파일**: `ngd-studio/lib/ai/providers/openaiSdk.ts`, 단위 테스트

## 배경

현재 `openaiSdk.ts` 는 `client.chat.completions.create` 1-shot 호출만 함. function calling 미사용, supportsTools=false.

본 phase 는 Chat Completions API 의 **function calling** + 자체 loop 직접 구현. Responses API 도입 안 함 (Phase 3 결정).

## 결정 사항 (확정 — 2026-05-19)

- 구현 방식: **A. Chat Completions function calling + 자체 loop**
- tool schema: Phase 1 의 `TOOL_SCHEMAS_OPENAI` 사용 (`{type: "function", function: {...}}` 형식)
- tool 실행: Phase 1 의 `executeHostTool` 호출
- `ProviderRunOptions.allowedTools` 필터링 호환
- maxTurns 한도 (기본 5)
- `supportsTools: true` 로 전환

## 설계

### loop 의사 코드

```typescript
let messages: ChatCompletionMessageParam[] = [{ role: "user", content: [...prompt + image blocks...] }];
let turns = 0;
const maxTurns = options?.maxTurns ?? 5;

while (turns < maxTurns) {
  turns++;
  const resp = await client.chat.completions.create({
    model, max_tokens, messages,
    tools: filteredOpenAISchemas,
  });
  const msg = resp.choices[0].message;
  messages.push(msg);  // assistant message
  // tool_calls 발견 시:
  //   각 tool_call 마다:
  //     - allowedTools 필터 통과 확인
  //     - executeHostTool 호출
  //     - { role: "tool", tool_call_id, content: <result> } 메시지 append
  //   loop 계속
  // finish_reason === "stop" 이면 종료
}
```

### event stream 변환

기존 openaiSdk 의 `events: AsyncIterable<ClaudeEvent>` 형태 유지:
- text content → `assistant` event
- tool_calls → `tool_use` event (input 은 `JSON.parse(arguments)`)
- tool message → `tool_result` event
- 종료 시 `result` event

### 모델 / max_tokens

기존 openaiSdk 의 상수 그대로 유지.

### 에러 처리

claude-sdk 와 동일 패턴 (API 에러 → result.error / tool 에러 → tool_result.error / maxTurns 초과 → result.error).

## 체크리스트

- [ ] `openaiSdk.ts` — `chat.completions.create` 호출을 agentic loop 로 교체
- [ ] `tool_calls` 파싱 + `executeHostTool` 호출 + tool message 회신
- [ ] `allowedTools` 옵션 honor — 미지정 시 빈 도구 목록 (1-shot 흐름과 동등) / 지정 시 해당 도구만 schema 전달
- [ ] `supportsTools: true` 로 전환
- [ ] 단위 테스트 — mock OpenAI client 로 (a) tool_calls 시퀀스, (b) allowedTools 필터링, (c) maxTurns 초과 시 에러, (d) supportsTools=true 검증

## 영향 범위

- openaiSdk.ts 호출 흐름 변경 (1-shot → multi-turn)
- 1-shot 호환: `allowedTools` 미지정 + 모델이 tool_calls 안 반환하면 1턴 종료
- API 비용 증가 (multi-turn) — extractor stage 만 영향

## 검증

```bash
cd ngd-studio && unset NODE_OPTIONS && npx tsc --noEmit
echo tsc=$?
npx vitest run lib/ai --reporter=basic
echo vitest=$?
cd ..
```

검증 통과 조건: tsc + vitest exit 0 + openaiSdk 단위 테스트 새 케이스 (a)~(d) 모두 pass + 기존 mock provider 의존 테스트 영향 없음.
