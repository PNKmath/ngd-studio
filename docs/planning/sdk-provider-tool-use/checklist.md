---
task: sdk-provider-tool-use
phase_count: 4
created: 2026-05-19
---

# SDK provider tool use 구현 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run` 이 이 파일을 읽어 다음 phase 를 선정합니다.

## 배경

`ngd-create-v4-followup` 종료 시점 후속. 현재 4개 provider 중 CLI 2종 (claude-cli, codex-cli) 만 agentic 동작:

| Provider | supportsTools | 동작 |
|----------|---------------|------|
| claude-cli | true | ✓ native Read/Grep/Glob (CLI 자체 agentic) |
| codex-cli | true | ✓ native (CLI 자체 agentic) |
| claude-sdk | **false** | ❌ extractor 호출 시 `extractor_provider_unsupported_tools` 에러 |
| openai-sdk | **false** | ❌ 동일 |
| deepseek-v4 | false | (vision 미지원, extractor 대상 아님) |

본 task 는 claude-sdk / openai-sdk 의 tool use 를 구현해 4 provider 모두 extractor 흐름 통과시킴.

## 결정 사항 (확정 — 2026-05-19)

- **claude-sdk**: vanilla `@anthropic-ai/sdk` 의 `messages.create` 반복 호출 + 자체 loop (Phase 2 A안)
- **openai-sdk**: `openai` SDK 의 `chat.completions.create` + function calling + 자체 loop (Phase 3 A안)
- **host tool sandbox**: `docs/extractor-reference/` whitelist (ngd-create-v4-followup Phase 2 결정 유지)
- **tool 집합**: Read / Grep / Glob (claude-cli 와 정합)
- **destructive tool 차단**: Bash / Write / Edit 는 host 측에서 구현하지 않음 → SDK 가 호출해도 schema 자체 없음

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-host-tool-module.md](./phase-01-host-tool-module.md) | 5 | 5 | 100% | completed | 753f4b3 |
| 2 | [phase-02-claude-sdk-agentic.md](./phase-02-claude-sdk-agentic.md) | 5 | 5 | 100% | completed | 95b18a0 |
| 3 | [phase-03-openai-sdk-agentic.md](./phase-03-openai-sdk-agentic.md) | 5 | 5 | 100% | completed | fb3c6da |
| 4 | [phase-04-cross-provider-e2e.md](./phase-04-cross-provider-e2e.md) | 3 | 3 | 100% | completed | 564faa0 |
| **Total** | | **18** | **18** | **100%** | | |

## Phase 의존성

```
Phase 1 ─┬─▶ Phase 2 ─┐
         └─▶ Phase 3 ─┴─▶ Phase 4
```

Phase 2, 3 은 scope 겹치지 않아 병렬 가능. Phase 4 는 두 SDK 완료 후 cross-provider 검증.

## 우선순위 / 예상 시간

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | host tool module (Read/Grep/Glob + sandbox) | 30분 |
| P0 | Phase 2 | claude-sdk agentic loop | 40분 |
| P0 | Phase 3 | openai-sdk agentic loop | 40분 |
| P1 | Phase 4 | cross-provider e2e + 회귀 | 15분 |

## 검증 체크리스트

### 공통 검증
- [ ] `cd ngd-studio && npx tsc --noEmit` exit 0
- [ ] `npx vitest run --reporter=basic` 전체 통과 (기존 286 + 본 task 신규 테스트)
- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` exit 0
- [ ] `python3 tools/build_template_showcase.py` exit 0

### 회귀 검증
- [ ] claude-cli / codex-cli 동작 유지 (ngd-create-v4-followup 산출물)
- [ ] extractor 출력 형식 (extractor JSON 스키마) 불변
- [ ] orchestrator 통합 테스트 mock provider 가 그대로 동작

### 크로스 플랫폼
- [ ] tool 구현이 `path.join` / `path.resolve` 사용 (Windows + macOS 양쪽)
- [ ] sandbox 경로 비교가 OS 분기 처리 (`docs/extractor-reference/` 매칭)

## 범위 밖 (touch 금지)

- claude-cli / codex-cli provider (이미 동작)
- deepseek-v4 (vision 미지원, extractor 대상 아님)
- extractor.ts 의 호출 측 로직 (Phase 2 ngd-create-v4-followup 산출물 유지)
- ngd-exam-* 에이전트
- `inputs/`, `outputs/` 사용자 데이터

## 관련 문서

- `docs/planning/ngd-create-v4-followup/` — 선행 task (4 phase 모두 completed)
- `docs/planning/ngd-create-v4-followup/phase-02-extractor-agentic-conversion.md` — extractor agentic 흐름 원형
- `docs/extractor-reference/` — sandbox whitelist 대상 디렉터리
- `ngd-studio/lib/ai/types.ts` — `AIProviderAdapter`, `ProviderRunOptions`
- `ngd-studio/lib/ai/providers/claudeCli.ts` — allowedTools 전달 참조 구현
