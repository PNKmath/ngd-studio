# V3 프론트엔드 상세 설계

## 페이지 구조

### create-v3/page.tsx (신규)

V2의 `QuestionSlotGrid`를 재사용하되, 파이프라인 스테이지와 결과 표시를 V3에 맞게 변경.

```
┌──────────────────────────────────────────────────────┐
│  좌측 사이드바 (320px)                                 │
│  ┌──────────────────────────────────────────────┐    │
│  │ 시험지 메타 정보                                │    │
│  │  - 학교명, 학년, 과목 (수동 입력 or PDF에서 추출)  │    │
│  │  - 시험 범위                                   │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 제작 시작 / 중단 버튼                           │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 결과 카드 (완료 시)                             │    │
│  │  - 성공/실패 상태                               │    │
│  │  - 다운로드 버튼                                │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 참고사항 (기존 GuidePanel)                      │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  우측 메인 영역                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │ QuestionSlotGrid (V2 재사용)                    │    │
│  │  - 문제 수 조절 (기본 18, 1~30)                  │    │
│  │  - 슬롯별 이미지 붙여넣기/드래그                   │    │
│  │  - 슬롯별 상태 표시 (대기/추출중/완료/실패)         │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ PipelineView (스테이지 표시)                     │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 문제별 결과 + 로그                               │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## QuestionSlotGrid 확장

### 기존 (V2) 기능 — 재사용
- 문제 수 조절 (슬라이더)
- 슬롯별 파일 입력 (클릭, 드래그, Ctrl+V)
- 이미지 미리보기
- PDF → 첫 페이지 렌더링
- 호버 시 자동 선택 (Ctrl+V 즉시 붙여넣기)
- 삭제/교체 버튼

### V3 추가 기능

#### 슬롯별 상태 표시
각 슬롯에 현재 처리 상태를 시각적으로 표시:

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│  1번 ✓  │  │  2번 ⟳  │  │  3번 ✓  │  │  4번 ○  │
│ [이미지] │  │ [이미지] │  │ [이미지] │  │  비어있음 │
│ 추출완료 │  │ 해설생성중│  │ 검증완료 │  │         │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
```

상태 값:
- `empty` — 이미지 없음
- `ready` — 이미지 있음, 대기 중
- `extracting` — extractor 실행 중
- `solving` — solver 실행 중
- `verifying` — verifier 실행 중
- `retry` — verifier 실패, solver 재시도 중 (N/3)
- `done` — 완료
- `failed` — 최종 실패 (수동 검토 필요)

#### 슬롯별 결과 미리보기
완료된 슬롯 클릭 시 추출된 내용 확인:
- 문제 텍스트 (parts 렌더링)
- 해설 (explanation_parts 렌더링)
- verifier 검증 결과
- 재시도 횟수

---

## PipelineView 변경

### V1/V2 스테이지
```
reader → solver → figure → builder → checker
```

### V3 스테이지
```
extractor → solver → verifier → figure → builder → checker
```

각 스테이지에 진행률 표시:
- extractor: `4/18 완료`
- solver: `2/18 완료`
- verifier: `1/18 완료 (재시도 1건)`

---

## 문제별 결과 뷰 (신규)

작업 완료 후 문제별로 결과를 확인할 수 있는 탭:

```
┌─────────────────────────────────────────────┐
│ [1] [2] [3] [4] [5] ... [18]  ← 문제 탭     │
├─────────────────────────────────────────────┤
│ 문제 1                                       │
│ ┌─────────────┐  ┌──────────────────────┐   │
│ │ 원본 이미지   │  │ 추출 결과            │   │
│ │             │  │ 함수 f(x)=2^x의 ...  │   │
│ │             │  │                      │   │
│ │             │  │ [해설]               │   │
│ │             │  │ f(x)=2^x에서 y=4 ... │   │
│ └─────────────┘  └──────────────────────┘   │
│                                              │
│ 검증: ✓ pass (1회 통과)                       │
│ 단원: 지수함수 그래프(수1)                      │
│ 난이도: 중  배점: 4.2점                        │
└─────────────────────────────────────────────┘
```

