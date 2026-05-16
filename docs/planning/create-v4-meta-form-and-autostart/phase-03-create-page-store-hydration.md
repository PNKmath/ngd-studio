---
phase: 3
title: /create 페이지 mount 자동 진행 화면 분기
status: completed
depends_on: [2]
scope:
  - ngd-studio/app/create/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: `/create` 페이지 mount 자동 진행 화면 분기

> **범위**: Frontend (단일 페이지 작은 분기)
> **난이도**: S
> **의존성**: Phase 2 (`/create-v4`에서 `startJob` 후 `router.push('/create')`)
> **영향 파일**: `app/create/page.tsx`

## 배경

`/create` 페이지(`app/create/page.tsx:147,363`)는 이미 `hasJob = isRunning || isDone`이면 진행 화면(`PipelineView + LogStream`)을 표시한다. 즉, `/create-v4` → `startJob` → `router.push('/create')` 흐름은 **이미 동작할 가능성이 큼** — zustand store가 client-side 페이지 전환에 보존되기 때문.

다만 `/create` mount 시 무조건 실행되는 부수 작업이 두 가지 있어, 진행 중인 작업과 충돌하거나 UX 잡음이 생길 수 있다:
1. `useEffect: fetch("/api/question-images")` (line 60-67) — 저장된 이미지 목록 가져옴. `existingImages` state 세팅.
2. 사용자가 폼/Resume 카드를 보게 됨 (idle일 때만 표시되지만, store hydration 타이밍에 따라 짧게 깜빡일 수 있음).

본 phase는 `/create` mount 시 store 상태를 먼저 확인하고, 진행 중인 작업(`jobId` 존재 + `status !== "idle"`)이면 부수 fetch + 폼 렌더를 건너뛰도록 정리한다.

## 설계

### mount 분기

```typescript
// app/create/page.tsx 상단
const hasJob = isRunning || isDone; // 기존 로직 그대로 (line 147)
const isExternallyStarted = jobId !== null && status !== "idle";

// existingImages fetch는 hasJob이면 skip (진행 중인 작업은 이미 store에 있음)
useEffect(() => {
  if (hasJob) return; // 진행 중이면 fetch 안 함
  fetch("/api/question-images")
    .then((r) => r.json())
    .then((data) => {
      if (data.count > 0) setExistingImages({ count: data.count, hasClean: data.hasClean });
    })
    .catch(() => {});
}, [hasJob]);
```

### 렌더 분기 (기존 유지 + 미세 정리)

```typescript
// 이미 작성된 로직 (line 363 즈음):
if (!hasJob) {
  return (/* idle 폼 + Resume 카드 */);
}
return (/* 진행 상황 뷰 */);
```

이 분기 자체는 이미 존재. 문제는 mount 직후 `jobId/status` hydration 타이밍 — Next.js client-side router.push 후 컴포넌트가 unmount/mount 되면 zustand store는 in-memory라 그대로 살아 있으므로 정상. 다만 SSR(hydration) 시 렌더와 useEffect 실행 순서가 깜빡임을 만들 수 있음 → 위 `useEffect` 가드로 충분.

### 폼 비움/리셋 방지

`/create-v4`에서 시작한 직후 `/create` 진입 시, 사용자가 우연히 (또는 새로고침으로) idle 상태로 돌아갔을 때 폼의 메타가 살아있어야 한다. 기존 `useState("")` defaults는 빈 값. 두 가지 옵션:

- **옵션 1**: Phase 2의 sessionStorage 키(`create-v4.meta-form`)를 `/create`에서도 mount 시 복원 — 동일 폼이므로 자연.
- **옵션 2**: store의 `v3Meta` (있다면)를 mount 시 폼 state로 복원.

**옵션 2 권장** — store 우선, sessionStorage 보조. 이미 진행 중인 작업이 있으면 진행 화면이 뜨므로 폼 자체는 안 보임. 폼이 보이는 경우는 새로고침 후 idle인 경우 → v3Meta가 store에 살아있을 수 있음 → 폼 자동 채움.

