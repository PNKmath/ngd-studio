---
phase: 1
title: 회귀 테스트 baseline 고정
status: completed
depends_on: []
scope:
  - ngd-studio/lib/claude.ts
  - ngd-studio/lib/prompts.ts
  - ngd-studio/lib/__tests__/
  - ngd-studio/server/sse.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: 회귀 테스트 baseline 고정

> **범위**: Test + small extraction helpers if needed
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `lib/__tests__/`, `lib/claude.ts`, `lib/prompts.ts`

## 배경

provider 구조를 도입하기 전에 현재 Claude 전용 동작을 테스트로 고정한다. 이 baseline이 없으면 Codex provider 추가 중 stage 감지, file 이벤트, prompt 문구, review extraction 이벤트가 깨져도 늦게 발견된다.

## 설계

기존 `lib/__tests__/claude.test.ts`와 `prompts.test.ts`를 확장한다. 테스트하기 어려운 `server/sse.ts` 로직이 있으면 순수 함수로 작은 단위만 분리하되, 이 phase의 목적은 기능 추가가 아니라 현재 behavior lock이다.

고정할 주요 behavior:

- Claude stream-json 이벤트의 `transformToSSE` 변환
- `detectStageFromTool`의 `.claude` agent/skill stage 매핑
- `.hwpx`, `.json`, 이미지 파일 생성 이벤트
- `[EXTRACTION_REVIEW]` block parsing
- `buildCreatePrompt`, `buildResumePrompt`, `buildCropPrompt`, `buildReviewPrompt`의 현재 skill 호출 문구

## 체크리스트

- [x] `transformToSSE` stage/log/file/result 변환 테스트 보강
- [x] `[EXTRACTION_REVIEW]` block parsing 회귀 테스트 추가
- [x] `buildCreatePrompt`/`buildResumePrompt`/`buildReviewPrompt` skill 호출 문구 테스트 보강
- [x] provider 도입 전 `server/sse.ts`에서 분리 가능한 순수 로직 후보를 최소 범위로 식별
- [x] focused Vitest가 통과함
- [x] 전체 `pnpm test`가 통과함

## 영향 범위

테스트 baseline phase이므로 runtime behavior 변경은 없어야 한다. 순수 함수 추출이 필요하면 기존 export 호환성을 유지한다.

## 검증

```bash
cd ngd-studio
npx vitest run lib/__tests__/claude.test.ts lib/__tests__/prompts.test.ts --reporter=basic
pnpm test
```

## 실행 결과

### 2026-05-16 — Phase 1

#### Summary
- `lib/__tests__/claude.test.ts`에 Claude stream-json → SSE 변환, stage 감지 fallback, 파일 이벤트, question 이벤트, `[EXTRACTION_REVIEW]` parsing, result 변환 회귀 테스트를 추가했다.
- `lib/__tests__/prompts.test.ts`에 create/resume/crop/review prompt의 현재 skill 호출 문구와 주요 입력 경로 포함 여부를 보강했다.
- `server/sse.ts`는 현재 `transformToSSE`/`runClaude` 호출 지점 외 추가 분리 없이 Phase 2 provider contract에서 다루는 편이 적절하다고 확인했다.

#### Scope Audit (orchestrator)
- pass — changed files are within Phase 1 scope: `ngd-studio/lib/__tests__/claude.test.ts`, `ngd-studio/lib/__tests__/prompts.test.ts`

#### Verification Re-run (orchestrator)
- pass — `npx vitest run lib/__tests__/claude.test.ts lib/__tests__/prompts.test.ts --reporter=basic` (35 tests)
- pass — `pnpm test` (62 tests)

#### Review (orchestrator)
- pass — runtime behavior is unchanged; added tests exercise existing exported helpers and prompt builders.

#### Commit
- pending — commit will be recorded in `checklist.md` after local commit creation.
