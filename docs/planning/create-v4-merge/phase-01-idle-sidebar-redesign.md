---
phase: 1
title: 좌측 사이드바 디자인 통일 + 파이프라인 미리보기 추가
status: completed
depends_on: []
scope:
  - ngd-studio/app/create-v4/page.tsx
intervention_likely: false
intervention_reason: ""
---

# Phase 1: 좌측 사이드바 디자인 통일 + 파이프라인 미리보기 추가

> **범위**: Frontend only
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `ngd-studio/app/create-v4/page.tsx`

## 배경

현재 `/create-v4` 좌측 사이드바는 단순 `<div>` + `h2` 구조라서 `/create` 페이지의 `Card` + `h3` 디자인과 시각적으로 어긋난다. 또한 추출 직후 어떤 백엔드 단계가 실행되는지 사용자에게 미리 보여주는 파이프라인 미리보기가 없다.

이 phase에서는 디자인을 `/create`와 통일하고, 시험정보 카드 아래에 파이프라인 미리보기(모든 stage `pending`)를 추가한다. 라우팅이나 상태 분기는 건드리지 않는다 — 순수 UI 통일만.

## 설계

### 변경 전 (`app/create-v4/page.tsx:208-223`)

```tsx
<div className="w-72 shrink-0 border-r overflow-y-auto p-4 space-y-4">
  <div>
    <h2 className="text-sm font-semibold mb-2">시험 정보</h2>
    <MetaForm value={meta} onChange={handleMetaChange} disabled={submitting} />
  </div>

  {!isMetaComplete && (
    <p className="text-xs text-muted-foreground">
      필수 필드를 모두 채워주세요.
    </p>
  )}
</div>
```

### 변경 후

```tsx
<div className="w-72 shrink-0 border-r overflow-y-auto p-4 space-y-4">
  <Card className="p-4 space-y-3">
    <h3 className="text-sm font-medium">시험 정보</h3>
    <MetaForm value={meta} onChange={handleMetaChange} disabled={submitting} />
    {!isMetaComplete && (
      <p className="text-xs text-muted-foreground">
        필수 필드를 모두 채워주세요.
      </p>
    )}
  </Card>

  <PipelineView mode="create" />
</div>
```

- `Card` 임포트: `@/components/ui/card` (create 페이지와 동일)
- `PipelineView` 임포트: `@/components/pipeline/PipelineView`
- `mode="create"`로 호출하면 6단계(extractor→solver→verifier→figure→builder→checker) 모두 `pending` 상태로 표시됨 (`components/pipeline/PipelineView.tsx:15-22` 참고)

### 주의

- "이전 작업 재개" 카드는 이 phase에서는 추가하지 않는다 (Phase 3에서 처리).
- `CropperWorkspace`/`handleExtract`/메타 폼 로직은 건드리지 않는다.
- 사이드바 너비(`w-72`)는 유지. create의 `w-[320px]`와 약간 다르지만 v4 레이아웃 일관성을 우선.

## 체크리스트

- [x] `Card` 컴포넌트 임포트 추가 (`@/components/ui/card`)
- [x] `PipelineView` 컴포넌트 임포트 추가 (`@/components/pipeline/PipelineView`)
- [x] 시험정보 `<div>` + `<h2>` 구조를 `<Card>` + `<h3 text-sm font-medium>` 구조로 교체
- [x] `!isMetaComplete` 메시지를 시험정보 Card 내부로 이동
- [x] 시험정보 Card 아래에 `<PipelineView mode="create" />` 추가
- [x] `npx tsc --noEmit` 통과
- [ ] `pnpm dev` 띄우고 `/create-v4` 접속 시 좌측에 Card 디자인 + 6단계 pending 파이프라인이 표시되는 것 확인

## 영향 범위

- 사용자 시각 변화: 좌측 사이드바 디자인 일관성 향상 + 파이프라인 미리보기 추가
- 기능 영향 없음 (idle 상태 UI만 변경)
- `/create` 페이지는 영향 없음

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 확인: `pnpm dev` 후 브라우저에서 `/create-v4` 접속, 좌측 사이드바 구조 확인.

## 실행 결과

### 1회차 (2026-05-17 00:00 KST) — completed
**상태**: completed
**소요 시간**: 약 3분
**진행 모델**: claude-sonnet-4-6

#### 요약
`/create-v4` 좌측 사이드바를 `div+h2` 구조에서 `Card+h3` 구조로 교체하고, `!isMetaComplete` 안내 메시지를 Card 내부로 이동했다. Card 아래에 `<PipelineView mode="create" />`를 추가해 6단계 파이프라인 미리보기(모두 pending)가 표시된다. `npx tsc --noEmit` 통과.

#### 변경 파일
- `ngd-studio/app/create-v4/page.tsx` (수정, +4/-6줄 net, import 2개 추가 + 사이드바 구조 교체)

#### 검증 결과
- [x] `npx tsc --noEmit`: 오류 없음 → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (`ngd-studio/app/create-v4/page.tsx` + PHASE_FILE)
noted: 9 unattributed edits (다른 Claude 세션, run_id 미일치)

#### Verification Re-run (orchestrator)
exit 0 — `cd ngd-studio && npx tsc --noEmit` 통과

#### Simplify (orchestrator)
SIMPLIFIED: 0 — 파일이 이미 최적 상태, 중복/dead code 없음

#### Review (orchestrator)
fix_required (false positive — phase 시작 전부터 page.tsx에 다른 작업의 미커밋 변경분이 commingled). 사용자 확인 후 phase-1의 실제 기여(Card+h3+PipelineView)만 선택적 staging으로 atomic commit 처리.

#### Commit
23852b8 — feat(create-v4): Phase 1 — 좌측 사이드바 Card 디자인 통일 + PipelineView 추가
