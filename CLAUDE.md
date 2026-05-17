# NGD 기출 시험지 작업 프로젝트

이 폴더는 수학 기출 시험지를 HWPX 포맷으로 **제작**하고 **검수(오검)**하는 전용 작업 폴더다.

## 폴더 구조

```
inputs/
  시험지 제작/    원본 PDF + HWPX 양식지
  오검/           원본 PDF + 작업된 HWPX (검수 대상)
outputs/           완성된 HWPX + images/ (생성 그림)
.claude/
  data/
    unit_classification.json  과목별 단원분류표 (양식지 8p에서 추출)
  skills/          작업 스킬 3개
    hwp-equation/    HWP 수식 문법 레퍼런스 (자동 로딩)
    ngd-exam-create/ 시험지 제작 워크플로우
    ngd-exam-review/ 오검 워크플로우 + 체크리스트
  agents/          작업 에이전트 7개
    ngd-exam-extractor.md PDF 이미지 1장 → 문제 JSON
    ngd-exam-solver.md    해설 생성
    ngd-exam-verifier.md  해설 독립 검증 (↔ solver 최대 3회)
    ngd-exam-figure.md    그림 처리 (nano-banana)
    ngd-exam-builder.md   JSON → HWPX 조립
    ngd-exam-checker.md   AI 생성 HWPX 품질 검수
    ngd-exam-reviewer.md  오검 에이전트
```

## 핵심 작업 2가지

### 1. 시험지 제작

- **오케스트레이터**: `ngd-exam-create` 스킬 → extractor 병렬 + solver/verifier 병렬 + figure/builder/checker 순차 호출
- **입력**: `inputs/시험지 제작/`의 스캔 PDF + 양식지 HWPX
- **출력**: `outputs/`에 완성된 HWPX
- **흐름**:
  ```
  [Phase 1-A] ngd-exam-extractor (병렬, 8문제 배치): 이미지 1장 → 문제 JSON (.v3cache/q{N}_extracted.json)
  [추출 편집]                  : 사용자가 프론트엔드에서 추출 결과 직접 수정
  [Phase 1-B] ngd-exam-solver + ngd-exam-verifier (병렬): 해설 생성 + 독립 검증 (최대 3회)
  [Phase 2] 순차 처리:
    [4] ngd-exam-figure  : 그림 처리 (nano-banana)
    [5] ngd-exam-builder : JSON + 이미지 → HWPX 조립 + 후처리(fix_namespaces.py) + 검증(validate.py)
    [6] ngd-exam-checker : HWPX 품질 검수 → 피드백 루프
  ```

#### 신규 흐름 vs legacy 흐름

- **신규 흐름 (코드 기반 orchestrator)**: `ngd-studio/server/stages/orchestrator.ts` (`runStageOrchestrator`)가 stage들을 결정론적으로 실행. `/settings`에서 `create.*` stage override가 하나라도 지정되면 자동 선택 (`shouldUseCodeOrchestrator`).
- **legacy 흐름 (Claude CLI + skill)**: `/settings`에서 create.* stage override 미지정 또는 `auto` provider일 때 기존 `runLegacyPromptJob` → `ngd-exam-create` 스킬 경로. Claude CLI 구독자는 이 경로로 토큰 추가 과금 없이 사용 가능.
- **선택 기준**: `/settings` 페이지에서 create.extractor / create.solver / create.verifier 등 stage override 지정 여부. 하나라도 지정 시 → 신규 TS orchestrator; 미지정(또는 전부 `auto`) 시 → legacy Claude CLI 경로.

### 2. 오검 (오류검수)

- **스킬**: `ngd-exam-review` / **에이전트**: `ngd-exam-reviewer`
- **입력**: `inputs/오검/`의 원본 PDF + 작업 HWPX
- **출력**: 수정된 HWPX + 오검 리포트
- **흐름**: PDF 읽기 → HWPX 파싱 → 내용 비교 → 체크리스트 검증 → HWPX 직접 수정 → 후처리 → 리포트

## HWPX 포맷

