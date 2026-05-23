# exam-data-refactor — Manual Smoke Runbook

> 이 runbook은 P10 수동 smoke 단계에서 사용자가 직접 실행하는 체크리스트입니다.
> 모든 시나리오를 순서대로 통과한 뒤 phase-10-manual-smoke.md의 `## 실행 결과` 섹션에 결과를 기록합니다.

---

## 준비

- [ ] `npm run dev` + `npm run sse` 가동 확인
- [ ] 테스트 PDF 1개 준비 (figure 2-3 문제 포함, 5-10문제 규모)
- [ ] `.v3cache` / `question_images` / `outputs/images/` 비운 상태에서 시작

---

## Scenario A — 신규(PDF→HWPX) 전체 흐름

- [ ] `/create` 페이지 진입 → 폼 7필드 입력
- [ ] PDF 업로드 → 자동분할 또는 수동 크롭
- [ ] handleExtract 실행 → 단일 fetch `/api/create/start` 응답 확인 (DevTools Network)
- [ ] 이후 `/api/run` SSE 스트림 정상 → 각 stage (cleaning / extractor / solver / verifier / figure / builder / checker) UI dot 켜짐 확인
- [ ] 완료 시 `outputs/`에 HWPX 생성, DownloadButton 활성화
- [ ] HWPX 한컴오피스로 열어 figure 있는 문제에 그림 박혀 있음 시각 확인
- [ ] `.v3cache/session_meta.json` 존재 + `.v3cache/exam_data.json`의 `info` 필드가 camelCase임 확인
- [ ] `.v3cache/figure_status.json` 내 `questions[*].finalImage` 키 존재 확인
- [ ] `.v3cache_prev` 디렉터리 없음 확인 (P8 housekeeping 검증)

---

## Scenario B-α — idle 상태 "작업 재개" 카드

> 전제: Scenario A 완료 후 브라우저 새로고침

- [ ] 페이지 새로고침 후 "이전 작업이 존재합니다" 카드 표시 확인
- [ ] "작업 재개" 버튼 클릭
- [ ] `GET /api/v3cache-meta` 응답이 `.v3cache/session_meta.json`에서 읽은 camelCase meta를 반환함 확인 (DevTools Network)
- [ ] orchestrator가 disk-scan으로 startStage 판정 → builder/checker 부근에서 재개됨 확인
- [ ] **`buildExamDataJson` 재호출 후에도 HWPX에 그림 박혀있음** (F1 회귀 — 핵심)

---

## Scenario B-γ — followup `resume --from=builder`

> 전제: Scenario A 완료 + 사용자가 figure 결과를 confirm

- [ ] orchestrator가 `resume --from=builder` 발사하는 것 확인 (로그 또는 DevTools)
- [ ] cleanup이 `exam_data` 삭제 후 builder가 새로 rebuild함 확인
- [ ] **새 HWPX에 그림 박혀있음** (F1+F2 회귀 검증)
- [ ] `resume --q=2 --from=figure` 발사 → figure_processor 로그에 `--question 2` 인자 포함 확인 (F3 회귀 검증)

---

## Scenario C — 신규-실패-재개 (L1/L2 회귀)

> 전제: Scenario A와 같이 신규 작업 시작, handleExtract 실행 후 `/api/create/start` 응답 직전에 페이지 새로고침

- [ ] 새로고침 직후 디스크 상태가 **이전 일관 상태(Scenario A 직전)** 로 복원되어 있음 확인 (atomic rollback 검증)
- [ ] "작업 재개" 카드의 메타가 **직전 시험지(Scenario A)의 메타** 임 확인 (새 시험지 메타가 아님)
- [ ] **현재 시험지 작업에 이전 시험지 메타/이미지가 절대 노출되지 않음** (L1+L2 핵심 회귀 검증)

---

## 통과 기준

- [ ] 모든 시나리오 ✓ 확인
- [ ] 한 곳이라도 ✗이면 → phase-7/8/9 회귀 분석 필요

---

## 실행 결과 기록 방법

smoke 완료 후 `/docs/planning/exam-data-refactor/phase-10-manual-smoke.md`의 `## 실행 결과` 섹션에 다음을 기록하세요:

- 실행 일시 (KST)
- 사용한 PDF 파일명
- 시나리오별 PASS / FAIL
- 발견된 회귀 (있으면 별도 issue 링크 또는 후속 phase 번호)
- 스크린샷 첨부 위치 (선택)
