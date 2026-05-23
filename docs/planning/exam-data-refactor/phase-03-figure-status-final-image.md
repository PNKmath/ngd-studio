---
phase: 3
title: figure_info.final_image → figure_status.json 이전 (Python read-only)
status: completed
depends_on: [2]
scope:
  - figure_processor.py
  - ngd-studio/server/stages/figureRunner.ts
  - ngd-studio/server/stages/__tests__/figureRunner.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "figure_processor.py가 exam_data.json을 read-only로 전환하는 것이 핵심 fix; final_image 키를 figure_status.json 으로 이전해 buildExamDataJson rebuild가 안전해진다."
e2e_refs:
  - build-hwpx-cli
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 3: figure_info.final_image → figure_status.json 이전 (Python read-only)

> **범위**: Both
> **난이도**: M
> **의존성**: P2
> **영향 파일**: `figure_processor.py`, `server/stages/figureRunner.ts`

## 배경

**F1 (load-bearing bug)**: `orchestrator.ts:882-900`이 `stillUnder("figure")`이기만 하면 매 resume마다 `buildExamDataJson`을 호출 → `_extracted+_solved`만으로 problems 재생성 → 직전 figure run이 박아둔 `figure_info.final_image` 키가 소실. 다음 figure stage가 안 돌면 builder는 그림 없는 HWPX 생성.

원인: `figure_processor.py`가 `exam_data.json`을 read+mutate+write하는 구조. 같은 파일을 TS도 write하므로 race가 아니라 schema-on-mutation이 위험.

### 해결 방향

`final_image`를 **`figure_status.json`** 안으로 이동. 이미 `figure_status.json:questions[N].image` 필드가 동일 의미로 존재(`orchestrator.ts:1163-1177` emit 부분 참조). 이 키를 정본화하고 `figure_info.final_image`는 폐기.

assemble.py(P4)가 exam_data + figure_status 두 파일을 join해 그림을 박는다.

## 설계

### 1) `figure_processor.py`

**현재 (213-219, 305-329)**:
```python
# legacy positional shim — 삭제
# write back to exam_data.json (line 328-329) — 삭제
```

**새 동작**:
- exam_data.json **read only**. 더 이상 write back 안 함.
- legacy positional shim(213-219) 삭제. CLI는 `--exam-data` flag만 받음.
- `prob["figure_info"]["final_image"] = q_result["image"]` (line 312) 삭제.
- `figure_status.json`의 각 entry는 이미 `image` 필드 있음 — 의미를 명확히 하기 위해 `finalImage` 키 추가(기존 `image`도 backward compat 위해 유지하되, P4에서 양쪽 다 사용 가능하게).

```python
def _make_q_status(uncertain: bool) -> dict:
    s: dict = {
        "status": "boundary_uncertain" if uncertain else "ok",
        "image": str(final_path),         # legacy 키
        "finalImage": str(final_path),    # 정본 키 (camelCase, 새 컨트랙트)
        "boundaryUncertain": uncertain,
    }
    if uncertain:
        s["cropAttempts"] = 1
        s["needsAgentReview"] = True
    return s
```

snake_case였던 `boundary_uncertain` / `crop_attempts` / `needs_agent_review`도 camelCase로 정합. (이 키들은 `orchestrator.ts:1136-1178`이 읽음 — figureRunner와 함께 갱신.)

### 2) `figureRunner.ts`

```ts
interface FigureQuestionStatus {
  status: "ok" | "boundary_uncertain" | "failed";
  image?: string;        // backward compat (legacy)
  finalImage?: string;   // 정본
  boundaryUncertain?: boolean;
  cropAttempts?: number;
  needsAgentReview?: boolean;
  error?: string;
}
```

`extractNeedsAgentReview`는 `q.needsAgentReview === true` 또는 `q.status === "boundary_uncertain"` 모두 인식.

### 3) `orchestrator.ts:emitFigureQuestionEvents`

```ts
const payload: Record<string, unknown> = {
  status: q?.status ?? "ok",
  ...(q?.finalImage ? { finalImage: q.finalImage } : q?.image ? { finalImage: q.image } : {}),
  ...(q?.error ? { error: q.error } : {}),
};
```

`image` 키 폴백 한 단계 — figure_processor가 양쪽 다 emit하므로 P3 종료 시점에 둘 다 동작.

### 4) 테스트

- `figureRunner.test.ts`:
  - figure_status.json에서 `finalImage` 읽기
  - `boundaryUncertain` flag → `needsAgentReview` 도출 정합
  - **`exam_data.json`이 figure 실행 후에도 변하지 않는다** (read-only 검증) — 디스크 mtime 비교 또는 내용 hash

