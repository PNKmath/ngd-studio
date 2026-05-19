---
phase: 4
title: cross-provider e2e + 회귀 검증
status: completed
depends_on: [2, 3]
scope:
  - ngd-studio/server/stages/__tests__/extractor.test.ts
  - ngd-studio/lib/ai/__tests__/
executor: qwen-fast
intervention_likely: false
intervention_reason: ""
---

# Phase 4: cross-provider e2e + 회귀 검증

> **범위**: Backend (TS) — 테스트만
> **난이도**: S
> **의존성**: Phase 2, 3 완료
> **영향 파일**: `extractor.test.ts`, `ngd-studio/lib/ai/__tests__/`

## 배경

Phase 2, 3 으로 두 SDK provider 가 tool use 가능해진 뒤, **4 provider 모두** extractor 흐름에서 동작하는지 cross-provider 테스트 추가. 회귀 가능성 (특히 orchestrator 통합 테스트의 mock provider supportsTools 변화) 확인.

## 설계

### 1. 4-provider parametric 테스트

```typescript
describe.each([
  ["claude-cli", claudeCliProvider],
  ["codex-cli", codexCliProvider],
  ["claude-sdk-mock", makeMockClaudeSdkProvider()],
  ["openai-sdk-mock", makeMockOpenaiSdkProvider()],
])("extractor with provider %s", (label, provider) => {
  it("completes Read(ref doc) → JSON output flow", async () => {
    // ...
  });
});
```

CLI provider 는 실 CLI 호출이 어려우므로 mock 으로 대체 (claude-cli mock 은 기존 테스트와 동일 패턴). SDK provider 는 Phase 2/3 에서 추가한 mock helper 활용.

### 2. supportsTools=false provider 거부 확인 보존

기존 `extractor_provider_unsupported_tools` 에러 테스트가 계속 통과하는지 확인 (claude-sdk / openai-sdk 가 true 로 전환됐어도 `deepseek-v4` 같은 false provider 가 여전히 거부됨).

### 3. 전체 회귀

- `npx vitest run` 전체 (286 + 본 task 신규)
- Python 빌드 2종 (extractor 흐름은 TS 만 영향이라 빌드 회귀는 가능성 낮으나 안전 확인)

## 체크리스트

- [x] 4-provider parametric extractor 테스트 추가
- [x] `supportsTools=false` provider 거부 테스트 보존 확인 (deepseek-v4 mock 으로)
- [x] 전체 vitest + Python 빌드 회귀 확인

## 영향 범위

- 테스트 코드만 추가 — production 영향 없음

## 검증

```bash
cd ngd-studio && unset NODE_OPTIONS && npx tsc --noEmit
echo tsc=$?
npx vitest run --reporter=basic
echo vitest=$?
cd ..

python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
echo exam=$?
python3 tools/build_template_showcase.py
echo sc=$?
```

검증 통과 조건: tsc + 전체 vitest + 두 Python 빌드 모두 exit 0 + 4-provider parametric 테스트 모두 pass.

## 실행 결과

### 회차 1 (run-1779202020-69508)

**상태**: completed

**요약**: 4-provider parametric 테스트 8개 (2 per provider × 4 providers) + deepseek-v4 supportsTools=false 거부 테스트 1개 추가. 총 vitest 42 tests in extractor.test.ts (before: 30), 전체 325 tests pass.

**변경 파일**:
- `ngd-studio/server/stages/__tests__/extractor.test.ts` — 4-provider parametric 블록 + deepseek-v4 거부 보존 테스트 추가 (~70줄)

**검증 결과**:
- tsc=0 (타입 오류 없음)
- vitest=0 (324 passed | 1 skipped / 325 total, 29 test files)
- exam=0 (Python HWPX 빌드 정상)
- sc=0 (template showcase 빌드 정상)

**추가 발견사항**: 없음. 기존 테스트와 완전히 독립적인 mock 패턴 재사용으로 구현 단순.

**질문**: 없음.

#### Scope Audit (orchestrator)
pass — extractor.test.ts + PHASE_FILE만.

#### Verification Re-run (orchestrator)
exit 0 — tsc + extractor.test.ts 42/42 pass.

#### Simplify (orchestrator)
1 file (extractor.test.ts) — 중복 `id: "claude-sdk" as const` 속성 제거. VERIFY pass.

#### Review (orchestrator)
pass — 4-provider parametric + deepseek-v4 거부 보존 정합, scope 이탈 없음. checklist.md 갱신은 orchestrator가 별도 처리.

#### Commit
`564faa0` test(ai): Phase 4 — 4-provider parametric cross-provider e2e 테스트 추가
