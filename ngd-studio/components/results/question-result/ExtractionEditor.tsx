"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useJobStore } from "@/lib/store";
import { sendResumeAction } from "./resume";

/**
 * 추출 결과 편집 폼.
 * Step 3.5(추출 편집)에서 사용자가 parts/choices/answer 등을 직접 수정한다.
 * 저장은 PUT /api/extracted-json?q=N — 백엔드의 q{N}_extracted.json을 덮어쓴다.
 * 저장 완료 후 "풀이부터 재실행" 버튼이 활성화된다.
 */
export function ExtractionEditor({
  qNum,
  initial,
  onSaved,
}: {
  qNum: number;
  initial: Record<string, unknown>;
  onSaved: (updated: Record<string, unknown>) => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [partsText, setPartsText] = useState(JSON.stringify(initial.parts ?? [], null, 0));
  const [choicesText, setChoicesText] = useState(JSON.stringify(initial.choices ?? null, null, 0));
  const [conditionBoxText, setConditionBoxText] = useState(JSON.stringify(initial.condition_box ?? null, null, 0));
  const [dataTableText, setDataTableText] = useState(JSON.stringify(initial.data_table ?? null, null, 0));
  const [cropText, setCropText] = useState(
    JSON.stringify(((initial.figure_info as Record<string, unknown>)?.crop_ratio ?? null), null, 0),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobId = useJobStore((s) => s.jobId);
  const jobStatus = useJobStore((s) => s.status);

  const markDirty = () => setDirty(true);

  const handleRerunFromSolver = useCallback(async () => {
    if (!jobId || rerunning || jobStatus === "running") return;
    setRerunning(true);
    const instruction = `resume --q=${qNum} --from=solver`;
    await sendResumeAction(jobId, instruction, useJobStore.getState());
    setRerunning(false);
  }, [jobId, rerunning, jobStatus, qNum]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    let parts: unknown;
    let choices: unknown;
    let conditionBox: unknown;
    let dataTable: unknown;
    let cropRatio: unknown;
    try {
      parts = JSON.parse(partsText);
      choices = choicesText.trim() ? JSON.parse(choicesText) : null;
      conditionBox = conditionBoxText.trim() ? JSON.parse(conditionBoxText) : null;
      dataTable = dataTableText.trim() ? JSON.parse(dataTableText) : null;
      cropRatio = cropText.trim() ? JSON.parse(cropText) : null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 파싱 실패");
      setSaving(false);
      return;
    }

    const next: Record<string, unknown> = {
      ...data,
      parts,
      choices,
      condition_box: conditionBox,
      data_table: dataTable,
    };
    if (data.has_figure && cropRatio) {
      next.figure_info = {
        ...((data.figure_info as Record<string, unknown>) ?? {}),
        crop_ratio: cropRatio,
      };
    }

    try {
      const res = await fetch(`/api/extracted-json?q=${qNum}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "저장 실패");
      }
      onSaved(next);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-2 space-y-2 text-xs">
      <h5 className="font-medium text-blue-600">추출 결과 편집</h5>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-muted-foreground">유형</span>
          <select
            value={String(data.type ?? "")}
            onChange={(e) => { setData({ ...data, type: e.target.value }); markDirty(); }}
            className="w-full border rounded px-1 py-0.5 mt-0.5 bg-background"
          >
            <option value="choice">choice</option>
            <option value="essay">essay</option>
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground">난이도</span>
          <select
            value={String(data.difficulty ?? "중")}
            onChange={(e) => { setData({ ...data, difficulty: e.target.value }); markDirty(); }}
            className="w-full border rounded px-1 py-0.5 mt-0.5 bg-background"
          >
            <option value="하">하</option>
            <option value="중">중</option>
            <option value="상">상</option>
            <option value="킬">킬</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-muted-foreground">배점</span>
          <input
            type="text"
            value={String(data.score ?? "")}
            onChange={(e) => { setData({ ...data, score: e.target.value }); markDirty(); }}
            className="w-full border rounded px-1 py-0.5 mt-0.5 bg-background"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">단원</span>
          <input
            type="text"
            value={String(data.subtopic ?? "")}
            onChange={(e) => { setData({ ...data, subtopic: e.target.value }); markDirty(); }}
            className="w-full border rounded px-1 py-0.5 mt-0.5 bg-background"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-muted-foreground">정답</span>
        <input
          type="text"
          value={String(data.answer ?? "")}
          onChange={(e) => { setData({ ...data, answer: e.target.value }); markDirty(); }}
          className="w-full border rounded px-1 py-0.5 mt-0.5 bg-background"
          placeholder="예: ② 또는 -3"
        />
      </label>

      <label className="block">
        <span className="text-muted-foreground">본문 parts (JSON 배열)</span>
        <textarea
          value={partsText}
          onChange={(e) => { setPartsText(e.target.value); markDirty(); }}
          rows={4}
          className="w-full border rounded px-1 py-0.5 mt-0.5 font-mono text-[10px] bg-background"
          spellCheck={false}
        />
      </label>

      <label className="block">
        <span className="text-muted-foreground">선지 choices (JSON 배열, 서답형은 null)</span>
        <textarea
          value={choicesText}
          onChange={(e) => { setChoicesText(e.target.value); markDirty(); }}
          rows={3}
          className="w-full border rounded px-1 py-0.5 mt-0.5 font-mono text-[10px] bg-background"
          spellCheck={false}
        />
      </label>

      <label className="block">
        <span className="text-muted-foreground">보기/조건 condition_box (JSON 또는 null)</span>
        <textarea
          value={conditionBoxText}
          onChange={(e) => { setConditionBoxText(e.target.value); markDirty(); }}
          rows={3}
          className="w-full border rounded px-1 py-0.5 mt-0.5 font-mono text-[10px] bg-background"
          spellCheck={false}
          placeholder="null"
        />
      </label>

      <label className="block">
        <span className="text-muted-foreground">표 data_table (JSON 또는 null)</span>
        <textarea
          value={dataTableText}
          onChange={(e) => { setDataTableText(e.target.value); markDirty(); }}
          rows={3}
          className="w-full border rounded px-1 py-0.5 mt-0.5 font-mono text-[10px] bg-background"
          spellCheck={false}
          placeholder="null"
        />
      </label>

      {Boolean(data.has_figure) && (
        <label className="block">
          <span className="text-muted-foreground">그림 crop_ratio [left, top, right, bottom]</span>
          <input
            type="text"
            value={cropText}
            onChange={(e) => { setCropText(e.target.value); markDirty(); }}
            className="w-full border rounded px-1 py-0.5 mt-0.5 font-mono text-[10px] bg-background"
            placeholder="[0.55, 0.1, 0.95, 0.7]"
          />
        </label>
      )}

      {error && <div className="text-red-600 text-[10px]">{error}</div>}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-7 text-xs"
        >
          {saving ? "저장 중..." : "이 문제 저장"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRerunFromSolver}
          disabled={saving || dirty || rerunning || jobStatus === "running" || !jobId}
          title={dirty ? "먼저 저장하세요" : "이 추출로 풀이부터 다시"}
          className="h-7 text-xs"
        >
          {rerunning ? "재실행 중..." : "풀이부터 재실행"}
        </Button>
      </div>
    </div>
  );
}
