---
phase: 7
title: 로그 영역 'PDF 열기' 버튼 제거
status: completed
depends_on: [6]
scope:
  - ngd-studio/app/create/page.tsx
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 7: 로그 영역 'PDF 열기' 버튼 제거

> **범위**: Frontend only
> **난이도**: XS (체크리스트 2항목)
> **의존성**: Phase 6 (같은 파일이므로 순차)

## 배경

사용자 보고 (2026-05-23):
> "4. create 페이지 우측 하단 로그가 나오는 영역에 'pdf 열기'버튼은 필요없음"

`page.tsx` 의 "PDF 열기" 텍스트는 2곳:

1. **`page.tsx:139`** — `NoActiveSession` placeholder 컴포넌트 (우측 하단 로그 영역의 비어있을 때 메시지). `<Button onClick={onOpenCropper}>PDF 열기</Button>` — **제거 대상**
2. **`page.tsx:659`** — 메인 헤더 좌측의 PDF 열기 버튼 (cropper 진입) — **유지**

사용자 의도: 로그 영역에는 이미 "이전 작업을 재개하세요" 안내가 placeholder 본문에 있으니 별도 버튼 불필요. 헤더의 PDF 열기 버튼이 동일 동작을 이미 제공.

## 설계

### 1. NoActiveSession placeholder 의 PDF 열기 버튼 제거

`page.tsx:131~141` 부근 (Read 로 정확 위치 확인 후 수정):

```tsx
// 변경 전
<div className="space-y-1">
  <p className="text-xs font-bold ...">No Active Session</p>
  <p className="text-[10px] text-muted-foreground ...">
    PDF를 업로드해 새 작업을 시작하거나<br />우측 상단에서 이전 작업을 재개하세요.
  </p>
</div>
<Button onClick={onOpenCropper} className="mt-2">
  PDF 열기
</Button>

// 변경 후 — Button 블록 삭제
<div className="space-y-1">
  <p className="text-xs font-bold ...">No Active Session</p>
  <p className="text-[10px] text-muted-foreground ...">
    PDF를 업로드해 새 작업을 시작하거나<br />우측 상단에서 이전 작업을 재개하세요.
  </p>
</div>
```

### 2. NoActiveSession 의 onOpenCropper prop 처리

`NoActiveSession` 컴포넌트의 props 에서 `onOpenCropper` 가 더 이상 쓰이지 않으면:
- props 시그니처에서 제거
- 호출부 (`<NoActiveSession onOpenCropper={...} />`) 도 prop 제거
- 단 onOpenCropper 가 다른 곳에서도 호출된다면 그 곳은 그대로 유지

worker 가 Read 로 정확 위치/사용처 확인 후 처리.

### 3. 헤더 PDF 열기 (page.tsx:659) 유지

CropperWorkspace 안내 문구 (`components/cropper/CropperWorkspace.tsx:699`) 도 "왼쪽 상단의 'PDF 열기' 버튼" 을 명시하므로, 헤더 버튼은 절대 건드리지 말 것.

## 체크리스트

- [x] ⓐ `NoActiveSession` placeholder 의 `<Button>PDF 열기</Button>` 블록 + 관련 prop 정리
- [x] ⓑ 검증 명령 통과 + 헤더의 PDF 열기 버튼이 그대로 유지됨을 코드 diff 로 확인

## 영향 범위

- **변경 파일**: 1개 (page.tsx)
- **호환성**: 헤더 진입 경로 유지. 사용자가 PDF 를 새로 열 수 있는 경로는 헤더 버튼 + 우측 상단 이전 작업 재개 두 가지가 그대로 남음.
- **롤백 전략**: git revert 단일 커밋

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
grep -n "PDF 열기" app/create/page.tsx
# 기대: 1곳만 남음 (헤더, 기존 659행 부근). NoActiveSession placeholder 의 1줄은 제거됨.

# 수동 smoke (Phase 7 끝나면 사용자가 직접):
# 1. /create 진입 (작업 없는 상태) → 우측 하단 로그 영역의 "No Active Session" placeholder 에 'PDF 열기' 버튼 미노출
# 2. 헤더의 'PDF 열기' 버튼은 정상 작동 (Cropper 진입)
```

## 실행 결과

### 1회차 (2026-05-23) — completed

**상태**: completed
**진행 모델**: claude-haiku-4-5

#### 요약
`NoActiveSessionPlaceholder` 의 `<Button onClick={onOpenCropper}>PDF 열기</Button>` 블록 제거 + `onOpenCropper` prop 시그니처/호출부 정리. 헤더의 PDF 열기 버튼은 유지.

#### 변경 파일
- `ngd-studio/app/create/page.tsx` (수정)

#### 검증 결과
- [x] `NODE_OPTIONS="" npx tsc --noEmit` → pass
- [x] `grep -n "PDF 열기" app/create/page.tsx` → 1곳만 매칭 (헤더). placeholder 의 1줄은 제거됨

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (app/create/page.tsx)

#### Verification Re-run (orchestrator)
exit 0 — tsc 통과

#### Review (orchestrator)
skip — XS phase, 단순 버튼 제거. grep 으로 헤더 버튼 유지 + placeholder 제거 양쪽 확인.
