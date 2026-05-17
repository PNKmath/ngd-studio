---
phase: 3
title: 이전 작업 재개 + figure/build/followup 패널 포팅
status: completed
depends_on: [2]
scope:
  - ngd-studio/app/create-v4/page.tsx
intervention_likely: false
intervention_reason: ""
---

# Phase 3: 이전 작업 재개 + figure/build/followup 패널 포팅

> **범위**: Frontend only
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `ngd-studio/app/create-v4/page.tsx`

## 배경

Phase 2까지 마치면 통합 페이지가 idle/running/done을 모두 처리한다. 그러나 `/create`에 있던 다음 보조 기능들이 아직 v4로 옮겨지지 않았다:

1. **이전 작업 재개 카드** (`/create` page.tsx:272-313) — `.v3cache`에 남은 이미지가 있을 때 idle 상태에서 재개 가능
2. **figure 확인 패널** (`/create` page.tsx:396-440) — figure 처리 백그라운드 폴링 + 사용자 확인 후 builder 시작
3. **build 상태 패널** (`/create` page.tsx:443-481) — HWPX 조립 상태/재처리/폴백/오류 표시
4. **FollowupChat** (`/create` page.tsx:484) — 작업 완료 후 후속 채팅

이 phase에서 이 4가지를 모두 통합 페이지로 옮긴다.

## 설계

### 1. existingImages fetch + 이전 작업 재개 카드

상태:
```tsx
const [existingImages, setExistingImages] = useState<{ count: number; hasClean: boolean } | null>(null);
const [resumeFrom, setResumeFrom] = useState("extractor");
const [showResumeForm, setShowResumeForm] = useState(false);

useEffect(() => {
  if (hasJob) return;
  fetch("/api/question-images")
    .then((r) => r.json())
    .then((data) => {
      if (data.count > 0) setExistingImages({ count: data.count, hasClean: data.hasClean });
    })
    .catch(() => {});
}, [hasJob]);
```

`handleResume`:
```tsx
const handleResume = useCallback(async () => {
  if (!existingImages) return;
  let cachedMeta: Record<string, unknown> = {};
  try {
    const r = await fetch("/api/v3cache-meta");
    const data = await r.json();
    if (data.found) cachedMeta = data;
  } catch { /* ignore */ }

  const jobMeta = {
    school: (cachedMeta.school as string) || meta.school,
    grade: (cachedMeta.grade as number) || meta.grade,
    subject: (cachedMeta.subject as string) || meta.subject,
    semester: (cachedMeta.semester as string) || meta.semester,
    examType: (cachedMeta.examType as string) || meta.examType,
    range: (cachedMeta.range as string) || meta.range,
    questionCount: existingImages.count,
    resumeFrom,
  };
  setV3Meta({ ...jobMeta });
  await startJob("resume", { pdf: "" }, jobMeta);
}, [existingImages, meta, resumeFrom, startJob, setV3Meta]);
```

재개 카드 마크업은 `/create` page.tsx:272-313 그대로 — idle 좌측 사이드바의 시험정보 Card와 PipelineView 사이에 배치.

### 2. figure 패널

`FigureStatus` 타입 + 상태:
```tsx
type FigureStatus = { pending: boolean; done: boolean; success: number[]; failed: number[]; images: string[] };

const [figureStatus, setFigureStatus] = useState<FigureStatus | null>(null);
const figureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

const showFigureConfirm = isDone
  && (mode === "resume" || mode === "create")
  && v3Meta?.resumeFrom === "figure";
```

폴링 useEffect는 `/create` page.tsx:172-202 그대로 포팅 (`/api/figure-status`).

`handleConfirmFigure`:
```tsx
const handleConfirmFigure = useCallback(async () => {
  if (!v3Meta) return;
  const jobMeta = { ...v3Meta, resumeFrom: "confirm" };
  await startJob("resume", { pdf: "" }, jobMeta);
}, [v3Meta, startJob]);
```

마크업은 `/create` page.tsx:396-440 그대로 — running/done 분기의 우측 영역 또는 그 아래에 조건부 렌더.

### 3. build status 패널

`BuildStatus` 타입 + 상태:
```tsx
type BuildStatus = {
  pending: boolean;
  status?: "running" | "retrying" | "fallback" | "success" | "failed";
  hwpx_path?: string;
  error?: string;
  retried?: { problem: number; agent: string }[];
  fallback?: boolean;
};

const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
const buildIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

const showBuildStatus = (isRunning || isDone) &&
  (mode === "create" || mode === "resume") &&
  v3Meta?.resumeFrom !== "figure";
```

