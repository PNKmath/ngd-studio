---
phase: 4
title: /pdf-cropper 독립 테스트 페이지
status: completed
depends_on: [1, 2, 3]
scope:
  - ngd-studio/app/pdf-cropper/page.tsx
  - ngd-studio/components/cropper/CropperWorkspace.tsx
  - ngd-studio/app/page.tsx
  - ngd-studio/package.json
  - ngd-studio/pnpm-lock.yaml
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: `/pdf-cropper` 독립 테스트 페이지

> **범위**: Frontend (라우트 + 워크스페이스 컴포넌트)
> **난이도**: M
> **의존성**: Phase 1 (`/api/pdf-meta`), Phase 2 (`lib/cropper/*`), Phase 3 (`PdfPageCanvas`)
> **영향 파일**: `app/pdf-cropper/page.tsx` (신규), `components/cropper/CropperWorkspace.tsx` (신규), `app/page.tsx` (임시 링크)

## 배경

Phase 1~3에서 만든 조각을 통합한 **Step 1 결과물**. 사용자가 PDF를 업로드해 끝까지 박스 그리고 추출 다운로드까지 검증하는 독립 페이지. 시험지 제작 페이지와는 분리되어 있어 안전하게 테스트 가능.

여기서 동작이 확인되면 Phase 5의 통합으로 넘어간다.

## 설계

### `app/pdf-cropper/page.tsx`

얇은 라우트 — `<CropperWorkspace />`만 마운트.

### `components/cropper/CropperWorkspace.tsx`

전체 상태/오케스트레이션. 다음 책임:

**1. PDF 업로드**
- `FileDropzone` 또는 단순 `<input type="file">`로 PDF 받기
- `FormData`로 `/api/upload` POST (`mode=create`) → 서버 경로 받음
- 기존 `QuestionSlotGrid.tsx:80-86`의 업로드 코드 참조

**2. 페이지 메타 조회**
- `/api/pdf-meta` POST → `{ pages, page0Width, page0Height }`

**3. 페이지 PNG fetch (lazy)**
- 현재 페이지가 미로드 상태면 `/api/pdf-preview` POST (`page=N`, `dpi=200`)
- blob → `URL.createObjectURL` → 페이지별 캐싱 (Map<pageIndex, blobUrl>)
- 페이지 전환 시 즉시 다음 페이지 prefetch (선택)

**4. 박스 상태**
- 전체 박스 `CropBox[]` — 페이지 무관 단일 배열
- 현재 페이지의 박스만 필터해서 `PdfPageCanvas`에 전달
- 박스 변경 시 `autoNumber(전체박스)`로 자동 번호 갱신
- 사이드패널: 박스 리스트 (페이지/번호/좌표 요약), 번호 수동 재지정 input

**5. 페이지 네비게이션**
- "이전 / 다음" 버튼 + 페이지 N/Total 표시
- 키보드 ←/→ 단축키 (선택)

**6. localStorage 저장/복원**
- 키: `pdf-cropper:${pdfPath}` (pdfPath를 hash해서 안전한 키로)
- 값: `{ boxes: CropBox[], updatedAt: ISO }`
- mount 시 같은 pdfPath면 자동 복원, "초기화" 버튼 제공
- 박스 변경 시 debounce(500ms) 저장

**7. "추출 실행" — 클라이언트 crop + ZIP 다운로드**
- 각 박스에 대해:
  - 해당 페이지 PNG를 `<img>` 또는 `ImageBitmap`으로 로드
  - 오프스크린 `<canvas>` 생성, 박스 영역만 drawImage
  - `canvas.toBlob('image/png')` → Blob
- 모든 Blob을 ZIP으로 묶기 — **추가 의존성을 피하려면**:
  - 옵션 A: 개별 PNG 다운로드 (브라우저가 차단할 수 있음 → 비추)
  - 옵션 B: `jszip` 추가 (~100KB, 표준 솔루션 → **추천**)
  - 옵션 C: 서버 라우트 신규 추가해 ZIP 묶음 — 본 phase 범위 초과
- **결정**: `jszip` 추가. 파일명은 `q01.png`, `q02.png` 형식 (zero-padded, 기존 명명 규칙과 일치)
- 다운로드 트리거: `URL.createObjectURL(zipBlob)` + 임시 `<a download>` 클릭

**8. 임시 네비 링크**
- `app/page.tsx`의 빠른 시작 카드 영역에 `/pdf-cropper` 카드 한 장 추가 (테스트 접근용)
- Phase 5 완료 시 이 카드는 제거 또는 유지 결정 — 본 phase에서는 추가만

