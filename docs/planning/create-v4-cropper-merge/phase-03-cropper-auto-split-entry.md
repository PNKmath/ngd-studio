---
phase: 3
title: CropperWorkspace 자동 분할 진입점
status: completed
depends_on: [1, 2]
scope:
  - ngd-studio/components/cropper/CropperWorkspace.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: `CropperWorkspace` 자동 분할 진입점

> **범위**: Frontend (단일 컴포넌트)
> **난이도**: M
> **의존성**: Phase 1 (`/api/auto-crop`), Phase 2 (`normalizedBboxToCropBox`, `CropBox.kind`)
> **영향 파일**: `ngd-studio/components/cropper/CropperWorkspace.tsx`

## 배경

PDF-CROPPER UI (`CropperWorkspace`)는 현재 사용자가 박스를 처음부터 손으로 그리는 것만 지원한다. LLM이 추출한 박스 좌표를 초기값으로 주입하는 진입점이 필요하다.

## 설계

### 헤더에 "자동 분할" 버튼 추가

기존 PDF 메타가 로드된 상태(`pdfMeta != null`)에서 표시. 클릭 시:

1. 기존 박스가 있으면 confirm dialog ("기존 박스 N개를 모두 비우고 자동 분할을 진행하시겠습니까?"). 사용자가 취소하면 중단.
2. 진행 상태 표시 (`autoCropping: true` 상태). 버튼 비활성화 + "자동 분할 중…" 표시.
3. `POST /api/auto-crop` with `{ pdfPath }`.
4. 응답 파싱: `pages[].questions[]` 각각을 `normalizedBboxToCropBox`로 변환.
5. 변환 시 `pageIndex`, `imageWidth`, `imageHeight`, `number`, `kind` 모두 전달.
6. **결과 배열을 페이지 순(`pageIndex` 오름차순) → 페이지 내 응답 순서** 로 정렬해 `setBoxes` (autoNumber가 배열 index 그대로 번호 부여).
7. `answerPage: true`인 페이지의 questions는 건너뜀.
8. 오류 시 alert 또는 inline 에러 메시지(`autoCropError` 상태).

### 페이지별 imageWidth/Height 추적

기존 `pdfMeta.page0Width/Height`는 첫 페이지 기준값. 자동 분할 응답에는 페이지마다 `imageWidth/Height`가 들어오므로 그 값을 페이지별로 사용해 변환한다. 페이지 크기가 모든 페이지에서 동일하다고 가정해도 무방하지만(스캔 PDF의 일반적 케이스), API 응답을 신뢰해 페이지별로 사용.

### prop 추가는 하지 않음

`autoCropEnabled` prop 없이 기본 활성화. 사이드바 진입점(`/create-v4`)과 standalone(`/pdf-cropper`)이 같은 컴포넌트 사용 — 자동 분할 버튼은 둘 다에서 노출됨. (`/pdf-cropper`는 개발/디버깅 용도라 같이 활성화돼 있어도 무해.)

## 체크리스트

- [x] 헤더에 "자동 분할" 버튼 추가, `pdfMeta` 있을 때만 표시
- [x] 기존 박스 있을 때 `confirm()` dialog로 사용자 확인
- [x] `POST /api/auto-crop` fetch + JSON 파싱 + 오류 상태 표시 (`autoCropError`)
- [x] 응답 → `normalizedBboxToCropBox` 변환 → 페이지 순 + 페이지 내 응답 순 정렬 → `setBoxes(autoNumber(result))`
- [x] 로딩 상태 (`autoCropping`) UI: 버튼 비활성화 + "자동 분할 중…" 표시

## 영향 범위

- `CropperWorkspace.tsx` 헤더 영역에 버튼 1개 + 상태 2개(`autoCropping`, `autoCropError`) 추가.
- 기존 박스 드래그/추출/localStorage 흐름 영향 없음.
- `/pdf-cropper`(독립 페이지)도 자동 분할 사용 가능 — 부수적 이점.

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm build
pnpm dev
# 브라우저에서 http://localhost:3020/pdf-cropper
```

수동 동작 검증:
1. PDF 업로드 (`sample/시험지 제작/` 아래)
2. "자동 분할" 버튼 클릭
3. 박스가 자동 주입되고 각 페이지로 이동하면 해당 페이지 박스가 보임
4. 박스 드래그/리사이즈/삭제 정상
5. 기존 박스 있는 상태에서 "자동 분할" 재클릭 시 confirm 표시
6. `/api/auto-crop`이 실패하는 케이스(빈 PDF / API key 없음)에서 에러 메시지 표시

## 실행 결과

### 1회차 (2026-05-14 11:30 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`CropperWorkspace.tsx`에 "자동 분할" 버튼과 관련 로직을 추가했다. `normalizedBboxToCropBox` import, `autoCropping`/`autoCropError` 상태 2개, `handleAutoCrop()` 함수, 헤더 버튼 UI, 에러 배너를 구현했다. `answerPage: true` 페이지 건너뜀, 페이지 순 정렬, localStorage 저장 모두 포함.

#### 변경 파일
- `ngd-studio/components/cropper/CropperWorkspace.tsx` (수정, +75/-1줄)

#### 검증 결과
- [x] `pnpm build`: `next build` → Compiled successfully, TypeScript 오류 없음, 23 페이지 정적 생성 완료

#### 추가 발견사항
- API 응답의 `questions[].number`가 `number | string`(서술형은 "서술형 1" 같은 문자열)일 수 있어 `typeof q.number === "number" ? q.number : 0`로 안전 변환 처리함.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (`ngd-studio/components/cropper/CropperWorkspace.tsx`). git diff fallback.

#### Verification Re-run (orchestrator)
exit 0 — `pnpm build` Compiled successfully, 신규 `/api/auto-crop` 라우트 빌드 포함 확인. `pnpm dev`는 dev 서버라 skip.
