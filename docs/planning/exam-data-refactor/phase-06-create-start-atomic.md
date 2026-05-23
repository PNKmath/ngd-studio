---
phase: 6
title: /api/create/start 단일 엔드포인트 + handleExtract 원자화
status: pending
depends_on: [5]
scope:
  - ngd-studio/app/api/create/start/route.ts
  - ngd-studio/app/api/v3cache-reset/route.ts
  - ngd-studio/app/api/question-images/route.ts
  - ngd-studio/app/api/v3cache-meta/route.ts
  - ngd-studio/app/create/page.tsx
  - ngd-studio/app/api/create/start/__tests__/route.test.ts
intervention_likely: true
intervention_reason: "디스크 일관성을 책임지는 신규 트랜잭션 엔드포인트. 잘못 만들면 L1/L2 leak 재도입. 설계 단계에서 사용자 검토 필요 (실패 시 rollback 정책, 부분 실패 시 상태 보고 형식 등)."
executor: sonnet
load_bearing: "/api/create/start가 reset+image+meta를 단일 트랜잭션으로 처리하는 것이 L2 누수의 핵심 fix; 중간단계의 일관되지 않은 디스크 상태가 사라진다."
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 6: /api/create/start 단일 엔드포인트 + handleExtract 원자화

> **범위**: Frontend (API + 페이지)
> **난이도**: M
> **의존성**: P5
> **영향 파일**: `app/api/create/start/route.ts` (신설), 기존 3개 라우트 (정리), `app/create/page.tsx`

## 배경

**L2 (load-bearing leak)**: 현재 `handleExtract`(`page.tsx:395-444`)는 4개의 독립 fetch:
1. `POST /api/v3cache-reset`
2. `POST /api/question-images`
3. `POST /api/v3cache-meta`
4. `POST ${SSE_BASE}/api/run` (startJob)

각 단계 사이에 사용자가 새로고침/탭 닫기 → 디스크가 일관되지 않은 중간 상태. 가장 위험한 윈도우:
- 1)과 2) 사이 — `.v3cache` 비었는데 question_images는 **이전 시험지**. 사용자 새로고침 → "재개" 카드 → 이전 시험지 메타+이전 시험지 이미지로 재추출.
- 2)와 3) 사이 — 이미지는 새 시험지, session_meta는 이전 시험지. P5가 session_meta를 .v3cache 안으로 옮겼으므로 이 윈도우는 L1 자동 해결되지만, 이미지 자체가 이미 새 것이라 메타 불일치는 발생 가능.

### 해결

**클라이언트는 단일 fetch**. 서버가 reset + image 저장 + meta 저장을 한 트랜잭션으로 수행. 어느 sub-step에서 실패하면 전체 rollback.

## 설계

### 1) `app/api/create/start/route.ts` (신설)