- HWPX = ZIP + XML 구조 (한컴오피스 개방형 포맷)
- 핵심 파일: `Contents/section0.xml` (본문), `Contents/masterpage0.xml` (머릿말), `Contents/content.hpf` (매니페스트)
- 이미지: `BinData/` 폴더에 저장, `content.hpf`에 등록, `section0.xml`에 `<hp:pic>`으로 참조
- ZIP-level XML 조작으로 문서를 생성/편집한다
- **네임스페이스 후처리(`fix_namespaces.py`) 필수** — 수정 후 반드시 실행

## 수식

- HWP 수식은 `<hp:equation><hp:script>` 안에 HWP 전용 문법으로 작성
- 상세 문법 및 NGD 작업 규칙은 `hwp-equation` 스킬 참조
- 핵심 규칙 요약:
  - 단위/도형 대문자 → `rm`체 (예: `rmA`, `150``rm kg`)
  - 순열/조합/확률/분포 → `{rmP}`, `{rmC}`, `{rmN}{it(m,~sigma^2)}`
  - **왼쪽 첨자는 LSUB/LSUP 필수**: `{rmP}_{r} LSUB {n}` (`_`로 시작하면 렌더링 실패)
  - 내적 → `cdot` (bullet 아님)
  - 쉼표 뒤 `~`, 분수 괄호 `left(` `right)`
  - cdots 양쪽 `` ` ``
  - 통수식 금지 — 등호 단위로 끊기

## 그림 처리

- 그림이 있는 문제는 PDF에서 해당 영역을 crop → `nano-banana` 스킬(Gemini)로 깔끔하게 재생성
- 재생성 후 상하 여백 트리밍 + 오른쪽 하단에 "NGD" 워터마크 (작고 연한 회색)
- 최종 이미지를 HWPX의 `BinData/`에 삽입
- PDF 변환: PyMuPDF(`fitz`) 사용, dpi=72(확인용) / dpi=200(crop용)

## 작업 규칙

- 원본 PDF 내용과 100% 일치해야 한다
- 서체: 나눔고딕 10, 수식크기 11, 수식서체 HYhwpEQ
- F6 스타일: 바탕글 1개만
- 정답 bold 금지
- 미주와 문제 사이 띄어쓰기 없음
- shift+enter 사용금지 (정답 라인 2줄일 때만 허용)
- 선지: 탭키 3번 간격
- 서술형: `[서술형 N]` 형식
- 그림: 모든 생성 그림에 NGD 워터마크 필수
- 파일명: `[코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]`

## ngd-studio 개발 환경

- **개발 OS**: macOS (단일)
- **배포 타깃**: Windows / macOS 양쪽에서 동작해야 함 — 작성하는 모든 Node/Next.js 코드는 두 OS에서 동등하게 작동해야 한다.

### 개발 시 허용 명령

- `pnpm install` / `pnpm add` / `pnpm dev` / `pnpm build` — Mac에서 자유롭게 실행
- `npx tsc --noEmit` — 타입 검증
- `npx vitest run <file> --reporter=basic` — 단위 테스트

### 크로스 플랫폼 코드 규칙 (Windows + macOS 양쪽 동작 필수)

- **Python 실행**: `process.platform === "win32" ? "python" : "python3"` 패턴 사용 (`app/api/pdf-meta/route.ts:41` 참고)
- **경로 조합**: 반드시 `path.join` / `path.resolve` 사용. 문자열 `"/"` 하드코딩 금지.
- **셸 호출**: `child_process.spawn` 사용 시 `shell: true`는 피하고 인자는 배열로. `.bat`/`.cmd` 호출이 필요하면 OS 분기 또는 cross-spawn 사용.
- **줄바꿈**: 코드 파일은 LF. `.gitattributes` / `.editorconfig`로 강제.
- **파일 권한**: `chmod`에 의존하는 동작 금지 (Windows에서 무시됨).
- **임시 파일 경로**: `os.tmpdir()` 사용. `/tmp` 하드코딩 금지.
- **환경 변수**: 홈 디렉터리는 Windows `process.env.USERPROFILE` / Unix `process.env.HOME` — 둘 다 처리.
- **Python 스크립트** (`workspaces/crop/*.py` 등): pathlib 사용, `os.sep` 의존 금지, encoding 명시(`encoding="utf-8"`).
