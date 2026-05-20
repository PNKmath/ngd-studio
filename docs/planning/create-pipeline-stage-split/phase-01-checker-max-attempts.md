---
phase: 1
title: checker maxAttempts 설정화
status: completed
depends_on: []
scope:
  - ngd-studio/lib/ai/settings.ts
  - ngd-studio/lib/__tests__/providerSettings.test.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/app/settings/page.tsx
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 1: checker maxAttempts 설정화

> **범위**: Backend + Frontend
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `lib/ai/settings.ts`, `server/stages/orchestrator.ts:696-699`, `app/settings/page.tsx`

## 배경

`server/stages/orchestrator.ts:696-699`에서 checker auto-fix 시도 횟수가 **하드코딩 `2`**:

```ts
const { result: checkerResult, autofixed } = await runCheckerWithAutoFix(
  { hwpxPath: hwpxPath || undefined },
  2 // max 2 fix attempts
);
```

사용자가 "auto-fix를 0회(검사만)" 또는 "최대 5회까지" 등으로 조정할 수 없다. settings에 노출만 하면 비용 없이 사용자 제어 추가.

## 설계

### 1. 타입/스토리지 (`lib/ai/settings.ts`)

`AISettings`에 필드 추가:

```ts
export interface AISettings {
  defaultProvider: SelectableProviderId;
  stageOverrides: StageOverrideMap;
  figureRegen: boolean;
  /** checker auto-fix 시도 최대 횟수. 0 = 검사만, 기본 2. 범위 0~5. */
  checkerMaxAttempts: number;
}
```

- `DEFAULT_AI_SETTINGS.checkerMaxAttempts = 2`
- `readAISettings` / `writeAISettings`에서 정규화:
  ```ts
  function normalizeCheckerMaxAttempts(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return DEFAULT_AI_SETTINGS.checkerMaxAttempts;
    return Math.max(0, Math.min(5, Math.round(n)));
  }
  ```

### 2. 요청 body 전달 (`lib/useJobRunner.ts:103-110`)

`figureRegen` 옆에 `checkerMaxAttempts: aiSettings.checkerMaxAttempts` 추가.

### 3. SSE 수신 (`server/sse.ts:134-138, 312-321`)

```ts
body: {
  ...
  figureRegen?: boolean;
  checkerMaxAttempts?: number;  // 추가
}
```

orchestrator 호출 시 그대로 전달.

### 4. Orchestrator 입력/사용 (`server/stages/orchestrator.ts:38-44, 696-699`)

```ts
interface OrchestratorInput {
  ...
  figureRegen?: boolean;
  checkerMaxAttempts?: number;  // 추가
}

// L696-699
const maxAttempts = input.checkerMaxAttempts ?? 2;
const { result: checkerResult, autofixed } = await runCheckerWithAutoFix(
  { hwpxPath: hwpxPath || undefined },
  maxAttempts
);
```

값 범위 검증은 settings 정규화 단계에서 끝났다고 가정 (0~5 clamp).

### 5. Settings UI (`app/settings/page.tsx`)

`figureRegen` 섹션(L528-563) 바로 아래에 새 섹션 추가:

```tsx
{/* ── Checker auto-fix ─────────────────────── */}
<section className="space-y-3">
  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
    <Sparkles className="size-4" />
    Checker auto-fix
  </div>
  <div className="rounded-lg border bg-card px-4 py-4 space-y-2">
    <h2 className="text-base font-medium">자동 수정 최대 시도 횟수</h2>
    <p className="text-sm text-muted-foreground">
      checker 검사 후 발견된 결정적 이슈를 자동으로 수정하고 재검사하는 횟수.
      0이면 검사만 수행 (수정 안 함). 기본 2회.
    </p>
    <input
      type="number"
      min={0}
      max={5}
      step={1}
      value={settings.checkerMaxAttempts}
      onChange={(e) => setSettings(writeAISettings({
        ...settings,
        checkerMaxAttempts: Number(e.target.value),
      }))}
      className="w-20 rounded-md border bg-background px-2 py-1.5 text-sm"
    />
  </div>
</section>
```

(아이콘은 기존 import 활용)

