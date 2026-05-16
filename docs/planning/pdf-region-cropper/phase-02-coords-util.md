---
phase: 2
title: 자료구조 + 좌표 변환 유틸
status: completed
depends_on: []
scope:
  - ngd-studio/lib/cropper/types.ts
  - ngd-studio/lib/cropper/coords.ts
  - ngd-studio/lib/cropper/__tests__/coords.test.ts
  - ngd-studio/vitest.config.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: 자료구조 + 좌표 변환 유틸

> **범위**: Frontend (lib only, DOM 의존 없음)
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `ngd-studio/lib/cropper/` (신규 디렉터리)

## 배경

박스 인터랙션 컴포넌트(Phase 3)와 통합 페이지(Phase 4)에서 공통으로 쓸 **타입**과 **순수 함수**를 먼저 분리해 단위 테스트로 보호한다. 좌표 변환은 zoom/scroll 상태가 얽히는 영역이라 휴먼 에러가 잦으므로, Canvas/SVG 의존 없는 순수 함수로 만들어 Vitest로 검증한다.

기존 `ngd-studio/lib/` 에 `claude.ts`, `store.ts` 등이 있고 테스트는 `ngd-studio/lib/__tests__/`에 둠 — 동일 패턴 따른다. Vitest는 이미 설정(`ngd-studio/vitest.config.ts`).

## 설계

### `lib/cropper/types.ts`

```ts
/** 박스 좌표는 PDF 페이지가 렌더된 이미지의 픽셀 좌표계 (dpi=200 기준). */
export interface CropBox {
  id: string;          // uuid (crypto.randomUUID())
  page: number;        // 0-indexed
  x: number;           // image-pixel
  y: number;
  w: number;
  h: number;
  number: number;      // 문제 번호 (1, 2, 3 ...)
}

export interface PageMeta {
  index: number;       // 0-indexed
  imageWidth: number;  // 렌더 PNG 픽셀 폭
  imageHeight: number;
}

/** crop 결과 (Phase 4의 추출 단계에서 생성) */
export interface CroppedProblem {
  number: number;
  blob: Blob;          // image/png
  sourceBox: CropBox;
}
```

### `lib/cropper/coords.ts`

순수 함수만:

```ts
/** 화면 좌표 (clientX, clientY 기준 컨테이너 상대) → 이미지 픽셀 좌표 */
export function screenToImage(
  screenX: number, screenY: number,
  viewport: { displayWidth: number; displayHeight: number; imageWidth: number; imageHeight: number }
): { x: number; y: number }

/** 이미지 픽셀 좌표 → 화면 좌표 */
export function imageToScreen(
  imgX: number, imgY: number,
  viewport: { displayWidth: number; displayHeight: number; imageWidth: number; imageHeight: number }
): { x: number; y: number }

/** w/h가 음수인 박스 → 정규화 (드래그 방향 무관하게 양수) */
export function normalizeBox(box: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number }

/** 박스를 페이지 경계에 클램프 */
export function clampBox(
  box: { x: number; y: number; w: number; h: number },
  pageWidth: number, pageHeight: number
): { x: number; y: number; w: number; h: number }

/** 같은 페이지의 박스들을 Y좌표(ties면 X) 순으로 정렬하여 자동 번호 부여 */
export function autoNumber(boxes: CropBox[]): CropBox[]
```

`autoNumber`는 페이지 순(0,1,2…) → 각 페이지 내 Y → 같은 Y면 X 순으로 1부터 매김.

### `lib/cropper/__tests__/coords.test.ts`

Vitest. 최소 다음 케이스:
- `screenToImage` ↔ `imageToScreen` round-trip
- `normalizeBox`: 음수 w/h 처리, 0 처리
- `clampBox`: 경계 넘는 박스, 음수 시작점
- `autoNumber`: 페이지 섞인 입력에서 페이지-Y 순서대로 번호 매김
- `autoNumber`: 빈 배열 / 단일 박스

## 체크리스트

- [x] `ngd-studio/lib/cropper/types.ts` 작성 (위 인터페이스)
- [x] `ngd-studio/lib/cropper/coords.ts` 작성 (5개 함수, 순수 함수만)
- [x] DOM/Canvas/React import 없음 (`grep -E "from \"(react|next)\"" lib/cropper/coords.ts` 빈 결과)
- [x] `ngd-studio/lib/cropper/__tests__/coords.test.ts` 작성 (최소 6개 it)
- [x] `ngd-studio/vitest.config.ts` include 패턴 확장 (`lib/**/__tests__/**/*.test.ts`) — 2회차 추가
- [x] `pnpm --filter ngd-studio test` 통과 (새 테스트 포함 전체)
- [x] `pnpm --filter ngd-studio build` 통과

## 영향 범위

