# NGD Studio — API 아키텍처

> Claude Code CLI 연동 및 서버-클라이언트 통신 설계

참조: [00-overview.md](./00-overview.md) | [02-phase-checklist.md](./02-phase-checklist.md)

---

## 1. Claude CLI 연동 방식

### 1.1 CLI 호출 형태

```bash
# 시험지 제작
claude -p "<프롬프트>" \
  --output-format stream-json \
  --allowedTools "Read,Write,Edit,Bash,Glob,Grep,Agent" \
  --max-turns 100

# 오검
claude -p "<프롬프트>" \
  --output-format stream-json \
  --allowedTools "Read,Write,Edit,Bash,Glob,Grep,Agent" \
  --max-turns 50
```

### 1.2 stream-json 출력 형식

Claude CLI는 `--output-format stream-json`으로 실행하면 줄 단위 JSON을 출력:

```jsonl
{"type":"system","subtype":"init","session_id":"...","tools":[...]}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{...}}]}}
{"type":"result","subtype":"success","result":"...","session_id":"..."}
```

### 1.3 TypeScript 래퍼

```typescript
// lib/claude.ts

import { spawn, ChildProcess } from 'child_process';

interface ClaudeEvent {
  type: 'system' | 'assistant' | 'result';
  subtype?: string;
  message?: {
    role: string;
    content: ContentBlock[];
  };
  result?: string;
  session_id?: string;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;    // tool name
  input?: unknown;
}

export function runClaude(
  prompt: string,
  options?: { maxTurns?: number; cwd?: string }
): {
  process: ChildProcess;
  events: AsyncIterable<ClaudeEvent>;
} {
  const proc = spawn('claude', [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--max-turns', String(options?.maxTurns ?? 100),
  ], {
    cwd: options?.cwd ?? process.cwd(),
  });

  const events = parseStreamJson(proc);
  return { process: proc, events };
}

async function* parseStreamJson(
  proc: ChildProcess
): AsyncIterable<ClaudeEvent> {
  let buffer = '';

  for await (const chunk of proc.stdout!) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch {
          // 파싱 불가한 줄은 로그로 처리
        }
      }
    }
  }
}
```

---

## 2. API 라우트

### 2.1 POST /api/upload

파일 업로드 → inputs/ 폴더 저장.

```typescript
// 요청
POST /api/upload
Content-Type: multipart/form-data
Body: { files: File[], mode: 'create' | 'review' }

// 응답
{
  "files": [
    { "name": "원본.pdf", "path": "inputs/시험지 제작/원본.pdf", "size": 1234567 },
    { "name": "양식.hwpx", "path": "inputs/시험지 제작/양식.hwpx", "size": 234567 }
  ]
}
```

저장 경로:
- `mode: 'create'` → `inputs/시험지 제작/`
- `mode: 'review'` → `inputs/오검/`

### 2.2 POST /api/run

작업 실행 → SSE 스트리밍.

```typescript
// 요청
POST /api/run
Content-Type: application/json
Body: {
  "mode": "create" | "review",
  "files": {
    "pdf": "inputs/시험지 제작/원본.pdf",
    "hwpx": "inputs/시험지 제작/양식.hwpx"
  },
  "jobId": "uuid"  // 클라이언트 생성
}

// 응답: SSE 스트림
Content-Type: text/event-stream

data: {"event":"stage","data":{"name":"reader","status":"running"}}
data: {"event":"log","data":{"stage":"reader","message":"PDF 페이지 1/4 처리중..."}}
data: {"event":"stage","data":{"name":"reader","status":"done","summary":"15개 문제 추출"}}
data: {"event":"stage","data":{"name":"solver","status":"running"}}
...
data: {"event":"result","data":{"status":"success","outputPath":"outputs/결과.hwpx"}}
```

### 2.3 GET /api/download/[jobId]

완성된 파일 다운로드.

```typescript
// 요청
GET /api/download/abc123

// 응답
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="결과.hwpx"
```

### 2.4 GET /api/jobs

작업 목록 조회.

```typescript
// 요청
GET /api/jobs?limit=20&offset=0

// 응답
{
  "jobs": [
    {
      "id": "abc123",
      "mode": "create",
      "status": "done",
      "inputFiles": ["원본.pdf", "양식.hwpx"],
      "outputFile": "outputs/결과.hwpx",
      "startedAt": "2026-03-08T10:30:00Z",
      "finishedAt": "2026-03-08T10:35:00Z",
      "summary": { "questions": 15, "figures": 3 }
    }
  ],
  "total": 42
}
```

