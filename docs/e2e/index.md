---
project: ngd-studio
catalog_version: 1
last_refreshed: 2026-05-21
total_scenarios: 3
---

# E2E Catalog — ngd-studio

> phase-e2e-init 이 bootstrap / refresh 시 갱신. phase-init 이 task 단위로 mutate.
> phase-run 은 읽기 전용 (per-phase 발화 시 e2e_refs 시나리오만 로드).
> 자세한 스키마: `~/.claude/skills/phase-run/docs/checklist-schema.md` §7

## Scenarios

| id | type | priority | domain | involved_globs | entry_points | file |
|----|------|----------|--------|----------------|--------------|------|
| create-v4-full-pipeline | full | P0 | create | ngd-studio/app/create/**, ngd-studio/components/cropper/**, ngd-studio/components/upload/**, ngd-studio/lib/useJobRunner.ts, ngd-studio/lib/store.ts, ngd-studio/lib/pdf/**, ngd-studio/app/api/run/**, ngd-studio/app/api/jobs/**, ngd-studio/app/api/upload/**, ngd-studio/app/api/build-status/**, ngd-studio/app/api/status/**, ngd-studio/app/api/extracted-json/**, ngd-studio/app/api/figure-status/**, ngd-studio/app/api/v3cache-data/**, ngd-studio/app/api/v3cache-meta/**, ngd-studio/app/api/question-images/**, ngd-studio/app/api/file/**, ngd-studio/server/**, ngd-studio/components/ui/**, ngd-studio/lib/utils.ts | create-v4-page, api-run, api-run-followup, api-jobs, api-build-status, api-status, api-upload, api-extracted-json, api-figure-status, api-v3cache-data, api-v3cache-meta, api-question-images, api-file | [scenarios/create/create-v4-full-pipeline.md](scenarios/create/create-v4-full-pipeline.md) |
| build-hwpx-cli | partial | P0 | create | build_hwpx.py, assemble.py, figure_processor.py, equation.py, ids.py, shapes.py, tables.py, resources/** | cli-build-hwpx, cli-assemble, cli-figure-processor | [scenarios/create/build-hwpx-cli.md](scenarios/create/build-hwpx-cli.md) |
| review-full-pipeline | full | P0 | review | ngd-studio/app/review/**, ngd-studio/server/review/**, ngd-studio/server/stages/reviewRunner.ts, .claude/agents/ngd-exam-reviewer.md, .claude/skills/ngd-exam-review/**, ngd-studio/lib/useJobRunner.ts, ngd-studio/lib/store.ts, ngd-studio/lib/reviewParser.ts, ngd-studio/components/results/ReviewReport.tsx, ngd-studio/components/pipeline/PipelineView.tsx, ngd-studio/app/api/run/**, ngd-studio/app/api/jobs/**, ngd-studio/app/api/upload/**, ngd-studio/app/api/file/** | review-page, api-run, api-jobs, api-upload, api-file, api-build-status, api-run-followup, api-pdf-preview | [scenarios/review/review-full-pipeline.md](scenarios/review/review-full-pipeline.md) |

## 도메인 Coverage

- create: P0 2 (작성 완료)
- review: P0 1 (작성 완료)
- history: 미작성 — 후속 phase-e2e-init refresh 필요 ([_pending](scenarios/history/_pending.md))
- pdf-cropper: 미작성 — 후속 phase-e2e-init refresh 필요 ([_pending](scenarios/pdf-cropper/_pending.md))
- settings: 미작성 — 후속 phase-e2e-init refresh 필요 ([_pending](scenarios/settings/_pending.md))
- misc: 미작성 — 후속 phase-e2e-init refresh 필요 ([_pending](scenarios/misc/_pending.md))

## 미할당 entry points

(refresh 결과 시나리오와 매핑 안 된 entry point. 작성 안 된 도메인에 속한 entry 들은 _pending 참조.)

- history-page, api-download (history 도메인)
- pdf-cropper-page, api-auto-crop, api-pdf-meta, api-pdf-preview (pdf-cropper 도메인)
- settings-page, api-env-settings, api-env-settings-test (settings 도메인)
- root-page, api-v3cache-reset (misc)
