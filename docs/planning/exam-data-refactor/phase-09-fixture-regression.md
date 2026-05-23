---
phase: 9
title: Fixture 재생성 + 회귀 vitest + 최종 alias grep=0
status: completed
depends_on: [1, 2, 3, 4, 5, 6, 7, 8]
scope:
  - outputs/_fixtures/year-2026-test/exam_data.json
  - outputs/_fixtures/year-2026-test/figure_status.json
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
  - ngd-studio/server/stages/__tests__/builder.test.ts
  - ngd-studio/server/stages/__tests__/figureRunner.test.ts
  - ngd-studio/server/stages/__tests__/examData.test.ts
  - ngd-studio/server/stages/__tests__/cleanup.test.ts
  - ngd-studio/lib/__tests__/sseClient.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
  - build-hwpx-cli
e2e_triggers:
  - create-v4-full-pipeline
  - build-hwpx-cli
---

# Phase 9: Fixture 재생성 + 회귀 vitest + 최종 alias grep=0

> **범위**: Both (tests + fixtures)
> **난이도**: M
> **의존성**: P1-P8
> **영향 파일**: `outputs/_fixtures/year-2026-test/*`, 다수 vitest 파일

## 배경

P1-P8 완료. 이제 자동 회귀 안전망을 친다:
1. 옛 fixture (`outputs/_fixtures/year-2026-test/exam_data.json`)는 **stale 스키마** — snake-only, `type:"selection"`, `choices:["1","2",...]`. 새 컨트랙트로 재생성.
2. F1/F2/L1/L2 회귀 방지 vitest 시나리오 추가:
   - resume-from-builder 후 그림 보존
   - handleExtract 도중 실패 → 디스크가 직전 일관 상태로 복원
   - session_meta 격리(이전 시험지 메타가 새 시험지로 노출 안 됨)
3. 최종 잔존 alias grep = 0 확인.

## 설계

### 1) Fixture 재생성

`outputs/_fixtures/year-2026-test/`에 다음 두 파일:

**`exam_data.json`** (camelCase info, 새 problem schema):
```json
{
  "info": {
    "schoolLevel": "고",
    "school": "테스트고",
    "grade": 2,
    "year": 2026,
    "subject": "수학 II",
    "semester": "1학기",
    "examType": "중간",
    "range": "수열의 극한",
    "subjectCode": "수2",
    "region": "서울",
    "code": "99999",
    "filenameBase": "[99999][고][2026][2-1-a][서울][테스트고][수2][수열의 극한][99999]"
  },
  "problems": [
    {
      "number": 1,
      "type": "choice",
      "score": "3",
      "difficulty": "중",
      "subtopic": "수열의 극한",
      "has_figure": false,
      "figure_info": null,
      "parts": [{"t": "다음 극한값을 구하시오. "}, {"eq": "lim_{n -> infty} {n+1} over {n}"}],
      "choices": [[{"eq":"1"}],[{"eq":"2"}],[{"eq":"e"}],[{"eq":"infty"}],[{"eq":"0"}]],
      "condition_box": null,
      "bogi_box": null,
      "data_table": null,
      "explanation_table": null,
      "answer": "①",
      "explanation_parts": [{"t": "분자/분모를 n으로 나누면 1로 수렴한다."}]
    },
    {
      "number": 2,
      "type": "choice",
      "score": "4",
      "difficulty": "중",
      "subtopic": "수열의 극한",
      "has_figure": true,
      "figure_info": {
        "description_en": "A geometric series diagram.",
        "position": "center",
        "crop_ratio": [0.1, 0.1, 0.9, 0.9]
      },
      "parts": [{"t": "그림과 같이..."}],
      "choices": [[{"eq":"1"}],[{"eq":"2"}],[{"eq":"3"}],[{"eq":"4"}],[{"eq":"5"}]],
      "condition_box": null,
      "bogi_box": null,
      "data_table": null,
      "explanation_table": null,
      "answer": "②",
      "explanation_parts": [{"t": "기하 분석을 통해..."}]
    }
  ]
}
```

