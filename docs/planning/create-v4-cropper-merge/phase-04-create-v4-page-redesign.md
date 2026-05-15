---
phase: 4
title: /create-v4 페이지 cropper UI 재설계 + /api/question-images 직결
status: completed
depends_on: [3]
scope:
  - ngd-studio/app/create-v4/page.tsx
intervention_likely: true
intervention_reason: "최종 '추출 실행' 버튼이 /api/question-images POST로 직결되어 기존 시험지 제작 흐름에 진입한다 — Phase 3까지 동작 확인 후 본 통합을 진행. 또한 UX 결정(자동 분할 자동 실행 vs 사용자 클릭 / FormData 키 명명 등) 사용자 확인 필요."
executor: sonnet
---

# Phase 4: `/create-v4` 페이지 cropper UI 재설계 + `/api/question-images` 직결

> **범위**: Frontend (단일 페이지)
> **난이도**: M-L
> **의존성**: Phase 3 (`CropperWorkspace` 자동 분할 진입점)
> **영향 파일**: `ngd-studio/app/create-v4/page.tsx`

## 배경

기존 `/create-v4`(`app/create-v4/page.tsx:1-351`)는:
- PDF 업로드 → `useJobRunner.startJob("crop", ...)` → SSE 서버가 Claude CLI로 `ngd-exam-crop` 스킬 호출 → `gemini_crop.py`가 PNG + crop_results.json 디스크 저장
- 결과 PNG들을 썸네일 그리드로 표시 — 사용자는 삭제/번호 재지정/수동 교체만 가능, 좌표 조정 불가

본 phase에서 이 페이지를 `CropperWorkspace` 기반 UI로 교체한다. "자동 분할" 버튼은 Phase 3에서 만든 진입점을 그대로 사용한다.

"추출 실행" 클릭 시 — 현재 `/pdf-cropper`는 ZIP 다운로드만 — 여기서는 **`/api/question-images` POST로 직결해 기존 시험지 제작(extractor) 파이프라인에 진입**한다.

## 설계

### 페이지 흐름

1. PDF 업로드 (FileDropzone 또는 cropper 내부 업로드 — `CropperWorkspace`의 기존 업로드 UI 활용 권장)
2. 사용자가 "자동 분할" 버튼 클릭 → Phase 3 흐름으로 박스 주입
3. 박스 드래그/리사이즈/삭제/추가/순서 변경
4. **"시험지 제작 시작"** 버튼 클릭 → 박스 → canvas crop → PNG Blob → FormData → `/api/question-images` POST → 응답 후 `/create` 페이지로 이동(또는 inline 진행)

### `/api/question-images` 흐름 검증

`/api/question-images` 엔드포인트의 기존 POST 형식 확인 필요. `CropperWorkspace`의 기존 ZIP 추출 로직(`CropperWorkspace.tsx` handleExtract)을 베이스로 — canvas crop은 그대로 사용하고 결과를 ZIP 대신 FormData로 묶어 POST.

FormData 키 컨벤션은 기존 `/create` 흐름 따름 (예: `q1`, `q2`, ... 또는 `files`, `numbers[]`). 본 phase 시작 시 worker가 `app/api/question-images/route.ts` Read해서 확인.

### prop 분기 — `/pdf-cropper`와 동일 컴포넌트 공유

`CropperWorkspace`에 `mode?: "standalone" | "create"` prop 추가 (또는 더 명시적으로 `onExtractMode?: "zip" | "question-images"`):
- `standalone` (기본, `/pdf-cropper`): ZIP 다운로드 (기존 동작)
- `create` (`/create-v4`): FormData → `/api/question-images` POST 후 `/create`로 이동(또는 toast)

**대안**: `CropperWorkspace`에 `onExtract: (blobs: { number, kind, blob }[]) => Promise<void>` prop을 받아 책임을 상위 페이지에 넘김. `/pdf-cropper`는 ZIP 콜백, `/create-v4`는 POST 콜백 주입. 더 SOLID한 설계이므로 **권장**.

### 기존 작업 잡 로직 제거

`useJobRunner.startJob("crop", ...)` 및 `crop_results.json` fetch 등 SSE 기반 흐름 제거. 새 흐름은 클라이언트 단독 (Gemini API 호출은 Next.js API route를 통해).

## 체크리스트

