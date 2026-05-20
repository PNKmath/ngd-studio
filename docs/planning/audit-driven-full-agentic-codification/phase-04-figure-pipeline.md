---
phase: 4
title: figure processing pipeline — Python+agent 분리
status: pending
depends_on: [3]
scope:
  - ngd-studio/server/stages/figureRunner.ts
  - ngd-studio/server/stages/__tests__/figureRunner.test.ts
  - ngd-studio/server/stages/__tests__/fixtures/figure-cases/
  - figure_processor.py
  - .claude/agents/ngd-exam-figure.md
  - .claude/skills/ngd-exam-create/SKILL.md
intervention_likely: true
intervention_reason: "Gemini(nano-banana) API 통합 + ngd-exam-figure agent의 역할 재정의. crop 영역 부정확 판단을 agent에 남기는 boundary를 어디로 그을지 사용자 확인 필요."
---

# Phase 4: figure processing pipeline — Python+agent 분리

> **범위**: Backend (TS+Python) + agent 문서
> **난이도**: L
> **의존성**: Phase 3 (orchestrator 안정화 선행)
> **영향 파일**: `figureRunner.ts` (신규), `figure_processor.py` (확장), `ngd-exam-figure.md` (재작성)

## 배경

audit doc Group A5 + "agent fallback 필요 조건"의 마지막 항목 (crop 영역 부정확 시).

현재 `figure_processor.py` (197줄)가:
- `aspect_ratio_str` (line 29)
- `trim_and_watermark` (line 43)
- `generate_with_gemini` (line 71)
- `process_figure` (line 97)
- `main` (line 148)

5개 함수로 cropping, Gemini 호출, 워터마크, 트리밍을 수행. `.claude/agents/ngd-exam-figure.md`는 같은 절차를 자연어 + 호출 지시로 중복 기술.

**audit fallback 기준**:
- agent fallback 필요: figure crop 영역이 부정확해서 사람이 보는 수준의 판단이 필요한 경우
- agent fallback 불필요: 정상 경로 전체 (crop + Gemini call + watermark + trim)

본 phase는:
- TS runner(`figureRunner.ts`)가 `figure_processor.py`를 단일 entrypoint로 호출
- agent는 "crop 영역 재조정 판단"만 수행 (boundary 부정확 신호 받았을 때)
- skill에서 figure 관련 자연어 절차 제거

## 설계

### 1. `figure_processor.py` 인터페이스 명료화

기존 `main()`을 다음 CLI로 정리:

```bash
python3 figure_processor.py \
  --exam-data outputs/<sample>/exam_data.json \
  --output-dir outputs/<sample>/images/ \
  --status-out outputs/<sample>/figure_status.json \
  [--no-regen]   # crop+워터마크만 (Gemini skip)
  [--question N] # 특정 문제만 재처리
```

`figure_status.json` 스키마:
```json
{
  "status": "done" | "partial" | "failed",
  "questions": {
    "1": { "status": "ok", "image": "images/q01.png", "boundary_uncertain": false },
    "2": { "status": "boundary_uncertain", "crop_attempts": 1, "needs_agent_review": true },
    "3": { "status": "failed", "error": "gemini quota exceeded" }
  }
}
```

`boundary_uncertain` 판정 휴리스틱:
- 원본 crop 영역의 가로/세로 비율이 극단적(>5:1 또는 <1:5)
- 추출된 figure_info의 bbox가 페이지 경계와 닿음
- Gemini 응답 image dimensions가 입력과 50% 이상 차이

이 boolean을 보고 agent에 위임 여부 결정.

### 2. `ngd-studio/server/stages/figureRunner.ts` (신규)

```typescript
export interface FigureRunnerInput {
  examDataPath: string;
  outputDir: string;
  regenerate: boolean;          // false → crop+워터마크만
  signal: AbortSignal;
}

export interface FigureRunnerOutput {
  status: "done" | "partial" | "failed";
  statusJsonPath: string;
  needsAgentReview: number[];   // boundary_uncertain 문제 번호들
}

/**
 * figure_processor.py를 spawn. status JSON 파싱.
 * 정상 경로(boundary_uncertain=false 전부)는 agent 호출 없이 종료.
 * needsAgentReview > 0일 때만 ngd-exam-figure agent 호출 (호출자 책임).
 */
export async function runFigureStage(input: FigureRunnerInput): Promise<FigureRunnerOutput>;
```

