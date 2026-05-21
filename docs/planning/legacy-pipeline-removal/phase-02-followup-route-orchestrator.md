---
phase: 2
title: followup route legacy 분기 제거 + review followup 통합
status: completed
depends_on: [1]
scope:
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - review-full-pipeline
e2e_triggers: []
---

# Phase 2: followup route legacy 분기 제거 + review followup 통합

> **범위**: Backend (Next.js API route)
> **난이도**: S
> **의존성**: Phase 1 (orchestrator review mode)
> **영향 파일**: `app/api/run/[jobId]/followup/route.ts`

## 배경

`/api/run/{jobId}/followup` 은 navigator action 5종 (이미지 교체, 이미지 재정리, 재추출, 해설 재작성, 검증 재실행) + `FollowupChat` 컴포넌트 자유 텍스트의 공통 endpoint다.

현재 라우팅 (`route.ts:72-78`):
- `instruction` 이 `^\s*resume\b` 로 시작 + `shouldUseCodeOrchestrator(job.mode, stageOverrides)` true → orchestrator
- 그 외 → legacy 분기 (`route.ts:219-311`) — `runClaude` 직접 호출 + `buildCreatePrompt` / `buildReviewPrompt` 류 prompt (특히 `이전 작업(...오검...)의 결과를 수정해줘 ... Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해`)

legacy 분기를 제거하면:
- create/resume + resume command → orchestrator (mode: "resume")
- create + 자유 텍스트 instruction → orchestrator (mode: "resume", instruction 을 metadata 로 전달)
- **review + 자유 텍스트** → orchestrator (mode: "review", `additionalInstruction = instruction`)

## 설계

### 1. 라우팅 결정

```ts
const job = JSON.parse(await readFile(jobFile, "utf-8"));
const jobMode: string = job.mode ?? "create";
const isResumeCommand = /^\s*resume\b/.test(instruction.trim());

// 본 phase 후: shouldUseCodeOrchestrator 더 이상 사용 안 함 (phase 5 에서 helper 삭제)
// 모든 followup 은 orchestrator 로 라우팅
```

### 2. orchestrator 입력 빌드

- `jobMode === "review"`:
  - `mode: "review"`, `hwpxPath: job.inputFiles[hwpx 항목]`, `additionalInstruction: instruction`
  - questionImages 빌드 불필요 (review 는 per-question 파이프라인 안 탐)
- `jobMode === "create"` (resume command 또는 자유 텍스트):
  - resume command → 기존 `parseResumeArgs` 로 `resumeFrom`, `targetQuestions` 추출, `mode: "resume"`
  - 자유 텍스트 → `mode: "resume"`, `resumeFrom: "extractor"` (기본값), questionImages 디스크 스캔 fallback
  - 자유 텍스트는 reviewer instruction 처럼 orchestrator 가 직접 소비할 곳은 없으므로 **현 시점에서는 자유 텍스트도 resume 으로 처리** (legacy 와 동등하지는 않으나, navigator action 5종이 자유 텍스트 followup 의 사실상 모든 trafic). 자유 텍스트 followup 의 instruction 은 SSE log 로만 emit.

### 3. legacy 분기 제거

`route.ts:219-311` 의 코드 (legacy prompt 빌드 + `runClaude` spawn + `transformToSSE` 처리 + close 핸들링) 일괄 삭제.

import 정리:
- 삭제: `runClaude`, `transformToSSE` (from `@/lib/claude`)
- 삭제: `shouldUseCodeOrchestrator` (from `@/server/stages/branchHelper`)
- 유지: `SSEEvent` type (orchestrator send 콜백에 사용)

### 4. SSE 응답 흐름

- orchestrator 가 send 콜백으로 `log` / `stage` / `question` / `result` / `error` 발화
- job.status 영구화 + followups 배열 갱신 로직은 유지 (orchestrator 완료/실패 시점에서)

## 체크리스트

