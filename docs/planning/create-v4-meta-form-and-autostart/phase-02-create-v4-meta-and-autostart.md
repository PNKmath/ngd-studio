---
phase: 2
title: /create-v4 메타 폼 통합 + 자동 시작 wiring
status: completed
depends_on: [1]
scope:
  - ngd-studio/app/create-v4/page.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: `/create-v4` 메타 폼 통합 + 자동 시작 wiring

> **범위**: Frontend (단일 페이지 재설계)
> **난이도**: M
> **의존성**: Phase 1 (`MetaForm` 컴포넌트)
> **영향 파일**: `app/create-v4/page.tsx`

## 배경

현재 `/create-v4`는 박스 조정 → "시험지 제작 시작" → POST `/api/question-images` → `router.push('/create')`까지만 한다. 사용자는 `/create`에서 다시 메타 입력 + "이어 작업" 클릭 필요 = 원스톱이 아님.

본 phase에서 `/create-v4`에 `MetaForm`을 통합하고, 한 번의 "시험지 제작 시작" 클릭으로 [이미지 업로드 + 메타 저장 + extractor 자동 시작 + 진행 화면 이동]을 모두 처리한다.

## 설계

### 레이아웃

```
┌─────────────────────────────────────────────┐
│ [PDF 자동분할 자동실행 토글] [에러배너] ...   │  ← 기존 상단바 + 에러 표시
├──────────┬──────────────────────────────────┤
│          │                                   │
│ MetaForm │   CropperWorkspace                │
│ (좌측    │   (기존 컴포넌트, onExtract 콜백 │
│  사이드  │    + autoSplitOnUpload prop)     │
│  280px)  │                                   │
│          │                                   │
└──────────┴──────────────────────────────────┘
```

좌측 사이드 너비 ~280px (Tailwind `w-72`). 메타 폼 6개 필드 세로 정렬. 폼 하단에 "필수 필드를 모두 채워주세요" 도움말 (필드 미충족 시).

### 상태

```typescript
import { MetaForm, type MetaValue } from "@/components/upload/MetaForm";

const META_LS_KEY = "create-v4.meta-form"; // sessionStorage

const [meta, setMeta] = useState<MetaValue>({
  school: "", grade: 2, subject: "수학 I",
  semester: "1학기", examType: "중간", range: "",
});

// mount: sessionStorage에서 복원
useEffect(() => {
  try {
    const raw = sessionStorage.getItem(META_LS_KEY);
    if (raw) setMeta(JSON.parse(raw));
  } catch { /* 무시 */ }
}, []);

// 변경 시 sessionStorage 저장
function handleMetaChange(next: MetaValue) {
  setMeta(next);
  try { sessionStorage.setItem(META_LS_KEY, JSON.stringify(next)); } catch { /* quota */ }
}
```

`sessionStorage`는 탭 단위 영속 — 작업 중 페이지 이동/실패 후 복귀에 자연. localStorage 아님(여러 시험지 작업이 섞이지 않게).

### "시험지 제작 시작" 활성 조건

```typescript
const isMetaComplete =
  meta.school.trim().length > 0 &&
  meta.grade > 0 &&
  meta.subject.trim().length > 0 &&
  meta.semester.trim().length > 0 &&
  meta.examType.trim().length > 0 &&
  meta.range.trim().length > 0;

// CropperWorkspace의 onExtract 버튼은 박스 1+개 일 때 활성.
// 메타 미충족 시 onExtract 호출 자체를 막거나, 호출 시 immediate setSubmitError 처리.
```

**구현**: `onExtract` 콜백 진입 시 메타 검증 → 미충족 시 `setSubmitError("필수 메타 입력 필요")` + 좌측 폼 강조. (`CropperWorkspace`의 버튼 활성/비활성은 박스 수 기준만이고 메타 검증은 콜백에서 처리.)

### `onExtract` 콜백 — 4단계 순차 + 실패 정책 (b)