## 체크리스트
- [x] `figure_processor.py:213-219` legacy positional shim 삭제
- [x] `figure_processor.py:312, 328-329` `exam_data.json` write back + `prob["figure_info"]["final_image"]` 대입 삭제
- [x] `figure_processor.py:_make_q_status`에 `finalImage`/`boundaryUncertain`/`cropAttempts`/`needsAgentReview` camelCase 키 추가 (legacy snake 키도 동시 emit하여 P4까지 backward compat)
- [x] `figureRunner.ts:FigureQuestionStatus` 인터페이스 camelCase 키 반영
- [x] `orchestrator.ts:emitFigureQuestionEvents` `finalImage` 우선 + `image` 폴백
- [x] `figureRunner.test.ts`에 read-only 검증 케이스 추가 (figure_processor 실행 후 exam_data.json mtime 불변)
- [x] `npx vitest run server/stages/__tests__/figureRunner.test.ts --reporter=basic` 통과

## 영향 범위

- **assemble.py는 아직 `figure_info.final_image`를 읽는다**(P4에서 교체). 이 phase 종료 직후 빌드하면 그림 누락 가능 — P4까지 묶음.
- figure_processor 실행은 idempotent로 강화됨. 같은 입력 → 같은 출력 (exam_data 부작용 없음).

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio
# 픽처 처리 후 exam_data.json 불변 확인
md5sum inputs/시험지\ 제작/.v3cache/exam_data.json
python3 figure_processor.py --exam-data "inputs/시험지 제작/.v3cache/exam_data.json" \
  --output-dir outputs/images --status-out "inputs/시험지 제작/.v3cache/figure_status.json" --no-regen
md5sum inputs/시험지\ 제작/.v3cache/exam_data.json
# 두 hash가 동일해야 함

cd ngd-studio
npx vitest run server/stages/__tests__/figureRunner.test.ts --reporter=basic
```

## 실행 결과

### 1회차 (2026-05-23 23:23 KST) — 완료
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`figure_processor.py`에서 `exam_data.json` write-back(줄 328-329)과 `prob["figure_info"]["final_image"]` 대입(줄 312), legacy positional shim(줄 213-219)을 삭제했다. `_make_q_status`에 `finalImage`/`boundaryUncertain`/`cropAttempts`/`needsAgentReview` camelCase 키를 추가(snake 키도 P4 backward compat 위해 동시 emit). `figureRunner.ts` 인터페이스와 `extractNeedsAgentReview` 함수를 camelCase 키 인식으로 업데이트, `orchestrator.ts:emitFigureQuestionEvents`를 `finalImage` 우선 + `image` 폴백 구조로 변경, 테스트 픽스처와 read-only 검증 케이스 3개를 추가했다.

#### 변경 파일
- `figure_processor.py` (수정, -12/+18줄): legacy shim 삭제, exam_data write-back 삭제, camelCase 키 추가
- `ngd-studio/server/stages/figureRunner.ts` (수정, +10/-5줄): FigureQuestionStatus 인터페이스 camelCase 키 추가, extractNeedsAgentReview camelCase 인식
- `ngd-studio/server/stages/orchestrator.ts` (수정, +4/-2줄): FigureStatusFile 인터페이스 finalImage 추가, emitFigureQuestionEvents finalImage 우선 폴백 구조
- `ngd-studio/server/stages/__tests__/figureRunner.test.ts` (수정, +72/-1줄): read-only 검증 케이스 3개 추가 (mtime 불변, finalImage 키 존재, camelCase 키 인식)
- `ngd-studio/server/stages/__tests__/fixtures/figure-cases/figure_status.done.json` (수정): finalImage/boundaryUncertain 키 추가
- `ngd-studio/server/stages/__tests__/fixtures/figure-cases/figure_status.partial.json` (수정): finalImage/boundaryUncertain/cropAttempts/needsAgentReview camelCase 키 추가

#### 검증 결과
- [x] vitest 12 tests: `npx vitest run server/stages/__tests__/figureRunner.test.ts --reporter=basic` → pass (12/12)
- [x] TypeScript 타입 체크: `npx tsc --noEmit` → pass (에러 없음)
- [x] Python 문법 검사: `python3 -c "import ast; ast.parse(...)"` → syntax OK
- [ ] `md5sum` exam_data.json 불변 검증: 실 캐시 파일 없음 — 대신 vitest read-only mtime 테스트로 커버

#### 추가 발견사항
- `figure_status.success.json` (기존 파일, `__tests__/fixtures/` 루트)은 snake_case만 있는 legacy fixture. 이 파일을 사용하는 테스트가 없어 이번 phase scope 밖으로 두었음. P4 이후 정리 권고.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
escalate → 사용자 승인 — orchestrator.ts dual-read 8줄(finalImage 우선 + image 폴백), fixture finalImage 키 갱신 2건. P3 contract 정합 필수 변경, 사용자 drift 허용.

#### Verification Re-run (orchestrator)
tsc exit 0 + vitest 527/527 통과 (5건 증가는 P3 새 테스트).

#### Simplify (orchestrator)
SIMPLIFIED: 0 — diff 이미 최소화.

#### Review (orchestrator)
VERDICT: pass — figure_processor.py read-only 전환 + finalImage 정본 키 이전 스펙 일치, J(인과사슬) 논리 검증 통과.