- [x] `shouldUseCodeOrchestrator` import 제거 + `useCodeOrchestrator` 분기 제거 (무조건 orchestrator)
- [x] `jobMode === "review"` 분기: `runStageOrchestrator({ mode: "review", hwpxPath, additionalInstruction: instruction, ... })` 호출
- [x] `jobMode === "create"` 분기: 기존 resume 빌드 로직 유지 (parseResumeArgs + questionImages 디스크 스캔)
- [x] legacy 분기 (line 219~311) 일괄 삭제 — `runClaude` 호출부, `transformToSSE` 사용부, legacy prompt 빌드 모두
- [x] `runClaude`, `transformToSSE` import 제거
- [x] job.followups 갱신 + job.status 영구화 로직 유지 + outputFile / resultSummary 갱신
- [x] `cd ngd-studio && npx tsc --noEmit` 통과

## 영향 범위

- **Navigator action 5종**: 기존과 동일하게 동작 (이미 orchestrator 분기 사용 중).
- **FollowupChat 자유 텍스트 (create)**: 이전엔 legacy → ngd-exam-create skill 일임. 이제는 orchestrator 의 resume 경로로 진입. **자유 텍스트 instruction 의 의미가 좁아짐** — orchestrator 는 free-form prompt 를 stage 에 반영하지 않으므로, 사용자가 "이 부분 다시 봐줘" 같은 자유 입력을 주면 사실상 resume from extractor 와 동등. 이는 비범위로 명시 (phase 6 의 수동 검증에서 사용자 의도 차이를 기록).
- **FollowupChat 자유 텍스트 (review)**: 이제 review re-run + reviewer prompt 에 `additionalInstruction` append. legacy 와 동등 (혹은 더 결정론적).

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 검증은 phase 06 에서 일괄 실행. 본 phase 단독 검증:
- followup endpoint 가 `runClaude` 를 import 하지 않는지 grep 으로 확인
- 분기 제거 후 코드 길이 ~50% 감소 예상

## 실행 결과

### 1회차 (2026-05-22 오후 KST) — completed
**상태**: completed
**소요 시간**: 약 3분
**진행 모델**: claude-sonnet-4-6

#### 요약
followup route 에서 `shouldUseCodeOrchestrator` 분기 + legacy 분기(runClaude / transformToSSE / prompt 빌드)를 완전 제거하고, 모든 followup을 orchestrator로 라우팅하도록 재작성. review 모드는 `mode: "review"` + `hwpxPath` + `additionalInstruction`로, create 모드는 `mode: "resume"` + parseResumeArgs + questionImages 스캔으로 각각 orchestrator에 진입.

#### 변경 파일
- `ngd-studio/app/api/run/[jobId]/followup/route.ts` (전체 재작성, 319→309줄)

#### 검증 결과
- [x] tsc --noEmit: `cd ngd-studio && npx tsc --noEmit` → 출력 없음 (pass)
- [x] runClaude/transformToSSE/shouldUseCodeOrchestrator import 없음: grep → 출력 없음 (pass)

#### 추가 발견사항
- hwpxPath 결정: `job.outputFile` 우선 → 없으면 `job.inputFiles` 에서 `.hwpx` 확장자 탐색. review 첫 실행 후 outputFile이 세팅되면 이후 followup은 수정된 파일 기준으로 재실행됨.
- 자유 텍스트 create followup: instruction을 SSE log로만 emit하고 `resumeFrom: "extractor"`로 처리 (설계서 명시).

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (route.ts)

#### Verification Re-run (orchestrator)
exit 0 — tsc 재현됨

#### Simplify (orchestrator)
SIMPLIFIED: 1, CHANGES: 1 file, 5 edits — persistResult/persistFailure/sseResponse 헬퍼 추출 + encoder/stream 중복 제거 (310→240줄). VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass — A~J 전 항목 이상 없음. legacy 분기 완전 제거, review/create followup 모두 orchestrator 경로 통일.
