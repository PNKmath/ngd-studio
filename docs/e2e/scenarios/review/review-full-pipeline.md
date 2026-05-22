---
id: review-full-pipeline
type: full
priority: P0
domain: review
trigger: last_touch
delegate_to: run
entry_points:
  - review-page
  - api-run
  - api-jobs
  - api-upload
  - api-file
  - api-build-status
  - api-run-followup
  - api-pdf-preview
involved_globs:
  - ngd-studio/app/review/**
  - ngd-studio/server/review/**
  - ngd-studio/server/stages/reviewRunner.ts
  - ngd-studio/server/sse.ts
  - .claude/agents/ngd-exam-reviewer.md
  - .claude/skills/ngd-exam-review/**
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/reviewParser.ts
  - ngd-studio/components/results/ReviewReport.tsx
  - ngd-studio/components/pipeline/PipelineView.tsx
  - ngd-studio/app/api/run/**
  - ngd-studio/app/api/jobs/**
  - ngd-studio/app/api/upload/**
  - ngd-studio/app/api/file/**
last_change:
  date: 2026-05-22
  task: legacy-pipeline-removal
  ref: changelog/review.md#review-full-pipeline-2026-05-22
---

# review-full-pipeline: PDF + 작업 HWPX → reviewRunner → 수정 HWPX + 오검 리포트

> 변경 이력: [review changelog](../../changelog/review.md#review-full-pipeline)

## scenarios

1. localhost:3000/review 진입 → 페이지 200 응답
2. `inputs/오검/` 의 운영 PDF + HWPX 한 세트를 FileDropzone 에 드랍 (PDF 1, HWPX 1)
3. "시작" 버튼 클릭 → `startJob("review", ...)` → SSE 로 stage 진행 관찰
4. reviewRunner stage 완료 (job status = built 또는 동등 종결 상태) — 도중 에러/타임아웃 없음
5. ReviewReport 에 issue 항목 표시 + DownloadButton 으로 수정 HWPX 다운로드 가능

## 검증 포인트

- reviewRunner 가 autoValidators + reviewer agent 양쪽을 호출 (Phase 7 이후): SSE log 에 양쪽 발화 흔적
- ReviewItems 의 `rule_id` 중복 0건 (autoValidators ↔ agent skipRuleIds 동치성)
- 다운로드된 HWPX 가 ZIP open 가능 + `Contents/section0.xml` 파싱 가능

## 관련 시나리오

- [create-v4-full-pipeline](../create/create-v4-full-pipeline.md): job 진입점 API (api-run, api-jobs, api-upload, api-file) 공유. review 는 builder 가 아닌 reviewRunner 로 분기.

## 메모

- review 전용 API route 없음 — 모든 흐름이 `/api/run` SSE 로 수렴.
- Phase 7 (audit-driven-full-agentic-codification) 이후 본 시나리오의 "rule_id 중복 0건" 검증이 운영 invariant 가 됨. 그 전에는 agent 단독 생성이라 중복 검증 의미 없음 — Phase 7 합쳐지면 본 시나리오 검증이 자연스럽게 invariant 발화.
