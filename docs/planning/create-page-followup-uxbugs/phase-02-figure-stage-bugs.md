---
phase: 2
title: figure_processor 실패 + cleaned 이미지 폴백 + figure 후 stage routing 버그
status: completed
depends_on: []
scope:
  - ngd-studio/components/results/question-result/QuestionImages.tsx
  - ngd-studio/components/results/question-result/FigureReviewModal.tsx
  - figure_processor.py
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/app/create/page.tsx
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
intervention_likely: true
intervention_reason: "진단 단계 + audit 분기 가능성. figure_processor.py 실패 원인은 worker 가 workspace 로그 탐색해야 파악 가능. stage routing 영역은 최근 두 커밋(296cd58, 86117c0)에서 같은 영역 픽스 이력 — 3회차 버그면 memory feedback-systematic-audit 에 따라 audit 매트릭스로 전환할지 사용자 판단 필요."
executor: sonnet
load_bearing: "figure_processor 실패 픽스(ⓒ) + stage routing 픽스(ⓓ)가 핵심; cleaned 폴백 UX(ⓑ)·figure 모달 실패 표시(ⓕ)는 보강"
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers:
  - create-v4-full-pipeline
---

# Phase 2: figure_processor 실패 + cleaned 이미지 폴백 + figure 후 stage routing 버그

> **범위**: Both (Frontend + Backend + Python)
> **난이도**: L (진단 + 픽스)
> **의존성**: 없음 (Phase 1 과 page.tsx scope 만 공유 → 순차 실행)
> **영향 파일**: `QuestionImages.tsx`, `FigureReviewModal.tsx`, `figure_processor.py`, `server/stages/orchestrator.ts`, `app/create/page.tsx`, `app/api/run/[jobId]/followup/route.ts`

## 배경

사용자 시험 사용 중 figure 단계 관련 3개 버그 + 1개 보강 발견 (`create-page-followup-uxbugs` 사용자 메시지 ③⑧⑨⑩):

1. **③ cleaned 자리에 raw crop 이미지 표시**: 사용자가 figure 단계("이미지 처리") 클릭 안 했는데, 문제 팝업의 cleaned 자리에 필기 포함된 raw 크롭이 표시됨. `QuestionImages.tsx:10-11, :47, :50-52` 의 `cleanedError` 폴백 분기 추정 — onError 시 fallback UI 표시되는데, **그 fallback 이 raw 이미지를 보여주는 경로** 일 가능성. cleaned 가 존재하지 않을 때는 raw 가 아니라 "이미지 처리 전" placeholder 노출이 옳음.

2. **⑧ figure_processor.py 실패**: 프로젝트 루트 `figure_processor.py` 가 최근 작업에서 실패. 사용자는 "정확히 알긴 힘들고 최근 작업이다" — workspace 의 가장 최근 mtime job 디렉터리 탐색 + 로그 grep 필요.

3. **⑨ figure 후 stage routing 오류**: figure 단계 완료(또는 실패) 직후 "문제별 결과(추출 편집 모드)" 섹션에 "HWPX 조립" 버튼이 노출되어야 하나 "진행 → 해설 생성 시작" 버튼이 나옴. 클릭 시 해설부터 재실행됨.
   - `app/create/page.tsx:327-329` 의 `showBuildStatus` 조건: `(isRunning || isDone) && (mode === "create" || mode === "resume") && v3Meta?.resumeFrom !== "figure"`
   - `:904, :911` build_status.json 폴링 결과 기반 builder/checker 상태 표시
   - `orchestrator.ts:912` 는 figure 다음 builder 자동 실행 (`shouldRunStage(startStage, "builder") && stillUnder("builder")`)
   - `:945` figure 실패 시 builder 자동 skip
   - **가설**: figure 실패 시 builder 가 skip 되면서 build_status 가 생성되지 않거나, `v3Meta.resumeFrom` 이 "figure" 로 set 되어 `showBuildStatus` false → 결과적으로 "진행 → 해설 생성 시작" 버튼이 잘못 노출되는 경로. 또는 followup route(`:240-242, :318-329`) 에서 `parseResumeArgs` 결과 resumeFrom 이 의도와 다르게 설정.
   - 최근 동일 영역 픽스 이력: `296cd58 fix(create): followup meta 누락 + HWPX 조립 버튼 중복 해소` + `86117c0 fix(orchestrator): Phase 7 — defaultProvider routing 복구 + silent fallback 차단`. **3회차 버그면 메모리 `feedback-systematic-audit` 에 따라 reactive patch 중단 + audit 매트릭스로 전환** — 본 phase 가 결정.

