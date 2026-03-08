# NGD Studio — 프로젝트 개요

> Claude Code CLI 기반 시험지 제작/검수 로컬 웹 애플리케이션

## 문서 인덱스

| 문서 | 내용 |
|---|---|
| [00-overview.md](./00-overview.md) | 프로젝트 개요, 아키텍처 (현재 문서) |
| [01-design-system.md](./01-design-system.md) | 색상 팔레트, 타이포그래피, 컴포넌트 규칙 |
| [02-phase-checklist.md](./02-phase-checklist.md) | 페이즈별 체크리스트 + 진행 추적 |
| [03-api-architecture.md](./03-api-architecture.md) | CLI 연동, API 라우트, 데이터 흐름 |

---

## 1. 프로젝트 목적

팀원들이 CLI 없이 **브라우저에서** 시험지 제작/오검 작업을 수행할 수 있는 로컬 웹 도구.

### 핵심 가치
- **접근성**: CLI 경험 없는 팀원도 사용 가능
- **가시성**: 에이전트 진행 상태 + 중간 결과를 실시간 확인
- **완결성**: 파일 업로드 → 작업 실행 → 결과 다운로드까지 한 곳에서

## 2. 기술 스택

| 레이어 | 기술 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) | SSR + API Route + 스트리밍 |
| 언어 | TypeScript | 타입 안전성 |
| UI | shadcn/ui + Tailwind CSS v4 | 커스터마이징 자유도 |
| 폰트 | Pretendard (본문), JetBrains Mono (코드) | 한글 가독성 + 코드 가독성 |
| 상태관리 | Zustand | 가볍고 직관적 |
| CLI 연동 | child_process.spawn | Claude Code CLI stream-json |
| 패키지매니저 | pnpm | 빠르고 디스크 효율적 |

## 3. 아키텍처

```
┌─────────────────────────────────────────────┐
│                 브라우저 (React)              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ 제작 페이지│  │ 오검 페이지│  │ 히스토리  │ │
│  └─────┬────┘  └─────┬────┘  └───────────┘ │
│        │             │                       │
│        ▼             ▼                       │
│  ┌─────────────────────────┐                │
│  │   EventSource (SSE)     │  ← 실시간 스트림 │
│  └────────────┬────────────┘                │
└───────────────┼─────────────────────────────┘
                │ HTTP
┌───────────────┼─────────────────────────────┐
│  Next.js API Routes (서버)                   │
│               │                              │
│  ┌────────────▼────────────┐                │
│  │   Claude CLI Spawner    │                │
│  │   spawn('claude', [...])│                │
│  └────────────┬────────────┘                │
│               │ stream-json                  │
│  ┌────────────▼────────────┐                │
│  │   Stream Parser         │                │
│  │   → 단계/로그/결과 분류   │                │
│  └────────────┬────────────┘                │
│               │                              │
│  ┌────────────▼────────────┐                │
│  │   File Manager          │                │
│  │   inputs/ ↔ outputs/    │                │
│  └─────────────────────────┘                │
└──────────────────────────────────────────────┘
```

## 4. 핵심 워크플로우

### 시험지 제작
```
사용자: PDF + HWPX 업로드 → [제작 시작] 클릭
서버:   claude -p "시험지 제작" --output-format stream-json
UI:     reader → solver → figure → builder → checker 진행률 표시
완료:   HWPX 다운로드 + 결과 요약 + 추가 지시 가능
```

### 오검 (오류검수)
```
사용자: 원본 PDF + 작업 HWPX 업로드 → [검수 시작] 클릭
서버:   claude -p "오검" --output-format stream-json
UI:     검수 진행률 + 오검 리포트 표시
완료:   수정된 HWPX 다운로드 + 수정 내역 + 추가 지시 가능
```

## 5. 디렉토리 구조

```
ngd-studio/
├── app/
│   ├── layout.tsx                # 루트 레이아웃 (사이드바)
│   ├── page.tsx                  # 대시보드 (최근 작업)
│   ├── create/
│   │   └── page.tsx              # 시험지 제작
│   ├── review/
│   │   └── page.tsx              # 오검
│   └── history/
│       └── page.tsx              # 작업 히스토리
├── api/
│   ├── run/route.ts              # CLI 실행 + SSE 스트리밍
│   ├── upload/route.ts           # 파일 업로드
│   ├── download/[id]/route.ts    # 결과 다운로드
│   └── jobs/route.ts             # 작업 목록 조회
├── components/
│   ├── layout/                   # Sidebar, Header
│   ├── pipeline/                 # PipelineView, StageCard
│   ├── upload/                   # FileDropzone
│   ├── log/                      # LogStream
│   └── shared/                   # Button, Card, Badge 등
├── lib/
│   ├── claude.ts                 # CLI spawn + stream 파싱
│   ├── files.ts                  # 파일 I/O 유틸
│   └── store.ts                  # Zustand 스토어
├── public/
│   └── fonts/
├── tailwind.config.ts
└── package.json
```

## 6. 배포 방식

| 방식 | 장점 | 단점 |
|---|---|---|
| **팀 공용 서버 (추천)** | 설치 1회, 모두 접속 | 서버에 Claude CLI 필요 |
| 각자 로컬 | 독립적 | 각자 CLI 설치 필요 |

초기에는 개발자 로컬에서 개발하고, 안정화 후 팀 서버에 배포.

## 7. 제약사항

- Claude Code CLI가 설치되어 있어야 함
- CLI 인증 세션이 유효해야 함
- 동시 작업 수는 CLI 동시 실행 제한에 의존
- HWPX 미리보기는 XML 기반 간이 렌더링 (한글 프로그램 수준은 불가)
