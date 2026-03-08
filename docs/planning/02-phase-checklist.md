# NGD Studio — 페이즈별 체크리스트

> AI 주도 개발 진행 추적용. 각 항목 완료 시 `[x]`로 표기.

참조: [00-overview.md](./00-overview.md) | [01-design-system.md](./01-design-system.md) | [03-api-architecture.md](./03-api-architecture.md)

---

## Phase 0: 프로젝트 세팅

### 환경 구성
- [x] Next.js 15 프로젝트 생성 (App Router, TypeScript, Tailwind, pnpm)
- [x] shadcn/ui 초기화 + 기본 컴포넌트 설치 (Button, Card, Badge, Input, Tabs, Separator)
- [x] Pretendard 폰트 설치 및 적용 (Variable woff2, localFont)
- [x] JetBrains Mono 폰트 설치 및 적용 (next/font/google)
- [x] 디자인 시스템 CSS 변수 적용 (`01-design-system.md` 섹션 6) — 파스텔 라벤더 팔레트
- [x] Zustand 설치

### 프로젝트 구조
- [x] `app/` 디렉토리 구조 생성 (layout, create, review, history)
- [x] `components/` 디렉토리 구조 생성 (layout, pipeline, upload, log, shared)
- [x] `lib/` 디렉토리 구조 생성 (claude.ts, files.ts, store.ts)
- [x] `api/` 라우트 파일 생성 (스텁: upload, run, download, jobs)

### 확인
- [x] `pnpm build` 정상 빌드 확인
- [x] 페이지 라우팅 + 사이드바 레이아웃 확인

---

## Phase 1: 공통 기반

### 레이아웃
- [x] 사이드바 컴포넌트 (`Sidebar.tsx`)
  - [x] 네비게이션: 대시보드, 시험지 제작, 오검, 히스토리
  - [x] 활성 메뉴 하이라이트 (sidebar-accent 배경)
  - [x] 하단: 앱 버전 표시
- [x] 루트 레이아웃에 사이드바 + 메인 영역 배치 (`AppShell.tsx`)
- [x] 헤더 컴포넌트 (페이지 제목 + 빵부스러기) — `Header.tsx`

### 파일 업로드
- [x] `FileDropzone` 컴포넌트
  - [x] 드래그앤드롭 지원
  - [x] 파일 타입 필터 (PDF, HWPX, HWP)
  - [x] 업로드 진행률 표시
  - [x] 파일 목록 표시 + 삭제
- [x] `POST /api/upload` 라우트
  - [x] 파일 → `inputs/` 폴더 저장 (mode별 경로 분기)
  - [x] 파일 메타데이터 반환 (이름, 크기, 경로)

### 파이프라인 뷰어
- [x] `PipelineView` 컴포넌트
  - [x] 단계 목록 세로 배치 (5단계 / 오검은 1단계)
  - [x] 각 단계: 도트(stage color) + 이름 + 상태 + 진행 바
  - [x] 상태별 스타일: 대기(neutral) → 진행중(info) → 완료(success) → 실패(error)
- [x] `StageCard` 컴포넌트
  - [x] 단계 이름, 설명, 진행률(%), 소요시간
  - [x] 완료 시 결과 요약 텍스트

### 로그 스트림
- [x] `LogStream` 컴포넌트
  - [x] 다크 배경 터미널 스타일
  - [x] 자동 스크롤 (하단 고정, 수동 스크롤 시 해제)
  - [x] 타임스탬프 + 단계 라벨(색상) + 메시지
  - [x] 접기/펼치기 토글

### 결과 다운로드
- [x] `GET /api/download/[jobId]` 라우트
  - [x] `outputs/` 폴더에서 파일 스트리밍
- [x] 다운로드 버튼 컴포넌트 (`DownloadButton.tsx`)

### 확인
- [x] `pnpm build` 정상 빌드 (모든 라우트 포함)
- [x] PipelineView + LogStream 목 데이터 렌더링 — 대시보드 DemoPreview
- [x] 파일 업로드 API → inputs/ 저장 구현 완료
- [x] 로그 스트림 단계별 색상 + 자동스크롤 구현 완료

---

## Phase 2: 시험지 제작 UI

### 페이지 레이아웃
- [x] `app/create/page.tsx` 구현
  - [x] 좌측: 파일 업로드 영역 + 제작 시작 버튼 + 파일 상태 표시
  - [x] 우측: 파이프라인 뷰 (5단계)
  - [x] 하단: 중간 결과 탭 + 로그 스트림 (작업 시작 후 표시)

### CLI 연동
- [x] `POST /api/run` 라우트 구현
  - [x] Claude CLI spawn + stream-json 파싱 (`lib/claude.ts`)
  - [x] SSE(Server-Sent Events)로 클라이언트에 스트리밍
  - [x] 에러 핸들링 (CLI 실패, 비정상 종료)
- [x] 프론트 SSE 연결 + Zustand 스토어 업데이트 (`lib/useJobRunner.ts`)
- [x] 프롬프트 조립 로직 (`lib/prompts.ts` — create/review 분리)

### 스트림 파싱
- [x] Claude CLI stream-json 출력 → 구조화된 SSE 이벤트 변환 (`transformToSSE`)
  - [x] 단계 시작/완료 감지 — 텍스트 패턴 + tool_use 기반 이중 감지
  - [x] 진행률 추정 로직 (progress 이벤트)
  - [x] 로그 메시지 추출 (text + tool 호출 요약)
  - [x] 에러 메시지 추출

