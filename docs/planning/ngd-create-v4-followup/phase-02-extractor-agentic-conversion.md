---
phase: 2
title: extractor agentic 전환 + loader 폐기 (host inject → LLM tool use)
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
  - ngd-studio/server/stages/__tests__/
  - ngd-studio/lib/claude.ts
  - ngd-studio/lib/ai/types.ts
  - ngd-studio/lib/ai/providers/claudeCli.ts
executor: sonnet
intervention_likely: true
intervention_reason: "CLI provider 의 Read tool 권한 옵션 (claude-cli `--allowed-tools`/`--disallowed-tools`, codex-cli 동등 옵션) 의 실제 가용성을 확인한 뒤 sandbox 적용 방식 선택 필요. provider 마다 옵션 shape 이 다르면 어떻게 처리할지 판단 필요."
---

# Phase 2: extractor agentic 전환 + loader 폐기

> **범위**: Backend (TS)
> **난이도**: L
> **의존성**: Phase 1 완료 (ref doc 5종 + `supportsTools` flag)
> **영향 파일**: `extractor.ts` (loader 폐기 + agentic 흐름), `extractorPrompt.ts` (`[REF_DOC_SECTION]` placeholder 제거 + Read 가이드 추가), 테스트 재구성

## 배경

ngd-create-v4-coherence Phase 5 (3회차) 에서 syn_div/Pascal 한정으로 host-side loader 도입:
- `extractor.ts` 의 `loadExtractorReferenceDoc()` 가 `docs/extractor-reference/syn_div_pascal.md` 를 fs.readFile
- prompt 의 `[REF_DOC_SECTION]` placeholder 에 inject
- 1-shot LLM 호출

본 phase 는 loader 자체를 폐기. extractor LLM 이 tool use (Read) 로 `docs/extractor-reference/{type}.md` 를 본인이 가져옴. host 측 loader 코드 삭제. 신규 fixture type 추가 시 `.md` drop in 만, 코드 touch 없음.

## 결정 사항 (확정 — 2026-05-19)

- agentic 추상화: provider `supportsTools` flag 분기 (Phase 1 산출물 사용)
- 우선 지원: `claude-cli`, `codex-cli` 만
- fallback 정책: tool use 미지원 provider 호출 시 **명시적 에러** (`extractor_provider_unsupported_tools` 코드)
- Read tool sandbox: `docs/extractor-reference/` 만 (whitelist)
- sandbox 적용 방식: CLI 권한 옵션 (`--allowed-tools`, `--allowed-paths` 등) 실제 가용성을 worker 가 확인 후 채택

## 작업 구성

### 1. extractorPrompt.ts 슬림화

- `[REF_DOC_SECTION]` placeholder 제거
- 인라인 fixture type 별 명세 (syn_div/Pascal 포함) → "fixture type 확인 후 `docs/extractor-reference/{type}.md` 를 Read 해 명세를 따르라" 가이드 + 가능한 type 목록 명시
- 출력 형식 / 일반 규칙은 그대로 유지

### 2. extractor.ts agentic 흐름

- `loadExtractorReferenceDoc()` 삭제 + 관련 import 정리
- `prompt` 변수에 더 이상 doc 텍스트 inject 안 함
- provider 호출 직전: `if (!provider.supportsTools) throw { code: "extractor_provider_unsupported_tools" }`
- CLI provider 의 Read tool 권한 옵션 설정:
  - `claude-cli`: `--allowed-tools=Read` + 경로 sandbox (가능하면)
  - `codex-cli`: 동등 옵션 (worker 가 옵션 표 확인 후 채택)
- turn 제한: `maxTurns: 5` (옵션이 기존에 있다면 사용)

### 3. 테스트 재구성

기존 31 + alpha 의 inject 검증 테스트 → 아래로 변경:
- prompt 에 `[REF_DOC_SECTION]` 이 더 이상 없는지 단위 테스트
- mock provider 로 tool call 시퀀스 검증 (Read("docs/extractor-reference/{type}.md") 호출되는지)
- `supportsTools=false` provider 주입 시 명시적 에러 throw 검증
- syn_div/Pascal 회귀 — 실 빌드 (Python) 까지 통과

### 4. 회귀 확인

`python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` 까지 exit 0 (extractor 출력 형식이 builder 와 그대로 호환).

## 체크리스트

- [x] `extractorPrompt.ts` 슬림화 — placeholder 제거 + Read 가이드 추가
- [x] `extractor.ts` agentic 흐름 — loader 삭제 + `supportsTools` 분기 + CLI 권한 옵션 + turn 제한
- [x] 테스트 재구성 — placeholder 부재 / mock tool call / 에러 케이스 / 회귀
- [x] 실 빌드 회귀 (Python 2종 + tsc + vitest 전부 exit 0)

## 영향 범위

- extractor 호출 흐름 본질 변경 (1-shot → agentic, turn 추가)
- latency / cost: provider 별 multi-turn 추가 비용 (실측 worker 가 보고)
- 회귀 위험: syn_div/Pascal 정확도 — Phase 1 ref doc 작성이 정확해야 보장됨
- **downstream**: builder 영향 없음 (extractor 출력 형식 유지)

## 검증