### 6. 테스트 (`lib/__tests__/providerSettings.test.ts`)

기존 `writeAISettings` 테스트에 `checkerMaxAttempts` 케이스 추가:
- 기본값 2 적용
- 범위 밖 값 clamp (-1 → 0, 10 → 5)
- legacy 저장본(필드 없음) 읽을 때 기본값

## 체크리스트

- [x] `lib/ai/settings.ts`에 `checkerMaxAttempts: number` 추가 + `DEFAULT_AI_SETTINGS` 갱신 + normalize 함수 + read/write 통과
- [x] `lib/useJobRunner.ts`에서 body에 `checkerMaxAttempts` 포함
- [x] `server/sse.ts` body 타입에 추가, orchestrator로 전달
- [x] `server/stages/orchestrator.ts`의 `OrchestratorInput`에 추가, L696-699에서 사용
- [x] `app/settings/page.tsx`에 입력 UI 추가 + localStorage 왕복 동작
- [x] `vitest run lib/__tests__/providerSettings.test.ts --reporter=basic` 통과 + 추가 케이스 포함

## 영향 범위

- 신규 필드. 기존 호출자가 omit하면 기본값 2 적용되어 **동작 불변**.
- DB / 외부 API 영향 없음. localStorage 스키마 추가만.
- legacy 저장본(이 필드 없음) → normalize 시 기본값으로 채워짐.

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run lib/__tests__/providerSettings.test.ts --reporter=basic
```

수동 확인:
1. `/settings` 진입 → 새 섹션이 figureRegen 아래에 보임
2. 값을 3으로 변경 → 새로고침 → 3 유지
3. `/create`에서 PDF 빌드 → checker가 최대 3회 시도하는지 로그 확인
4. 값을 0으로 변경 → 빌드 → checker가 검사만 수행 (auto-fix 메시지 없음)

## 실행 결과

### 1회차 (2025-05-21 03:10 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-haiku-4-5

#### 요약
checkerMaxAttempts 필드를 AISettings 인터페이스에 추가하고, normalize 함수로 0~5 범위로 clamping되도록 구현했습니다. 모든 계층(settings, useJobRunner, sse, orchestrator, UI)에서 정상적으로 전달되며, 테스트도 모두 통과했습니다.

#### 변경 파일
- `ngd-studio/lib/ai/settings.ts` (수정, +9/-1줄)
- `ngd-studio/lib/__tests__/providerSettings.test.ts` (수정, +41/-2줄)
- `ngd-studio/lib/useJobRunner.ts` (수정, +1/-0줄)
- `ngd-studio/server/sse.ts` (수정, +2/-1줄)
- `ngd-studio/server/stages/orchestrator.ts` (수정, +3/-2줄)
- `ngd-studio/app/settings/page.tsx` (수정, +17/-0줄)

#### 검증 결과
- [x] TypeScript 타입 검증: `pnpm --filter ngd-studio exec tsc --noEmit` → pass
- [x] 테스트: `vitest run lib/__tests__/providerSettings.test.ts --reporter=basic` → pass (14 tests)
  - 기본값 2 적용 ✓
  - 범위 밖 값 clamp (-1 → 0, 10 → 5) ✓
  - legacy 저장본 호환성 ✓
  - 반올림 동작 ✓

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 7 files in scope (PHASE_FILE + 6 scope files)

#### Verification Re-run (orchestrator)
exit 0 — tsc + vitest providerSettings 14/14 pass

#### Simplify (orchestrator)
SIMPLIFIED 2 / VERIFY pass — useJobRunner.ts 이중 getState() 통합, sse.ts 자명한 주석 1건 제거. orchestrator.ts/settings.ts 는 추출 시 타입 복잡도 증가로 skip.

#### Review (orchestrator)
VERDICT pass / ISSUES 0 — 전 레이어 스펙 일치, UI/UX 통일성(K) 확인: section wrapper·label 클래스·card 스타일 모두 figureRegen 형제와 동일.

#### Commit
c77056b — feat(settings): Phase 1 — checker maxAttempts 설정화

#### E2E (orchestrator)
skip — no e2e_triggers
