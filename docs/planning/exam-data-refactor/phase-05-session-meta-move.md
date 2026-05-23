---
phase: 5
title: session_meta.json을 .v3cache/로 이동 + v3cache-meta route 단일 출처화
status: pending
depends_on: [1]
scope:
  - ngd-studio/app/api/v3cache-meta/route.ts
  - ngd-studio/app/create/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "session_meta를 .v3cache 안으로 옮기는 것이 L1 누수의 핵심 fix; v3cache-reset이 cache dir 통째로 비우므로 stale meta가 자동 폐기된다."
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 5: session_meta.json을 .v3cache/로 이동 + v3cache-meta route 단일 출처화

> **범위**: Frontend (API route + 페이지)
> **난이도**: S
> **의존성**: P1
> **영향 파일**: `app/api/v3cache-meta/route.ts`, `app/create/page.tsx`

## 배경

**L1 (load-bearing leak)**: 현재 `session_meta.json`은 `inputs/시험지 제작/session_meta.json` — **`.v3cache` 밖**(`v3cache-meta/route.ts:7`). `v3cache-reset` 라우트(`v3cache-reset/route.ts:23-39`)는 `.v3cache`만 옮기므로 session_meta가 이전 시험지 메타로 남는다.

이전 시험지 메타가 현재 시험지 작업에 묻어가는 시나리오:
1. handleExtract 중간(`POST /v3cache-meta` 직전)에 사용자 새로고침/오류
2. `.v3cache`는 비고, question_images는 (앞단계에서 이미 새로 썼다면) 현재 시험지, session_meta는 이전 시험지
3. 사용자 "작업 재개" → `GET /v3cache-meta`가 1순위로 session_meta 반환 → **이전 시험지 메타가 현재 시험지에 박힘**

### 해결

- `session_meta.json` 위치를 `.v3cache/session_meta.json`로 이동
- `v3cache-reset`이 `.v3cache → .v3cache_prev` rename할 때 session_meta가 함께 cache_prev로 이동 (= reset 의미에 부합, 새 시험지 시작 시 자동 폐기됨)
- `GET /v3cache-meta`는 **`.v3cache/session_meta.json` 하나만** 읽음. exam_data.info 폴백 제거. (resume 시 session_meta가 항상 있다는 컨트랙트로 단순화 — P6의 `/api/create/start`가 보장)

## 설계

### 1) `app/api/v3cache-meta/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { ExamMeta, ExamMetaInput } from "@/lib/exam/meta";

const BASE_DIR = path.resolve(process.cwd(), "..");
const CACHE_DIR = path.join(BASE_DIR, "inputs", "시험지 제작", ".v3cache");
const SESSION_META_PATH = path.join(CACHE_DIR, "session_meta.json");

interface MetaResult {
  found: boolean;
  meta?: ExamMetaInput;
}

export async function GET(): Promise<NextResponse<MetaResult>> {
  try {
    const raw = await readFile(SESSION_META_PATH, "utf-8");
    const meta = JSON.parse(raw) as ExamMetaInput;
    return NextResponse.json({ found: true, meta });
  } catch {
    return NextResponse.json({ found: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const meta = (await req.json()) as ExamMetaInput;
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(SESSION_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- `extractFromInfo` 함수 삭제 (snake/camel 폴백 불필요 — P2 이후 디스크는 camelCase only)
- `exam_data.json` 폴백 분기 삭제
- 응답 shape를 `{ found, meta }`로 단순화 (기존은 `found`를 메타와 합쳐 평탄화하여 반환 — `MetaResult & found: false` 분기 모호)

### 2) `app/create/page.tsx:handleResume` 정합

```ts
const handleResume = useCallback(async () => {
  if (!existingImages) return;
  let cachedMeta: ExamMetaInput = {};
  try {
    const r = await fetch("/api/v3cache-meta");
    const data = await r.json() as { found: boolean; meta?: ExamMetaInput };
    if (data.found && data.meta) cachedMeta = data.meta;
  } catch { /* ignore */ }

  // 폼 값과 캐시된 메타를 병합 (캐시 우선, 누락 필드는 폼에서)
  const jobMeta: ExamMetaInput = {
    schoolLevel: cachedMeta.schoolLevel ?? meta.schoolLevel,
    school: cachedMeta.school ?? meta.school,
    grade: cachedMeta.grade ?? meta.grade,
    year: cachedMeta.year ?? meta.year,
    subject: cachedMeta.subject ?? meta.subject,
    semester: cachedMeta.semester ?? meta.semester,
    examType: cachedMeta.examType ?? meta.examType,
    range: cachedMeta.range ?? meta.range,
    questionCount: existingImages.count,
    resumeFrom: "auto",
  } as ExamMetaInput & { questionCount: number; resumeFrom: string };
  // ... 나머지 동일
});
```

기존의 dual alias 폴백 (`cachedMeta.schoolLevel as SchoolLevel || ...`) 제거 — P1 ExamMeta 타입으로 단순.

### 3) `v3cache-reset/route.ts` 변경 없음(이미 cache dir 통째로 rename) — 검증만

session_meta가 .v3cache 안으로 들어가면 reset이 자동으로 함께 prev로 이동. 코드 변경 불필요. 단, 주석 갱신:

```ts
// 신규 V3 작업 시작 시 호출 — 기존 .v3cache를 .v3cache_prev로 백업 후 비운다.
// session_meta.json도 .v3cache/ 안에 있으므로 자동 폐기됨 (L1 봉합).
```

### 4) 기존 `session_meta.json`(.v3cache 밖) 정리

배포 전이라 migration 불필요. 단 dev 환경에서 잔존하므로 `.gitignore` + 수동 정리 안내(README 등에).

## 체크리스트
- [ ] `v3cache-meta/route.ts`: SESSION_META_PATH를 `.v3cache/session_meta.json`로 변경
- [ ] `v3cache-meta/route.ts`: `extractFromInfo` 및 exam_data 폴백 분기 삭제, 응답 shape `{ found, meta }` 단순화
- [ ] `app/create/page.tsx:handleResume`: 새 응답 shape에 맞춰 분기 단순화, dual alias 폴백 제거
- [ ] `v3cache-reset/route.ts` 주석 갱신 (session_meta가 cache 안에 있어 자동 폐기됨 명시)
- [ ] `npx tsc --noEmit` 통과 + `grep -rn "session_meta.json" ngd-studio` 결과는 `.v3cache/` prefix 외에 0건

## 영향 범위

- `GET /api/v3cache-meta` 응답 shape 변경 (`found: true, schoolLevel: ..., school: ...` → `found: true, meta: {...}`). 호출처는 `page.tsx:handleResume`만 — 같이 갱신.
- 기존 디스크 `inputs/시험지 제작/session_meta.json`은 더 이상 읽지 않음. dev 환경에 잔존해도 무해(읽히지 않음). 정리 가이드만 안내.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic

# manual:
# 1) 신규 시험지 → handleExtract 후 .v3cache/session_meta.json 존재 확인
# 2) v3cache-reset → .v3cache_prev/session_meta.json으로 이동 확인 (= 자동 폐기 effect)
# 3) /api/v3cache-meta GET이 found=true + meta 반환 확인 (.v3cache/session_meta.json 있을 때)
# 4) cache 비운 상태에서 GET → found=false 응답
```
