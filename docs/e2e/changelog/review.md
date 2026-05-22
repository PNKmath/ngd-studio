# review 도메인 — E2E 변경 이력

> 시나리오 단위로 시간 역순. 각 entry 는 task 단위.
> 시나리오 본문은 이력 0줄 — 모든 변경은 여기에만 누적.

## review-full-pipeline

→ 시나리오: [scenarios/review/review-full-pipeline.md](../scenarios/review/review-full-pipeline.md)
→ entry-points 영향: [review-page](../entry-points.md#review-page), [api-run](../entry-points.md#api-run), [api-jobs](../entry-points.md#api-jobs), [api-upload](../entry-points.md#api-upload) 외

### <a id="review-full-pipeline-2026-05-22"></a> 2026-05-22 — task: legacy-pipeline-removal
- involved_globs 에 `ngd-studio/server/sse.ts` 추가 (14 → 15)
- 사유: review 모드 SSE 요청의 라우팅/생애주기 진입점이 sse.ts. legacy pipeline 제거 작업으로 review 분기가 orchestrator 로 이관되면 sse.ts 변경이 review 흐름에 직접 영향. catalog 갭 보강.

### <a id="review-full-pipeline-2026-05-20"></a> 2026-05-20 — task: bootstrap
- 신규 추가 (도메인 bootstrap — phase-e2e-init --refresh --domain review)
- type: full, priority: P0, trigger: last_touch, delegate_to: run
- entry_points 8개 (UI + 공통 API), involved_globs 14개 (server/review + reviewer agent + UI runner + 공통 API)
- 오검 흐름 end-to-end: PDF + 작업 HWPX → reviewRunner → 수정 HWPX + 리포트
- audit-driven-full-agentic-codification Phase 7 이후 rule_id 중복 0건 invariant 발화 예정
