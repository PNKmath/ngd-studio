---
phase: 9
title: 통합 테스트 + 수동 회귀
status: completed
depends_on: [6, 7, 8]
scope:
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
  - ngd-studio/lib/__tests__/providerDeepSeekLive.test.ts
  - docs/planning/stage-runner-rewrite/phase-09-integration-tests.md
intervention_likely: true
intervention_reason: "실제 작업 데이터로 e2e 수동 시나리오 확인 필요. dev 서버 + 브라우저 조작이 자동화 어려움"
---

# Phase 9: 통합 테스트 + 수동 회귀

> **범위**: Verification (통합 + 수동)
> **난이도**: M
> **의존성**: Phase 6 (SSE 분기), Phase 7 (UI), Phase 8 (followup)
> **영향 파일**: `server/stages/__tests__/orchestrator.integration.test.ts` (신규)

## 배경

Phase 1~8 통합본이 실제로 동작하는지 mock + live + 수동 검증. 회귀(legacy /create 경로) 확인 포함.

## 설계

### 1. mock 통합 테스트

`server/stages/__tests__/orchestrator.integration.test.ts`:
- mock provider 4종 (claudeSdk/openaiSdk/codexCli/deepseekV4) 각각 정상 응답을 가짜로 반환
- mock figure_processor (python spawn 대신 fixture 파일 작성)
- mock builder/checker (deterministic 그대로 사용 가능하면 사용, 또는 skip)
- 3문제 짜리 시나리오 e2e:
  - extractor (mock claude-sdk) → solver (mock deepseek-v4) → verifier (mock deepseek-v4, pass on first try) → figure (fixture) → builder (deterministic) → checker (deterministic)
  - 결과: success + outputFile 존재 + telemetry 6개 entry

### 1a. Fixture 데이터

`server/stages/__tests__/fixtures/`에 다음 준비:
- `q01.png`, `q02.png`, `q03.png` — 1x1 투명 또는 작은 더미 PNG (실제 인식 불필요, mock이 응답)
- `extracted/q01.json`, `q02.json`, `q03.json` — extractor mock 응답용 샘플 JSON (`has_figure: true/false` 섞기)
- `solved/q01.json` 등 — solver mock 응답용
- `verified/q01.json` 등 — verifier pass 결과
- `figure_status.success.json` — figure mock spawn 시 작성할 더미

테스트 setup에서 임시 디렉터리 마련(`mkdtemp`), 각 테스트 끝에 cleanup.

### 2. live 테스트 확장

`lib/__tests__/providerDeepSeekLive.test.ts`에 e2e 케이스 추가:
- DEEPSEEK_API_KEY + ANTHROPIC_API_KEY 둘 다 있을 때만 활성
- 실제 1문제(fixture 이미지)로 extractor(claude-sdk) → solver(deepseek-v4) → verifier(deepseek-v4) 통과 확인
- 비용 보호: 1문제만, 짧은 prompt, timeout 90s

### 3. 수동 회귀 시나리오

dev 서버 + 브라우저:

**시나리오 A — 신규 작업 (코드 경로)**
1. `/settings`에서 create.solver=deepseek-v4, create.verifier=deepseek-v4 지정
2. `/create-v4` 신규 작업, 3문제 짜리 PDF 업로드 → 추출
3. PipelineView 라이브 갱신: extractor → solver(deepseek) → verifier(deepseek) → figure → builder → checker
4. outputs/ HWPX 생성, 다운로드 동작

**시나리오 B — 재개 (코드 경로)**
1. `.v3cache`에 verified 결과 있는 상태로 `/create-v4`
2. "이전 작업 재개" 카드 → from=figure 선택 → 재개
3. orchestrator가 figure stage부터 진행

**시나리오 C — Followup resume (코드 경로)**
1. 작업 완료 후 FollowupChat에 `resume --q=5 --from=figure` 입력
2. orchestrator 분기 진입 + 5번 figure 재실행

**시나리오 D — Legacy auto 경로**
1. `/settings`에서 모든 stage override 해제(`auto`)
2. `/create-v4` 또는 `/create`에서 신규 작업
3. 기존 Claude CLI Skill 흐름으로 처리(`runLegacyPromptJob`) — 회귀 없음

