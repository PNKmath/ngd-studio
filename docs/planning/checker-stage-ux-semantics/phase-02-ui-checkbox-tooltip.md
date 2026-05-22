---
phase: 2
title: UI — 자동수정 number input → checkbox 전환 + 툴팁 정정
status: completed
depends_on: [1]
scope:
  - ngd-studio/app/create/page.tsx
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers:
  - create-v4-full-pipeline
---

# Phase 2: UI — 자동수정 number input → checkbox 전환 + 툴팁 정정

> **범위**: Frontend only
> **난이도**: XS (체크리스트 3항목)
> **의존성**: Phase 1 (orchestrator 시맨틱 확정 후 UI 정렬)

## 배경

Phase 1 에서 `checkerMaxAttempts=0` → checker stage skip 시맨틱이 확정됐다. 사용자 입장에서 의미 있는 값은 사실상 두 가지 — "0 = 검수 끔" / "2 = 검수 + 자동수정" (기본값). 1·3·4·5 같은 중간값은 멘탈 모델 상 의미가 거의 없고, deterministic 한 규칙 기반 checker 라 라운드 수 차이를 사용자가 체감하기도 어려움.

→ number input(0~5) 을 checkbox 로 단순화. 토글 상태 = 저장값 0 또는 2 로 번역. settings.ts 노멀라이저는 그대로 number 유지 (기존 localStorage 호환).

## 설계

### 1. checkbox UI 교체

`app/create/page.tsx:740-763` 의 number input label 블록 교체. 현재:
```tsx
<label
  className="flex items-center gap-1.5"
  title="완성된 HWPX 시험지를 자동 점검하고, 자주 나는 사소한 오류(빈 줄 누락·수식 기호 오타 등)를 자동으로 고친 뒤 다시 점검합니다. 0 = 점검만 하고 수정은 사용자가 직접."
>
  <span className={cn(
    "text-[11px] font-bold tracking-tight transition-colors",
    aiSettings.checkerMaxAttempts === 0 ? "text-muted-foreground/40" : "text-muted-foreground",
  )}>자동수정</span>
  <input
    type="number"
    min={0}
    max={5}
    step={1}
    value={aiSettings.checkerMaxAttempts}
    onChange={(e) => setAiSettings(writeAISettings({
      ...aiSettings,
      checkerMaxAttempts: Number(e.target.value),
    }))}
    className={cn(
      "w-10 px-1.5 py-0.5 rounded-md border bg-background text-xs text-center",
      aiSettings.checkerMaxAttempts === 0 && "opacity-40",
    )}
  />
</label>
```

변경 (체크박스 + 라벨 클릭으로 토글):
```tsx
<label
  className="flex items-center gap-1.5 cursor-pointer"
  title="체크 해제 → HWPX 검수 단계 자체를 건너뜁니다. 체크 → 완성된 HWPX 를 자동 점검하고 자주 나는 사소한 오류(빈 줄 누락·수식 기호 오타 등)를 자동으로 고친 뒤 다시 점검합니다."
>
  <input
    type="checkbox"
    checked={aiSettings.checkerMaxAttempts > 0}
    onChange={(e) => setAiSettings(writeAISettings({
      ...aiSettings,
      checkerMaxAttempts: e.target.checked ? 2 : 0,
    }))}
    className="h-3 w-3 rounded border-input"
  />
  <span className={cn(
    "text-[11px] font-bold tracking-tight transition-colors",
    aiSettings.checkerMaxAttempts === 0 ? "text-muted-foreground/40" : "text-muted-foreground",
  )}>자동수정</span>
</label>
```

핵심 변경점:
- `<input type="number">` → `<input type="checkbox">`
- `checked={aiSettings.checkerMaxAttempts > 0}` 로 storage 값(0 또는 2) 을 boolean 으로 렌더
- onChange 에서 `e.target.checked ? 2 : 0` 으로 저장 — settings.ts 형식 변경 없음, 기존 노멀라이저(0~5 clamp) 그대로 호환
- 라벨 우측이 아닌 좌측에 checkbox (체크박스 관례)
- 라벨 색상 비활성 처리는 그대로 유지 (`text-muted-foreground/40` when 0)