### 2.5 POST /api/run/[jobId]/followup

완료된 작업에 추가 지시.

```typescript
// 요청
POST /api/run/abc123/followup
Body: {
  "instruction": "3번 문제 수식 다시 확인해줘"
}

// 응답: SSE 스트림 (동일 형태)
```

---

## 3. SSE 이벤트 스키마

클라이언트가 받는 이벤트 타입:

| 이벤트 | 데이터 | 설명 |
|---|---|---|
| `stage` | `{name, status, summary?}` | 단계 상태 변경 |
| `log` | `{stage, message, timestamp}` | 로그 메시지 |
| `progress` | `{stage, percent}` | 진행률 (추정) |
| `file` | `{type, name, path}` | 중간 파일 생성 (JSON, 이미지) |
| `result` | `{status, outputPath, summary}` | 작업 완료 |
| `error` | `{message, stage?}` | 에러 발생 |

---

## 4. 스트림 파싱 전략

Claude CLI의 raw JSON을 위 SSE 이벤트로 변환하는 로직:

### 4.1 단계 감지

```
텍스트에서 패턴 매칭:
- "reader" / "PDF" / "추출" → stage: reader
- "solver" / "해설" / "풀이" → stage: solver
- "figure" / "그림" / "이미지" / "crop" → stage: figure
- "builder" / "HWPX" / "조립" / "XML" → stage: builder
- "checker" / "검수" / "검증" → stage: checker
```

### 4.2 진행률 추정

단계별 예상 비중:

| 단계 | 비중 | 비고 |
|---|---|---|
| reader | 25% | 문제 수에 비례 |
| solver | 20% | 부실 해설 수에 비례 |
| figure | 25% | 그림 수에 비례 |
| builder | 20% | 고정 |
| checker | 10% | 고정 |

### 4.3 tool_use 활용

```
tool_use.name === "Read" && input.file_path에 ".pdf" → reader 진행중
tool_use.name === "Write" && input.file_path에 "exam_data.json" → reader 완료
tool_use.name === "Agent" && input에 "figure" → figure 진행중
tool_use.name === "Write" && input.file_path에 ".hwpx" 관련 → builder 진행중
```

---

## 5. 작업 저장소

### 5.1 로컬 JSON 파일 기반

초기에는 DB 없이 JSON 파일로 관리:

```
data/
├── jobs.json          # 작업 목록 인덱스
└── jobs/
    ├── abc123.json    # 개별 작업 상세 (로그, 결과 포함)
    └── def456.json
```

### 5.2 jobs.json 스키마

```typescript
interface Job {
  id: string;
  mode: 'create' | 'review';
  status: 'queued' | 'running' | 'done' | 'failed';
  inputFiles: string[];
  outputFile?: string;
  stages: StageStatus[];
  logs: LogEntry[];
  startedAt: string;
  finishedAt?: string;
  summary?: Record<string, unknown>;
}

interface StageStatus {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  summary?: string;
}

interface LogEntry {
  timestamp: string;
  stage: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}
```

### 5.3 향후 확장

필요 시 SQLite (better-sqlite3) 또는 Prisma + SQLite로 전환 가능.
JSON 스키마를 유지하면 마이그레이션 간단.

---

## 6. 프롬프트 조립

### 6.1 시험지 제작 프롬프트

```typescript
function buildCreatePrompt(files: { pdf: string; hwpx: string }): string {
  return `
inputs/시험지 제작/ 폴더에 있는 파일로 시험지를 제작해줘.
- 원본 PDF: ${files.pdf}
- 양식 HWPX: ${files.hwpx}
/ngd-exam-create 스킬을 실행해줘.
  `.trim();
}
```

### 6.2 오검 프롬프트

```typescript
function buildReviewPrompt(files: { pdf: string; hwpx: string }): string {
  return `
inputs/오검/ 폴더에 있는 파일로 오검을 진행해줘.
- 원본 PDF: ${files.pdf}
- 작업 HWPX: ${files.hwpx}
오검 체크리스트에 따라 검수하고 수정해줘.
  `.trim();
}
```

---

## 7. 에러 처리

| 상황 | 대응 |
|---|---|
| CLI 미설치 | 시작 시 `which claude` 체크 → 안내 메시지 |
| CLI 인증 만료 | stderr에서 감지 → "재로그인 필요" 알림 |
| CLI 비정상 종료 | exit code ≠ 0 → error 이벤트 발행 |
| 타임아웃 | 30분 제한 → 경고 후 프로세스 종료 |
| 동시 실행 초과 | 큐에 넣고 순차 실행 |