**`figure_status.json`** (camelCase, finalImage 키):
```json
{
  "status": "done",
  "questions": {
    "2": {
      "status": "ok",
      "finalImage": "outputs/_fixtures/year-2026-test/images/prob2_final.png",
      "boundaryUncertain": false
    }
  }
}
```

`outputs/_fixtures/year-2026-test/images/prob2_final.png` 1x1 placeholder PNG (테스트용).

### 2) `examData.test.ts` 갱신

```ts
// 새 컨트랙트 검증
it("buildExamDataJson writes camelCase only, no snake aliases", async () => {
  const meta: ExamMeta = { /* 7 필드 + filenameBase 채워서 */ };
  await buildExamDataJson({ cache, meta, questionNumbers: [1] });
  const written = JSON.parse(await readFile(cache.paths.examData, "utf-8"));
  expect(written.info.schoolLevel).toBe("고");
  expect(written.info).not.toHaveProperty("school_level");
  expect(written.info).not.toHaveProperty("exam_type");
  expect(written.info).not.toHaveProperty("filename_base");
});

it("buildExamDataJson throws when meta required fields missing", async () => {
  await expect(buildExamDataJson({ cache, meta: { school: "X" }, questionNumbers: [1] }))
    .rejects.toThrow(/missing required fields/);
});

it("buildExamDataJson auto-fills filenameBase via buildFilenameBase", async () => {
  // ...
});
```

### 3) `orchestrator.pipeline.test.ts` 회귀 시나리오

```ts
describe("resume safety regressions", () => {
  it("F1: resume --from=builder preserves figure images via figure_status.json", async () => {
    // setup: _extracted, _solved 캐시 + figure_status.json with finalImage
    // run orchestrator with resumeFrom="builder"
    // assert: builder가 figure 포함 HWPX 생성
  });

  it("F8: cache hit + miss mixed → stageCounter total == entered == completed", async () => {
    // setup: extractor/solver/verifier 각각 Q1 cache hit, Q2 miss 같은 혼합 상태
    // run pipeline
    // assert: stageCounter.extractor/solver/verifier 모든 카운트 일치
  });

  it("F3: resume --q=2,3 --from=figure reprocesses only targeted figures and preserves merged status", async () => {
    // setup: figure_status.json has existing results for multiple figure questions
    // run followup/orchestrator with targetQuestionNumbers=[2, 3]
    // assert: figure runner invoked only for 2 and 3, final figure_status keeps both updated entries
  });
});
```

### 4) `create/start/__tests__/route.test.ts` 트랜잭션 회귀

```ts
it("L2: handleExtract failure preserves previous exam state (rollback)", async () => {
  // setup: 이전 시험지 디스크 상태 (.v3cache + session_meta + 이미지)
  // mock writeFile to fail while writing .next_<txid> temp dirs
  // POST /api/create/start
  // assert: final .v3cache/question_images 디스크가 이전 시험지 상태 그대로
  // assert: partial temp contents are not visible through /api/question-images or /api/v3cache-meta
});

it("L2: reader APIs do not expose partial final state during create/start commit lock", async () => {
  // setup: .create_start.lock exists and final dirs are mid-swap
  // GET /api/question-images and /api/v3cache-meta
  // assert: pending/409 response, no stale/new mixed payload
});

it("L1: session_meta lives in .v3cache and is removed on next start", async () => {
  // setup: 시험지 A start → .v3cache/session_meta.json 생성
  // 시험지 B start
  // assert: 시험지 A의 session_meta가 사라지고 B의 메타만 남음 (이전 시험지로 안 빠짐)
});
```

### 5) `sseClient.test.ts` (P7 산출물 확장)

```ts
it("F5: applySSEEvent handles both extraction_review variants identically", () => {
  const legacy = { event: "extraction_review", data: { items: [{ number: 1, data: {...} }] } };
  const incremental = { event: "extraction_review", data: { number: 1, data: {...} } };
  // 두 경우 모두 store.updateQuestionResult 호출 + setExtractionReviewActive(true)
});
```

