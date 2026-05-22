# Legacy Claude Code Pipeline 제거

## 배경

ngd-studio에는 두 가지 실행 경로가 공존한다:

- **Legacy (skill 일임 경로)**: `sse.ts` / `followup/route.ts` 가 `ngd-exam-create` / `ngd-exam-review` skill 호출용 monolithic prompt를 만들어 Claude CLI 1회 호출로 전 파이프라인을 일임. `runLegacyPromptJob` (server/stages/jobRunner.ts) + `lib/prompts.ts` 의 `buildCreatePrompt` / `buildResumePrompt` / `buildReviewPrompt` 가 이 경로.
- **신규 (TS orchestrator)**: `runStageOrchestrator` (server/stages/orchestrator.ts) 가 stage별 (extractor → solver → verifier → figure → builder → checker) 결정론적 실행. provider는 `claudeCliProvider` 또는 다른 provider 사용 가능.

분기 기준은 `shouldUseCodeOrchestrator` (server/stages/branchHelper.ts) — `/settings` 에서 create.* stage override가 하나라도 지정되면 신규, 모두 `auto`/미지정이면 legacy.

이 분기 자체가 legacy 잔존부의 게이트다. 본 task는 게이트와 legacy 분기를 모두 제거하고 **모든 실행을 orchestrator로 일원화** 한다.

## 범위

1. orchestrator에 `mode: "review"` 통합 — reviewer agent callable + 자유 텍스트 instruction 지원
2. `auto` provider semantics 재정의 — stageOverrides 미지정 시 `claude-cli` 로 default resolve (이미 registry에서 그렇게 동작; 명시적 보장 + UI 카피)
3. followup route legacy 분기 제거 — create/resume + **review followup** 모두 orchestrator로
4. crop 모드 jobRunner 의존성 제거 — sse.ts crop 분기를 small inline helper (`runAIProvider` 직접 호출) 로 마이그레이션
5. sse.ts create/resume/review legacy 분기 일괄 제거 (deterministicBuilder/Checker 분기 포함)
6. Dead code 정리 — `jobRunner.ts` (runLegacyPromptJob), `branchHelper.ts` (shouldUseCodeOrchestrator), `lib/prompts.ts` 의 buildCreate/Resume/ReviewPrompt 삭제
7. `/settings` UI 카피 미세 조정 (auto 옵션 label/detail)
8. 수동 E2E 검증 4 모드 (create 처음~끝, navigator action 5종, create FollowupChat, review, review followup, crop)

## 비범위

- `claudeCliProvider` 와 `lib/claude.ts` 의 `runClaude` (Claude CLI spawn helper) 는 유지 — provider 레이어의 정상 구현부, legacy의 일부가 아님
- crop 자체의 orchestrator 통합은 본 task 범위 밖 (jobRunner 의존만 끊고 crop 자체는 그대로 작동)
- `/settings` UI 구조 변경 (label/detail 카피만 미세 조정)

## 완료 기준

- `runLegacyPromptJob`, `shouldUseCodeOrchestrator` 가 코드베이스에서 제거됨
- `/api/run/{jobId}/followup` 와 `server/sse.ts` 모두 분기 없이 `runStageOrchestrator` (또는 crop 인라인 헬퍼) 만 호출
- `mode === "review"` 가 `runReviewStage` 를 통해 흐르고, review followup 도 동일 경로 사용
- `stageOverrides` 가 비어 있어도 orchestrator 가 default provider 로 정상 실행
- `npx tsc --noEmit` 통과, vitest 관련 테스트 통과
- 수동 검증: create / create resume / create followup / review / review followup / crop 6 흐름 모두 정상

## 관련 문서

- 스키마: `~/.claude/skills/phase-run/docs/checklist-schema.md`
- E2E 카탈로그: `docs/e2e/scenarios/create/create-v4-full-pipeline.md`, `docs/e2e/scenarios/review/review-full-pipeline.md`
- 기존 orchestrator 통합 작업: `docs/planning/stage-runner-foundation/`, `docs/planning/create-v4-deterministic-codification/`