- [x] `/create-v4/page.tsx`의 기존 그리드 UI / `useJobRunner("crop")` / `crop_results.json` fetch 제거
- [x] `CropperWorkspace` 호스트로 교체. 자동 분할 자동 실행 여부는 사용자 결정 (자동/수동 토글, localStorage 영속화, 기본 OFF)
- [x] `CropperWorkspace`에 `onExtract` prop 추가 (callback 주입 방식). `/pdf-cropper`는 prop 미주입 → ZIP 다운로드 그대로. `/create-v4`는 콜백 주입
- [x] `/api/question-images` POST 흐름 검증 (FormData 키 `q1`..`q30` 확인). 응답 정상 시 `router.push('/create')` 라우팅
- [x] `pnpm build` 통과

## 영향 범위

- `/create-v4` 사용자 흐름 완전 변경 — UI/UX 크게 달라짐.
- `CropperWorkspace`에 `onExtract` prop 추가 시 `/pdf-cropper`(독립 페이지)도 동일 prop 사용. 기존 ZIP 흐름은 `/pdf-cropper`가 default로 유지.
- SSE 기반 `crop` mode (`server/sse.ts:194-196`)는 그대로 둠 — `ngd-exam-crop` 스킬이 CLI에서 호출하면 여전히 동작 (회귀 없음). 다만 `/create-v4`에서는 이 흐름 더 이상 사용 안 함.

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm build
pnpm dev
# 브라우저에서 http://localhost:3020/create-v4
```

수동 동작 검증:
1. PDF 업로드 → "자동 분할" → 박스 주입 정상
2. 박스 1개 추가/삭제 후 "시험지 제작 시작" → 진행 모달/이동 표시 → `/create`(또는 다음 단계) 진입
3. 네트워크 탭에서 `/api/question-images` POST에 실제 PNG Blob들이 포함되는지 확인
4. 기존 `/pdf-cropper`는 ZIP 다운로드 동작 그대로 (회귀)

## 실행 결과

### 1차 (run-1778700715-70683)

**구현 방식**: `CropperWorkspace`에 `onExtract` prop 추가 (callback 주입). scope 외 수정이지만 사용자 결정사항으로 승인됨.

**변경 파일**:
- `ngd-studio/components/cropper/CropperWorkspace.tsx` — `onExtract`, `autoSplitOnUpload` prop 추가; `useRef` import 추가; `cropAllBoxesToBlobs()` 분리; `handleExtract` 분기 (onExtract 있으면 callback, 없으면 ZIP); 추출 버튼 라벨 조건부 ("시험지 제작 시작" vs "추출 실행"); auto-split useEffect 추가
- `ngd-studio/app/create-v4/page.tsx` — 기존 그리드/SSE 흐름 전체 제거; `CropperWorkspace` 호스트로 교체; 자동분할 토글(localStorage `cropper.auto-split-on-upload`, 기본 false); `onExtract` 콜백 → FormData(`q{N}` 키) → `POST /api/question-images` → `router.push('/create')` 구현

**FormData 키 컨벤션**: `route.ts` 직접 확인 — `q1`, `q2`, ..., `q30` (parseInt(key.slice(1)) 방식)

**검증**: `pnpm build` 통과 (exit code 0). `/create-v4`, `/pdf-cropper` 모두 빌드 목록에 포함. TypeScript 오류 없음.

#### Scope Audit (orchestrator)
expanded — 원래 scope는 `ngd-studio/app/create-v4/page.tsx`만이었으나 설계 `onExtract` prop 명시로 `CropperWorkspace.tsx` 동시 수정 발생. 사용자가 scope 확장 명시 승인 후 진행.

#### Verification Re-run (orchestrator)
exit 0 — `pnpm build` Compiled successfully, `/create-v4` `/pdf-cropper` 모두 정상.

#### Simplify (orchestrator)
2 files / 22 edits — `CropItem` 타입 파일 레벨 추출, 섹션 주석 정리. VERIFY pass.

#### Review (orchestrator)
pass — A~I 항목 전부 통과. FormData 키(`q{N}`) 라우트와 일치 확인, `/pdf-cropper` 회귀 없음 (onExtract 미주입 시 ZIP 다운로드 유지). 후속 관찰: lazy-load 페이지 미방문 시 박스 blob 누락 가능 — Phase 5 e2e에서 확인 권장.
