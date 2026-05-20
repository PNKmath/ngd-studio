---
phase: 2
title: verifier 스킵 옵션
status: completed
depends_on: []
scope:
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/__tests__/providerSettings.test.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/stages/__tests__/orchestrator.test.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/app/settings/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 2: verifier 스킵 옵션

> **범위**: Backend + Frontend
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `server/stages/orchestrator.ts:274-277, 384-498`, `lib/ai/settings.ts`, `app/settings/page.tsx`

## 배경

현재 `create.verifier` stage는 항상 실행된다 — `lib/ai/settings.ts:11-16`의 `AI_STAGE_KEYS`에 verifier가 들어 있어 provider 변경은 가능하지만 **스킵 불가**. 일부 시나리오(빠른 초안 / 비용 절감)에서는 solver 결과만으로 figure stage에 진입하고 싶다.

`StageProviderId`에 `"skip"` sentinel을 추가하는 방식은 타입 분기를 모든 provider 호출 경로에 강요해 비용이 크다. **별도 필드 `stageSkip: Partial<Record<AIStageKey, boolean>>`** 로 분리한다 (확장성 ↑, 타입 안전 ↑).

## 설계

### 1. 타입 (`lib/ai/settings.ts`)

```ts
export type StageSkipMap = Partial<Record<AIStageKey, boolean>>;

export interface AISettings {
  defaultProvider: SelectableProviderId;
  stageOverrides: StageOverrideMap;
  figureRegen: boolean;
  checkerMaxAttempts: number;
  /** stage별 스킵 플래그. 현재는 create.verifier만 의미 있음. */
  stageSkip: StageSkipMap;
}
```

- `DEFAULT_AI_SETTINGS.stageSkip = {}`
- `normalizeStageSkip`: 알려진 stageKey 만 통과, value는 boolean 으로 강제. read/write 정규화.

### 2. Body 전달 (`lib/useJobRunner.ts`, `server/sse.ts`)

`stageSkip`을 요청 body에 포함 → SSE에서 받아 orchestrator로 전달:

```ts
// sse.ts body type
stageSkip?: Partial<Record<string, boolean>>;

// orchestrator 호출
stageSkip: normalizeStageSkip(body.stageSkip),
```

### 3. Orchestrator 입력/사용 (`server/stages/orchestrator.ts`)

```ts
interface OrchestratorInput {
  ...
  stageSkip?: StageSkipMap;
}
```

L274-277 `skipVerifier` 분기에 OR-in:

```ts
const skipVerifier =
  !shouldRunStage(startStage, "verifier") ||
  state.verified ||
  input.stageSkip?.["create.verifier"] === true;
```

추가로, L384 `if (!skipVerifier)` 블록 진입 전에 **명시적 스킵일 때 stage event 한 번 emit**:

```ts
if (input.stageSkip?.["create.verifier"] === true && state.verified === false) {
  send(stageEvent("verifier", "done", { summary: "스킵됨 (사용자 설정)" }));
  send(logEvent("verifier", `Q${n} 검증 스킵 (stageSkip)`));
}
```

`providerTelemetry`에 skipped 기록:

```ts
providerTelemetry.push(
  createProviderTelemetryEntry({
    stageKey: "create.verifier",
    workflowStageKey: "create.verifier",
    requestedProvider: "auto",
    resolvedProvider: "skipped",
    attempt: 0,
    status: "skipped",
    elapsedMs: 0,
    retry: false,
  })
);
```

> `status: "skipped"` 가 createProviderTelemetryEntry에서 지원되는지 확인. 미지원이면 `status: "success"` + `errorSummary: "stage skipped"`로 대체하거나 단순히 push 생략.

### 4. Settings UI (`app/settings/page.tsx:469-525`)

verifier stage 카드 내부에 체크박스 추가:

```tsx
{stageKey === "create.verifier" && (
  <label className="flex items-center gap-2 text-xs text-muted-foreground">
    <input
      type="checkbox"
      checked={!!settings.stageSkip["create.verifier"]}
      onChange={(e) => setSettings(writeAISettings({
        ...settings,
        stageSkip: { ...settings.stageSkip, "create.verifier": e.target.checked },
      }))}
    />
    검증 단계 스킵 (solver 결과로 figure 진입)
  </label>
)}
```

스킵 활성 시 provider select를 disabled 처리 (보기 좋게).

### 5. 테스트

`lib/__tests__/providerSettings.test.ts`:
- `stageSkip` 기본 `{}` 직렬화/역직렬화
- 알려지지 않은 stageKey 필터링
- legacy 저장본 마이그레이션

`server/stages/__tests__/orchestrator.test.ts` (신규 또는 기존 파일):
- `stageSkip["create.verifier"] = true` 일 때:
  - verifier provider 호출 0회 (mock)
  - solver 출력이 그대로 다음 stage로 전달
  - stage event "verifier done (스킵됨)" 1회 emit

## 체크리스트