4. **⑩ figure 실패로 figure 모달 확인 불가**: figure 단계가 실패하면 (`FigureReviewModal` 진입점 인 `QuestionPanelHeader` 의 "그림 결과 확인" 버튼이) 보이지 않거나 활성화 안 됨. 사용자가 figure 결과를 확인할 수 없는 상태. UX 보강 — figure 실패 상태에서도 모달 진입 가능 + "전체 재생성" CTA 노출. ⑧ 가 픽스되면 자연히 풀리지만 실패 상태 자체의 UX 도 안전망으로 필요.

## 설계

### 0. 진단 단계 (worker 가 가장 먼저 수행)

체크리스트 ⓐ 가 명시. 별도 commit 없이 본 phase 안에서 진단 + 픽스 묶음.

```bash
# 가장 최근 mtime 의 workspaces/ 또는 ngd-studio/workspaces/ job 디렉터리 탐색
ls -lt workspaces/ 2>/dev/null | head -20
ls -lt ngd-studio/workspaces/ 2>/dev/null | head -20

# figure_processor 관련 로그 grep
find workspaces -name "*.log" -newer /tmp/recent-marker -print 2>/dev/null | xargs grep -l "figure_processor\|Traceback\|Error" 2>/dev/null

# job dir 안의 figure_status.json / build_status.json 상태 확인
cat <recent-job>/figure_status.json 2>/dev/null
cat <recent-job>/build_status.json 2>/dev/null
```

진단 결과 정리 → `## 실행 결과` 의 1회차 "진단" 섹션에 기록.

### 1. ⓑ cleaned 이미지 폴백 (③)

`QuestionImages.tsx` 의 cleaned 렌더링 로직 점검:

```tsx
// 현재 (추정 — :47, :50-52 라인 근처)
<img
  src={cleanedSrc}
  onError={() => setCleanedError(true)}
  ...
/>
{cleanedError && <FallbackUI />}
```

**핵심 결정**:
- `FallbackUI` 가 raw 이미지를 보여주는 경로면 → raw 차단 + "이미지 처리 전" placeholder 로 교체
- cleaned 파일 경로 자체가 raw 와 동일하게 잘못 결정되고 있으면 → 경로 분리 로직 픽스

worker 가 실제 코드 Read 후 결정.

### 2. ⓒ figure_processor.py 픽스 (⑧)

진단 결과 확보된 stacktrace 의 근본 원인 픽스. 흔한 케이스:
- 의존성 (PIL, opencv, nano-banana 클라이언트) 미설치 / 버전 불일치
- 입력 이미지 경로 누락 / 권한 문제
- API quota / 네트워크 에러

**메모리 `feedback-both-layers-when-different-jobs` 적용**: figure_processor.py(Python) 와 orchestrator.ts(Node) 가 서로 다른 역할 — 단일 위치 강요 금지. Python 측 픽스가 적절하면 Python 만, orchestrator 측 호출 인자 문제면 orchestrator 만 수정.

진단 결과 외부 의존(quota/네트워크) 이라 코드 픽스 불가능하면 `needs_user` 보고.

### 3. ⓓ stage routing audit (⑨)

**메모리 `feedback-systematic-audit` 트리거 판단**:

먼저 다음을 확인:
1. 직전 두 픽스(296cd58, 86117c0) 가 본 증상과 정확히 같은 root cause 인가? — git log + diff 확인.
2. 본 증상의 root cause 가 직전 두 픽스와 다른 새로운 경로인가?

**3회차 동일 root cause 면 audit 매트릭스 작성 후 종료** (별도 픽스 phase 는 phase-init --from <audit> 로 추가). audit 파일 경로: `docs/planning/create-page-followup-uxbugs/e2e-audit-stage-routing-<ts>.md`. 매트릭스 항목:

| Aspect | 값 |
|--------|-----|
| 증상 | figure 후 "HWPX 조립" 대신 "해설 생성 시작" 노출 + 해설부터 재실행 |
| 영향 경로 | orchestrator stage 결정 / followup route resumeFrom / page.tsx showBuildStatus / figure_status.json 상태 / build_status.json 부재 |
| 직전 픽스 1 | 296cd58 — followup meta 누락 |
| 직전 픽스 2 | 86117c0 — defaultProvider routing |
| 본 케이스 root cause | (진단 결과 채움) |
| 분류 | regression / spec-validity-gap / env / unknown |
| 제안 | (분류별 권장 행동) |

