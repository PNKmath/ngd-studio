---
phase: 6
title: UI — '자동수정' → '자동검수' 라벨 + 풀이검증 좌측 재배치 + 자동분할 스타일 통일
status: completed
depends_on: []
scope:
  - ngd-studio/app/create/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "B (풀이검증 좌측 재배치) + C (스타일 통일) 가 사용자 멘탈 모델 통일의 핵심"
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers:
  - create-v4-full-pipeline
---

# Phase 6: UI — '자동수정' → '자동검수' 라벨 + 풀이검증 좌측 재배치 + 자동분할 스타일 통일

> **범위**: Frontend only
> **난이도**: S (체크리스트 5항목)
> **의존성**: 없음 (Phase 2 의 checkbox 도입 직후 후속 정리)

## 배경

Phase 2 에서 자동수정 컨트롤을 number input → checkbox 로 전환했으나, 사용자 보고 (2026-05-23):

> "1. '자동 수정'을 '자동 검수'로 바꾸고, 풀이검증 왼쪽에, 자동 분할/이미지 정리 체크박스와 같은 스타일로 배치"

세 가지 변경:

1. **라벨 변경**: '자동수정' → '자동검수' — 사용자가 인식하는 기능은 "검수(=점검) 단계 활성화" 이지, "자동 수정(=fix) 만" 이 아님. checker 라는 stage 가 다양한 issue 를 점검하고 자동 수정도 함께 수행하므로 "자동검수" 가 정확.
2. **위치 변경**: 풀이검증 **왼쪽** 으로. 현재 풀이검증 → 자동수정 순서를 자동검수 → 풀이검증 으로 swap. 사용자가 워크플로 순서대로 (HWPX 검수 → 풀이 검증) 인식하는 것과 일치.
3. **스타일 통일**: '자동 분할' / '이미지 정리' 체크박스와 동일 className/spacing. 현재 자동수정 checkbox 는 `className="h-3 w-3 rounded border-input"` 인데, '이미지 정리' 는 `className="accent-primary w-3.5 h-3.5"`. 통일 필요.

## 설계

### 1. 라벨 변경 — '자동수정' → '자동검수'

`page.tsx:756` 의 span 텍스트:

```tsx
// 변경 전
}>자동수정</span>

// 변경 후
}>자동검수</span>
```

### 2. 위치 swap — 자동검수 ↔ 풀이검증

현재 `<div className="flex items-center gap-3">` 안에 풀이검증 label (line 720~) + 자동수정 label (line 740~) 순서.

변경 후: 자동검수 label 이 풀이검증 **왼쪽** 으로 → DOM 순서를 swap.

```tsx
<div className="flex items-center gap-3">
  {/* 자동검수 (먼저) */}
  <label className="..." title="...">
    <input type="checkbox" ... />
    <span>자동검수</span>
  </label>

  {/* 풀이검증 (뒤로) */}
  <label className="..." title="...">
    <span>풀이검증</span>
    <input type="number" ... />
  </label>
</div>
```

### 3. 스타일 통일 — '이미지 정리' 패턴 모방

대상 패턴 (`page.tsx:703~715` 부근, "이미지 정리"):
```tsx
<label className="flex items-center gap-1.5 cursor-pointer ..." title="...">
  <input
    type="checkbox"
    checked={aiSettings.imageCleaningEnabled}
    onChange={...}
    className="accent-primary w-3.5 h-3.5"
  />
  <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-bold tracking-tight">
    이미지 정리 <span className="font-normal opacity-70">(손글씨 제거, Gemini API 사용)</span>
  </span>
</label>
```

자동검수에 적용할 변경 (page.tsx:740~758):
- checkbox className: `"h-3 w-3 rounded border-input"` → `"accent-primary w-3.5 h-3.5"`
- span 의 disabled 시 opacity 효과는 유지 (cn helper 로 토글) — '이미지 정리' 에는 없는 패턴이지만 자동검수 OFF 시 시각적 dim 효과는 사용자가 익숙한 동작이므로 보존
- label className 도 `cursor-pointer` 유지

라벨 부연(자동 분할 의 `(Gemini API 사용)` 처럼 작은 부연) 은 자동검수에는 없음 (단순 ON/OFF). 부연 없이 유지.

### 4. title 툴팁 텍스트 검토