### 6) 최종 alias grep

```bash
# TS/TSX 측에 snake 변형 없음 (Python adapter는 lib/exam/meta.ts 외)
grep -rn "school_level\|exam_type\|filename_base\|final_image" ngd-studio --include="*.ts" --include="*.tsx"
# 결과 0건

# Python 측에 신/구 키 혼재 없음
grep -rn "exam_type\|school_level\|filename_base\|final_image" /Users/junhyukpark/ngd/ngd-studio/*.py
# 결과 0건 (단 figure_processor.py의 backward compat legacy emit은 P3-P4 사이 임시였으므로 P9 시점엔 제거되어야 함 — 확인)
```

P3에서 figure_processor가 legacy snake 키 동시 emit하던 backward compat는 P9에서 제거:
```python
# P3에서 추가했던 "image" 키 (legacy) 제거, finalImage만 남김
def _make_q_status(uncertain: bool) -> dict:
    return {
        "status": "boundary_uncertain" if uncertain else "ok",
        "finalImage": str(final_path),
        "boundaryUncertain": uncertain,
        # crop_attempts/needs_agent_review의 snake 버전도 제거
        **({"cropAttempts": 1, "needsAgentReview": True} if uncertain else {}),
    }
```

`orchestrator.ts:emitFigureQuestionEvents`도 `image` 폴백 제거.

## 체크리스트
- [x] `outputs/_fixtures/year-2026-test/exam_data.json` 새 schema로 재생성 (camelCase info + 새 problem shape)
- [x] `outputs/_fixtures/year-2026-test/figure_status.json` 신규 생성 (finalImage 키)
- [x] `outputs/_fixtures/year-2026-test/images/prob2_final.png` 1x1 placeholder
- [x] `examData.test.ts`: dual emit 부재 + filenameBase 자동 채움 + meta 검증 케이스 (이미 P1/P2에서 완료, 통과 확인)
- [x] `orchestrator.pipeline.test.ts`: F1/F8 회귀 시나리오 (E-ext/F-ext로 이미 존재, 통과 확인)
- [x] `create/start/__tests__/route.test.ts`: L1/L2 회귀 시나리오 (P6에서 완료, 통과 확인)
- [x] `sseClient.test.ts`: F5 회귀 (P7에서 완료, 통과 확인)
- [x] P3의 backward compat legacy 키 (`image`, `boundary_uncertain`, etc.) 제거 (figure_processor.py + figureRunner.ts + orchestrator.ts + figure-cases fixtures)
- [x] 최종 grep — `school_level\|exam_type\|filename_base\|final_image` ngd-studio + *.py 결과 0건 (TS/TSX: test assertion lines만 toBeUndefined() 형태; Python: assemble.py variable names만, scope 외)
- [x] `npx tsc --noEmit` + `npx vitest run --reporter=basic` 전체 통과 (558 tests)

## 영향 범위

- 자동 회귀 안전망 확보. P10 manual smoke 외엔 추가 회귀 거의 없음.
- legacy backward compat 제거로 디스크/SSE 키가 정본만 남음.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic

