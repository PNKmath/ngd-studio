---
phase: 1
title: extractor reference doc 5종 작성 + provider supportsTools capability flag 추가
status: completed
depends_on: []
scope:
  - docs/extractor-reference/
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/providers/claudeCli.ts
  - ngd-studio/lib/ai/providers/codexCli.ts
  - ngd-studio/lib/ai/providers/claudeSdk.ts
  - ngd-studio/lib/ai/providers/openaiSdk.ts
  - ngd-studio/lib/ai/providers/deepseekV4.ts
  - ngd-studio/lib/ai/__tests__/
  - ngd-studio/lib/__tests__/
  - ngd-studio/server/stages/__tests__/
executor: sonnet
intervention_likely: false
intervention_reason: ""
---

# Phase 1: reference doc 5종 작성 + provider capability flag

> **범위**: Docs + Backend (TS provider abstraction)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `docs/extractor-reference/*.md` (5종 신규), `lib/ai/types.ts` (`AIProviderAdapter.supportsTools` 추가), 5개 provider 어댑터 (flag 값 설정), provider 단위 테스트

## 배경

Phase 2 (extractor agentic 전환) 의 선행 작업. agentic 전환 자체는 다음 phase 에서 수행하나, 본 phase 에서:
1. agentic LLM 이 참조할 ref doc 5종을 미리 준비
2. provider abstraction 에 tool use 지원 여부 flag 를 도입

이 분리의 이유: ref doc 작성은 extractor 호출 흐름과 독립적 (LLM 이 prompt 인라인이든 Read tool 이든 본문은 동일). flag 추가도 extractor 변경 없이 provider 측 변경만. Phase 2 (실 변환) 이전에 안전하게 commit 가능한 단위.

## 결정 사항 (확정 — 2026-05-19)

- agentic 추상화: capability flag (`supportsTools`)
- 우선 지원 provider: `claude-cli`, `codex-cli` (둘 다 native Read tool)
- 후속 phase: `claude-sdk`, `openai-sdk` 의 tool use 구현
- `deepseek-v4`: `supportsTools=false`

## 작업 구성

### 1. reference doc 5종 작성

`docs/extractor-reference/` 에 추가. 표준 구조 (기존 `syn_div_pascal.md` 따름):

```markdown
## {type tag} ({한글 명칭})

### 입력 dict 스키마
{ JSON 예시 }

### 필드 설명
{ 표 — 필드별 의미 }

### 셀 규칙 (필요 시)
{ generator 가 기대하는 cell 분기 / equation vs text / span 처리 등 }

### 예시 1~2개
{ 양식지 사례 기반 }
```

- `bogi.md` — bogi_box_3/4/6items, ㄱ/ㄴ/ㄷ 라벨
- `proposition.md` — pq_proposition_table_5x5
- `choice_image.md` — choice_image_5options + 이미지 placeholder
- `choice_grid.md` — choice_grid_2cols/3cols
- `inc_dec.md` — inc_dec_1x~4x 가변 증감표

각 doc 의 스키마/필드/예시는 `tables.py` 의 generator 함수와 `docs/planning/ngd-create-v4-coherence/schema.md`, `fixture_audit.md` 를 참조해 도출.

### 2. provider capability flag

`ngd-studio/lib/ai/types.ts`:

```typescript
export interface AIProviderAdapter {
  id: ResolvedAIProviderId;
  label: string;
  supportsTools: boolean;  // 신규
  run(prompt: string, options?: ProviderRunOptions): ProviderRunResult;
}
```

5개 provider 의 객체 리터럴에 flag 값 설정:
- `claude-cli`: `true`
- `codex-cli`: `true`
- `claude-sdk`: `false` (현재) — 후속 phase 로 미룸
- `openai-sdk`: `false` (현재) — 후속 phase 로 미룸
- `deepseek-v4`: `false`

### 3. 테스트

- 각 provider 의 `supportsTools` 값을 검증하는 단위 테스트
- ref doc 5종 파일 존재 검증 (선택 — fs 기반 sanity)

## 체크리스트

- [x] `docs/extractor-reference/bogi.md` 작성 (표준 구조)
- [x] `docs/extractor-reference/proposition.md` 작성
- [x] `docs/extractor-reference/choice_image.md` 작성
- [x] `docs/extractor-reference/choice_grid.md` 작성
- [x] `docs/extractor-reference/inc_dec.md` 작성
- [x] `AIProviderAdapter.supportsTools` 필드 추가 + 5개 provider 값 설정 + 단위 테스트