### UI 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│ Header: [PDF 업로드 | 페이지 1/N ← →] [추출 실행 (N문제)] │
├──────────────────────────────────────┬──────────────────┤
│                                      │ 박스 리스트      │
│  PdfPageCanvas (현재 페이지)         │ ──────────────── │
│                                      │ #1 p.1 (124,200)│
│                                      │ #2 p.1 (124,400)│
│                                      │ #3 p.2 (124,80) │
│                                      │ ...             │
│                                      │ [전체 삭제]     │
│                                      │ [localStorage   │
│                                      │   복원/초기화]  │
└──────────────────────────────────────┴──────────────────┘
```

## 체크리스트

- [x] `app/pdf-cropper/page.tsx` 작성 (얇은 라우트 + 클라이언트 컴포넌트 마운트)
- [x] `components/cropper/CropperWorkspace.tsx` 작성 — 업로드/메타/페이지 페치/박스 상태/네비/저장/추출
- [x] `jszip` 의존성 추가 (`pnpm add jszip`, `pnpm add -D @types/jszip` 필요 시)
- [x] 페이지 네비게이션 동작 (이전/다음, 페이지 표시)
- [x] localStorage 자동 저장/복원 동작 (debounce 500ms, 키는 pdfPath 기반)
- [x] "추출 실행" → ZIP 다운로드 (파일명 `q01.png`~`qNN.png` zero-padded)
- [x] `app/page.tsx` 빠른 시작 영역에 `/pdf-cropper` 카드 추가
- [x] `pnpm --filter ngd-studio build` 통과

## 영향 범위

- 신규 라우트 `/pdf-cropper` — 기존 페이지에 영향 없음
- `app/page.tsx`에 카드 1개 추가 (다른 카드는 건드리지 않음)
- 의존성 +1 (`jszip`)
- 시험지 제작 흐름은 그대로 — Phase 5에서 통합 결정

## 검증

수동 동작 검증 (사용자 직접 확인):

```bash
cd /mnt/c/NGD/ngd-studio
pnpm dev
# 브라우저에서 http://localhost:3020/pdf-cropper
```

1. 다중페이지 PDF 업로드 (≥3페이지) — 예: `inputs/시험지 제작/` 아래 기존 PDF
2. 페이지 1에서 박스 3~5개 그리기 — 리사이즈/이동/삭제 모두 시도
3. 다음 페이지로 이동 → 박스 추가 → 자동 번호가 페이지 순으로 매겨지는지 확인
4. "추출 실행" → ZIP 다운로드 → 압축 풀어 각 PNG가 실제 박스 영역과 일치하는지 확인
5. 페이지 새로고침 → localStorage 복원 동작 확인
6. "초기화" 버튼 → 박스 전부 사라지는지 확인

이 단계가 통과해야 Phase 5로 진행.

#### Scope Audit (orchestrator)
pass — 5 files in scope (app/pdf-cropper/page.tsx, CropperWorkspace.tsx 신규 + app/page.tsx, package.json, pnpm-lock.yaml 수정). 비고: package.json/pnpm-lock.yaml은 jszip 의존성 추가용으로 초기 frontmatter scope에 누락되어 있던 것을 orchestrator가 사후 추가(스펙 본문 line 74-76, checklist line 105에서 명시적으로 요구한 변경이라 spec authoring 누락으로 판단).

#### Verification Re-run (orchestrator)
exit 0 — `cd ngd-studio && pnpm build` 성공, `/pdf-cropper` 라우트 정적 페이지 생성. 인터랙티브 수동 검증은 Phase 5 진행 전 사용자가 직접 확인.

## 실행 결과

### 1회차 (2026-05-14 오늘 KST) — completed
**상태**: completed
**소요 시간**: 약 12분
**진행 모델**: claude-sonnet-4-6

#### 요약
`jszip` 의존성 추가, `app/pdf-cropper/page.tsx` 신규 라우트 생성, `components/cropper/CropperWorkspace.tsx` 전체 워크스페이스 컴포넌트 작성(업로드/메타/페이지 페치/박스 상태/네비/localStorage 저장·복원/ZIP 추출), `app/page.tsx`에 PDF 크롭 테스트 카드 추가. `pnpm build` 통과.

#### 변경 파일
- `ngd-studio/app/pdf-cropper/page.tsx` (신규, +5줄)
- `ngd-studio/components/cropper/CropperWorkspace.tsx` (신규, +290줄)
- `ngd-studio/app/page.tsx` (수정, +10줄)
- `ngd-studio/package.json` (수정, jszip +@types/jszip 의존성 추가)

#### 검증 결과
- [x] 빌드 통과: `pnpm build` → 22개 라우트 생성, `/pdf-cropper` ○ 정적 포함, 오류 없음
- [ ] 수동 동작 검증: 사용자 직접 `pnpm dev` 후 브라우저에서 확인 필요

#### 추가 발견사항
- `/api/upload`는 `mode=create` 시 `inputs/시험지 제작/` 에 저장하므로 크롭 전용 업로드가 기존 워크플로우와 공유됨 — Phase 5에서 별도 처리 고려 가능
- `/api/pdf-preview`의 dpi=200 캐시는 `outputs/.pdf-preview-cache/`에 저장되어 재사용됨

#### 질문 / 결정 사항
없음

#### Simplify (orchestrator)
1 file, 3 edits — CropperWorkspace.tsx에서 미사용 useRef import 제거, loadImage 모듈 레벨로 이동, 불필요한 "Debounce helper" 주석 제거. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass · ISSUES: 0 · 스펙 8개 책임 항목 전부 구현, 심볼 실존 확인, 빌드 통과, 검증 기록 정합성 OK.

#### Commit
`96910dd` — feat(cropper): Phase 4 — /pdf-cropper 독립 테스트 페이지 + CropperWorkspace 신규
