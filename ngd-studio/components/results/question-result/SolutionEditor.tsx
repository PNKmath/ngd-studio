"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 풀이 및 해설 편집 폼.
 * 기본 read-only 모드. "풀이 및 해설 편집" 버튼 클릭 시 편집 모드 진입.
 * 저장은 PUT /api/solver-json?q=N — 백엔드의 q{N}_solved.json을 덮어쓴다.
 */
export function SolutionEditor({
  qNum,
  initial,
  onSaved,
}: {
  qNum: number;
  initial: Record<string, unknown>;
  onSaved: (updated: Record<string, unknown>) => void;
}) {
  const [editMode, setEditMode] = useState(false);
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
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [dirty, isValid, saving, text, qNum, onSaved]);

  // Read-only 모드
  if (!editMode) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditMode(true)}
          className="h-7 text-xs"
        >
          풀이 및 해설 편집
        </Button>
        <pre className="text-xs p-3 bg-muted/30 rounded border overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(initial, null, 2)}
        </pre>
      </div>
    );
  }

  // 편집 모드
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setText(JSON.stringify(initial, null, 2));
            setDirty(false);
            setError(null);
            setEditMode(false);
          }}
          className="h-7 text-xs"
        >
          편집 취소
        </Button>
        <Button
          size="sm"
          disabled={!dirty || !isValid || saving}
          onClick={handleSave}
          className="h-7 text-xs"
        >
          {saving ? "저장 중…" : "풀이 및 해설 저장"}
        </Button>
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
