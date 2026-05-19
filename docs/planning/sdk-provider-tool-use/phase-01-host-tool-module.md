---
phase: 1
title: host-side tool module (Read/Grep/Glob + sandbox)
status: completed
depends_on: []
scope:
  - ngd-studio/lib/ai/tools/
  - ngd-studio/lib/ai/__tests__/
executor: qwen
intervention_likely: false
intervention_reason: ""
---

# Phase 1: host-side tool module (Read/Grep/Glob + sandbox)

> **범위**: Backend (TS)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `ngd-studio/lib/ai/tools/` (신규 모듈), `ngd-studio/lib/ai/__tests__/`

## 배경

claude-sdk / openai-sdk 가 tool use 를 지원하려면 host 측에서 tool 을 **실제로 실행**해야 한다. CLI provider 는 CLI 자체가 Read 를 수행하나, SDK 는 모델이 tool_use 블록을 반환하면 host 가 직접 파일을 읽고 결과를 회신해야 한다.

본 phase 는 두 SDK provider 가 공유할 **host-side tool 실행 모듈** 을 단독 작성. Phase 2, 3 의 선행.

## 결정 사항 (확정)

- tool 집합: **Read / Grep / Glob** (claude-cli 와 정합, Bash/Write/Edit 제외)
- sandbox: `docs/extractor-reference/` whitelist (path normalize 후 prefix 검사)
- 경로 비교: `path.resolve` + `path.relative` 기반 (Windows + macOS 양쪽)

## 설계

### 1. tool 인터페이스

```typescript
// ngd-studio/lib/ai/tools/types.ts (또는 index.ts)
export interface HostToolInput {
  Read: { path: string };
  Grep: { pattern: string; path?: string };
  Glob: { pattern: string; path?: string };
}

export interface HostToolContext {
  /** sandbox 허용 디렉터리 (절대경로). 기본 `<repoRoot>/docs/extractor-reference` */
  allowedRoot: string;
  /** repo root (cwd 보조용) */
  repoRoot: string;
}

export type HostToolName = keyof HostToolInput;

export async function executeHostTool<N extends HostToolName>(
  name: N,
  input: HostToolInput[N],
  ctx: HostToolContext,
): Promise<{ ok: true; output: string } | { ok: false; error: string }>;
```

### 2. sandbox 강제 (모든 tool 공통)

```typescript
function withinSandbox(target: string, allowedRoot: string): boolean {
  const abs = path.resolve(target);
  const root = path.resolve(allowedRoot);
  const rel = path.relative(root, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
```

sandbox 밖 경로 호출 → `{ ok: false, error: "sandbox: path '<x>' outside allowed root '<root>'" }`.

### 3. Read

```typescript
// fs.readFile(path, "utf-8"), 최대 100KB 제한 (extractor ref doc 은 < 20KB)
```

### 4. Grep

```typescript
// glob 으로 sandbox 내 .md 파일 수집 → 각 파일에 정규식 검색 → "path:line:match" 줄 리턴
// 결과 truncate 50줄
```

### 5. Glob

```typescript
// glob 모듈 (`fast-glob` 등 기존 dep 활용) — sandbox 내 매칭만 반환
// 결과 100파일 limit
```

### 6. tool schema export (Anthropic / OpenAI 호환)

```typescript
// ngd-studio/lib/ai/tools/schema.ts
export const TOOL_SCHEMAS_ANTHROPIC = [
  { name: "Read", description: "...", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  // Grep, Glob 동일
];

export const TOOL_SCHEMAS_OPENAI = [
  { type: "function", function: { name: "Read", description: "...", parameters: { ... } } },
  // ...
];
```

두 schema 는 같은 정의의 형식 변환만 다름 — 동일 source 에서 derive 권장.

## 체크리스트

