---
phase: 3
title: 재시작 지점 선택 UI
status: completed
depends_on: []
scope:
  - ngd-studio/app/create/page.tsx
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/__tests__/store.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 3: 재시작 지점 선택 UI

> **범위**: Frontend
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `app/create/page.tsx:188, 223-262`, `lib/store.ts:72-130`

## 배경

백엔드 `server/stages/resumeState.ts:106-113`은 이미 6개 stage(`extractor`/`solver`/`verifier`/`figure`/`builder`/`checker`) + `confirm`(=builder) + `auto`(=cache 스캔) 모두 `resumeFrom` 으로 진입 가능.

하지만 프론트는 `app/create/page.tsx:188`에서 `useState("auto")`로 고정 — "이전 작업 재개" 버튼 클릭 시 항상 cache 자동 감지 모드만 사용한다. 사용자가 "builder부터 다시" / "checker만 다시" 같은 선택을 못 한다.

UI에 select만 노출하면 끝나는 작업.

## 설계

### 1. State 변경 (`app/create/page.tsx:188`)

```tsx
const [resumeFrom, setResumeFrom] = useState<string>("auto");
```

기존 destructure-only(`const [resumeFrom] = useState("auto")`) → setter 노출.

### 2. UI 추가

"이전 작업 재개" 카드 (`existingImages` 가 truthy 일 때만 보이는 영역) 안에 select 추가:

```tsx
<label className="flex items-center gap-2 text-sm">
  <span className="text-muted-foreground">어디부터 다시?</span>
  <select
    value={resumeFrom}
    onChange={(e) => setResumeFrom(e.target.value)}
    className="rounded-md border bg-background px-2 py-1 text-sm"
  >
    <option value="auto">자동 (캐시 스캔)</option>
    <option value="extractor">추출부터</option>
    <option value="solver">풀이부터</option>
    <option value="verifier">검증부터</option>
    <option value="figure">그림부터</option>
    <option value="builder">빌드부터</option>
    <option value="checker">검사만</option>
  </select>
</label>
```

`handleResume`은 이미 `resumeFrom` state를 read 중이므로 추가 변경 불필요.

### 3. store buildResumeStages 검증 (`lib/store.ts:72-130`)

`buildResumeStages(resumeFrom)`이 새 값들에 대해 올바른 stage UI 상태를 반환하는지 단위 테스트 추가. 현재 테스트(`lib/__tests__/store.test.ts:31-60`)는 extractor / builder / confirm 만 검증.

추가 케이스:
- `resumeFrom="solver"` → extractor done, solver pending, 이후 pending
- `resumeFrom="verifier"` → extractor/solver done, verifier pending
- `resumeFrom="figure"` → extractor/solver/verifier done, figure pending
- `resumeFrom="checker"` → figure/builder done, checker pending

`buildResumeStages` 구현이 새 stage들도 처리하는지 코드 확인. 빠지면 보완.

### 4. Resume 가능 영역 표시 (선택, 작으면 같이)

`auto` 와 명시 stage 차이를 사용자가 알 수 있도록 select 옆에 짧은 설명 추가 가능:
"auto: 미완료 stage 자동 탐지 / 그 외: 해당 stage부터 강제 재시작 (이전 캐시 무시 아님)".

## 체크리스트

- [x] `app/create/page.tsx`의 `resumeFrom` state에 setter 노출
- [x] "이전 작업 재개" 카드에 stage select UI 추가 (7개 옵션)
- [x] `lib/store.ts:buildResumeStages`가 solver/verifier/figure/checker 케이스 모두 처리 (필요 시 구현 보완)
- [x] `lib/__tests__/store.test.ts`에 4개 신규 케이스 추가
- [x] `vitest run lib/__tests__/store.test.ts --reporter=basic` 통과

## 영향 범围

- 백엔드 무변경. resumeState 의 normalizeResumeName은 이미 모든 케이스 처리.
- 기본값 `auto` 유지 → 기존 동작 불변.
- `handleConfirmFigure`(L304-308)는 `resumeFrom: "confirm"` 하드코딩이라 영향 없음.

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run lib/__tests__/store.test.ts --reporter=basic
```

수동 확인:
1. `/create`에서 PDF 한 번 빌드 (캐시 채우기)
2. 새로고침 → "이전 작업 재개" 카드 노출 + select 표시
3. "checker" 선택 후 "재개" → checker stage만 실행되고 hwpx 갱신
4. "figure" 선택 → figure부터 builder/checker 순차 실행

## 실행 결과

### 1회차 (2026-05-21 03:34 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`app/create/page.tsx`의 `resumeFrom` state에 setter를 노출하고, 이전 작업 재개 영역(existingImages truthy 시)에 7개 옵션 select UI를 추가했다. 기존 form 컨트롤 패턴(label + `px-0 py-0.5 text-sm bg-transparent border-b` select)을 그대로 mimic했다. `buildResumeStages`는 이미 모든 stage 값을 올바르게 처리하므로 수정 불필요. 4개 신규 테스트 케이스 추가 후 전체 15개 통과.

#### 변경 파일
- `ngd-studio/app/create/page.tsx` (수정, +19/-1줄) — setter 노출 + select UI 추가
- `ngd-studio/lib/__tests__/store.test.ts` (수정, +44/-1줄) — solver/verifier/figure/checker 4개 신규 케이스

#### 검증 결과
- [x] tsc --noEmit: `pnpm exec tsc --noEmit` → pass (출력 없음)
- [x] vitest store.test.ts: `pnpm exec vitest run lib/__tests__/store.test.ts --reporter=basic` → 15 tests passed

#### 추가 발견사항
`buildResumeStages`가 `"auto"` 입력 시 `indexOf` 반환 값 -1로 인해 `resumeIdx > 0` 조건이 false → 모든 stage를 pending으로 올바르게 처리. 별도 guard 불필요.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 3 files in scope (PHASE_FILE + app/create/page.tsx + lib/__tests__/store.test.ts). lib/store.ts 는 worker 판단으로 미수정(기존 buildResumeStages 충분).

#### Verification Re-run (orchestrator)
exit 0 — tsc 출력 없음 + vitest store 15/15 pass

#### Simplify (orchestrator)
SIMPLIFIED 1 / VERIFY pass — app/create/page.tsx: 미사용 `canResume` 변수, `AIProviderBadge` 함수 제거 + 빈 줄 정리.

#### Review (orchestrator)
VERDICT pass / ISSUES 0 — K(UI 통일성) 점검: 새 select 가 기존 MetaForm select className 과 100% 동일, 새 색·간격·border-radius 도입 없음.

#### Commit
5f9a02c — feat(create): Phase 3 — 재시작 지점 select UI 노출

#### E2E (orchestrator)
skip — no e2e_triggers
