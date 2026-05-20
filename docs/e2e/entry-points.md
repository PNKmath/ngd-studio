---
project: ngd-studio
last_scanned: 2026-05-20
project_type: mixed (nextjs + cli-python)
---

# Entry Points — ngd-studio

> phase-e2e-init 의 entry point 매처가 자동 생성. 사람은 검증/보완만.
> refresh 시 delta 비교 기준이 됨.
> project_type 별 매처 규칙: `~/.claude/skills/phase-e2e-init/docs/entry-point-patterns.md`

## Entry Points

### Pages (Next.js App Router)

### <a id="root-page"></a> root-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/page.tsx
- discovered: 2026-05-20

### <a id="settings-page"></a> settings-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/settings/page.tsx
- discovered: 2026-05-20

### <a id="pdf-cropper-page"></a> pdf-cropper-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/pdf-cropper/page.tsx
- discovered: 2026-05-20

### <a id="review-page"></a> review-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/review/page.tsx
- discovered: 2026-05-20

### <a id="history-page"></a> history-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/history/page.tsx
- discovered: 2026-05-20

### <a id="create-page"></a> create-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/create/page.tsx
- discovered: 2026-05-20

### <a id="create-v4-page"></a> create-v4-page
- type: page
- pattern: nextjs-app-page
- file: ngd-studio/app/create-v4/page.tsx
- discovered: 2026-05-20

### API Routes (Next.js App Router)

### <a id="api-auto-crop"></a> api-auto-crop
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/auto-crop/route.ts
- discovered: 2026-05-20

### <a id="api-build-status"></a> api-build-status
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/build-status/route.ts
- discovered: 2026-05-20

### <a id="api-download"></a> api-download
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/download/[jobId]/route.ts
- discovered: 2026-05-20

### <a id="api-env-settings"></a> api-env-settings
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/env-settings/route.ts
- discovered: 2026-05-20

### <a id="api-env-settings-test"></a> api-env-settings-test
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/env-settings/test/route.ts
- discovered: 2026-05-20

### <a id="api-extracted-json"></a> api-extracted-json
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/extracted-json/route.ts
- discovered: 2026-05-20

### <a id="api-figure-status"></a> api-figure-status
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/figure-status/route.ts
- discovered: 2026-05-20

### <a id="api-file"></a> api-file
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/file/route.ts
- discovered: 2026-05-20

### <a id="api-jobs"></a> api-jobs
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/jobs/route.ts
- discovered: 2026-05-20

### <a id="api-pdf-meta"></a> api-pdf-meta
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/pdf-meta/route.ts
- discovered: 2026-05-20

### <a id="api-pdf-preview"></a> api-pdf-preview
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/pdf-preview/route.ts
- discovered: 2026-05-20

### <a id="api-question-images"></a> api-question-images
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/question-images/route.ts
- discovered: 2026-05-20

### <a id="api-run"></a> api-run
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/run/route.ts
- discovered: 2026-05-20

### <a id="api-run-followup"></a> api-run-followup
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/run/[jobId]/followup/route.ts
- discovered: 2026-05-20

### <a id="api-status"></a> api-status
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/status/route.ts
- discovered: 2026-05-20

### <a id="api-upload"></a> api-upload
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/upload/route.ts
- discovered: 2026-05-20

### <a id="api-v3cache-data"></a> api-v3cache-data
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/v3cache-data/route.ts
- discovered: 2026-05-20

### <a id="api-v3cache-meta"></a> api-v3cache-meta
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/v3cache-meta/route.ts
- discovered: 2026-05-20

### <a id="api-v3cache-reset"></a> api-v3cache-reset
- type: api
- pattern: nextjs-app-route
- file: ngd-studio/app/api/v3cache-reset/route.ts
- discovered: 2026-05-20

### CLI Tools (Python main-guard fallback)

### <a id="cli-build-hwpx"></a> cli-build-hwpx
- type: cli
- pattern: cli-main-guard
- file: build_hwpx.py
- discovered: 2026-05-20

### <a id="cli-assemble"></a> cli-assemble
- type: cli
- pattern: cli-main-guard
- file: assemble.py
- discovered: 2026-05-20

### <a id="cli-figure-processor"></a> cli-figure-processor
- type: cli
- pattern: cli-main-guard
- file: figure_processor.py
- discovered: 2026-05-20

## 미감지 영역

(없음. 사용자가 매처가 못 잡은 entry 있으면 여기 추가.)