Phase 2 에서 다음 텍스트로 설정:
> "체크 해제 → HWPX 검수 단계 자체를 건너뜁니다. 체크 → 완성된 HWPX 를 자동 점검하고 자주 나는 사소한 오류(빈 줄 누락·수식 기호 오타 등)를 자동으로 고친 뒤 다시 점검합니다."

라벨이 '자동검수' 로 바뀌므로 텍스트 일관성 점검. 그대로 두어도 의미 부합 — 본 phase 에서 동일 유지 (단순 라벨 변경이 텍스트 의미를 깨지 않음).

### 5. localStorage / state 영향

상태 키(`aiSettings.checkerMaxAttempts`) 는 그대로. UI 라벨/위치만 변경.

## 체크리스트

- [x] ⓐ '자동수정' 텍스트를 '자동검수' 로 변경
- [x] ⓑ DOM 순서를 swap — 자동검수 label 이 풀이검증 label 왼쪽
- [x] ⓒ 자동검수 checkbox className 을 `"accent-primary w-3.5 h-3.5"` 로 변경 (이미지 정리 패턴)
- [x] ⓓ 자동검수 label className 을 이미지 정리/자동 분할 과 동일한 spacing/gap 으로 정렬
- [x] ⓔ 검증 명령 통과 + 시각 비교 (스크린샷은 worker 가 dev server 못 띄우므로 코드 diff 기준)

## 영향 범위

- **변경 파일**: 1개 (page.tsx)
- **호환성**: 상태 키·localStorage 형식 변경 없음. Phase 2 의 onChange/onSubmit 흐름 그대로 유지.
- **롤백 전략**: git revert 단일 커밋
- **e2e 영향**: `create-v4-full-pipeline` — UI 라벨만 변경. 사용자 결정으로 e2e 는 manual smoke 대체.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit

# 수동 smoke (Phase 6 끝나면 사용자가 직접):
# 1. /create 진입 → 우측 상단 컨트롤에 '자동검수' 라벨 노출
# 2. 컨트롤 순서: 자동검수 → 풀이검증 (왼쪽에서 오른쪽)
# 3. 자동검수 체크박스 스타일이 '이미지 정리' 와 동일 크기·색
# 4. 체크 ON/OFF → localStorage checkerMaxAttempts 0/2 토글 정상
```

## 실행 결과

### 1회차 (2026-05-23 오늘) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`ngd-studio/app/create/page.tsx` 의 `/create` 페이지 컨트롤 섹션에서 세 가지 변경을 단일 Edit으로 적용했다. (1) '자동수정' 텍스트를 '자동검수'로 변경, (2) DOM 순서를 swap하여 자동검수 label이 풀이검증 label 왼쪽에 위치, (3) checkbox className을 `"h-3 w-3 rounded border-input"` → `"accent-primary w-3.5 h-3.5"` 로 변경해 이미지 정리/자동 분할 패턴과 통일. `npx tsc --noEmit` 통과.

#### 변경 파일
- `ngd-studio/app/create/page.tsx` (수정, 3가지 변경: 라벨 텍스트·DOM 순서·checkbox className)

#### 검증 결과
- [x] TypeScript 타입 체크: `NODE_OPTIONS="" npx tsc --noEmit` → pass (출력 없음)
- [x] 코드 diff 확인: '자동수정' 텍스트 없음, '자동검수' 732번째 줄, 풀이검증 741번째 줄 (자동검수가 앞), className `accent-primary w-3.5 h-3.5` 정상 적용

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (app/create/page.tsx)

#### Verification Re-run (orchestrator)
exit 0 — npx tsc --noEmit (NODE_OPTIONS="" 필요, cmux preload 환경 이슈)

#### Simplify (orchestrator)
SIMPLIFIED: 0 — 변경 없음. Phase 6 적용 코드가 이미 깔끔하며 추상화 이득 없음.

#### Review (orchestrator)
VERDICT: pass — 라벨·DOM 순서·checkbox className 세 가지 변경이 스펙과 100% 일치, tsc 통과.

#### Commit
0c722dc — feat(create): Phase 6 — 자동검수 라벨 변경 + 풀이검증 왼쪽 재배치 + 체크박스 스타일 통일

#### E2E (orchestrator)
manual_pending — 사용자 결정(checklist.md)으로 수동 smoke 대체. 재발화 시 `/phase-e2e checker-stage-ux-semantics --phase 6`.