### 중간 결과 뷰어
- [x] 탭 컴포넌트: JSON | 이미지 | 요약 (`ResultTabs.tsx`)
- [x] JSON 파일 목록 뷰어
- [x] 이미지 갤러리 (그리드 레이아웃)
- [x] 결과 요약 (성공/실패 상태 + 텍스트)

### 완료 상태
- [x] 결과 요약 카드 (성공/실패 상태 표시)
- [x] HWPX 다운로드 버튼 (DownloadButton 재사용)
- [x] 작업 데이터 JSON 저장 (`data/jobs/{jobId}.json`)

### 확인
- [x] `pnpm build` 정상 빌드
- [x] 파이프라인 단계별 상태 전환 로직 구현 확인
- [x] 중간 결과 탭 전환 + 내용 표시 구현 확인
- [x] 에러 발생 시 UI 표시 구현 확인

---

## Phase 3: 오검 UI

### 페이지 레이아웃
- [x] `app/review/page.tsx` 구현
  - [x] 좌측: 파일 업로드 (원본 PDF + 작업 HWPX) + 검수 시작 버튼
  - [x] 우측: 진행 상태 (단일 단계 — PipelineView mode="review")
  - [x] 하단: 오검 리포트 + 로그 (2컬럼 레이아웃)

### CLI 연동
- [x] 오검 전용 프롬프트 조립 (`lib/prompts.ts` — buildReviewPrompt)
- [x] 기존 `/api/run` 재사용 (mode 파라미터로 구분)

### 오검 리포트 뷰어
- [x] `ReviewReport` 컴포넌트
  - [x] 수정 항목 리스트 (아이콘 + 설명 + 상태)
  - [x] 카테고리별 그룹핑 (수식/텍스트/스타일/그림/구조/기타)
  - [x] 통과/수정/경고 뱃지 (파스텔 상태색)
- [x] 리포트 파싱 로직 (`lib/reviewParser.ts` — parseReviewReport)
  - [x] 카테고리 자동 감지 (패턴 매칭)
  - [x] 상태 자동 감지 (수정됨/경고/통과)
  - [x] 요약 집계 (summarizeReport) + 카테고리 그룹핑 (groupByCategory)

### 완료 상태
- [x] 수정된 HWPX 다운로드 (DownloadButton 재사용)
- [x] 수정 내역 요약 (수정 N건, 경고 N건, 통과 N건)
- [x] 작업 데이터 JSON 저장 (기존 /api/run 로직)

### 확인
- [x] `pnpm build` 정상 빌드
- [x] 리포트 파싱 + 컴포넌트 렌더링 로직 구현 확인
- [x] 다운로드 + 요약 카드 구현 확인

---

## Phase 4: 완료 후 개입

### 추가 지시 입력
- [x] 작업 완료 후 채팅 입력 UI (`FollowupChat.tsx`) — 제작/오검 페이지 모두 적용
  - [x] 텍스트 입력 + 전송 버튼 (Enter 키 지원)
  - [x] 전송 중 로딩 스피너 + 비활성화
- [x] 추가 지시 → Claude CLI 재호출 (`POST /api/run/[jobId]/followup`)
- [x] 결과 업데이트 반영 (SSE 스트림 → 스토어 업데이트)

### 이전 작업 이어하기
- [x] 작업 ID 기반 데이터 저장 (`data/jobs/{id}.json` — followups 배열)
- [x] `GET /api/jobs` — 작업 목록 조회 (정렬, 페이지네이션)

### 확인
- [x] `pnpm build` 정상 빌드 (followup 라우트 포함)
- [x] FollowupChat SSE 연결 + 스토어 업데이트 로직 구현 확인

---

## Phase 5: 팀 사용성

### 작업 히스토리
- [ ] `app/history/page.tsx` 구현
  - [ ] 작업 목록 테이블 (날짜, 유형, 파일명, 상태, 소요시간)
  - [ ] 필터: 유형(제작/오검), 상태(완료/실패)
  - [ ] 작업 클릭 → 결과 상세 보기 + 다운로드

### 작업 큐
- [ ] 여러 작업 순차 실행 큐
- [ ] 큐 상태 표시 (대기 N건, 진행중 1건)
- [ ] 작업 취소 기능

### 대시보드
- [ ] `app/page.tsx` (메인 대시보드)
  - [ ] 최근 작업 목록 (최근 5건)
  - [ ] 빠른 시작 카드 (제작 / 오검)
  - [ ] 시스템 상태 (CLI 연결 확인)

### 배포
- [ ] 팀 서버 배포 스크립트
- [ ] 환경 변수 설정 가이드
- [ ] 사용 가이드 문서 (팀원용)

### 확인
- [ ] 히스토리 목록/필터 동작 확인
- [ ] 큐에 여러 작업 → 순차 실행 확인
- [ ] 다른 PC 브라우저에서 접속 확인

---

## 진행 상태 요약

| Phase | 항목 수 | 완료 | 상태 |
|---|---|---|---|
| 0: 프로젝트 세팅 | 12 | 12 | ✅ 완료 |
| 1: 공통 기반 | 23 | 23 | ✅ 완료 |
| 2: 시험지 제작 | 19 | 19 | ✅ 완료 |
| 3: 오검 | 12 | 12 | ✅ 완료 |
| 4: 완료 후 개입 | 6 | 6 | ✅ 완료 |
| 5: 팀 사용성 | 14 | 0 | ⬜ 미시작 |
| **합계** | **86** | **0** | |
