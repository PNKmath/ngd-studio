"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 풀이 및 해설 편집 폼.
 * 부모(QuestionDetail) 가 editingSol 분기로 마운트한다 — 마운트 즉시 편집.
 * 저장은 PUT /api/solver-json?q=N — 백엔드의 q{N}_solved.json을 덮어쓴다.
 */
export function SolutionEditor({
  qNum,
  initial,
  onSaved,
  onCancel,
}: {
  qNum: number;
  initial: Record<string, unknown>;
  onSaved: (updated: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }, [text]);

  const handleSave = useCallback(async () => {
    if (!dirty || !isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const res = await fetch(`/api/solver-json?q=${qNum}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `저장 실패: ${res.status}`);
      }
      onSaved(parsed);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [dirty, isValid, saving, text, qNum, onSaved]);

  return (
    <div className="pt-2 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <h5 className="font-medium text-blue-600">풀이 및 해설 편집</h5>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-7 text-xs"
          >
            편집 취소
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || !isValid || saving}
            className="h-7 text-xs"
          >
            {saving ? "저장 중…" : "풀이 및 해설 저장"}
          </Button>
        </div>
      </div>

      {!isValid && dirty && (
        <p className="text-xs text-destructive">JSON 형식 오류 — 저장 불가</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        className="w-full h-64 font-mono text-xs p-3 bg-background border rounded"
        spellCheck={false}
      />
    </div>
  );
}