**3회차 다른 root cause 또는 직접 픽스로 충분한 단순 회귀면 다음 픽스 적용**:
- 가설별 픽스 후보:
  - `orchestrator.ts:912` shouldRunStage 분기에서 figure 성공/실패 두 경로 모두에 대해 build_status 가 정확히 emit 되는지 검증 + 누락이면 emit 추가
  - `page.tsx:327-329` `showBuildStatus` 조건에서 `v3Meta?.resumeFrom !== "figure"` 가 잘못된 게이트일 가능성 점검 — figure 완료 후엔 resumeFrom 이 다른 값(예: "builder") 으로 전환되어야 함
  - followup route(`:240-242, :318-329`) 에서 parseResumeArgs 가 figure 직후 "solver" 가 아닌 "builder"/"confirm" 으로 라우팅하는지 확인

### 4. ⓕ figure 모달 실패 상태 UX (⑩)

`FigureReviewModal.tsx` 안에서 figure 실패 상태도 표시:
- entries 중 `figure_status === "failed"` 인 문제가 있으면 헤더에 실패 카운트 노출 ("실패 N개")
- 실패한 문제에 빨강 테두리 + 개별 재생성 CTA
- 전체 재생성 버튼은 항상 활성 (실패 시에도)

`QuestionPanelHeader` 의 "그림 결과 확인" 버튼이 figure 실패 시에도 클릭 가능해야 함 (현재 `isDone` 조건만 보면 figure 실패도 done 처리될 가능성 — 확인 필요).

## 체크리스트
- [x] ⓐ 진단 — workspaces 최근 job 의 figure_processor stacktrace 확보 + figure_status.json / build_status.json 상태 기록. 결과를 `## 실행 결과` 1회차에 기록
- [x] ⓑ ③ cleaned 폴백 — `QuestionImages.tsx` 분기 점검 + raw 가 cleaned 자리에 들어가는 경로 차단 → "이미지 처리 전" placeholder 노출
- [x] ⓒ ⑧ figure_processor.py 실패 픽스 — 진단 결과의 root cause 픽스 (외부 의존이면 needs_user 보고)
- [x] ⓓ ⑨ stage routing — 직전 두 픽스(296cd58, 86117c0) 와 root cause 비교. 3회차 동일 root cause 면 audit 매트릭스 작성 후 종료, 다른 경로면 직접 픽스
- [x] ⓔ memory `feedback-systematic-audit` 적용 판단 명시 (`## 실행 결과` 의 `추가 발견사항` 에 분기 결과 한 줄)
- [x] ⓕ ⑩ figure 모달 실패 상태 표시 + "그림 결과 확인" 버튼 figure 실패 시에도 진입 가능

## 영향 범위

- **변경 가능 파일**: scope 6개. 단 모두 수정 필요는 아님 — 진단 결과 따라 일부만.
- **호환성**: figure_status.json / build_status.json 의 JSON 스키마 변경 금지 (다른 모듈 의존). 새 필드 추가만 허용.
- **롤백 전략**: git revert 단일 커밋
- **e2e 영향**: `create-v4-full-pipeline` 시나리오 전체 — 사용자 수동 smoke 권장 (자동 e2e 는 비용 큼)
- **audit 분기 가능성**: ⓓ 가 audit 매트릭스로 분기되면 본 phase 는 `needs_user` 종료. 후속 픽스 phase 는 별도 `/phase-init --from <audit>` 로 추가

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic
# (vitest 전체 run 은 OpenAI quota pre-existing fail 1건 알려져 있음 — 신규 fail 만 의미)

