---
phase: 2
title: 작업 상태 분기 + Running/Done 뷰 도입
status: pending
depends_on: [1]
scope:
  - ngd-studio/app/create-v4/page.tsx
intervention_likely: false
intervention_reason: ""
---

# Phase 2: 작업 상태 분기 + Running/Done 뷰 도입

> **범위**: Frontend only
> **난이도**: L
> **의존성**: Phase 1
> **영향 파일**: `ngd-studio/app/create-v4/page.tsx`

## 배경

현재 `/create-v4`는 추출 버튼을 누르면 `router.push("/create")`로 페이지를 옮겨 진행 상황을 보여준다. 통합 후에는 같은 페이지 안에서 idle / running / done 상태 전환이 일어나야 한다.

이 phase에서는:
1. `useJobStore`를 구독해 작업 상태(running/done) 분기를 도입
2. `handleExtract`에서 `router.push("/create")` 제거 + `/create` 페이지의 `handleStart` 동선(v3cache-reset, v3cache-meta POST, setV3Meta)을 통합
3. Running/Done 시 CropperWorkspace를 숨기고 좌측에 시험정보 요약 + 상태/제어 + 라이브 파이프라인, 우측에 QuestionResultPanel + LogStream을 표시
4. v3Meta auto-restore useEffect 포팅

"이전 작업 재개" 카드와 figure/build/followup 패널은 Phase 3에서 처리.

## 설계

### 1. 추가 임포트

```tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { QuestionResultPanel } from "@/components/results/QuestionResultPanel";
import { LogStream } from "@/components/log/LogStream";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { useJobStore } from "@/lib/store";
import { useEffect } from "react";
```

(Phase 1에서 `Card`, `PipelineView`는 이미 임포트되어 있을 수 있음 — 중복 제거)

### 2. Store 구독

```tsx
const { startJob, stopJob } = useJobRunner();
const status = useJobStore((s) => s.status);
const mode = useJobStore((s) => s.mode);
const stages = useJobStore((s) => s.stages);
const logs = useJobStore((s) => s.logs);
const jobId = useJobStore((s) => s.jobId);
const result = useJobStore((s) => s.result);
const v3Meta = useJobStore((s) => s.v3Meta);
const setV3Meta = useJobStore((s) => s.setV3Meta);

const isRunning = status === "running";
const isDone = status === "done" || status === "failed";
const hasJob = isRunning || isDone;
```

### 3. v3Meta auto-restore

```tsx
useEffect(() => {
  if (!v3Meta || hasJob) return;
  queueMicrotask(() => {
    setMeta({
      school: v3Meta.school ?? "",
      grade: v3Meta.grade ?? 2,
      subject: v3Meta.subject ?? "수학 I",
      semester: v3Meta.semester ?? "1학기",
      examType: v3Meta.examType ?? "중간",
      range: v3Meta.range ?? "",
    });
  });
}, [v3Meta, hasJob]);
```

### 4. handleExtract 동선 수정

기존 v4 `handleExtract` (`app/create-v4/page.tsx:92-168`)에서:
- 이미지 업로드 직전에 **v3cache-reset 호출 추가** (create와 동일하게):
  ```tsx
  await fetch("/api/v3cache-reset", { method: "POST" }).catch(() => {});
  ```
- `setV3Meta`를 startJob 전에 호출:
  ```tsx
  const jobMeta = { ...meta, questionCount: items.length };
  setV3Meta(jobMeta);
  ```
- `startJob` 호출 시 `jobMeta` 사용
- **`router.push("/create")` 제거**
- `submitting` 플래그는 그대로 유지(업로드 중 표시용). startJob 성공 시 store가 status를 running으로 바꾸면 자동으로 running 뷰로 전환됨

### 5. 렌더링 분기

함수 컴포넌트 return을 다음 구조로 변경:

