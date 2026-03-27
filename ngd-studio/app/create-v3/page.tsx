"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionSlotGrid } from "@/components/upload/QuestionSlotGrid";
import type { QuestionSlot } from "@/components/upload/QuestionSlotGrid";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { LogStream } from "@/components/log/LogStream";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { FollowupChat } from "@/components/shared/FollowupChat";
import { QuestionResultPanel } from "@/components/results/QuestionResultPanel";
import { useJobStore } from "@/lib/store";
import { useJobRunner } from "@/lib/useJobRunner";

export default function CreateV3Page() {
  const { startJob, stopJob } = useJobRunner();
  const status = useJobStore((s) => s.status);
  const stages = useJobStore((s) => s.stages);
  const logs = useJobStore((s) => s.logs);
  const jobId = useJobStore((s) => s.jobId);
  const result = useJobStore((s) => s.result);
  const v3Meta = useJobStore((s) => s.v3Meta);
  const setV3Meta = useJobStore((s) => s.setV3Meta);

  const [questionSlots, setQuestionSlots] = useState<QuestionSlot[]>([]);
  const [filledSlotCount, setFilledSlotCount] = useState(0);

  // Meta info form state
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState(2);
  const [subject, setSubject] = useState("수학 I");
  const [semester, setSemester] = useState("1학기");
  const [examType, setExamType] = useState("중간");
  const [range, setRange] = useState("");

  const canStart = filledSlotCount > 0 && status === "idle";

  const handleSlotsChange = useCallback((slots: QuestionSlot[]) => {
    setQuestionSlots(slots);
    setFilledSlotCount(slots.filter((s) => s.file !== null).length);
  }, []);

  const handleStart = useCallback(async () => {
    if (filledSlotCount === 0) return;

    const filledSlots = questionSlots.filter((s) => s.file !== null);
    let questionImageNums: number[] = [];

    if (filledSlots.length > 0) {
      const formData = new FormData();
      for (const slot of filledSlots) {
        if (slot.file) {
          formData.append(`q${slot.number}`, slot.file);
        }
      }
      try {
        const res = await fetch("/api/question-images", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        questionImageNums = (data.images ?? []).map((img: { number: number }) => img.number);
      } catch {
        // Continue without question images
      }
    }

    // Save meta to store for persistence across navigation
    const meta = { school, grade, subject, semester, examType, range, questionCount: filledSlotCount };
    setV3Meta(meta);

    await startJob(
      "create-v3",
      { pdf: "", questionImages: questionImageNums },
      meta
    );
  }, [filledSlotCount, questionSlots, startJob, school, grade, subject, semester, examType, range, setV3Meta]);

  const isRunning = status === "running";
  const isDone = status === "done" || status === "failed";
  const hasJob = isRunning || isDone;

  // --- Idle: 입력 폼 ---
  if (!hasJob) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">시험 정보</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">학교</label>
                  <input type="text" value={school} onChange={(e) => setSchool(e.target.value)}
                    placeholder="OO고등학교" className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">학년</label>
                    <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm">
                      <option value={1}>1학년</option>
                      <option value={2}>2학년</option>
                      <option value={3}>3학년</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">과목</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm">
                      <option>수학</option><option>수학 I</option><option>수학 II</option>
                      <option>확률과 통계</option><option>미적분</option><option>기하</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">학기</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm">
                      <option>1학기</option><option>2학기</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">시험</label>
                    <select value={examType} onChange={(e) => setExamType(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm">
                      <option>중간</option><option>기말</option><option>모의</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">범위</label>
                  <input type="text" value={range} onChange={(e) => setRange(e.target.value)}
                    placeholder="지수 ~ 삼각함수그래프" className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm" />
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={filledSlotCount > 0 ? "text-[var(--color-status-success)]" : ""}>
                  {filledSlotCount > 0 ? "✓" : "○"}
                </span>
                문제 이미지 {filledSlotCount > 0 ? `— ${filledSlotCount}개 삽입됨` : "(필수)"}
              </div>
              <Button onClick={handleStart} disabled={!canStart} className="w-full">
                V3 제작 시작
              </Button>
            </Card>

            <Card className="p-3 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">V3 파이프라인</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                이미지 기반 추출 → 문제별 독립 해설 생성 → 검증(최대 3회) → 그림 처리 → HWPX 조립 → 품질 검수
              </p>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <QuestionSlotGrid maxQuestions={18} onChange={handleSlotsChange} />
            </Card>
            <PipelineView mode="create-v3" />
          </div>
        </div>
      </div>
    );
  }

  // --- Running / Done: 진행 상황 뷰 ---
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Left: Job info + Controls */}
        <div className="space-y-4">
          {/* Meta summary */}
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

          {/* Status + Controls */}
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
              <Button onClick={stopJob} variant="destructive" className="w-full">
                중단
              </Button>
            )}

            {isDone && jobId && (
              <DownloadButton jobId={jobId} disabled={result?.status !== "success"} />
            )}
          </Card>

          {/* Pipeline */}
          <PipelineView
            mode="create-v3"
            stages={stages.length > 0 ? stages : undefined}
          />
        </div>

        {/* Right: Question Results (main area) */}
        <div className="space-y-6">
          <QuestionResultPanel />
          <LogStream logs={logs} />
        </div>
      </div>

      {/* Followup chat */}
      {isDone && <FollowupChat disabled={isRunning} />}
    </div>
  );
}
