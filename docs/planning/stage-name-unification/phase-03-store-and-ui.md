---
phase: 3
title: store/UI canonical name 정렬 + cleaned/review_extract 제거
status: completed
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

- [x] `lib/store.ts`: `createStages` 6개로 축소 (cleaned/review_extract 제거)
- [x] `lib/store.ts`: `STAGE_ORDER`와 `buildResumeStages` 6개 기준 갱신
- [x] `app/create-v4/page.tsx`: `inferResumeStage`의 order 배열 6개로 축소
- [x] `components/log/LogStream.tsx`: `shortenStage` helper 제거, `[{log.stage}]` 직접 표시 (truncate는 유지)
- [x] `lib/__tests__/store.test.ts`: stage count/이름 변경에 맞춰 갱신, 회귀 없음
- [x] `cd ngd-studio && npx tsc --noEmit && npx vitest run lib/__tests__/store.test.ts --reporter=basic` pass

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

## 실행 결과

### 1회차 (2026-05-17 23:47 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`createStages`에서 `cleaned`/`review_extract` 2개를 제거해 6개 canonical 배열로 축소했다. `STAGE_ORDER`를 `PIPELINE_STAGES` 참조로 교체하고 `buildResumeStages`의 기본 인덱스를 0으로 수정했다. `inferResumeStage`에서 더 이상 존재하지 않는 두 stage의 매핑 분기를 제거했고, `LogStream.tsx`에서 `shortenStage` helper를 삭제해 `log.stage`를 직접 표시한다. 테스트 8개 전부 pass.

#### 변경 파일
- `ngd-studio/lib/store.ts` (수정, +3/-9줄): pipelineStages import 추가, createStages 6개로 축소, STAGE_ORDER 타입 추가 및 초기값 변경, buildResumeStages resumeIdx default 0으로 변경
- `ngd-studio/app/create-v4/page.tsx` (수정, +2/-7줄): inferResumeStage 6개 배열 + 매핑 분기 제거
- `ngd-studio/components/log/LogStream.tsx` (수정, +1/-5줄): shortenStage 제거, log.stage 직접 표시
- `ngd-studio/lib/__tests__/store.test.ts` (수정, +14/-17줄): 8개→6개 stage 기대값 갱신, cleaned/review_extract 관련 단언 제거

#### 검증 결과
- [x] tsc --noEmit: `npx tsc --noEmit` → 오류 없음 (no output)
- [x] vitest store.test.ts: `8 tests passed` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