```tsx
if (!hasJob) {
  return (
    // 기존 v4 idle 레이아웃 (Phase 1 결과)
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      ... 기존 idle 마크업 ...
    </div>
  );
}

// Running/Done 뷰
return (
  <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
    {/* 상단 toolbar는 idle과 동일하게 유지하거나 간소화 */}
    <div className="flex flex-1 overflow-hidden">
      <div className="w-72 shrink-0 border-r overflow-y-auto p-4 space-y-4">
        {/* 시험 정보 요약 Card */}
        {v3Meta && (
          <Card className="p-4 space-y-2">
            <h3 className="text-sm font-medium">시험 정보</h3>
            <div className="text-xs space-y-1 text-muted-foreground">
              {v3Meta.school && <div>{v3Meta.school}</div>}
              <div>
                {v3Meta.grade && `${v3Meta.grade}학년 `}
                {v3Meta.semester} {v3Meta.examType}
              </div>
              {v3Meta.subject && <div>{v3Meta.subject}</div>}
              {v3Meta.range && <div>{v3Meta.range}</div>}
              {v3Meta.questionCount && <div>문제 {v3Meta.questionCount}개</div>}
            </div>
          </Card>
        )}

        {/* 상태 + 제어 Card */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${
              isRunning ? "bg-yellow-500 animate-pulse" :
              result?.status === "success" ? "bg-[var(--color-status-success)]" :
              "bg-[var(--color-status-error)]"
            }`} />
            <span className="font-medium">
              {isRunning ? "제작 진행 중..." : result?.status === "success" ? "제작 완료" : "제작 실패"}
            </span>
          </div>

          {isRunning && (
            <Button onClick={stopJob} variant="destructive" className="w-full">중단</Button>
          )}

          {isDone && jobId && (
            <DownloadButton jobId={jobId} disabled={result?.status !== "success"} />
          )}
        </Card>

        {/* 라이브 파이프라인 */}
        <PipelineView mode="create" stages={stages.length > 0 ? stages : undefined} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <QuestionResultPanel />
        <LogStream logs={logs} />
      </div>
    </div>
  </div>
);
```

### 주의

- 상단 toolbar(자동 분할 체크박스/오류 메시지)는 idle 상태에서만 의미 있음. Running/Done에서는 제거하거나 매우 단순한 헤더로 대체.
- `submitError` / `recoveryHint` / `submitting` 처리는 idle 분기에 남겨둠.
- figure confirm / build status / followup chat은 **이 phase에서 다루지 않음** — Phase 3.
- "이전 작업 재개" 카드는 **이 phase에서 다루지 않음** — Phase 3.

## 체크리스트

- [ ] `useJobStore`, `useJobRunner` 임포트 및 필요한 상태 구독 (`status`, `mode`, `stages`, `logs`, `jobId`, `result`, `v3Meta`, `setV3Meta`, `stopJob`)
- [ ] `QuestionResultPanel`, `LogStream`, `DownloadButton`, `Button` 임포트 추가
- [ ] `hasJob` / `isRunning` / `isDone` 플래그 도입
- [ ] v3Meta auto-restore `useEffect` 추가 (hasJob일 때는 skip)
- [ ] `handleExtract`에서 v3cache-reset POST 추가 (이미지 업로드 직전)
- [ ] `handleExtract`에서 `setV3Meta` 호출 추가
- [ ] `handleExtract`에서 `router.push("/create")` **제거**
- [ ] `if (!hasJob)` idle return 분기 + running/done return 분기 구조로 컴포넌트 재작성
- [ ] Running/Done 좌측: 시험정보 요약 + 상태/제어 + `PipelineView stages={stages.length > 0 ? stages : undefined}`
- [ ] Running/Done 우측: `QuestionResultPanel` + `LogStream`
- [ ] full-height + 내부 스크롤 레이아웃 유지
- [ ] `npx tsc --noEmit` 통과
- [ ] `pnpm dev`로 동작 확인: 추출 버튼 → 같은 페이지에서 running 뷰로 전환되는지 (라우팅 발생하지 않음)
- [ ] `useRouter` import 제거 (사용처 없으면)

## 영향 범위

- `/create-v4` 동작이 근본적으로 바뀜 — 추출 후 별도 페이지로 가지 않고 같은 페이지에서 진행
- `/create` 페이지는 영향 없음 (그대로 유지)
- store(`useJobStore`)는 두 페이지에서 공유되므로 이미 호환됨

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 확인:
- `/create-v4` 접속 → PDF 업로드 → 자동/수동 crop → 추출 클릭
- 같은 URL을 유지하면서 좌/우 분할 뷰가 결과 뷰로 전환되는지 확인
- 진행 중 PipelineView가 live 업데이트되는지
- 작업 완료 시 다운로드 버튼이 활성화되는지