**시나리오 E — provider 누락 처리**
1. ANTHROPIC_API_KEY 미설정 상태에서 create.extractor=claude-sdk 시도
2. settings에 ⚠ 표시 + 작업 시작 시 명확한 에러 메시지

### 4. 결과 기록

이 phase의 `## 실행 결과` 섹션에 시나리오별 PASS/FAIL/스킵 기록.

## 체크리스트

- [x] `server/stages/__tests__/fixtures/` 준비 (3문제 dummy PNG + extracted/solved/verified 샘플 JSON)
- [x] `server/stages/__tests__/orchestrator.integration.test.ts` mock e2e 테스트 작성 (3문제, fixture 사용)
- [x] `lib/__tests__/providerDeepSeekLive.test.ts`에 extractor+solver+verifier live e2e 케이스 추가 (env가 있을 때만)
- [ ] 시나리오 A~E 수동 검증 결과 기록 **보류**
- [x] `npx tsc --noEmit` + `npx vitest run --reporter=basic` 전부 통과
- [x] legacy /create 경로 회귀 없음 확인 (전체 vitest 회귀에 포함)
- [ ] 후속 발견 사항(있다면) phase-10 또는 별도 작업으로 분리

## 영향 범위

- 신규 테스트 파일. 기존 테스트 회귀 검증.
- 수동 시나리오는 코드 변경 없이 관측.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic
# live (env가 있을 때):
ANTHROPIC_API_KEY=... DEEPSEEK_API_KEY=... npx vitest run lib/__tests__/providerDeepSeekLive.test.ts --reporter=basic
# 수동 시나리오 A~E는 dev 서버 + 브라우저로 진행
```

## 실행 결과

### 1회차 (2026-05-17) — completed

**상태**: completed  
**소요 시간**: 약 15분  
**진행 모델**: claude-sonnet-4-6

#### 요약

자동화 가능 항목 5개 전부 완료. fixtures 13개 파일 생성, mock integration 테스트 5케이스(4개 시나리오), providerDeepSeekLive에 extractor+solver+verifier e2e 케이스 추가. 전체 vitest 22파일 220 pass / 1 skip (ANTHROPIC_API_KEY 없어 describeBothLive skip) / 0 fail. 수동 시나리오 A~E는 보류.

#### 변경 파일

- `ngd-studio/server/stages/__tests__/fixtures/q01.png` (신규, 1x1 dummy PNG)
- `ngd-studio/server/stages/__tests__/fixtures/q02.png` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/q03.png` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/extracted/q01.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/extracted/q02.json` (신규, has_figure: true)
- `ngd-studio/server/stages/__tests__/fixtures/extracted/q03.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/solved/q01.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/solved/q02.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/solved/q03.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/verified/q01.json` (신규, status: pass)
- `ngd-studio/server/stages/__tests__/fixtures/verified/q02.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/verified/q03.json` (신규)
- `ngd-studio/server/stages/__tests__/fixtures/figure_status.success.json` (신규)
- `ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts` (신규)
- `ngd-studio/lib/__tests__/providerDeepSeekLive.test.ts` (수정 — describeBothLive 블록 추가)

#### 검증 결과

- [x] tsc / 전체 vitest pass (22 files, 220 pass, 1 skip)
- [x] mock integration: 5 tests pass (orchestrator.integration.test.ts)
- [-] live e2e (describeBothLive): ANTHROPIC_API_KEY 없어 skip — DEEPSEEK_API_KEY + ANTHROPIC_API_KEY 둘 다 있을 때 활성
- [-] 시나리오 A~E: **사용자 수동 검증 보류**

#### 시나리오 A~E 수동 검증 보류

- 시나리오 A (신규 작업 코드 경로): 사용자 수동 검증 필요 — `/settings` create.* override + `/create-v4` 3문제 e2e
- 시나리오 B (재개 코드 경로): 사용자 수동 검증 필요
- 시나리오 C (Followup resume): 사용자 수동 검증 필요
- 시나리오 D (Legacy auto): 사용자 수동 검증 필요
- 시나리오 E (provider 누락 처리): 사용자 수동 검증 필요

#### 추가 발견사항

없음

#### 질문 / 결정 사항

시나리오 A~E 수동 검증은 사용자가 dev 서버 + 브라우저로 직접 진행 필요.
