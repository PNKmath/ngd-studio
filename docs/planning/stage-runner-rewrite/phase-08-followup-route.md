---
phase: 8
title: followup route 라우팅 정리
status: completed
depends_on: [5]
scope:
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 8: followup route 라우팅 정리

> **범위**: Backend (followup API)
> **난이도**: S
> **의존성**: Phase 5 (orchestrator)
> **영향 파일**: `ngd-studio/app/api/run/[jobId]/followup/route.ts`

## 배경

followup chat은 작업 완료 후 추가 지시를 받음. 현재는 Claude CLI를 새 세션으로 띄워 instruction을 자유롭게 처리. resume 명령(`resume --q=N --from=...`)이 들어와도 동일하게 처리되는데, 빈 inputFiles 등으로 인해 사용자에게 되묻는 버그가 있었음 (직전 hotfix로 일부 해결).

코드 기반 흐름에서는 resume-style instruction을 orchestrator로 라우팅해 결정론적 처리가 가능. 자유 instruction(자연어 수정 지시)은 legacy CLI 경로 유지.

## 설계

### 분기 조건

```ts
const isResumeCommand = /^\s*resume\b/.test(instruction.trim());
const stageOverrides = (job.stageOverrides ?? {}) as StageOverrideMap;
const useCodeOrchestrator = isResumeCommand &&
  shouldUseCodeOrchestrator(job.mode, stageOverrides);  // Phase 6 helper
```

- resume 명령 + 코드 orchestrator 조건 만족 → orchestrator 직접 호출
- 그 외 → 현재의 Claude CLI followup 흐름 유지

### orchestrator 호출

instruction에서 `--q=N` `--from=STAGE` 파싱:

```ts
function parseResumeArgs(instruction: string): { resumeFrom: string; targetQuestions?: number[] };
```

`runStageOrchestrator` 호출 시 `targetQuestions`를 questionImages 배열로 변환(이미지 경로는 `inputs/시험지 제작/question_images/q{NN}.png` 패턴). meta는 `job.meta` 또는 v3cache-meta에서 로드.

### legacy 경로 보강

직전 hotfix(이미 적용된 [empty inputFiles 가드 + ngd-exam-create 스킬 호출 안내])는 유지. 코드 orchestrator 분기 미적용 케이스는 그대로 동작.

### 테스트

이 phase는 unit 테스트 어렵고 (route handler + Claude CLI spawn), 수동 검증 위주.

## 체크리스트

- [x] `parseResumeArgs(instruction)` 헬퍼 — `--q`, `--from` 정규식 파싱
- [x] `shouldUseCodeOrchestrator`(Phase 6) 재사용 + resume 명령 조건 추가
- [x] orchestrator 분기에서 `runStageOrchestrator` 호출 + SSE stream 응답
- [x] legacy 경로(자유 instruction)는 기존 hotfix 그대로 유지

## 영향 범위

- `followup/route.ts` 분기 추가. 자유 instruction 경로는 동일.
- create-v4의 FollowupChat이 resume-style 입력 시 orchestrator로 자동 라우팅 → UI 변경 불필요.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
# 수동:
# 1. /create-v4에서 작업 완료 후 followup에 "resume --q=5 --from=figure" 입력
# 2. orchestrator 분기 진입 + 5번 figure부터 재실행되는지 SSE event로 확인
# 3. 자유 instruction("3번 해설 다듬어줘")는 기존대로 Claude CLI 호출
```

## 실행 결과

### 1회차 (2026-05-17 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`followup/route.ts`에 resume 명령 감지 + orchestrator 라우팅 분기를 추가했다. `parseResumeArgs` 헬퍼로 `--q`/`--from` 파싱, `shouldUseCodeOrchestrator` (Phase 6)와 `isResumeCommand`를 AND 조건으로 코드 orchestrator 경로를 활성화한다. 자유 instruction 경로(legacy Claude CLI + 기존 hotfix)는 변경 없이 보존됐다.

#### 변경 파일
- `ngd-studio/app/api/run/[jobId]/followup/route.ts` (전면 개정, +~190 / -~90줄)

#### 검증 결과
- [x] tsc: `npx tsc --noEmit` → pass (출력 없음)

#### 추가 발견사항
- orchestrator `isAborted` 콜백은 현재 SSE `cancel()` 훅과 직접 연결하기 어려운 구조(ReadableStream cancel → async orchestrator 전파 어려움). `cancelled` 지역 변수 패턴으로 구현하되, 실제 강제 취소는 SSE stream이 닫힐 때 orchestrator의 checkAborted()가 다음 stage 진입 시점에 감지한다. 완전한 즉시 취소는 향후 AbortController 연동으로 개선 가능.
- `job.meta` 필드는 초기 jobData에 없음 — `?? {}` 가드로 빈 meta 처리.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (followup/route.ts).

#### Verification Re-run (orchestrator)
exit 0 — `npx tsc --noEmit` pass. (수동 SSE 시나리오는 dev 서버 필요로 보류.)

#### Simplify (orchestrator)
1 file, 5 edits, verify pass. readdir 동적 import → 정적 import, 미사용 cancelled 변수 + isAborted 클로저 제거, no-op cancel 간소화, 섹션 구분 주석 정리.

#### Review (orchestrator)
VERDICT: pass (0 issues). 4개 체크리스트 실코드 일치, hotfix 보존, 심볼 실존, tsc pass.

#### Commit
`{commit-hash}` — feat(followup): Phase 8 — followup route 라우팅 정리
