---
phase: 2
title: extractor agentic 전환 + loader 폐기 (host inject → LLM tool use)
status: pending
depends_on: [1]
scope:
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
  - ngd-studio/server/stages/__tests__/
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

- [ ] `extractorPrompt.ts` 슬림화 — placeholder 제거 + Read 가이드 추가
- [ ] `extractor.ts` agentic 흐름 — loader 삭제 + `supportsTools` 분기 + CLI 권한 옵션 + turn 제한
- [ ] 테스트 재구성 — placeholder 부재 / mock tool call / 에러 케이스 / 회귀
- [ ] 실 빌드 회귀 (Python 2종 + tsc + vitest 전부 exit 0)

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
