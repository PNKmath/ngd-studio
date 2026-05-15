"use client";

export type MetaValue = {
  school: string;
  grade: number;
  subject: string;
  semester: string;
  examType: string;
  range: string;
};

export interface MetaFormProps {
  value: MetaValue;
  onChange: (next: MetaValue) => void;
  disabled?: boolean;
}

export function MetaForm({ value, onChange, disabled }: MetaFormProps) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <label className="text-xs text-muted-foreground">학교</label>
        <input
          type="text"
          value={value.school}
          onChange={(e) => onChange({ ...value, school: e.target.value })}
          placeholder="OO고등학교"
          disabled={disabled}
          className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">학년</label>
          <select
            value={value.grade}
            onChange={(e) => onChange({ ...value, grade: Number(e.target.value) })}
            disabled={disabled}
            className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value={1}>1학년</option>
            <option value={2}>2학년</option>
            <option value={3}>3학년</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">과목</label>
          <select
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value })}
            disabled={disabled}
            className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option>수학</option>
            <option>수학 I</option>
            <option>수학 II</option>
            <option>확률과 통계</option>
            <option>미적분</option>
            <option>기하</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">학기</label>
          <select
            value={value.semester}
            onChange={(e) => onChange({ ...value, semester: e.target.value })}
            disabled={disabled}
            className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option>1학기</option>
            <option>2학기</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">시험</label>
          <select
            value={value.examType}
            onChange={(e) => onChange({ ...value, examType: e.target.value })}
            disabled={disabled}
            className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option>중간</option>
            <option>기말</option>
            <option>모의</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">범위</label>
        <input
          type="text"
          value={value.range}
          onChange={(e) => onChange({ ...value, range: e.target.value })}
          placeholder="지수 ~ 삼각함수그래프"
          disabled={disabled}
          className="w-full mt-0.5 px-2 py-1.5 rounded-md border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
