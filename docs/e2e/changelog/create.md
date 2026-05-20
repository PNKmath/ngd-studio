# create 도메인 — E2E 변경 이력

> 시나리오 단위로 시간 역순. 각 entry 는 task 단위.
> 시나리오 본문은 이력 0줄 — 모든 변경은 여기에만 누적.

## create-v4-full-pipeline

→ 시나리오: [scenarios/create/create-v4-full-pipeline.md](../scenarios/create/create-v4-full-pipeline.md)
→ entry-points 영향: [create-v4-page](../entry-points.md#create-v4-page), [api-run](../entry-points.md#api-run), [api-jobs](../entry-points.md#api-jobs), [api-upload](../entry-points.md#api-upload) 외

### <a id="create-v4-full-pipeline-2026-05-20"></a> 2026-05-20 — task: bootstrap
- 신규 추가
- type: full, priority: P0, trigger: last_touch, delegate_to: run
- entry_points 13개, involved_globs 19개 (UI + API + server + 공통)
- v3 신규 흐름 (코드 기반 orchestrator) 의 end-to-end 검증

## build-hwpx-cli

→ 시나리오: [scenarios/create/build-hwpx-cli.md](../scenarios/create/build-hwpx-cli.md)
→ entry-points 영향: [cli-build-hwpx](../entry-points.md#cli-build-hwpx), [cli-assemble](../entry-points.md#cli-assemble), [cli-figure-processor](../entry-points.md#cli-figure-processor)

### <a id="build-hwpx-cli-2026-05-20"></a> 2026-05-20 — task: bootstrap
- 신규 추가
- type: partial, priority: P0, trigger: last_touch, delegate_to: verify
- entry_points 3개 (CLI), involved_globs 8개 (Python tools + resources)
- web 없이 server-side 조립 단독 검증 (create-v4-full-pipeline 과 builder 공유)