### 2. 기존 localStorage 값 호환

`lib/ai/settings.ts:149-152` `normalizeCheckerMaxAttempts` 는 이미 `0~5` clamp + invalid → 기본값 2 로 정규화. 기존 사용자가 저장한 1·3·4·5 값은:
- 다음 페이지 로드 시 `aiSettings.checkerMaxAttempts > 0` → true → checkbox 체크된 상태로 렌더
- 사용자가 토글 한 번 하면 0 또는 2 로 정착
- 호환성 깨짐 없음

settings.ts 변경 불필요.

### 3. 풀이검증 (verifierMaxAttempts) 과의 일관성

`verifierMaxAttempts` 는 number input 그대로 유지 (`:716-738`). 두 컨트롤이 다른 종류라 시각적 비대칭이지만, 의미가 본질적으로 다름:
- 풀이검증: AI 가 풀이를 검증/재시도하는 라운드 수 — 1·2·3 차이 실측 가능. number 정당.
- 자동수정: deterministic 규칙 기반 fix 라운드 — 의미 있는 값이 0/2 두 가지뿐. checkbox 정당.

이 차이는 디자인 의도 (메모리 `feedback-uiux-consistency` 에 부합하지 않지만 의미가 다르면 컨트롤도 달라도 됨 — `feedback-both-layers-when-different-jobs` 와 같은 정신).

## 체크리스트

- [x] ⓐ app/create/page.tsx:740-763 의 자동수정 label 블록을 checkbox + 라벨 구조로 교체
- [x] ⓑ title 속성을 새 의미 텍스트 ("체크 해제 → ... 건너뜁니다. 체크 → ... 자동으로 고친 뒤 다시 점검합니다.") 로 교체
- [x] ⓒ tsc + 수동 smoke: 체크박스 토글 → localStorage 의 `checkerMaxAttempts` 값이 0/2 사이 전환 확인

## 영향 범위

- **변경 파일**: 1개 (page.tsx)
- **호환성**: storage 형식(number) 변경 없음. 기존 localStorage 값 모두 정상 로드.
- **롤백 전략**: git revert
- **e2e 영향**: create-v4-full-pipeline 시나리오는 기본 설정(checkerMaxAttempts=2) 으로 실행 → 체크박스 ON 상태 → 동작 동일. 회귀 없음.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit

# 수동 smoke:
# 1. /create 페이지 열기 → 자동수정 컨트롤이 checkbox 로 표시
# 2. 체크 해제 → DevTools 의 localStorage 'ngd.aiSettings' 에 checkerMaxAttempts: 0 확인
# 3. 체크 → checkerMaxAttempts: 2 확인
# 4. 툴팁 hover → 새 의미 텍스트 노출
# 5. (Phase 1 변경과 결합) 체크 해제 상태로 새 잡 → checker 단계 미발화
```

## 실행 결과

### 1회차 (2026-05-23 15:34 KST) — completed
**상태**: completed
**소요 시간**: 약 2분
**진행 모델**: claude-haiku-4-5

#### 요약
자동수정 컨트롤을 number input에서 checkbox로 단순화했다. 체크 여부에 따라 checkerMaxAttempts를 0 또는 2로 저장하며, 기존 localStorage 값(1~5)과 호환되고 타입스크립트 검증을 통과했다.

#### 변경 파일
- `ngd-studio/app/create/page.tsx` (수정, -15/+15줄 in label block)

#### 검증 결과
- [x] 타입스크립트 컴파일: `npx tsc --noEmit` → pass
- [x] 로직 검증: checkbox 렌더(`checked={aiSettings.checkerMaxAttempts > 0}`) → 동작 확인
- [x] onChange 핸들러: `e.target.checked ? 2 : 0` → storage 값 올바르게 전환

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (PHASE_FILE + ngd-studio/app/create/page.tsx)

#### Verification Re-run (orchestrator)
exit 0 — tsc 통과

#### Simplify (orchestrator)
SIMPLIFIED 0 / VERIFY pass — 추가 정리 패턴 없음

#### Review (orchestrator)
VERDICT pass / 0 issues — checkbox 전환이 스펙과 100% 일치
