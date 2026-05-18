---
phase: 4
title: 통합 회귀 + 수동 시나리오 검증
status: needs_user
depends_on: [2, 3]
scope:
  - docs/planning/stage-name-unification/phase-04-integration.md
intervention_likely: true
intervention_reason: "수동 시나리오: dev 서버 + 브라우저로 6 stage 카드가 순차 갱신되는지 육안 확인 필요"
---

# Phase 4: 통합 회귀 + 수동 시나리오 검증

> **범위**: Verification (자동 + 수동)
> **난이도**: S
> **의존성**: Phase 2 (orchestrator), Phase 3 (store/UI)
> **영향 파일**: 검증만 — 코드 변경 없음

## 배경

Phase 2 + 3 변경 후 전체 회귀를 돌리고, 실제 dev 서버에서 라이브 동작을 확인한다. canonical name unification이 PipelineView 카드 갱신과 LogStream 표시에 의도대로 반영됐는지 육안 검증.

## 설계

### 1. 자동 회귀

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic
```

타깃: 22 files / 220+ pass / 0 fail (live e2e는 env 부재 시 skip 허용).

### 2. 수동 시나리오 (사용자 직접 수행)

#### 시나리오 A — 신규 작업 (코드 orchestrator)
1. SSE 서버 재시작 + Next.js dev 서버 재시작
2. 브라우저 하드 새로고침 (Cmd+Shift+R)
3. `/settings`에서 `create.extractor=codex-cli` 또는 `claude-sdk` 지정
4. `/create-v4`에서 신규 PDF 업로드 → 추출 시작
5. **확인**: 좌측 사이드바 PipelineView에 6개 stage 카드가 표시되고, 순차적으로 pending → running → done 으로 갱신되는지
6. **확인**: LogStream에 `[extractor]`, `[solver]` 등 prefix 없이 짧은 라벨이 표시되는지
7. **확인**: status 카드의 "제작 진행 중..." 동안 `[일시정지] [중단]` 버튼이 보이는지

#### 시나리오 B — 재개 (코드 경로)
1. 시나리오 A 도중 `중단` 또는 `일시정지` 클릭
2. `재개 (extractor부터)` 또는 `재시도` 클릭
3. **확인**: orchestrator가 적절한 stage부터 재개되고 stage 카드 갱신 정상

#### 시나리오 C — 회귀 (legacy 경로)
1. `/settings`에서 모든 stage override 해제 (`auto`)
2. `/create-v4`에서 신규 작업 시도
3. **확인**: 기존 Claude CLI skill 흐름이 영향 없이 동작 (builder/checker stage 카드만 갱신되는 기존 동작과 일치)

### 3. 결과 기록

이 phase의 `## 실행 결과` 섹션에 시나리오별 PASS/FAIL/스킵 기록.

## 체크리스트

- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run --reporter=basic` 전체 통과 (0 fail)
- [ ] 시나리오 A 수동 확인 — PipelineView 6개 카드 순차 갱신 + LogStream 라벨 정상 표시
- [ ] 시나리오 B 수동 확인 — 중단/일시정지 후 재개 정상 (또는 보류 시 보류 사유 기록)

## 영향 범위

- 코드 변경 없음. 검증만.
- 회귀 발견 시 새 phase 추가 또는 Phase 2/3 보강 검토.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic

# 수동 시나리오 A~C는 dev 서버 + 브라우저로 직접 수행
```

## 실행 결과

### 1회차 (2026-05-18 00:00 KST) — 자동 회귀 완료, 수동 시나리오 후속 필요
**상태**: needs_user
**소요 시간**: 약 1분
**진행 모델**: claude-sonnet-4-6

#### 요약
자동 회귀(tsc + vitest) 통과 (pre-existing 1건 제외). 수동 시나리오 A~C는 사용자가 dev 서버 + 브라우저로 직접 수행 필요.

#### 변경 파일
- 없음 (검증 전용 phase)

#### 검증 결과
- [x] `cd ngd-studio && npx tsc --noEmit` → pass (0 errors)
- [x] `npx vitest run --reporter=basic` → 220 pass / 1 fail (pre-existing: orchestrator.integration "full flow from extractor review: 3 questions → extraction_review pause, then resume from solver → done" — `legacy builder fallback: HWPX 없음` assertion, Phase 2/3와 무관)
- [ ] 시나리오 A 수동 확인 — 사용자 직접 수행 필요
- [ ] 시나리오 B 수동 확인 — 사용자 직접 수행 필요

#### 상세 vitest 결과
- Test Files: 1 failed | 21 passed (22 total)
- Tests: 1 failed | 220 passed | 1 skipped (222 total)
- 실패: `server/stages/__tests__/orchestrator.integration.test.ts:395` — `expected 'legacy builder fallback: HWPX 없음' to be 'extraction_review_pending'`
- 이 1건은 Phase 2 이전에도 동일하게 실패하는 pre-existing failure로 확인됨

#### 추가 발견사항
없음

#### 질문 / 결정 사항
- 수동 시나리오 A~C는 사용자가 dev 서버 + 브라우저로 직접 수행해야 함. 시나리오 결과를 phase-04 파일 `## 실행 결과`에 추가 회차로 기록 권장.
