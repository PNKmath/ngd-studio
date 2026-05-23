---
phase: 8
title: .v3cache_prev orphan + outputs/images/ 누적 정리
status: pending
depends_on: [6]
scope:
  - ngd-studio/server/stages/cache.ts
  - ngd-studio/app/api/v3cache-reset/route.ts
  - figure_processor.py
  - ngd-studio/lib/__tests__/stageFoundation.test.ts
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - build-hwpx-cli
e2e_triggers: []
---

# Phase 8: .v3cache_prev orphan + outputs/images/ 누적 정리

> **범위**: Both
> **난이도**: S
> **의존성**: P6
> **영향 파일**: `server/stages/cache.ts`, `app/api/v3cache-reset/route.ts`, `figure_processor.py`

## 배경

### L3: `.v3cache_prev` orphan

`cache.ts:7,54`에 `previousCacheDir: ".v3cache_prev"` 정의. `v3cache-reset/route.ts:32-35` + 신규 `create/start`(P6)이 매번 `.v3cache → .v3cache_prev` rename. **읽는 코드 0건** (grep으로 확인). 즉 이전 시험지 전체 데이터를 1세대 디스크에 영구 보존하지만 **누구도 사용 안 함**.

위험:
- 미래 개발자가 "복구" 기능 추가하다 이전 시험지 데이터를 잘못 끌어옴
- 사용자가 수동으로 `cp .v3cache_prev/* .v3cache/` 같은 거 하면 immediate leak

### L4: `outputs/images/prob{N}_final.png` 누적

`figure_processor.py:175`가 `output_dir / f"prob{n}_final.png"`로 직접 덮어쓴다. 같은 N의 그림은 덮어쓰므로 안전하지만, **이전 시험지에 figure 있던 N이 현재 시험지에 없으면** prob{N}_final.png가 outputs/images에 잔존. HWPX 결과물엔 안 들어가지만 디버그·미리보기 도구가 outputs/images 스캔하면 stale 표시.

## 설계

### 1) `.v3cache_prev` 제거

**a) `app/api/v3cache-reset/route.ts`**:
   - P6의 `/api/create/start`가 init 책임 인수. 이 route를 호출하는 코드 0건이면 **route 자체 삭제**.
   - 단 followup이나 디버그 도구가 쓸 가능성 — grep 후 호출처 없으면 삭제. 있으면 v3cache-reset에서 `PREV_DIR` rename 대신 단순 `rm -rf .v3cache && mkdir`만 수행하도록 단순화.

**b) `app/api/create/start/route.ts`** (P6 산출물):
   - stage 4 "rotate prev" 부분 삭제. 백업본은 성공 시 그냥 `rm -rf` (rotate 없음).
   - 코드 변경:
     ```ts
     // Before: if (cacheBackup) await rename(cacheBackup, PREV_DIR);
     // After:
     if (cacheBackup) await rm(cacheBackup, { recursive: true, force: true });
     ```

**c) `cache.ts`**:
   ```ts
   export interface StageCachePaths {
     examDir: string;
     cacheDir: string;
     // previousCacheDir: string;  ← 삭제
     questionImagesDir: string;
     cleanedImagesDir: string;
     examData: string;
     figureStatus: string;
     cleaningStatus: string;
     buildStatus: string;
   }
   ```
   `FileBackedStageCache.constructor`에서 `previousCacheDir: path.join(...)` 줄도 제거.

**d) `lib/__tests__/stageFoundation.test.ts:55`**: `previousCacheDir` 검증 케이스 삭제.

### 2) `outputs/images/` 정리

옵션 A: `/api/create/start` (P6)에서 `outputs/images/`도 함께 초기화
옵션 B: `figure_processor.py` 시작 시 `--clear-output-dir` 플래그 처리, orchestrator가 신규 작업 시 전달
옵션 C: `figure_processor.py`가 이번 작업의 figure 있는 문제 번호만 알면 다른 번호의 prob{N}_final.png를 자동 삭제

**권장: 옵션 A** (가장 단순, P6과 자연스럽게 통합).

`app/api/create/start/route.ts`의 stage 3 시작 부분에 추가:

```ts
const OUTPUTS_IMAGES_DIR = path.join(BASE_DIR, "outputs", "images");
// stage 3 시작:
if (await exists(OUTPUTS_IMAGES_DIR)) {
  await rm(OUTPUTS_IMAGES_DIR, { recursive: true, force: true });
}
await mkdir(OUTPUTS_IMAGES_DIR, { recursive: true });
```

백업은 안 함(outputs/images는 derivable artifact라 rollback 불요). 트랜잭션 무결성에 영향 없음.

> ⚠ 같은 시점에 outputs/의 HWPX는 보존(사용자 다운로드 가능). 이미지만 정리.

### 3) figure_processor.py 안전 보강 (선택)

명시적 디렉터리 클리어가 P6에서 처리되므로 figure_processor 자체엔 변경 불요. 단 문서 갱신:

```python
# figure_processor.py 상단 docstring
# Note: outputs/images/ 디렉터리는 /api/create/start 가 신규 작업 시점에
#       클리어한다. 본 스크립트는 prob{N}_final.png 를 idempotent 하게 작성만 한다.
```

### 4) 테스트

- `stageFoundation.test.ts`: previousCacheDir 케이스 삭제 (또는 "should not have previousCacheDir" 변환)
- `create/start/__tests__/route.test.ts` (P6 결과물): outputs/images 클리어 시나리오 추가

## 체크리스트
- [ ] `cache.ts:StageCachePaths.previousCacheDir` 필드 삭제 + 생성자에서 path.join 줄 제거
- [ ] `app/api/create/start/route.ts`: `PREV_DIR` rename 대신 백업본 rm으로 변경 (rotate 없음)
- [ ] `app/api/v3cache-reset/route.ts`: 호출처 grep 후 0건이면 route 파일 삭제, 있으면 PREV_DIR 로직만 제거
- [ ] `app/api/create/start/route.ts`: stage 3 시작 시 outputs/images/ 클리어 + 재생성
- [ ] `lib/__tests__/stageFoundation.test.ts`: previousCacheDir 케이스 갱신/삭제, outputs/images 클리어 검증 추가
- [ ] `npx tsc --noEmit` + `npx vitest run lib/__tests__/ --reporter=basic` 통과

## 영향 범위

- 디스크 누적이 사라짐 — 신규 시험지 시작이 진짜로 깨끗한 상태에서 출발.
- 이전 시험지 디버깅이 필요하면 git/백업으로 처리 (코드가 보존 책임 안 가짐).

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run lib/__tests__/ --reporter=basic

# manual
# 1) 신규 시험지 시작 → .v3cache_prev 디렉터리 없음 확인
# 2) 이전 시험지에 figure 있던 prob5_final.png → 새 시험지(figure 없음) 시작 시 사라짐 확인
ls /Users/junhyukpark/ngd/ngd-studio/inputs/시험지\ 제작/.v3cache_prev 2>&1 | head -1  # "No such file or directory"
ls /Users/junhyukpark/ngd/ngd-studio/outputs/images/  # 신규 작업의 figure 문제만
```
