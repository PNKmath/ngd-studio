---
phase: 3
title: store/UI canonical name 정렬 + cleaned/review_extract 제거
status: pending
depends_on: [1]
scope:
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/__tests__/store.test.ts
  - ngd-studio/app/create-v4/page.tsx
  - ngd-studio/components/log/LogStream.tsx
intervention_likely: false
intervention_reason: ""
---

# Phase 3: store/UI canonical name 정렬 + cleaned/review_extract 제거

> **범위**: Frontend (store + UI components)
> **난이도**: S
> **의존성**: Phase 1 (canonical namespace) — Phase 2와 병렬 가능 (scope disjoint)
> **영향 파일**: `ngd-studio/lib/store.ts`, `ngd-studio/app/create-v4/page.tsx`, `ngd-studio/components/log/LogStream.tsx`

## 배경

`store.ts`의 `createStages`는 8개 (`cleaned`, `extractor`, `review_extract`, `solver`, `verifier`, `figure`, `builder`, `checker`) 이지만, 코드 orchestrator는 `cleaned`와 `review_extract`를 절대 emit하지 않는다. 사용자는 PipelineView에서 이 두 카드가 영원히 pending인 상태를 보게 된다.

또한 `STAGE_ORDER`와 `buildResumeStages`도 같은 8개 기준이며, `create-v4/page.tsx`의 `inferResumeStage`도 동일 순서를 사용. LogStream에는 임시로 추가한 `shortenStage` helper가 있는데 Phase 2 완료 후엔 prefix가 안 오므로 제거 가능.

## 설계

### store.ts

```ts
import { PIPELINE_STAGES, type PipelineStageName } from "@/lib/pipelineStages";

const createStages: PipelineStage[] = [
  { name: "extractor", label: "문제 추출", status: "pending" },
  { name: "solver",    label: "해설 생성", status: "pending" },
  { name: "verifier",  label: "해설 검증", status: "pending" },
  { name: "figure",    label: "그림 처리", status: "pending" },
  { name: "builder",   label: "HWPX 조립", status: "pending" },
  { name: "checker",   label: "품질 검수", status: "pending" },
];

const STAGE_ORDER: PipelineStageName[] = [...PIPELINE_STAGES];

function buildResumeStages(resumeFrom?: string): PipelineStage[] {
  // "confirm"은 figure 완료를 의미 → builder부터 진행
  const effectiveFrom = resumeFrom === "confirm" ? "builder" : resumeFrom;
  const resumeIdx = effectiveFrom ? STAGE_ORDER.indexOf(effectiveFrom as PipelineStageName) : 0;
  return createStages.map((s) => ({
    ...s,
    status: (resumeIdx > 0 && STAGE_ORDER.indexOf(s.name as PipelineStageName) < resumeIdx) ? "done" as const : "pending" as const,
  }));
}
```

`cleaned`와 `review_extract` 단순 삭제. 첫 stage가 `extractor`이므로 resume 시 시작 인덱스 처리 단순화.

### create-v4/page.tsx

`inferResumeStage` 함수에서 사용하는 stage order를 canonical 6개로 축소:

```ts
function inferResumeStage(stages: { name: string; status: string }[]): string {
  const order = ["extractor", "solver", "verifier", "figure", "builder", "checker"];
  for (const name of order) {
    const stage = stages.find((s) => s.name === name);
    if (!stage) continue;
    if (stage.status !== "done") return name;
  }
  return "checker";
}
```

(이전엔 `cleaned → extractor` / `review_extract → solver` 매핑이 있었지만 두 stage가 사라지므로 매핑도 제거.)

`PIPELINE_STAGES`를 import해서 hard-coded 배열 대신 사용해도 됨. worker 판단.

### LogStream.tsx

`shortenStage` helper 제거. stage name이 이미 canonical short name (`extractor` 등)이므로 그대로 표시. `w-24 truncate` 폭은 유지 (예: `extractor`는 11자 → 충분).

### store.test.ts

기존 테스트가 8 stage 배열을 expect할 가능성 → 6 stage로 갱신.

## 체크리스트

- [ ] `lib/store.ts`: `createStages` 6개로 축소 (cleaned/review_extract 제거)
- [ ] `lib/store.ts`: `STAGE_ORDER`와 `buildResumeStages` 6개 기준 갱신
- [ ] `app/create-v4/page.tsx`: `inferResumeStage`의 order 배열 6개로 축소
- [ ] `components/log/LogStream.tsx`: `shortenStage` helper 제거, `[{log.stage}]` 직접 표시 (truncate는 유지)
- [ ] `lib/__tests__/store.test.ts`: stage count/이름 변경에 맞춰 갱신, 회귀 없음
- [ ] `cd ngd-studio && npx tsc --noEmit && npx vitest run lib/__tests__/store.test.ts --reporter=basic` pass

## 영향 범위

- PipelineView가 보여주는 stage 카드 8개 → 6개로 축소. 사용자가 보던 영원히 pending인 카드 사라짐.
- `buildResumeStages`/`inferResumeStage`의 stage 매핑 단순화.
- LogStream에 표시되는 stage 라벨이 prefix 없이 짧게 표시.
- 외부 API/타입 변경 없음. AIStageKey/AI_STAGE_KEYS 그대로.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run lib/__tests__/store.test.ts --reporter=basic
```