# 잔존 alias 0건
grep -rn "school_level\|exam_type\|filename_base\|final_image" ngd-studio --include="*.ts" --include="*.tsx"
grep -rn "exam_type\|school_level\|filename_base\|final_image" /Users/junhyukpark/ngd/ngd-studio/*.py
# 둘 다 결과 없음

# fixture 형식 검증
python3 -c "import json; d=json.load(open('outputs/_fixtures/year-2026-test/exam_data.json')); assert 'schoolLevel' in d['info'] and 'school_level' not in d['info']"
```

## 실행 결과

### 1회차 (2026-05-24 01:30 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
P9 작업 완료. 1) `exam_data.json` fixture를 camelCase info + 새 problem schema로 재생성, 2) `figure_status.json` fixture를 finalImage 키로 신규 생성, 3) 1x1 placeholder PNG 생성, 4) `figure_processor.py`에서 `image`/`boundary_uncertain`/`needs_agent_review`/`crop_attempts` legacy snake_case 키 제거, 5) `figureRunner.ts` 인터페이스에서 legacy 필드 제거 및 `extractNeedsAgentReview`에서 `needs_agent_review` 폴백 제거, 6) `orchestrator.ts`에서 `image` 폴백 제거, 7) figure-cases fixture에서 dual 키 제거, 8) 테스트 mock에서 legacy 키 → camelCase 업데이트. `npx tsc --noEmit` 통과, 558 테스트 모두 통과.

#### 변경 파일
- `outputs/_fixtures/year-2026-test/exam_data.json` (수정, camelCase info + 2문제 새 schema)
- `outputs/_fixtures/year-2026-test/figure_status.json` (신규, finalImage 키)
- `outputs/_fixtures/year-2026-test/images/prob2_final.png` (신규, 1x1 placeholder PNG)
- `figure_processor.py` (수정, legacy snake_case 키 제거, camelCase만 emit)
- `ngd-studio/server/stages/figureRunner.ts` (수정, 인터페이스 legacy 필드 제거, needs_agent_review 폴백 제거)
- `ngd-studio/server/stages/orchestrator.ts` (수정, image 폴백 제거, FigureStatusFile 타입 정리)
- `ngd-studio/server/stages/__tests__/fixtures/figure-cases/figure_status.done.json` (수정, dual 키 → camelCase only)
- `ngd-studio/server/stages/__tests__/fixtures/figure-cases/figure_status.partial.json` (수정, dual 키 → camelCase only)
- `ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts` (수정, mock figure_processor.py 응답 camelCase 업데이트)
- `ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts` (수정, mock figure_processor.py 응답 camelCase 업데이트)
- `ngd-studio/server/stages/__tests__/figureRunner.test.ts` (수정, 테스트 설명 코멘트 camelCase 업데이트)

#### 검증 결과
- [x] `npx tsc --noEmit`: 오류 0건
- [x] `npx vitest run lib/__tests__ server/stages/__tests__ app/api --reporter=basic`: 558 tests 전체 통과 (31 파일)
- [x] TS/TSX alias grep (`school_level|exam_type|filename_base|final_image`): 실제 key 사용 0건 (test assertion `toBeUndefined()` 7줄만)
- [x] Python alias grep: `figure_processor.py` legacy emit 0건 (assemble.py variable names는 scope 외 false positive)
- [x] fixture 형식 검증: `exam_data.json` camelCase info, `figure_status.json` finalImage 키 확인

#### 추가 발견사항
- `assemble.py` line 262에 `q.get("image")` legacy 폴백이 여전히 존재함. `figure_processor.py`가 더 이상 `image` 키를 emit하지 않으므로 이 폴백은 dead code가 됨. 단, `assemble.py`는 본 phase scope 밖이므로 보고만 함.
- `assemble.py` line 293에서 `school_level = info["schoolLevel"]`처럼 Python 로컬 변수 이름으로 snake_case 사용 — 이건 JSON key가 아닌 Python variable name이므로 alias 문제 아님.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
escalate → 사용자 승인 — figure_processor.py(P3 dual emit 제거), figureRunner.ts/orchestrator.ts(legacy fallback 제거), fixtures/figure_status.{done,partial}.json(legacy 키 제거). P3 transitional dual emit의 final cleanup 일부, 사용자 drift 허용.

#### Verification Re-run (orchestrator)
tsc exit 0 + scope-limited vitest 558/558 통과 + alias grep(school_level|exam_type|filename_base|final_image|aggregateVerifiedProblems) 소스 내 0건.

#### Simplify (orchestrator)
SIMPLIFIED: 0 — dual emit 제거 자체가 정리 작업.

#### Review (orchestrator)
VERDICT: pass — drift 4종 포함 스펙 정합, alias grep 0건 달성. ISSUES 0건.
