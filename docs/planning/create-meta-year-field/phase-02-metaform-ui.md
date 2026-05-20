---
phase: 2
title: MetaForm UI 학년/학년도 2-column + create page 통합
status: completed
depends_on: [1]
scope:
  - ngd-studio/components/upload/MetaForm.tsx
  - ngd-studio/app/create/page.tsx
intervention_likely: true
intervention_reason: "그리드 재배치 시각 확인 + 입력값이 jobMeta 까지 흘러가는지 수동 smoke 필요"
executor: sonnet
load_bearing: ""
e2e_refs: [create-v4-full-pipeline]
e2e_triggers: []
---

# Phase 2: MetaForm UI 학년/학년도 2-column + create page 통합

> **범위**: Frontend
> **난이도**: S
> **의존성**: Phase 1
> **영향 파일**: `MetaForm.tsx`, `app/create/page.tsx`

## 배경

Phase 1 에서 `MetaValue.year` 가 required 가 되어 컴파일 에러가 난다. 이 phase 에서 (a) MetaForm UI 에 학년도 select 를 추가하고 (b) `app/create/page.tsx` 의 DEFAULT_META, validity check, v3Meta 복원, JSX 를 모두 정합 맞춤.

UI 안 A 채택: **학년 옆에 2-column 으로 학년/학년도 배치**. 시각적으로 두 값이 묶이는 것이 자연스럽다.

## 설계

### MetaForm.tsx

기존 `:32-62` 의 `학년 + 과목` 2-column 그리드를:

- 행 1: `학년 | 학년도` (2-col)
- 행 2: `과목 | 학기` (2-col) — 현재 `:63-89` 의 `학기 + 시험` 행을 분리
- 행 3: `시험` 단독 또는 `시험 | (빈 칸)` 2-col

학년도 select 옵션: `currentYear - 5 ~ currentYear` 6개. 기본값은 `DEFAULT_META.year` 가 결정.

```tsx
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="text-xs text-muted-foreground">학년</label>
    <select value={value.grade} ...>
      <option value={1}>1학년</option>
      ...
    </select>
  </div>
  <div>
    <label className="text-xs text-muted-foreground">학년도</label>
    <select value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })} ...>
      {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  </div>
</div>
```

### app/create/page.tsx

#### `:37-44` DEFAULT_META

```ts
const DEFAULT_META: MetaValue = {
  school: "",
  grade: 2,
  year: new Date().getFullYear(),   // ← 추가
  subject: "수학 I",
  semester: "1학기",
  examType: "중간",
  range: "",
};
```

#### `:167-180` v3Meta 복원 useEffect

```ts
setMeta({
  school: v3Meta.school ?? "",
  grade: v3Meta.grade ?? 2,
  year: v3Meta.year ?? new Date().getFullYear(),   // ← 추가
  subject: v3Meta.subject ?? "수학 I",
  semester: v3Meta.semester ?? "1학기",
  examType: v3Meta.examType ?? "중간",
  range: v3Meta.range ?? "",
});
```

#### `:200-205` validity check

```ts
meta.school.trim().length > 0 &&
meta.grade > 0 &&
meta.year > 0 &&                    // ← 추가
meta.subject.trim().length > 0 &&
meta.semester.trim().length > 0 &&
...
```

#### `:228-232` cachedMeta 병합부

```ts
year: (cachedMeta.year as number) || meta.year,    // ← 추가
```

#### `:435-525` Exam Configuration JSX

`MetaForm` 컴포넌트가 아닌 인라인 폼이라면 위 그리드 패턴 직접 적용. `hasJob ? (v3Meta?.year || meta.year) : meta.year` 패턴 유지.

#### `:349` 에러 메시지

```
"학교/학년/학년도/과목/학기/시험/범위 7개 필드를 모두 입력하세요."
```

## 체크리스트

- [x] `MetaForm.tsx` 학년/학년도 2-column 그리드 추가 (안 A)
- [x] 학년도 옵션 6개 (현재 연도 ~ 5년 전) 동적 생성
- [x] `DEFAULT_META.year = new Date().getFullYear()` (`app/create/page.tsx:37-44`)
- [x] v3Meta auto-restore 에 `year` 복원 (`app/create/page.tsx:167-180`)
- [x] `isMetaComplete` validity 에 `meta.year > 0` 추가 (`app/create/page.tsx:200-205`)
- [x] cachedMeta 병합부 `year` 추가 (`app/create/page.tsx:228-232`)
- [x] 인라인 폼 JSX (`:435-525`) 에 학년도 select 추가 + `hasJob ? (v3Meta?.year || ...) : meta.year` 패턴
- [x] `npx tsc --noEmit` 통과 + `pnpm dev` 후 폼에서 학년도 변경 → 빌드 시 jobMeta 에 year 가 전달되는지 console 확인 (수동)

## 영향 범위

- 폼 입력 후 startJob 시 `meta.year` 가 `v3Meta` 로 들어가고 → `useJobRunner` → API → `examData.ts:81` 에서 `filename_base` 에 박힘
- 기존 sessionStorage 에 저장된 `META_LS_KEY="create-v4.meta-form"` 데이터에는 `year` 가 없음 → `loadStoredMeta` 의 `{ ...DEFAULT_META, ...JSON.parse(raw) }` spread 가 fallback 보정 → 안전
- legacy Claude CLI 흐름 (`/settings` create.* auto) 에서도 jobMeta.year 가 그대로 전달되어 prompt 컨텍스트에 활용 가능 (실제 활용은 phase-04)

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio/ngd-studio
npx tsc --noEmit
pnpm dev    # 수동: 폼 입력 → 학년도 select 가 동작 + jobMeta 에 year 전달 확인
```

## 실행 결과

### 1회차 (2026-05-21 오늘) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
MetaForm.tsx에 학년/학년도 2-column 그리드를 추가하고, 행 2를 과목/학기로 재배치, 시험을 단독 행으로 분리했다. app/create/page.tsx의 DEFAULT_META, v3Meta 복원, isMetaComplete validity, cachedMeta 병합, 인라인 폼 JSX, 에러 메시지를 모두 year 필드 포함으로 업데이트했다. Phase 1이 남긴 컴파일 에러가 모두 해소됐다.

#### 변경 파일
- `ngd-studio/components/upload/MetaForm.tsx` (수정, 학년도 select 추가 + 행 재배치)
- `ngd-studio/app/create/page.tsx` (수정, DEFAULT_META/v3Meta 복원/validity/cachedMeta/인라인 JSX/에러 메시지에 year 추가)

#### 검증 결과
- [x] npx tsc --noEmit: `npx tsc --noEmit` → pass (exit 0, 출력 없음)
- [ ] pnpm dev 수동 확인: 수동 smoke — intervention_likely 항목으로 사용자 확인 필요

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 scope files edited (MetaForm.tsx, app/create/page.tsx) + PHASE_FILE self-edits. No out-of-scope writes.

#### Verification Re-run (orchestrator)
exit 0 — npx tsc --noEmit 깔끔. Phase 1 이 남긴 누락 에러 2건 해소 확인.