## 영향 범위

- 신규 doc 5개 (extractor 가 본 phase 에선 아직 사용하지 않음 — Phase 2 에서 연결)
- provider 타입 시그니처 1줄 추가 + 5개 객체 리터럴에 flag 값
- 단위 테스트 추가

## 검증

```bash
cd ngd-studio && unset NODE_OPTIONS && npx tsc --noEmit
echo tsc=$?
npx vitest run lib/ai --reporter=basic
echo vitest=$?
cd ..

# ref doc 5종 존재 확인
for t in bogi proposition choice_image choice_grid inc_dec; do
  test -f "docs/extractor-reference/$t.md" || { echo "missing $t.md"; exit 1; }
done
echo "all docs present"
```

검증 통과 조건: tsc + vitest exit 0 + 5개 doc 파일 존재.

---

## 실행 결과

### 1회차 (2026-05-19 20:09 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
ref doc 5종 (`bogi.md`, `proposition.md`, `choice_image.md`, `choice_grid.md`, `inc_dec.md`) 을 `docs/extractor-reference/` 에 신규 작성. `AIProviderAdapter` 인터페이스에 `supportsTools: boolean` 필드를 추가하고 5개 provider 객체 리터럴에 값을 설정. 기존 테스트 mock 객체 10개도 `supportsTools: false` 로 업데이트해 tsc 통과. 신규 단위 테스트 6개 vitest 통과.

#### 변경 파일
- `docs/extractor-reference/bogi.md` (신규, +91줄)
- `docs/extractor-reference/proposition.md` (신규, +85줄)
- `docs/extractor-reference/choice_image.md` (신규, +72줄)
- `docs/extractor-reference/choice_grid.md` (신규, +106줄)
- `docs/extractor-reference/inc_dec.md` (신규, +124줄)
- `ngd-studio/lib/ai/types.ts` (수정, +5줄 — supportsTools 필드 추가)
- `ngd-studio/lib/ai/providers/claudeCli.ts` (수정, +1줄)
- `ngd-studio/lib/ai/providers/codexCli.ts` (수정, +1줄)
- `ngd-studio/lib/ai/providers/claudeSdk.ts` (수정, +1줄)
- `ngd-studio/lib/ai/providers/openaiSdk.ts` (수정, +1줄)
- `ngd-studio/lib/ai/providers/deepseekV4.ts` (수정, +1줄)
- `ngd-studio/lib/ai/__tests__/providerSupportsTools.test.ts` (신규, +39줄)
- 기존 테스트 mock 객체 10개에 `supportsTools: false` 추가 (solver/verifier/extractor/orchestrator/stageFoundation/deepSeek 테스트)

#### 검증 결과
- [x] tsc: `npx tsc --noEmit` → exit 0
- [x] vitest: `npx vitest run lib/ai --reporter=basic` → 6/6 pass
- [x] doc 존재: 5종 모두 확인

#### 추가 발견사항
기존 테스트 파일 6개에 inline mock AIProviderAdapter 객체가 있었으며, 인터페이스에 필드 추가 시 모두 업데이트 필요. scope 외 파일이지만 테스트 컴파일 통과를 위한 최소 수정이므로 처리.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
escalate-then-accepted — 9 files outside frontmatter scope: `ngd-studio/lib/__tests__/{providerDeepSeek,stageFoundation}.test.ts` + `ngd-studio/server/stages/__tests__/{extractor,orchestrator,orchestrator.integration,orchestrator.pipeline,solver,verifier}.test.ts`. 사유: `AIProviderAdapter.supportsTools` 필드 추가의 필연적 fallout (mock 객체 컴파일). 사용자 결정으로 scope 확장 수용 → frontmatter scope 에 `ngd-studio/lib/__tests__/`, `ngd-studio/server/stages/__tests__/` 추가.

#### Verification Re-run (orchestrator)
exit 0 — `tsc --noEmit` pass, `vitest run lib/ai` pass, 5개 ref doc 존재 확인.

#### Simplify (orchestrator)
SIMPLIFIED=0 — 변경 없음. supportsTools 필드 추가는 1-liner, 주석은 비자명 WHY 기술, ref doc 은 코드 외. VERIFY pass 유지.

#### Review (orchestrator)
VERDICT=pass, ISSUES=0 — 스펙 일치 + 체크리스트 정합 + scope (확장 후) 준수 + 회귀 영향 없음. tsc/vitest exit 0 정합 확인.