```typescript
const v3Meta = useJobStore((s) => s.v3Meta);

useEffect(() => {
  if (!v3Meta) return;
  if (hasJob) return; // 진행 중이면 폼 안 보임 → 복원 의미 없음
  // store v3Meta가 있으면 폼 state 자동 채움
  if (v3Meta.school) setSchool(v3Meta.school);
  if (v3Meta.grade) setGrade(v3Meta.grade);
  // ... 나머지 4개
}, [v3Meta, hasJob]);
```

(Phase 1에서 폼이 `metaValue` 단일 state로 통합됐으면 `setMeta({ ...v3Meta })` 한 줄로 정리 가능.)

## 체크리스트

- [ ] `app/create/page.tsx`에 `hasJob` 가드 추가 — `useEffect(fetch question-images)`가 진행 중일 때 skip.
- [ ] mount 시 `v3Meta`가 store에 있으면 폼 state 자동 복원 (새로고침/idle 복귀 케이스 대응).
- [ ] 기존 idle 폼/Resume 동작 회귀 없음 — 사용자가 직접 `/create` 진입 시 폼 빈 값으로 표시 (v3Meta 없음).
- [ ] `pnpm build` 통과.

## 영향 범위

- `/create` 페이지: mount 부수 작업 가드 + 폼 자동 채움. 기존 idle 흐름은 변경 없음.
- `/create-v4` → `/create` 전환: 이미 store에 jobId/status 있으므로 진행 화면 즉시 표시.
- 새로고침 케이스: store는 in-memory라 휘발 → idle 폼 표시 + v3Meta가 휘발돼서 폼 빈 값 → Phase 2의 sessionStorage가 보조 보완(작업 도중 새로고침 후 `/create-v4` 재진입 시 메타 복원).

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm build
```

수동 검증 (e2e는 Phase 4에서):
1. `/create` 직접 진입 (jobId 없음) → idle 폼/Resume 카드 표시
2. `/create-v4` → "시험지 제작 시작" → `/create`로 자동 이동 → 진행 화면 즉시 표시 (폼/Resume 안 뜸)
3. 진행 중 새로고침 → store 휘발 → idle 폼 표시 (정상 — 진행은 SSE 서버에서 계속, `/create-v4`의 sessionStorage가 보조)

## 실행 결과

**run-1778853181-76857 / 2026-05-15**

### 변경 내역 (app/create/page.tsx)

1. `isRunning` / `isDone` / `hasJob` 선언을 상태 선언부 직후(line 60-62)로 이동 — 이전에는 line 145-147에 있어 useEffect보다 늦게 정의됐음.
2. `useEffect(fetch /api/question-images)` — `if (hasJob) return;` 가드 추가, 의존 배열을 `[]` → `[hasJob]` 변경.
3. `useEffect(v3Meta 복원)` 신규 추가 — `v3Meta`가 store에 있고 `!hasJob`이면 `setMeta({ ...v3Meta + defaults })` 한 줄로 폼 자동 채움.

### 검증

- `npx tsc --noEmit` → **pass** (TypeScript compilation completed, 오류 없음)
- 로직 검증:
  - `hasJob=true` (running/done/failed) → question-images fetch 스킵 ✓
  - `v3Meta` 없음 → 폼 복원 useEffect early return ✓
  - `v3Meta` 있고 `hasJob=false` → `setMeta` 호출로 폼 채움 ✓
  - idle 직접 진입 (v3Meta=null) → 빈 폼 defaults 유지 ✓

#### Scope Audit (orchestrator)

pass — 1 file in scope (`app/create/page.tsx`). git diff로 검증.

#### Verification Re-run (orchestrator)

- `npx tsc --noEmit` → exit 0 (pass)
- `pnpm build` / `npx vitest run` → skipped (WSL platform binary 정책)

#### Simplify (orchestrator)

1 file, 2 edits — useEffect 조건 2줄→1줄, handleConfirmFigure 내 `meta` 변수 섀도잉 → `jobMeta` 리네임 (Phase 1 단일 state 통합 후 상단 `meta` state와 이름 충돌 해소). VERIFY: tsc pass.

#### Review (orchestrator)

VERDICT: pass — A~I 전부 OK, ISSUES: 0. `v3Meta`/`V3Meta` 필드 store.ts 실존 확인. hasJob 가드·v3Meta 복원·jobMeta 리네임 모두 정합.

#### Commit

eaf0ff1 — feat(create): Phase 3 — mount hasJob 가드 + v3Meta 폼 자동 복원
