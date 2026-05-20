---
id: create-v4-full-pipeline
type: full
priority: P0
domain: create
trigger: last_touch
delegate_to: run
entry_points:
  - create-v4-page
  - api-run
  - api-run-followup
  - api-jobs
  - api-build-status
  - api-status
  - api-upload
  - api-extracted-json
  - api-figure-status
  - api-v3cache-data
  - api-v3cache-meta
  - api-question-images
  - api-file
involved_globs:
  - ngd-studio/app/create-v4/**
  - ngd-studio/components/cropper/**
  - ngd-studio/components/upload/**
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/store.ts
  - ngd-studio/app/api/run/**
  - ngd-studio/app/api/jobs/**
  - ngd-studio/app/api/upload/**
  - ngd-studio/app/api/build-status/**
  - ngd-studio/app/api/status/**
  - ngd-studio/app/api/extracted-json/**
  - ngd-studio/app/api/figure-status/**
  - ngd-studio/app/api/v3cache-data/**
  - ngd-studio/app/api/v3cache-meta/**
  - ngd-studio/app/api/question-images/**
  - ngd-studio/app/api/file/**
  - ngd-studio/server/**
  - ngd-studio/components/ui/**
  - ngd-studio/lib/utils.ts
last_change:
  date: 2026-05-20
  task: bootstrap
  ref: changelog/create.md#create-v4-full-pipeline-2026-05-20
---

# create-v4-full-pipeline: create-v4 PDF → 추출 → solver → builder → HWPX 완성

> 변경 이력: [create changelog](../../changelog/create.md#create-v4-full-pipeline)

## scenarios

1. localhost:3000/create-v4 진입 → 페이지 200 응답
2. PDF + 메타 입력 → "추출 시작" → extractor 완료 (job status = extracted)
3. solver/verifier 단계 통과 (job status = solved)
4. figure + builder 단계 통과 (job status = built)
5. outputs/ 의 HWPX 파일 존재 + ZIP open 가능

## 관련 시나리오

- [build-hwpx-cli](build-hwpx-cli.md) — server-side HWPX 조립 단독 검증 (web 없이)