```ts
import { NextRequest, NextResponse } from "next/server";
import { mkdir, rm, rename, writeFile, stat } from "fs/promises";
import path from "path";
import type { ExamMetaInput } from "@/lib/exam/meta";

const BASE_DIR = path.resolve(process.cwd(), "..");
const EXAM_DIR = path.join(BASE_DIR, "inputs", "시험지 제작");
const CACHE_DIR = path.join(EXAM_DIR, ".v3cache");
const PREV_DIR = path.join(EXAM_DIR, ".v3cache_prev");
const IMAGES_DIR = path.join(EXAM_DIR, "question_images");
const SESSION_META_PATH = path.join(CACHE_DIR, "session_meta.json");

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * 신규 시험지 작업 시작 — 단일 트랜잭션:
 *   1. .v3cache → .v3cache_prev (rename. P8에서 prev orphan 제거 예정)
 *   2. question_images 디렉터리 전체 삭제 후 새 이미지 저장
 *   3. session_meta.json 작성 (.v3cache 안)
 *
 * 어느 단계에서 실패하면 rollback 시도 후 500 반환. 부분 성공 상태 디스크에 남기지 않음.
 *
 * multipart/form-data 입력:
 *   - meta: JSON string (ExamMetaInput)
 *   - q01, q02, ... (regular) / q_s01, q_s02, ... (essay): File
 */
export async function POST(req: NextRequest) {
  // ── stage 1: parse + validate ──
  let meta: ExamMetaInput;
  const images: { key: string; file: File }[] = [];
  try {
    const formData = await req.formData();
    const metaStr = formData.get("meta");
    if (typeof metaStr !== "string") {
      return NextResponse.json({ error: "meta(JSON) 필드 필요" }, { status: 400 });
    }
    meta = JSON.parse(metaStr) as ExamMetaInput;
    for (const [key, value] of formData.entries()) {
      if (key === "meta") continue;
      if (!(value instanceof File)) continue;
      images.push({ key, file: value });
    }
    if (images.length === 0) {
      return NextResponse.json({ error: "최소 1개 이상의 문제 이미지 필요" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: `request 파싱 실패: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }

  // ── stage 2: backup current state (for rollback) ──
  const cacheBackup = await exists(CACHE_DIR) ? path.join(EXAM_DIR, `.v3cache_pending_${Date.now()}`) : null;
  const imagesBackup = await exists(IMAGES_DIR) ? path.join(EXAM_DIR, `question_images_pending_${Date.now()}`) : null;
  try {
    if (cacheBackup) await rename(CACHE_DIR, cacheBackup);
    if (imagesBackup) await rename(IMAGES_DIR, imagesBackup);
  } catch (err) {
    return NextResponse.json({ error: `백업 실패: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // ── stage 3: write fresh state ──
  const saved: { number: number; kind: "regular" | "essay"; path: string }[] = [];
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await mkdir(IMAGES_DIR, { recursive: true });

    // images
    for (const { key, file } of images) {
      const essay = key.startsWith("q_s");
      const numPart = essay ? key.slice(3) : key.startsWith("q") ? key.slice(1) : null;
      if (numPart === null) continue;
      const num = parseInt(numPart, 10);
      if (isNaN(num)) continue;
      const padded = String(num).padStart(2, "0");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const fileName = essay ? `q_s${padded}.${ext}` : `q${padded}.${ext}`;
      const filePath = path.join(IMAGES_DIR, fileName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      saved.push({ number: num, kind: essay ? "essay" : "regular", path: `inputs/시험지 제작/question_images/${fileName}` });
    }

    // session_meta (.v3cache 안)
    await writeFile(SESSION_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
  } catch (err) {
    // ── rollback ──
    try {
      if (await exists(CACHE_DIR)) await rm(CACHE_DIR, { recursive: true, force: true });
      if (await exists(IMAGES_DIR)) await rm(IMAGES_DIR, { recursive: true, force: true });
      if (cacheBackup) await rename(cacheBackup, CACHE_DIR);
      if (imagesBackup) await rename(imagesBackup, IMAGES_DIR);
    } catch { /* rollback 실패는 별도 로깅 정도 — 일관성 깨질 위험 알림 */ }
    return NextResponse.json({ error: `작업 시작 실패 (rollback 수행): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // ── stage 4: commit (rotate prev) ──
  // 성공 → 백업본을 .v3cache_prev로 회전. 기존 prev는 폐기.
  try {
    if (await exists(PREV_DIR)) await rm(PREV_DIR, { recursive: true, force: true });
    if (cacheBackup) await rename(cacheBackup, PREV_DIR);
    if (imagesBackup) await rm(imagesBackup, { recursive: true, force: true });
  } catch { /* 비치명적 — 다음 reset 때 정리됨. 단, P8에서 prev 자체를 제거할 예정이라 더더욱 무해 */ }

  return NextResponse.json({ ok: true, images: saved });
}
```

### 2) `app/create/page.tsx:handleExtract` 단순화

```ts
const handleExtract = useCallback(async (items: { number: number; kind?: "regular" | "essay"; blob: Blob }[]) => {
  if (items.length === 0) return;
  if (!isMetaComplete) { setSubmitError("..."); return; }
  if (deepSeekBlocksCreate) { setSubmitError("..."); return; }

  setSubmitting(true); setSubmitError(null); setRecoveryHint(null);

  const formData = new FormData();
  formData.append("meta", JSON.stringify(meta));
  let rIdx = 0, eIdx = 0;
  for (const item of items) {
    let key: string;
    if (item.kind === "essay") {
      eIdx++;
      key = `q_s${String(eIdx).padStart(2, "0")}`;
    } else {
      rIdx++;
      key = `q${String(rIdx).padStart(2, "0")}`;
    }
    formData.append(key, new File([item.blob], `${key}.png`, { type: "image/png" }));
  }

  let saved: { number: number }[];
  try {
    const res = await fetch("/api/create/start", { method: "POST", body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error ?? `작업 시작 실패 (${res.status})`);
    }
    const data = await res.json() as { ok: true; images: { number: number }[] };
    saved = data.images;
  } catch (e) {
    setSubmitError(e instanceof Error ? e.message : "작업 시작 실패");
    setRecoveryHint("디스크 상태가 rollback되어 이전 상태로 복구되었습니다. 다시 시도하세요.");
    setSubmitting(false);
    return;
  }

  const jobMeta = { ...meta, questionCount: saved.length };
  setV3Meta(jobMeta);

  try {
    await startJob("create", { pdf: "", questionImages: saved.map((s) => s.number) }, jobMeta);
  } catch (e) {
    setSubmitError(e instanceof Error ? e.message : "작업 시작 실패");
    setRecoveryHint("이미지/메타 모두 저장됐습니다. 페이지를 새로고침하면 '이전 작업 재개' 카드에서 이어 작업할 수 있습니다.");
    setSubmitting(false);
  }
}, [meta, isMetaComplete, deepSeekBlocksCreate, startJob, setV3Meta]);
```

3-step fetch → **1-step** + startJob.

### 3) 기존 라우트 deprecate

- `app/api/v3cache-reset/route.ts`: handleExtract에서 더 이상 호출 안 함. 다른 곳에서 쓰는지 grep — `app/create/page.tsx:395` 외 호출처 없으면 **route 자체 삭제**. 단 P8(`.v3cache_prev` 정리)이 이 라우트를 손볼 거라, 이 phase에선 **handleExtract 호출만 제거**하고 route는 남겨둠. P8에서 최종 처리.
- `app/api/question-images/route.ts:POST`: handleExtract에서 더 이상 호출 안 함. PATCH는 image_replace 액션에서 여전히 사용 — 보존. POST handler만 410 Gone 또는 삭제 (선택 — 보수적으로 410 반환).
- `app/api/v3cache-meta/route.ts:POST`: handleExtract에서 더 이상 호출 안 함. GET만 남기고 POST는 삭제 (P5의 POST 정의를 삭제) — `create/start`가 session_meta 작성 책임.

### 4) 라우트 테스트

`app/api/create/start/__tests__/route.test.ts` 신설:
- 정상 흐름: meta + image 2장 → 디스크에 .v3cache/session_meta.json + question_images/qNN.png 존재, .v3cache_prev로 이전 상태 회전
- meta 파싱 실패 → 400
- meta JSON은 OK인데 images 0개 → 400
- 디스크 write 도중 실패 시 rollback (mock: writeFile 실패 → 백업이 원상복귀)

### 5) catalog mutation 인터뷰

`/api/create/start`는 신규 entry point. `docs/e2e/index.md`에 `create-v4-full-pipeline` 시나리오의 `involved_globs`에 `ngd-studio/app/api/create/**` 추가 + `entry_points`에 `api-create-start` 추가 필요. catalog mutation은 사용자 승인 후 진행 — phase 실행 시점에 인터뷰.

## 체크리스트
- [ ] `app/api/create/start/route.ts` 신설 — 트랜잭션 로직 (백업 → write → 실패 rollback → 성공 commit)
- [ ] `app/create/page.tsx:handleExtract` 단일 fetch로 단순화 (3-step → 1-step + startJob)
- [ ] `app/api/v3cache-meta/route.ts:POST` 삭제 (GET만 유지)
- [ ] `app/api/question-images/route.ts:POST` 410 Gone 반환 또는 삭제 (PATCH는 유지)
- [ ] `app/api/create/start/__tests__/route.test.ts` 트랜잭션/rollback 케이스 추가
- [ ] `docs/e2e/index.md` catalog mutation 인터뷰 후 시나리오 globs/entry_points 갱신
- [ ] `npx tsc --noEmit` 통과 + `npx vitest run app/api/create/start/__tests__/ --reporter=basic` 통과
- [ ] manual: 신규 작업 도중 새로고침/네트워크 끊김 → 디스크가 항상 직전 일관 상태(이전 시험지 or 신규 완료)임을 확인

## 영향 범위

- `/api/v3cache-reset` 호출처가 handleExtract에서 사라짐. P8에서 deprecate 또는 삭제.
- `/api/question-images:POST` 호출처가 handleExtract에서 사라짐. PATCH(image_replace 액션)는 유지.
- `/api/v3cache-meta:POST` 호출처 없음 → 삭제.
- 클라이언트 에러 처리가 단순해짐 (한 군데서 trap).

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic

# manual
# 1) 신규 시험지 → handleExtract 정상 (saved.images에 모든 번호 들어옴)
# 2) 신규 시험지 도중 서버 강제 종료 → 디스크가 .v3cache 또는 .v3cache_pending_<ts>로 일관됨
# 3) rollback 검증: 일부러 disk full 등으로 실패 트리거 → 이전 상태 복원
```