### 3. `.claude/agents/ngd-exam-figure.md` 재작성

기존 자연어 절차(crop+watermark+trim+Gemini)는 제거. 다음 역할만 유지:

```markdown
## 역할
boundary_uncertain 플래그가 켜진 문제의 crop 영역을 재조정.
입력: 원본 PDF page + 현재 crop bbox + figure_status.json의 boundary_uncertain 사유
출력: 새 bbox JSON. 이후는 figureRunner가 figure_processor.py를 재호출.
```

호출은 figureRunner가 결과 받은 후 conditional하게 수행.

### 4. SKILL.md 수정

`## 작업 절차`의 figure 절을 한 줄 인용으로 대체:

```markdown
### Figure 처리
figureRunner(`ngd-studio/server/stages/figureRunner.ts`)가 figure_processor.py를 호출.
crop boundary 불확실 케이스만 ngd-exam-figure agent에 위임.
```

## 영향 범위

- 정상 경로 figure 처리: agent 호출 0회 (이전엔 매번)
- boundary_uncertain 케이스만 agent 1회 호출 (이전엔 항상 agent가 전 절차 진행)
- Gemini API key 관리: figureRunner가 env에서 직접 읽기 (`GEMINI_API_KEY`)
- 기존 `outputs/<sample>/figure_status.json` 스키마 확장(`boundary_uncertain`, `needs_agent_review` 필드 추가). 기존 소비자가 모르는 필드는 무시하므로 회귀 없음.

## 체크리스트

- [ ] coverage-matrix.md의 A5 행에서 본 phase 인용 확인
- [ ] `figure_processor.py` — CLI 인자(`--exam-data`, `--output-dir`, `--status-out`, `--no-regen`, `--question`) 표준화 + `boundary_uncertain` 휴리스틱 구현
- [ ] `figureRunner.ts` 신규 — `runFigureStage` + status JSON 파싱 + needsAgentReview 식별
- [ ] `figureRunner.test.ts` — fixture로 status JSON 3종(done/partial/failed) round-trip + spawn은 mock
- [ ] `__tests__/fixtures/figure-cases/` — 3개 figure_status.json fixture
- [ ] `ngd-exam-figure.md` 재작성 — boundary 재조정 역할만, 정상 경로 자연어 제거
- [ ] SKILL.md — figure 자연어 절차 제거, 코드 경로 인용 1줄로 대체
- [ ] **agentic→code 동치성 검증**:
  1. 기존 운영 sample의 figure_status.json(있다면) 1개를 fixture로 보존 → 신규 figure_processor.py로 재생성 → 동일 image path 산출
  2. `figureRunner.ts`가 `--no-regen` 모드에서 Gemini 호출 0회 (test에서 spawn 인자 캡처)
  3. boundary_uncertain=false인 케이스에서 agent 호출 0건 확인 (orchestrator log 캡처)

## 검증

```bash
# 1. Python script 단위
python3 -c "import figure_processor; print(hasattr(figure_processor, 'main'))"

# 2. TS 단위
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test server/stages/__tests__/figureRunner.test.ts --reporter=basic

# 3. SKILL.md / agent figure 자연어 잔존 점검
grep -nE "nano-banana|aspect_ratio|trim_and_watermark|generate_with_gemini" .claude/skills/ngd-exam-create/SKILL.md
# expected: 0 match (코드/agent 경로 인용 1줄 허용)

grep -nE "crop\|워터마크\|aspect ratio" .claude/agents/ngd-exam-figure.md | wc -l
# expected: boundary 재조정 관련만 (이전 절차 사라짐)

# 4. agentic→code 동치성 — 운영 sample이 있으면
ls outputs/_TEMPLATE_SHOWCASE* 2>/dev/null && \
  python3 figure_processor.py --exam-data outputs/<sample>/exam_data.json --output-dir /tmp/figure_test --status-out /tmp/figure_test/status.json --no-regen && \
  diff -q outputs/<sample>/images/ /tmp/figure_test/images/  # 빈 diff = parity
```