폴링 useEffect는 `/create` page.tsx:209-241 그대로 포팅.

마크업은 `/create` page.tsx:443-481 그대로.

### 4. FollowupChat

```tsx
import { FollowupChat } from "@/components/shared/FollowupChat";
```

마크업: `{isDone && !showFigureConfirm && <FollowupChat disabled={isRunning} />}` (`/create` page.tsx:484)

### 배치

- 재개 카드 → idle 좌측 사이드바 (시험정보 Card와 PipelineView 사이)
- figure / build / followup → running/done 분기의 우측 영역 아래쪽, 또는 별도 하단 영역으로 조건부 렌더. 레이아웃은 v4의 `flex-col h-screen` 안에 자연스럽게 배치 (우측 컬럼 `overflow-y-auto` 안에 같이 넣으면 스크롤 가능).

## 체크리스트

- [x] `existingImages` / `resumeFrom` / `showResumeForm` 상태 추가
- [x] `existingImages` fetch `useEffect` 추가 (hasJob일 때 skip)
- [x] 이전 작업 재개 카드 마크업을 idle 좌측 사이드바에 추가
- [x] `handleResume` 함수 추가
- [x] `FigureStatus` 타입 + 상태 + 폴링 `useEffect` 추가
- [x] `showFigureConfirm` 플래그 추가
- [x] `handleConfirmFigure` 함수 추가
- [x] figure 확인 패널 마크업을 running/done 우측 영역에 추가
- [x] `BuildStatus` 타입 + 상태 + 폴링 `useEffect` 추가
- [x] `showBuildStatus` 플래그 추가
- [x] build 상태 패널 마크업을 running/done 우측 영역에 추가
- [x] `FollowupChat` 임포트 + 조건부 렌더 추가
- [x] `npx tsc --noEmit` 통과
- [ ] 빌드 성공 시 build status 패널이 나타나는지 수동 확인
- [ ] resumeFrom=figure 작업 후 figure 확인 패널이 나타나는지 수동 확인 (figure 단계 데이터가 있을 때)

## 영향 범위

- `/create-v4` 페이지가 `/create`의 기능적 동등본이 됨
- 이 phase 이후로는 사용자가 `/create`에 갈 이유가 거의 없음 → 폐기 가능성 평가 단계로 진입

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 확인 시나리오:
1. `.v3cache`에 이미지 있는 상태에서 `/create-v4` 접속 → 좌측에 "이전 작업 재개" 카드 표시 확인
2. 재개 클릭 → running 뷰 전환 확인
3. resumeFrom=figure 작업 진행 → figure 확인 패널 표시 및 폴링 동작 확인
4. HWPX 조립 진행 → build 상태 패널 표시 확인
5. 작업 완료 후 FollowupChat 표시 확인

## 실행 결과

### 1회차 (2026-05-17 00:00 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`/create-v4/page.tsx`에 이전 작업 재개 카드, figure 확인 패널, build 상태 패널, FollowupChat 4가지 기능을 포팅했다.
`mode` store 구독 추가, `FigureStatus`/`BuildStatus` 타입 추가, 관련 상태·refs·effect·핸들러 구현.
idle 좌측 사이드바에 재개 카드 삽입, running/done 우측 스크롤 영역 하단에 figure/build/followup 조건부 렌더.
`npx tsc --noEmit` 오류 없음.

#### 변경 파일
- `ngd-studio/app/create-v4/page.tsx` (수정, +140/-3줄)

#### 검증 결과
- [x] `npx tsc --noEmit`: 출력 없음 → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
수동 확인 항목 2개(build status 패널, figure 확인 패널)는 실제 작업 데이터 없이 자동 검증 불가 — 사용자가 직접 확인 필요.

#### Scope Audit (orchestrator)
pass — 1 file in scope (`ngd-studio/app/create-v4/page.tsx`), phase-file edits exempt

#### Verification Re-run (orchestrator)
exit 0 — `npx tsc --noEmit` 통과 (no output)

#### Simplify (orchestrator)
SIMPLIFIED: 1 / CHANGES: 1 / VERIFY: pass — 자명한 구현 주석 1건 제거 (폴링 헬퍼 통합/스타일 변환은 안전성 이유로 skip)

#### Review (orchestrator)
VERDICT: pass / ISSUES: 0 — 4가지 기능(재개/figure/build/followup) 모두 스펙대로 포팅, 인용 심볼 실존 확인됨