- **신규 파일만** — 기존 코드 변경 없음
- Phase 3, 4에서 이 모듈을 import
- 이후 자동 분할 task에서도 이 타입과 유틸을 재사용

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm test -- coords
pnpm build
```

## 실행 결과

### 1회차 (2026-05-14 오후 KST) — blocked
**상태**: blocked
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`types.ts`, `coords.ts`, `__tests__/coords.test.ts` 3개 파일을 모두 작성. TypeScript 타입 검사(`npx tsc --noEmit`, exit 0) 통과. 코드 품질 양호 (13개 it 블록, React/Next import 없음). 그러나 `pnpm test`와 `pnpm build` 모두 WSL 환경에서 native 바이너리 부재로 실패 — `@rollup/rollup-linux-x64-gnu` 및 `lightningcss.linux-x64-gnu.node`가 없음. node_modules가 Windows에서 pnpm install된 것으로 추정. 이는 이 phase 이전부터 존재하는 pre-existing 환경 이슈.

추가로 `vitest.config.ts`의 include 패턴(`lib/__tests__/**/*.test.ts`)이 `lib/cropper/__tests__/coords.test.ts`를 커버하지 않는 구조적 문제 발견. 테스트 실행 환경이 복구되면 `vitest.config.ts`의 include를 `lib/**/__tests__/**/*.test.ts`로 확장해야 함 (out-of-scope라 이번 phase에서 수정 불가).

#### 변경 파일
- `ngd-studio/lib/cropper/types.ts` (신규, +23줄)
- `ngd-studio/lib/cropper/coords.ts` (신규, +81줄)
- `ngd-studio/lib/cropper/__tests__/coords.test.ts` (신규, +130줄)

#### 검증 결과
- [x] DOM/Canvas/React import 없음: `grep -E 'from "(react|next)"' coords.ts` → 빈 결과 (exit 1)
- [x] TypeScript 타입 검사: `npx tsc --noEmit` → exit 0
- [ ] `pnpm test -- coords`: `@rollup/rollup-linux-x64-gnu` missing — WSL native 바이너리 부재 (pre-existing)
- [ ] `pnpm build`: `lightningcss.linux-x64-gnu.node` missing — 동일 원인

#### 추가 발견사항
1. `vitest.config.ts` include 패턴(`lib/__tests__/**/*.test.ts`)이 `lib/cropper/__tests__/` 경로를 커버하지 않음. scope 밖이라 수정 불가 — 후속 처리 필요.
2. native 바이너리 부재는 이 phase 이전부터 존재. 기존 테스트(store.test.ts 등)도 동일하게 실행 불가.

#### 질문 / 결정 사항
1. WSL에서 `pnpm install`(Linux 바이너리 재설치) 실행 여부 — orchestrator/사용자 결정 필요.
2. `vitest.config.ts` scope 추가 또는 include 패턴 수정 — Phase 3 또는 별도 fix phase로 처리 필요.

#### Scope Audit (orchestrator)
pass — 4 files in scope (types.ts, coords.ts, coords.test.ts 신규 + vitest.config.ts 수정 / git diff fallback).

#### Verification Re-run (orchestrator)
exit 0 — `pnpm test -- coords` 40/40 pass, `pnpm build` 21 라우트 모두 성공.

### 2회차 (2026-05-14 01:43 KST) — completed
**상태**: completed
**소요 시간**: 약 3분
**진행 모델**: claude-sonnet-4-6

#### 요약
Orchestrator가 사전에 WSL `pnpm install`(Linux native 바이너리 복구)과 scope에 `vitest.config.ts` 추가를 완료한 상태로 2회차 재시도 진행. `vitest.config.ts`의 include 패턴을 `lib/__tests__/**/*.test.ts` → `lib/**/__tests__/**/*.test.ts`로 확장해 `lib/cropper/__tests__/coords.test.ts`가 커버되도록 수정. `pnpm test -- coords` 실행 결과 40개 테스트 전체 pass(coords 13개 포함). `pnpm build` 실행 결과 21개 페이지 전체 static/dynamic 빌드 성공.

#### 변경 파일
- `ngd-studio/vitest.config.ts` (수정, +1/-1줄: include 패턴 확장)

#### 검증 결과
- [x] `pnpm test -- coords`: 4 test files, 40 tests — 모두 pass
- [x] `pnpm build`: Next.js 21개 라우트 빌드 성공 (exit 0)

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Simplify (orchestrator)
1 file, 1 edit — coords.ts에서 screenToImage/imageToScreen의 중복 inline viewport 타입을 `Viewport` interface로 추출. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass · ISSUES: 0 · 스펙 정의 5개 함수·3개 인터페이스 모두 구현, 13개 테스트 pass, vitest include 패턴 확장 정상, 기존 테스트 커버 유지됨.

#### Commit
`36238c0` — feat(ngd-studio): Phase 2 — coords util 테스트 커버리지 확보 및 vitest include 패턴 확장