```typescript
const handleExtract = useCallback(async (items: CropItem[]) => {
  if (items.length === 0) return;
  if (!isMetaComplete) {
    setSubmitError("학교/학년/과목/학기/시험/범위 6개 필드를 모두 입력하세요.");
    return;
  }

  setSubmitting(true);
  setSubmitError(null);
  setRecoveryHint(null); // 진행 시작 시 이전 복구 안내 제거

  // [1] 이미지 업로드
  const formData = buildFormData(items); // kind별 q/q_s 카운터 (기존 Phase 5 로직)
  try {
    const res = await fetch("/api/question-images", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`이미지 업로드 실패 (${res.status})`);
  } catch (e) {
    setSubmitError(e instanceof Error ? e.message : "이미지 업로드 실패");
    setSubmitting(false);
    return; // 단계 1 실패 — 추가 부수 작업 없음, 사용자 재시도
  }

  // [2] 메타 캐시 저장
  try {
    const res = await fetch("/api/v3cache-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw new Error(`메타 저장 실패 (${res.status})`);
  } catch (e) {
    // 단계 2 실패: 이미지는 디스크에 저장됨 → 사용자에게 /create로 이동해 이어 진행 안내
    setSubmitError(e instanceof Error ? e.message : "메타 저장 실패");
    setRecoveryHint("이미지는 저장됐습니다. /create로 이동해 이어 작업하시면 진행됩니다.");
    setSubmitting(false);
    return;
  }

  // [3] extractor 시작 + 페이지 이동
  try {
    const questionImageNums = items.map((it) => it.number); // [1, 2, 3, ...]
    await startJob("create", { pdf: "", questionImages: questionImageNums }, {
      ...meta,
      questionCount: items.length,
    });
    router.push("/create");
  } catch (e) {
    // 단계 3 실패: 이미지+메타 저장됨, 작업만 안 굴러감
    setSubmitError(e instanceof Error ? e.message : "작업 시작 실패");
    setRecoveryHint("이미지/메타 모두 저장됐습니다. /create로 이동해 '이어 작업'을 클릭하시면 진행됩니다.");
    setSubmitting(false);
  }
}, [meta, isMetaComplete, startJob, router]);
```

- `useJobRunner.startJob`은 store에 jobId/status/v3Meta를 모두 세팅. `/create` mount 시 `hasJob = true` → 진행 화면 자동 표시 (`/create/page.tsx:147,363`).
- `recoveryHint` 상태 추가 — 단계 2/3 실패 시 사용자에게 보일 안내. `<a href="/create">/create로 이동</a>` 같은 링크 포함.
- 단계 1 실패는 recoveryHint 안 띄움 (저장된 게 없음 — 그냥 재시도).

### `MetaForm` 비활성

`submitting === true`일 때 `<MetaForm disabled={submitting} />` 적용 (이중 클릭 방지).

### 자동 분할 토글

기존 `autoSplitEnabled` + `localStorage` 키 그대로 유지. 영향 없음.

## 체크리스트

- [x] `app/create-v4/page.tsx`에 `MetaForm` import + 좌측 사이드 레이아웃 (Tailwind `grid-cols-[280px_1fr]` 또는 flex).
- [x] `meta` state + sessionStorage 영속 (`META_LS_KEY`) — mount 복원, 변경 저장.
- [x] `handleExtract` 4단계 순차 + 단계별 실패 분기 (b 통일 — 자동 롤백 없음, 단계 2/3 실패 시 `recoveryHint` 표시).
- [x] `isMetaComplete` 검증 — 6개 필드 trim().length > 0 확인. 미충족 시 onExtract 진입 차단 + `setSubmitError`.
- [x] `startJob("create", ...)` 호출 후 `router.push("/create")` — 페이지 전환 + store hydration 의존.
- [x] `pnpm build` 통과 (WSL 환경 제약으로 `npx tsc --noEmit`으로 대체 — tsc pass).

