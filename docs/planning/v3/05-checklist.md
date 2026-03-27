# V3 구현 체크리스트

## Phase 0: 준비

- [x] `feat/exam-v3` 브랜치에서 작업
- [ ] `/tmp/v3/` 작업 디렉토리 구조 확인

---

## Phase 1: 에이전트 작성

### 1-1. ngd-exam-extractor (신규)
- [x] `.claude/agents/ngd-exam-extractor.md` 작성
  - [x] 역할/입출력 정의
  - [x] 이미지 기반 추출 규칙 (parts 배열 형식)
  - [x] HWP 수식 문법 참조 (hwp-equation 스킬)
  - [x] 단원분류표 참조 규칙
  - [x] JSON 출력 형식 (number, type, score, parts, choices, answer, figure_info)
  - [x] [UNCLEAR] 처리 규칙
- [ ] 단독 테스트: 이미지 1장 → JSON 추출 확인

### 1-2. ngd-exam-verifier (신규)
- [x] `.claude/agents/ngd-exam-verifier.md` 작성
  - [x] 검증 항목 A: 수학적 정확성 (답 역산, 중간 계산, 완결성)
  - [x] 검증 항목 B: 교과 범위 준수
  - [x] 검증 항목 C: 서식 규칙 (guidelines-answer.md)
  - [x] 검증 항목 D: 원본 이미지 대조
  - [x] pass/fail 출력 형식
  - [x] fail 시 feedback 형식 (solver 재호출용)
- [ ] 단독 테스트: 정상 해설 → pass, 오류 해설 → fail + feedback

### 1-3. ngd-exam-solver 수정
- [x] 문제별 독립 호출 지원 (입력 형식 변경)
- [x] 교과 순서 컨텍스트 입력 처리
- [x] 난이도별 줄 수 제한 제거
- [x] verifier feedback 반영하여 재생성 지원
- [ ] 단독 테스트: extractor JSON → 해설 JSON

---

## Phase 2: 오케스트레이터

### 2-1. ngd-exam-create-v3 스킬 (신규)
- [x] `.claude/skills/ngd-exam-create-v3/SKILL.md` 작성
  - [x] Phase 1 병렬 처리 흐름 (4개씩 배치)
  - [x] extractor → solver → verifier 루프 (최대 3회)
  - [x] 교과 컨텍스트 생성 로직
  - [x] Phase 2 순차 처리 (figure → builder → checker)
  - [x] JSON 취합 로직
  - [x] 에러 처리 (문제별/배치별/전체)
  - [x] 결과 리포트 출력 형식

### 2-2. 오케스트레이터 테스트
- [ ] 2문제로 소규모 테스트 (병렬 없이 순차)
- [ ] 4문제로 병렬 배치 테스트
- [ ] verifier 재시도 루프 테스트 (의도적 오류 해설)
- [ ] figure 포함 문제 테스트
- [ ] 전체 18문제 통합 테스트

---

## Phase 3: 프론트엔드

### 3-1. create-v3 페이지
- [x] `ngd-studio/app/create-v3/page.tsx` 작성
  - [x] 시험지 메타 정보 입력 (학교, 학년, 과목, 범위)
  - [x] QuestionSlotGrid 연동
  - [x] 제작 시작/중단 버튼
  - [x] 결과 카드 + 다운로드
  - [ ] 참고사항 GuidePanel

### 3-2. QuestionSlotGrid 확장
- [ ] 슬롯별 상태 표시 (extracting, solving, verifying, retry, done, failed)
- [ ] 상태별 시각적 피드백 (색상, 아이콘, 진행 표시)
- [ ] 완료된 슬롯 클릭 시 결과 미리보기

### 3-3. PipelineView 변경
- [x] V3 스테이지 추가 (extractor, solver, verifier, figure, builder, checker)
- [ ] 스테이지별 진행률 표시 (N/18 완료)

### 3-4. 문제별 결과 뷰 (신규)
- [ ] 문제 탭 네비게이션
- [ ] 원본 이미지 / 추출 결과 비교 뷰
- [ ] 해설 렌더링
- [ ] 검증 결과 표시

### 3-5. Store 확장
- [x] `create-v3` 모드 및 스테이지 추가
- [ ] `questionSlots` 상태 추가
- [ ] `questionResults` 상태 추가
- [ ] SSE 이벤트 핸들러: `question`, `question_result`

### 3-6. Sidebar/라우팅
- [x] `/create-v3` 라우트 추가
- [x] Sidebar에 "시험지 제작 v3" 메뉴 추가

---

## Phase 4: 백엔드

