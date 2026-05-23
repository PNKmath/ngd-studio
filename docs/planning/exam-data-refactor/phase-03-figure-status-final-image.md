---
phase: 3
title: figure_info.final_image → figure_status.json 이전 (Python read-only)
status: pending
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
- [ ] `figure_processor.py:213-219` legacy positional shim 삭제
- [ ] `figure_processor.py:312, 328-329` `exam_data.json` write back + `prob["figure_info"]["final_image"]` 대입 삭제
- [ ] `figure_processor.py:_make_q_status`에 `finalImage`/`boundaryUncertain`/`cropAttempts`/`needsAgentReview` camelCase 키 추가 (legacy snake 키도 동시 emit하여 P4까지 backward compat)
- [ ] `figureRunner.ts:FigureQuestionStatus` 인터페이스 camelCase 키 반영
- [ ] `orchestrator.ts:emitFigureQuestionEvents` `finalImage` 우선 + `image` 폴백
- [ ] `figureRunner.test.ts`에 read-only 검증 케이스 추가 (figure_processor 실행 후 exam_data.json mtime 불변)
- [ ] `npx vitest run server/stages/__tests__/figureRunner.test.ts --reporter=basic` 통과

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