## 영향 범위

- `/create-v4` UX 완전 변경 — 메타 폼 통합 + 자동 시작.
- `/pdf-cropper` 회귀 없음 (`CropperWorkspace` 자체 미수정).
- `useJobStore` 시그니처 변경 없음.
- `/create` 페이지 동작은 Phase 3에서 mount hydration 점검 — 본 phase에서는 store 세팅까지만.

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm build
# 기대: pass
```

수동 검증 (e2e는 Phase 4에서):
1. `/create-v4` mount 시 좌측에 6개 필드 폼 표시
2. 필드 입력 → sessionStorage에 저장됨 (DevTools Application 탭 확인)
3. 필드 비움 + 박스 1+개 + "시험지 제작 시작" → 비활성 또는 에러 배너 ("필수 메타 입력")
4. 필드 채움 + 박스 1+개 + 클릭 → 4단계 진행 → `/create`로 이동 → 진행 화면 표시

## 실행 결과

- **run**: run-1778853181-76857
- **실행일**: 2026-05-15
- **변경 파일**: `ngd-studio/app/create-v4/page.tsx`

### 완료 항목

1. `MetaForm` + `MetaValue` import, `useJobRunner` import 추가.
2. `meta` state 초기화 (`grade: 2`, `subject: "수학 I"`, `semester: "1학기"`, `examType: "중간"` 기본값).
3. mount `useEffect` — `sessionStorage.getItem(META_LS_KEY)` 복원.
4. `handleMetaChange` — 변경 시 `sessionStorage.setItem` 저장.
5. `isMetaComplete` — 6개 필드 `trim().length > 0` 조건.
6. `handleExtract` 재구성:
   - 단계 1: `/api/question-images` POST — 실패 시 `setSubmitError`, `setSubmitting(false)` 리턴. `recoveryHint` 없음.
   - 단계 2: `/api/v3cache-meta` POST — 실패 시 `setSubmitError` + `setRecoveryHint("이미지는 저장됐습니다...")`.
   - 단계 3: `startJob("create", { pdf: "", questionImages }, { ...meta, questionCount })` → `router.push("/create")` — 실패 시 `setSubmitError` + `setRecoveryHint("이미지/메타 모두 저장됐습니다...")`.
7. 레이아웃: `flex flex-1 overflow-hidden` → 좌측 `w-72 shrink-0 border-r` MetaForm 패널 + 우측 `flex-1 overflow-hidden` CropperWorkspace.
8. `recoveryHint` 상단바에 amber 텍스트 + `/create` 링크로 표시.
9. `MetaForm disabled={submitting}` — 제출 중 이중 입력 방지.

### 검증

- `npx tsc --noEmit` → **pass** (0 errors)
- `pnpm build`는 WSL platform binary 이슈로 실행 불가, tsc로 대체.

#### Scope Audit (orchestrator)

pass — 1 file in scope (`app/create-v4/page.tsx`). 그 외 dirty 파일은 task 이전부터 modified (auto-crop/route.ts, pnpm-lock.yaml 등).

#### Verification Re-run (orchestrator)

- `npx tsc --noEmit` → exit 0 (pass)
- `pnpm build` / `npx vitest run` → skipped (WSL platform binary, CLAUDE.md 정책)

#### Simplify (orchestrator)

1 file, 11 edits — 장식용 섹션 배너 주석 7개 + JSX 블록 주석 3개 + 빈 catch 주석 4개 제거. 로직·API·시그니처 무변경. VERIFY: tsc pass.

#### Review (orchestrator)

VERDICT: pass — A~I 전부 OK, ISSUES: 0. `MetaForm`/`useJobRunner.startJob`/`/api/question-images`/`/api/v3cache-meta` 전부 실존 grep 확인. 4단계 실패 정책 정확 구현.

#### Commit

9b66934 — feat(create-v4): Phase 2 — MetaForm 통합 + 자동 시작 wiring