- [x] `ngd-studio/lib/ai/tools/index.ts` (또는 `tools/host.ts`) 작성 — `executeHostTool` + sandbox 체크
- [x] Read / Grep / Glob 각각 구현 (sandbox 위반 시 error 반환)
- [x] `ngd-studio/lib/ai/tools/schema.ts` — Anthropic + OpenAI 형식 schema export
- [x] 단위 테스트 — sandbox 내 정상 read, sandbox 외 거부, Glob/Grep 정상 동작, 100KB 초과 거부
- [x] tsc + vitest 통과 (기존 286 + 신규 ~5건)

## 영향 범위

- 신규 모듈 `ngd-studio/lib/ai/tools/` (Phase 2, 3 이 import)
- 기존 코드 영향 없음 (extractor / provider 호출부 변경 없음)
- crossplatform: `path.resolve` / `path.relative` 사용 → Windows + macOS 양쪽 동작

## 검증

```bash
cd ngd-studio && unset NODE_OPTIONS && npx tsc --noEmit
echo tsc=$?
npx vitest run lib/ai/tools --reporter=basic
echo vitest=$?
cd ..

# sandbox 동작 sanity (테스트 코드와 별개)
node -e "
const { executeHostTool } = require('./ngd-studio/dist/lib/ai/tools/index.js');
// 또는 ts-node / vitest 안에서 확인
"
```

검증 통과 조건: tsc + vitest exit 0 + sandbox enforcement 단위 테스트 pass.

## 실행 결과

### 1회차 (2026-05-19 23:55 KST) — 완료

**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`ngd-studio/lib/ai/tools/` 신규 모듈 작성. `executeHostTool` + `withinSandbox` sandbox 체크를 포함한 Read / Grep / Glob 구현. Anthropic / OpenAI 형식 schema export. 단위 테스트 19건 전부 pass. 전체 테스트 304 pass (기존 285 + 신규 19).

외부 glob 라이브러리 없이 `fs/promises.readdir` 재귀 walk + 자체 `globToRegex` 구현 (Node v20 @types 호환).

#### 변경 파일
- `ngd-studio/lib/ai/tools/index.ts` (신규, +252줄) — executeHostTool, withinSandbox, Read/Grep/Glob 구현
- `ngd-studio/lib/ai/tools/schema.ts` (신규, +91줄) — TOOL_SCHEMAS_ANTHROPIC, TOOL_SCHEMAS_OPENAI
- `ngd-studio/lib/ai/__tests__/hostTools.test.ts` (신규, +233줄) — 19개 단위 테스트

#### 검증 결과
- [x] tsc --noEmit: `cd ngd-studio && npx tsc --noEmit` → exit 0
- [x] vitest (신규): `npx vitest run lib/ai/__tests__/hostTools.test.ts` → 19/19 pass
- [x] vitest (전체): `npx vitest run` → 304 passed, 1 skipped (exit 0)
- [x] sandbox 거부: `/etc/passwd` → `{ ok: false, error: "sandbox: ..." }` 확인
- [x] 100 KB 초과 거부: >100KB 파일 → `{ ok: false, error: "Read: file exceeds 100 KB..." }` 확인

#### 추가 발견사항
- `@types/node` v20은 `fs/promises.glob`을 미지원 → `readdir` 재귀 walk + 자체 globToRegex로 대체
- TypeScript 환경에서 문자열 리터럴 내 `[]` 포함 시 파서 오류 → Set 기반으로 특수문자 판별

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 5 files in scope (tools/index.ts, tools/schema.ts, __tests__/hostTools.test.ts, PHASE_FILE 자기참조).

#### Verification Re-run (orchestrator)
exit 0 — tsc --noEmit 통과 + hostTools.test.ts 19/19 pass (spec의 `lib/ai/tools` 필터는 매칭 없음; worker가 정확한 경로 `lib/ai/__tests__/hostTools.test.ts`로 검증함).

#### Simplify (orchestrator)
1 file (index.ts), 3 edits — sandboxError() 헬퍼 추출 + 3 사용처 통합 (~18줄 감소). VERIFY pass.

#### Review (orchestrator)
pass — 스펙 일치, sandbox 로직(prefix-attack/path traversal/root 케이스) 정확, scope 누출 없음, 검증 기록 정합.