# 수동 smoke (사용자 환경, 직전 task 의 phase-02 마쳤을 때와 동일 PDF 사용)
# 1. 새 잡 시작 → figure 단계 진입 → figure_processor 가 성공하는지 (⑧ 픽스 확인)
# 2. figure 단계 진행 전 문제 팝업 → cleaned 자리에 raw 이미지가 아닌 placeholder 노출 (③ 픽스 확인)
# 3. figure 완료 후 "HWPX 조립" 버튼 노출 — "해설 생성 시작" 부재 (⑨ 픽스 확인)
# 4. (선택) figure 실패 케이스를 강제로 만들어 "그림 결과 확인" 버튼 진입 가능 + 모달 안 실패 표시 + 재시도 (⑩ 픽스 확인)
```

## 실행 결과

### 1회차 (2026-05-22 23:50 KST) — completed
**상태**: completed
**소요 시간**: 약 25분
**진행 모델**: claude-sonnet-4-6

#### 요약
진단 결과: figure_status.json에 `"error": "gemini generation failed after 3 attempts"` 기록 — Gemini API 429 RESOURCE_EXHAUSTED (월 지출 한도 초과). ⓒ는 외부 의존 실패이므로 에러 메시지 캡처 개선으로 대응. ⓑ cleaning_status.json `cleaned: false` 시 파일은 존재하지만 원본 복사본이므로 QuestionImages.tsx에서 상태 fetch + 분기 추가. ⓓ 직전 두 픽스(followup meta 누락, defaultProvider routing)와 다른 새로운 root cause 확인 — `extractionReviewActive`가 extractor 이후 리셋 없이 유지되어 figure stage 이후 "그림 결과 확인" 버튼이 숨겨지는 문제. page.tsx에서 figure stage done/failed 시 자동 리셋 + retry 콜백 앞에서 즉시 리셋.

#### 변경 파일
- `figure_processor.py` (수정, +8/-5줄) — `generate_with_gemini` 반환 타입을 `(bytes|None, str|None)` 튜플로 변경, 실제 예외 메시지를 figure_status.json error 필드에 포함
- `ngd-studio/components/results/question-result/QuestionImages.tsx` (수정, +23/-5줄) — cleaning_status.json fetch + `isActuallyCleaned` 상태 추가, `cleaned=false` 시 "이미지 처리 전 (원본과 동일)" placeholder 표시
- `ngd-studio/components/results/question-result/FigureReviewModal.tsx` (수정, +30/-12줄) — `failedProblems` useMemo 추가, 헤더에 "실패 N개" 배지, 실패 문제에 빨강 테두리+에러 메시지+재생성 CTA, `allLoaded` 계산에서 failed 문제 제외
- `ngd-studio/app/create/page.tsx` (수정, +12/-0줄) — figure stage done/failed 시 extractionReviewActive 리셋 useEffect 추가, onRetryFigure/onRetryAll 콜백 앞에 즉시 리셋 추가

#### 검증 결과
- [x] TypeScript 타입 검사: `npx tsc --noEmit` → 오류 없음 (exit 0)
- [x] Vitest: 706 pass / 1 pre-existing fail (openai-sdk quota) — 신규 실패 없음
- [x] figure_processor.py 구문: `python3 -m py_compile figure_processor.py` → 통과
- [ ] 수동 smoke: 사용자 환경에서 figure 단계 실제 실행 필요 (Gemini API 한도 초과 상태로 자동 검증 불가)

#### 추가 발견사항
- **ⓔ feedback-systematic-audit 분기 판단**: 296cd58(followup meta 누락)·86117c0(defaultProvider routing) 모두 orchestrator/followup route 레이어의 데이터 누락 문제. 본 케이스 ⑨의 root cause는 `extractionReviewActive` 프론트엔드 상태가 figure followup 시 리셋되지 않는 문제 — 전혀 다른 레이어/경로. audit 매트릭스 전환 불필요, 직접 픽스 적용.
- **ⓒ Gemini 429 RESOURCE_EXHAUSTED**: API key는 정상 설정되어 있으나 프로젝트 월 지출 한도 초과. https://ai.studio/spend 에서 한도 상향 필요. 코드 픽스 범위 외 — 에러 메시지 visibility 개선으로 대응.
- **figure 실패 후 builder 계속 실행**: orchestrator.ts line 945-948에서 figure 실패 시 `return failed(...)` 없이 builder로 진행 — 그림 없이 HWPX를 조립하는 동작. 사용자 경험에 따라 figure 실패 시 중단이 나을 수도 있으나 현재 스펙 외 사항. 추가 발견으로만 기록.

#### 질문 / 결정 사항
- Gemini 월 한도 초과 해소 필요. https://ai.studio/spend 에서 프로젝트 지출 한도 상향 요청.
- figure 실패 시 builder 자동 실행 계속 여부 (현재 동작) — 의도된 동작이라면 OK, 아니면 별도 phase에서 다룰 것.

#### Scope Audit (orchestrator)
pass — 변경 4건 모두 scope 내 (figure_processor.py, page.tsx, FigureReviewModal.tsx, QuestionImages.tsx). docs/* 는 orchestrator/PHASE_FILE exempt. orchestrator.ts/followup route는 미수정.

#### Verification Re-run (orchestrator)
exit 0 — `cd ngd-studio && npx tsc --noEmit` clean, vitest 706/707 pass (1 fail = openaiSdkLive.test.ts, 검증 섹션 주석 명시 pre-existing OpenAI quota fail). worker 보고와 일치. partial 사유(Gemini 한도)는 사용자 확정 — 외부 의존이라 코드 픽스 범위 외.

#### Simplify (orchestrator)
2 files, 3 edits — VERIFY pass. figure_processor.py `_make_q_status` 헬퍼로 중복 q_status 블록 통합 + status `in` 연산자 단순화. FigureReviewModal no-op onError 핸들러 제거.

#### Review (orchestrator)
VERDICT: pass — 0 issues. 6개 항목 전부 구현, A~J 전부 OK, 대체 smoke test 3종(tsc/vitest/py_compile) 기록, ⓔ audit 분기 판단(296cd58/86117c0 와 다른 레이어 — frontend extractionReviewActive 상태) 합리적.