- [x] `lib/ai/settings.ts`에 `StageSkipMap` 타입 + `AISettings.stageSkip` + `DEFAULT_AI_SETTINGS` + normalize 추가
- [x] `lib/useJobRunner.ts`, `server/sse.ts`에서 body 전달 + orchestrator 호출에 주입
- [x] `server/stages/orchestrator.ts`에서 `skipVerifier` 조건 확장 + 스킵 시 stage event/log emit + providerTelemetry 처리
- [x] `app/settings/page.tsx` verifier 카드에 체크박스 + disabled 처리
- [x] `lib/__tests__/providerSettings.test.ts`에 `stageSkip` 직렬화 테스트
- [x] `server/stages/__tests__/orchestrator.test.ts`에 verifier-skip 시나리오 테스트
- [x] `vitest run lib/__tests__ server/stages/__tests__ --reporter=basic` 통과

## 영향 범위

- 기본값 `{}` → 미설정 시 동작 불변 (verifier 항상 실행).
- verifier feedback retry 루프(`applyVerifierRetry`, L398-473)는 스킵 시 진입 자체 안 함 — retry solver 호출도 없음. **solver 출력 = 최종 풀이**가 됨.
- DeepSeek 일괄 사용 토글과 무관 (skip은 provider 선택 위에 있는 별도 축).

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run lib/__tests__ server/stages/__tests__ --reporter=basic
```

수동 확인:
1. `/settings`에서 "검증 단계 스킵" 체크 → 새로고침 → 유지
2. `/create`에서 PDF 빌드 → verifier 단계가 "스킵됨" 으로 표시되고 곧바로 figure 시작
3. cache(.v3cache)에 `q{N}_verified.json` 생성 안 됨 확인
4. 체크 해제 후 빌드 → verifier 정상 실행

## 실행 결과

### 1회차 (2026-05-21 03:28 KST) — completed
**상태**: completed
**소요 시간**: 약 12분
**진행 모델**: claude-sonnet-4-6

#### 요약
`StageSkipMap` 타입 + `stageSkip` 필드를 settings 레이어 전체(lib/ai/settings.ts)에 추가하고, 요청 body(useJobRunner → sse.ts) 전달, orchestrator 스킵 조건 확장 + 스킵 시 stage event/log emit, settings UI verifier 카드에 체크박스 + select disabled 처리까지 완료했다. 4개 신규 stageSkip 테스트 및 verifier-skip orchestrator 시나리오 테스트 포함 전체 479개 테스트 통과.

#### 변경 파일
- `ngd-studio/lib/ai/settings.ts` (수정, +26/-2줄) — `StageSkipMap` 타입, `AISettings.stageSkip`, `DEFAULT_AI_SETTINGS.stageSkip`, `normalizeStageSkip` 추가; `readAISettings`/`writeAISettings` 반영
- `ngd-studio/lib/useJobRunner.ts` (수정, +1/-0줄) — `stageSkip: aiSettings.stageSkip` body에 추가
- `ngd-studio/server/sse.ts` (수정, +5/-2줄) — body 타입에 `stageSkip` 추가, `normalizeStageSkip` import 및 적용, orchestrator 호출에 주입
- `ngd-studio/server/stages/orchestrator.ts` (수정, +10/-2줄) — `OrchestratorInput.stageSkip` 필드, `skipVerifier` OR-in, 스킵 시 `stageEvent`/`logEvent` emit
- `ngd-studio/app/settings/page.tsx` (수정, +16/-1줄) — `StageSkipMap` import, verifier 카드 체크박스 + select disabled
- `ngd-studio/lib/__tests__/providerSettings.test.ts` (수정, +52/-5줄) — `normalizeStageSkip` import, 기존 테스트 `stageSkip` 반영, 신규 4개 테스트 추가
- `ngd-studio/server/stages/__tests__/orchestrator.test.ts` (수정, +56/-0줄) — verifier-skip 시나리오 테스트 추가

#### 검증 결과
- [x] TypeScript 타입 체크: `pnpm exec tsc --noEmit` → pass (출력 없음)
- [x] 단위 테스트: `pnpm exec vitest run lib/__tests__ server/stages/__tests__ --reporter=basic` → 479/479 pass

#### 추가 발견사항
`ProviderTelemetryEntry.status`가 `"success" | "failed" | "cancelled"`만 허용하여 `"skipped"` 지원 불가. 스펙 주석대로 skip 시 telemetry push를 생략하는 방식 채택(빈 배열보다 깔끔하고 타입 안전).

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 8 files in scope (PHASE_FILE + 7 scope files)

#### Verification Re-run (orchestrator)
exit 0 — tsc 출력 없음 + vitest 479/479 pass (orchestrator verifier-skip 시나리오 포함)

#### Simplify (orchestrator)
SIMPLIFIED 1 / VERIFY pass — useJobRunner.ts review 모드 로그 파싱 블록의 inner `const state` 섀도잉 제거.

#### Review (orchestrator)
VERDICT pass / ISSUES 0 — 전 레이어 스펙 일치, K 항목(verifier 카드 체크박스) 스펙 className 그대로 적용. 미세 dead-test-code(`trackingVerifierMock` void 억제) 외 issue 없음.

#### Commit
4dd1075 — feat(settings): Phase 2 — verifier 스킵 옵션

#### E2E (orchestrator)
skip — no e2e_triggers
