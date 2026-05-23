---
phase: 10
title: 실제 PDF 수동 smoke (B-α/β/γ + 신규-실패-재개)
status: pending
depends_on: [9]
scope:
  - docs/planning/exam-data-refactor/smoke-runbook.md
intervention_likely: true
intervention_reason: "실제 PDF + 브라우저 + 디스크 상태 검증이 필요한 end-to-end manual smoke. 자동화 불가능한 회귀 시나리오(브라우저 새로고침 타이밍, 실제 figure_processor Gemini 호출, 실제 HWPX 그림 박힘 시각 확인 등)를 사람이 1회 통과 확인."
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - build-hwpx-cli
e2e_triggers: []
---

# Phase 10: 실제 PDF 수동 smoke

> **범위**: Both (manual end-to-end)
> **난이도**: S (구현 측면) / M (실행 시간)
> **의존성**: P9
> **영향 파일**: `docs/planning/exam-data-refactor/smoke-runbook.md` (체크리스트 문서)

## 배경

P9까지 자동 회귀 망이 깔렸지만 다음은 자동화로 검증 불가:
1. **브라우저 새로고침 타이밍 race** — `/api/create/start` 도중 사용자가 reload (실제 disconnect 동작은 vitest mock과 다름)
2. **실제 Gemini figure 재생성** — API quota·rate-limit·이미지 품질 (vitest는 모킹)
3. **HWPX 안의 그림 시각 확인** — 한컴오피스 또는 viewer로 열어서 figure 박힌 위치/품질 검사
4. **stage UI 정합** — Navigator dot, Pipeline stage 카드, build status 패널의 종합 상태가 실제로 깜박임/멈춤 없이 정합인지

P10은 1회 검증으로 충분(반복 자동화 불요). 사용자가 직접 runbook 따라 통과 확인.

## 설계

### `smoke-runbook.md` 작성

다음 4개 시나리오를 순서대로 통과 확인:

```markdown
# exam-data-refactor — Manual Smoke Runbook

## 준비
- [ ] `npm run dev` + `npm run sse` 가동
- [ ] 테스트 PDF 1개 준비 (figure 2-3 문제 포함, 5-10문제 규모)
- [ ] `.v3cache` / `question_images` / `outputs/images/` 비운 상태에서 시작

## Scenario A — 신규(PDF→HWPX) 전체 흐름
- [ ] /create 페이지 진입 → 폼 7필드 입력
- [ ] PDF 업로드 → 자동분할 또는 수동 크롭
- [ ] handleExtract 실행 → 단일 fetch `/api/create/start` 응답 확인 (DevTools Network)
- [ ] 이후 `/api/run` SSE 스트림 정상 → 각 stage(cleaning/extractor/solver/verifier/figure/builder/checker) UI dot 켜짐 확인
- [ ] 완료 시 outputs/에 HWPX 생성, DownloadButton 활성화
- [ ] HWPX 한컴오피스로 열어 figure 있는 문제에 그림 박혀 있음 시각 확인
- [ ] `.v3cache/session_meta.json` 존재 + `.v3cache/exam_data.json` `info` camelCase 확인
- [ ] `.v3cache/figure_status.json:questions[*].finalImage` 키 존재 확인
- [ ] `.v3cache_prev` 디렉터리 없음 확인 (P8)

## Scenario B-α — idle 상태 "작업 재개" 카드
- [ ] Scenario A 완료 상태에서 페이지 새로고침
- [ ] "이전 작업이 존재합니다" 카드 표시 + "작업 재개" 버튼 클릭
- [ ] `GET /api/v3cache-meta` 응답이 `.v3cache/session_meta.json`에서 read한 camelCase meta 반환 확인
- [ ] orchestrator가 disk-scan으로 startStage 판정 → builder/checker 정도에서 시작
- [ ] **`buildExamDataJson` 재호출 후에도 HWPX에 그림 박혀있음** (F1 회귀 — 핵심)

## Scenario B-γ — followup `resume --from=builder`
- [ ] Scenario A 완료 + 사용자가 figure 결과를 confirm → orchestrator가 `resume --from=builder` 발사
- [ ] cleanup이 exam_data 삭제, builder가 새 rebuild
- [ ] **새 HWPX에 그림 박혀있음** (F1+F2 회귀)
- [ ] `resume --q=2 --from=figure` 발사 → figure_processor 로그에 `--question 2` 인자 포함 확인 (F3)

## Scenario C — 신규-실패-재개 (L1/L2 회귀)
- [ ] Scenario A 도중 (handleExtract → `/api/create/start` 응답 직전) 페이지 새로고침
- [ ] 디스크가 **이전 일관 상태(Scenario A 직전)** 로 복원되어 있음 확인 (rollback)
- [ ] "작업 재개" 카드의 메타가 직전 시험지의 메타 (Scenario A의 새 시험지가 아님)
- [ ] **현재 시험지 작업에 이전 시험지 메타/이미지가 절대 노출되지 않음** (L1+L2 핵심)

## 통과 기준
- [ ] 모든 시나리오 ✓
- [ ] 한 곳이라도 ✗면 phase 7/8/9 회귀 분석
```

### 실행 결과 기록

P10 worker는 smoke-runbook 체크리스트 통과 후 phase 파일의 `## 실행 결과` 섹션에:
- 실행 일시
- 사용한 PDF 파일
- 시나리오별 PASS/FAIL
- 발견된 회귀(있으면 별도 issue 또는 후속 phase)
- 스크린샷 첨부 위치 (선택)

## 체크리스트
- [ ] `docs/planning/exam-data-refactor/smoke-runbook.md` 작성 (위 4 시나리오 체크리스트 포함)
- [ ] 실제 PDF 준비 (figure 2-3문제 포함)
- [ ] Scenario A 통과 (신규 흐름)
- [ ] Scenario B-α 통과 (idle resume, F1 회귀 확인)
- [ ] Scenario B-γ 통과 (followup resume, F2/F3 회귀 확인)
- [ ] Scenario C 통과 (신규-실패-재개, L1/L2 회귀 확인)

## 영향 범위

- 사용자 confidence 확보 — 실제 PDF/브라우저로 양 흐름 + 회귀 시나리오 통과 확인.
- 실패 시 회귀 위치를 phase-7/8 단위로 좁힐 수 있다.

## 검증

수동 — `smoke-runbook.md`의 모든 체크리스트 ✓.