### 4-1. prompts.ts
- [x] `buildCreateV3Prompt()` 함수 추가
- [x] 문제 이미지 경로 목록 + 메타 정보 포맷팅
- [x] WSL 경로 변환 적용

### 4-2. sse.ts
- [x] `mode === "create-v3"` 라우팅 추가
- [ ] V3 SSE 이벤트 (`question`, `question_result`) 변환
- [x] 스테이지 감지 패턴 추가 (extractor, verifier)

### 4-3. claude.ts
- [x] `agentTypeToStage`에 extractor, verifier 추가
- [x] 텍스트 패턴 매핑 추가

### 4-4. useJobRunner.ts
- [x] `startJob("create-v3", ...)` 지원
- [ ] V3 SSE 이벤트 핸들링

---

## Phase 5: 통합 테스트

### 5-1. 기능 테스트
- [ ] 프론트엔드에서 이미지 업로드 → 제작 시작 → 완료 → 다운로드
- [ ] 중단 버튼 동작 확인
- [ ] 문제별 상태 표시 확인
- [ ] verifier 재시도 동작 확인
- [ ] 실패 문제 처리 확인

### 5-2. 품질 테스트
- [ ] 생성된 HWPX를 한컴오피스에서 열어 확인
- [ ] 수식 렌더링 확인
- [ ] 해설 내용 정확성 확인
- [ ] 교과 범위 준수 확인

### 5-3. 비교 테스트
- [ ] 동일 시험지를 V1과 V3로 각각 제작
- [ ] 문제 왜곡 비교
- [ ] 해설 품질 비교
- [ ] 소요 시간 비교

---

## Phase 6: 자동 크롭 (마지막)

- [ ] PDF → 페이지별 이미지화 (PyMuPDF, 200dpi)
- [ ] 문제 번호 패턴 감지 (①②③... 또는 1. 2. 3.)
- [ ] 문제 영역 자동 분리
- [ ] 분리된 이미지를 QuestionSlotGrid에 자동 채우기
- [ ] 수동 보정 UI (크롭 영역 드래그 조절)

---

## 구현 순서 요약

```
Phase 1 (에이전트)        ← 먼저: 핵심 로직
  1-1 extractor          ✅ 완료
  1-2 verifier           ✅ 완료
  1-3 solver 수정         ✅ 완료

Phase 2 (오케스트레이터)   ← 에이전트 연결
  2-1 스킬 작성           ✅ 완료
  2-2 테스트              ⬜ 미진행

Phase 4 (백엔드)          ← 서버 연결
  4-1~4-4                ✅ 완료

Phase 3 (프론트엔드)      ← UI 연결
  3-1 페이지              ✅ 완료
  3-2~3-5 확장            ⬜ 일부 미진행
  3-6 라우팅              ✅ 완료

Phase 5 (통합 테스트)     ← 전체 검증
                         ⬜ 미진행

Phase 6 (자동 크롭)       ← 마지막
                         ⬜ 미진행
```

---

## 참조 파일

| 파일 | 용도 |
|------|------|
| `.claude/data/unit_classification.json` | 교과 단원 분류 |
| `.claude/skills/hwp-equation/` | HWP 수식 문법 |
| `docs/guidelines-answer.md` | 해설/정답 규칙 |
| `docs/guidelines-layout.md` | 레이아웃/서식 규칙 |
| `docs/guidelines-clause.md` | 단서 조항 규칙 |
| `docs/guidelines-filename.md` | 파일명/머리말/단원 규칙 |
| `.claude/agents/ngd-exam-extractor.md` | extractor 에이전트 (신규) |
| `.claude/agents/ngd-exam-verifier.md` | verifier 에이전트 (신규) |
| `.claude/agents/ngd-exam-solver.md` | solver 규칙 (V3 수정) |
| `.claude/agents/ngd-exam-figure.md` | figure 에이전트 (유지) |
| `.claude/agents/ngd-exam-builder.md` | builder 에이전트 (유지) |
| `.claude/agents/ngd-exam-checker.md` | checker 에이전트 (유지) |
| `.claude/skills/ngd-exam-create/SKILL.md` | V1 오케스트레이터 (참고) |
| `.claude/skills/ngd-exam-create-v3/SKILL.md` | V3 오케스트레이터 (신규) |
| `ngd-studio/components/upload/QuestionSlotGrid.tsx` | V2 슬롯 UI (재사용) |

---

## 관련 문서

- [01-overview.md](./01-overview.md) — 전체 개요
- [02-agents.md](./02-agents.md) — 에이전트 상세 설계
- [03-frontend.md](./03-frontend.md) — 프론트엔드 상세 설계
- [04-orchestrator.md](./04-orchestrator.md) — 오케스트레이터 / 병렬 처리