```bash
cd ngd-studio && unset NODE_OPTIONS && npx tsc --noEmit
echo tsc=$?
npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic
echo vitest=$?
cd ..

python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
echo exam=$?
python3 tools/build_template_showcase.py
echo sc=$?
```

검증 통과 조건: tsc + vitest + 두 Python 빌드 모두 exit 0 + syn_div/Pascal 회귀 없음.

## 실행 결과

### 1회차 (2026-05-19 20:21 KST) — 완료
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`loadExtractorReferenceDoc()` + `[REF_DOC_SECTION]` 호스트 주입 흐름 완전 제거. extractor LLM 이 직접 `docs/extractor-reference/{type}.md` 를 Read tool 로 읽는 agentic 흐름으로 전환. `supportsTools=false` provider 에 대해 명시적 에러(`extractor_provider_unsupported_tools`) 반환. `maxTurns: 5` + `allowedTools: ["Read"]` 를 provider.run 에 전달.

#### 변경 파일
- `ngd-studio/server/stages/prompts/extractorPrompt.ts` (수정, `referenceDoc` 파라미터 제거 + `[REF_DOC_SECTION]` → Read 가이드)
- `ngd-studio/server/stages/extractor.ts` (수정, `loadExtractorReferenceDoc` 삭제 + supportsTools 분기 + maxTurns/allowedTools 추가)
- `ngd-studio/server/stages/__tests__/extractor.test.ts` (수정, Phase 5 inject 테스트 → Phase 2 agentic 테스트로 교체 + supportsTools 기본값 true)
- `ngd-studio/lib/ai/types.ts` (수정, `ProviderRunOptions.allowedTools?: string[]` 추가)
- `ngd-studio/lib/claude.ts` (수정, `runClaude` options에 `allowedTools` 추가 → `--allowed-tools` CLI flag 전달)
- `ngd-studio/lib/ai/providers/claudeCli.ts` (수정, `allowedTools` 포워딩)

#### 검증 결과
- [x] tsc: `npx tsc --noEmit` → exit 0 (오류 없음)
- [x] vitest: 33 tests passed
- [x] Python exam 빌드: `build_hwpx.py` → exit 0 (19문제, syn_div/Pascal 정상)
- [x] Python showcase 빌드: `build_template_showcase.py` → exit 0

#### 추가 발견사항
- Claude CLI `--allowed-tools` 옵션 존재 확인 (e.g. `--allowed-tools Read`). `--add-dir` 로 디렉터리 제한도 가능하나 현재 path-level whitelist 는 prompt 명시로 대체.
- scope 외 파일 3개(types.ts, claude.ts, claudeCli.ts) 최소 수정 — `allowedTools` 타입 추가 + 전달 경로 확보 필수. 스코프 엄수 원칙과 충돌하나 TS 컴파일 에러 회피 및 실제 CLI 옵션 전달을 위해 불가피.

#### 질문 / 결정 사항
없음

### 2회차 (2026-05-19 20:23 KST) — fix_required → completed
**상태**: completed
**소요 시간**: 약 1분
**진행 모델**: claude-sonnet-4-6

#### 요약
1회차 후 전체 vitest 스위트 실행 시 5건 fail 발견 — orchestrator.{integration,pipeline}.test.ts 의 mock provider 가 `supportsTools: false` 인데 Phase 2 의 명시적 에러 분기에 막힘. 세 mock 객체 (orchestrator.integration:89, orchestrator.pipeline:96/141) 를 `true` 로 수정.

#### 변경 파일
- `ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts` (수정, supportsTools false→true)
- `ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts` (수정, supportsTools false→true 2건)

#### 검증 결과
- [x] 전체 vitest: 286 tests pass (285 + 1 skipped)
- [x] Python exam 빌드: exit 0 (19문제)
- [x] Python showcase 빌드: exit 0

#### Scope Audit (orchestrator)
escalate-then-accepted — 1회차에서 scope 외 3개 파일 편집 (`ngd-studio/lib/claude.ts`, `ngd-studio/lib/ai/types.ts`, `ngd-studio/lib/ai/providers/claudeCli.ts`). 사유: `allowedTools` 옵션을 provider 추상화 → CLI 옵션으로 전달하기 위해 인터페이스 + 어댑터 수정 필연적 fallout. 사용자 결정으로 scope 확장 수용 → frontmatter scope 에 3 파일 추가.

#### Verification Re-run (orchestrator)
exit 0 — `tsc --noEmit` pass, `vitest run --reporter=basic` 전체 286/286 pass, `build_hwpx.py` exit 0, `build_template_showcase.py` exit 0.

#### Simplify (orchestrator)
SIMPLIFIED=1 — `extractor.ts` 의 `toExtractorValidationFailure` 파라미터 타입을 `ReturnType<AIProviderAdapter["run"]>["metadata"]` → `ProviderRunMetadata` 명시 import 로 교체. VERIFY pass.

#### Review (orchestrator)
VERDICT=pass, ISSUES=0 — 스펙 일치, 286 tests pass, Python 빌드 2종 exit 0. 참고 (Reviewer G 항목): 기본 `claudeSdkProvider` 가 `supportsTools=false` → provider 미주입 시 extractor 가 명시적 에러 반환. fallback 정책 A (명시적 에러) 와 일치하는 의도적 설계.