---

## Store 확장 (useJobStore)

### 추가 상태
```typescript
interface JobState {
  // ... 기존 필드 유지

  // V3 추가
  questionSlots: QuestionSlot[];        // 문제별 상태
  questionResults: QuestionResult[];     // 문제별 결과
}

interface QuestionSlot {
  number: number;
  imagePath: string | null;
  status: "empty" | "ready" | "extracting" | "solving"
        | "verifying" | "retry" | "done" | "failed";
  retryCount: number;                   // verifier 재시도 횟수
}

interface QuestionResult {
  number: number;
  extracted: object | null;             // extractor 출력
  explanation: object | null;           // solver 출력
  verification: {
    status: "pass" | "fail";
    issues: string[];
    attempts: number;
  } | null;
}
```

---

## SSE 이벤트 확장

### 기존 이벤트 (유지)
- `stage` — 스테이지 상태 변경
- `log` — 로그 메시지
- `progress` — 진행률
- `file` — 파일 생성
- `result` — 최종 결과
- `error` — 에러

### V3 추가 이벤트
```json
// 문제별 상태 변경
{
  "event": "question",
  "data": {
    "number": 1,
    "status": "extracting",
    "retryCount": 0
  }
}

// 문제별 결과
{
  "event": "question_result",
  "data": {
    "number": 1,
    "extracted": { /* extractor JSON */ },
    "explanation": { /* solver JSON */ },
    "verification": { "status": "pass", "attempts": 1 }
  }
}
```

이 이벤트들은 `transformToSSE()`에서 Claude CLI 출력의 텍스트 패턴으로 감지하거나,
오케스트레이터가 명시적으로 출력하는 JSON 마커로 파싱.

---

## 라우팅 / 네비게이션

### Sidebar 변경
```
대시보드
시험지 제작        → /create      (V1, 유지)
시험지 제작 v2     → /create-v2   (V2, 유지)
시험지 제작 v3     → /create-v3   (신규)
오검 (오류검수)     → /review
히스토리           → /history
```

V3가 안정화되면 v1/v2를 제거하고 v3를 기본으로 승격.

---

## API 변경

### prompts.ts — buildCreateV3Prompt()

```typescript
export function buildCreateV3Prompt(
  files: {
    questionImages: { number: number; path: string }[];
    metadata?: { school?: string; year?: string; subject?: string; range?: string };
  }
): string {
  const lines = [
    "시험지를 제작해줘. V3 모드 (문제별 이미지 기반).",
    "",
    "## 문제 이미지",
    ...files.questionImages.map(
      (q) => `- ${q.number}번: ${q.path}`
    ),
  ];

  if (files.metadata) {
    lines.push("", "## 시험지 메타 정보");
    if (files.metadata.school) lines.push(`- 학교: ${files.metadata.school}`);
    if (files.metadata.year) lines.push(`- 연도: ${files.metadata.year}`);
    if (files.metadata.subject) lines.push(`- 과목: ${files.metadata.subject}`);
    if (files.metadata.range) lines.push(`- 범위: ${files.metadata.range}`);
  }

  lines.push("", 'Skill 도구로 "ngd-exam-create-v3" 스킬을 호출해서 진행해.');
  return lines.join("\n");
}
```

### sse.ts — V3 모드 라우팅

```typescript
// mode === "create-v3" 일 때 V3 프롬프트 사용
const prompt =
  mode === "create"
    ? buildCreatePrompt(wslFiles)
    : mode === "create-v3"
      ? buildCreateV3Prompt(wslFiles)
      : buildReviewPrompt(wslFiles);
```

---

## 관련 문서

- [01-overview.md](./01-overview.md) — 전체 개요
- [02-agents.md](./02-agents.md) — 에이전트 상세 설계
- [04-orchestrator.md](./04-orchestrator.md) — 오케스트레이터 / 병렬 처리
- [05-checklist.md](./05-checklist.md) — 구현 체크리스트
