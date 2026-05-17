---
phase: 1
title: canonical pipeline stage namespace + 매핑 함수
status: pending
depends_on: []
scope:
  - ngd-studio/lib/pipelineStages.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 1: canonical pipeline stage namespace + 매핑 함수

> **범위**: 공통 라이브러리 (신규 모듈)
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `ngd-studio/lib/pipelineStages.ts` (신규)

## 배경

pipeline UI(`PipelineView`, `store.stages`)는 `"extractor"`, `"solver"`, ... 6개 bare name을 기대하지만, orchestrator는 Phase 1(stage-runner-rewrite)에서 도입된 AI provider 선택 키(`AIStageKey = "create.extractor" | ...`)를 그대로 SSE `stageEvent`에 흘려보내고 있다. useJobRunner의 `updateStage(name, ...)`가 store의 stage와 매치 안 돼 PipelineView가 갱신 안 되는 원인.

두 namespace를 공식적으로 분리하고 한 방향 매핑을 제공하는 단일 모듈을 만든다.

## 설계

`ngd-studio/lib/pipelineStages.ts` 신규:

```ts
import type { AIStageKey } from "@/lib/ai/types";

export const PIPELINE_STAGES = [
  "extractor",
  "solver",
  "verifier",
  "figure",
  "builder",
  "checker",
] as const;

export type PipelineStageName = typeof PIPELINE_STAGES[number];

/**
 * AI provider 선택용 stage key("create.extractor" 등)를 pipeline UI stage 이름으로
 * 매핑한다. Phase 1(stage-runner-rewrite)에서 도입된 AIStageKey와 PipelineView가
 * 사용하는 stage 식별자를 명시적으로 연결.
 *
 * - "create.extractor" → "extractor"
 * - "create.solver"    → "solver"
 * - "create.verifier"  → "verifier"
 * - "review.reviewer"  → null (review는 별도 흐름, pipeline 안 씀)
 */
export function aiStageToPipeline(key: AIStageKey): PipelineStageName | null {
  if (key === "create.extractor") return "extractor";
  if (key === "create.solver") return "solver";
  if (key === "create.verifier") return "verifier";
  return null; // review.reviewer
}

/**
 * 임의 stage 이름 문자열을 canonical pipeline name으로 정규화.
 * SSE event name이 legacy 형태("create.extractor")로 들어와도 매칭되도록 한다.
 * matching 실패 시 입력 그대로 반환(통과).
 */
export function normalizePipelineStage(name: string): string {
  if (name.startsWith("create.")) {
    const tail = name.slice("create.".length);
    if ((PIPELINE_STAGES as readonly string[]).includes(tail)) return tail;
  }
  return name;
}
```

`normalizePipelineStage`는 Phase 2에서 orchestrator를 직접 고치지 않아도 useJobRunner 측에서 통일된 이름으로 받기 위한 안전망. Phase 2가 emit 단계에서 깔끔히 처리하면 normalize는 no-op으로 동작.

## 체크리스트

- [ ] `ngd-studio/lib/pipelineStages.ts` 신규 작성 — `PIPELINE_STAGES` 상수 + `PipelineStageName` 타입 + `aiStageToPipeline` + `normalizePipelineStage` export
- [ ] 매핑 함수 4종(extractor/solver/verifier/review.reviewer) 모두 명시적 매핑 또는 null 반환
- [ ] `normalizePipelineStage`가 "create.solver" → "solver" / "extractor" → "extractor" / "figure" → "figure" 모두 동작
- [ ] `npx tsc --noEmit` 통과 (신규 모듈 import는 없으므로 컴파일만 확인)

## 영향 범위

- 신규 모듈만 추가. 기존 코드 영향 없음.
- Phase 2/3에서 이 모듈을 import해 사용.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```
