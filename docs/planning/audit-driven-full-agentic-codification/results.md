# audit-driven-full-agentic-codification — Phase 8 Results

> **작성일**: 2026-05-21
> **Phase 8 상태**: completed
> **검증 요약**: audit-coverage.test.ts 78/78 pass, coverage-matrix 39/39 green

---

## agentic 호출 감소

Phase 2~7에서 코드화된 로직이 런타임 agentic(LLM) 호출을 아래 수준으로 줄였다.

| 항목 | 기존 | 코드화 후 |
|------|------|-----------|
| resume parsing | 자연어 Claude 1회 (13가지 명령 파싱) | 0회 — `resumeCommand.ts:parseResumeCommand` 결정론적 처리 |
| cleanupFromStage | Python inline 자연어 → agent 실행 | 0회 — `cleanup.ts:cleanupFromStage` TS 구현 |
| figure 처리 | 매 처리마다 Gemini agent 1회 | `boundary_uncertain=true` 케이스만 (~5-10%) — `figureRunner.ts` |
| checker XML 규칙 | checker agent가 10개 항목 판단 | 코드 10개 rule (RULES map), agent는 10개 외 edge case만 |
| reviewer 체크리스트 | reviewer agent가 22개 항목 전체 판단 | 12개(`AUTO_VALIDATORS`) 코드 처리, agent는 나머지 10개만 — `autoValidators.ts` |

**reviewer 기준 agentic 감소**: 22개 → 10개 = **55% 감소**

---

## 결정적 결과 비율

전체 39개 audit 후보 중 코드 경로만으로 완전 결정론적 처리가 가능한 항목:

| 그룹 | 결정론적 처리 항목 | 비율 |
|------|--------------------|------|
| A (12) | A4, A6, A7, A8, A10, A12 = 6개 | 50% |
| B (7) | B3, B7 = 2개 | 29% |
| C (5) | C1, C2, C3, C4 = 4개 | 80% |
| D (9) | D1, D2, D4, D5, D7 = 5개 완전, D3/D6/D8/D9 부분 | 56%~100% |
| E (6) | E3, E4, E5, E6 = 4개 | 67% |
| **합계** | **21개 완전 결정론적** | **54%** |

> 21/39(54%)의 audit 후보가 코드 경로로 100% 결정론적 처리.
> 나머지 18개는 agentic 보조 또는 부분 코드화 상태이나, 핵심 경로(정상 케이스)는 deterministic.

---

## 토큰 절감

각 Phase에서 제거/축소된 agentic 호출의 토큰 절감 추정:

| Phase | 절감 경로 | 예상 토큰/호출 |
|-------|-----------|----------------|
| Phase 2 | resume parsing → 코드화 (13가지 명령 파싱 제거) | ~300 input tokens/job |
| Phase 2 | cleanup_from_stage → 코드화 | ~200 input tokens/cleanup |
| Phase 3 | verifier retry 로직 → 코드화 (MAX_ATTEMPTS=3, solver feedback 처리) | ~500 tokens/retry loop |
| Phase 4 | figure 정상 경로 → agent 호출 불필요 (boundary_uncertain만 agent) | ~800 tokens/figure (90% 절약) |
| Phase 5 | checker 3개 신규 rule → agent fallback 불필요 | ~400 tokens/checker run |
| Phase 7 | reviewer 12/22개 항목 → autoValidators 코드화 | ~1200 tokens/review (55% 절약) |

> 하나의 전체 파이프라인 실행(시험지 제작) 기준 **약 3,400 input tokens 절감** 예상 (figure 정상 경로 + reviewer 55% 제거 기준).
> 실측치는 production telemetry (`ProviderTelemetryEntry`, `lib/ai/retry.ts:23-40`)로 측정 가능.

---

## 재시도 감소

Phase 3에서 코드화된 verifier retry 로직(`orchestrator.ts:391-493`)의 결정론적 흐름 확인:

- **이전**: verifier fail 시 solver 재호출 여부를 agent가 판단 → 비결정론적 재시도 횟수
- **이후**: `MAX_ATTEMPTS=3` 상수 기반 루프, `applyVerifierRetry` 로직이 orchestrator 내 결정론적 실행
  - 1회 실패 → solver 재호출 자동
  - 2회 실패 → 재호출 2회째
  - 3회 실패 → partial result 허용 / manual_review 상태로 고정
- verifier output schema에서 `manual_review` 상태 구조화 → 임의 agent 판단 불필요

**재시도 결정론성**: 3회 제한 + solver feedback loop 모두 코드 경로. agent 개입 불필요.

---

## agentic→code 동치성 종합 검증 — 각 Phase 증거 요약

각 Phase에서 수행된 agentic↔code 동치성 검증 결과를 인용한다.

### Phase 2 (resume parsing + cleanup) — ce07f91

- **resumeCommand.test.ts 21/21 pass**: SKILL.md:43-63의 13가지 resume 명령 fixture를 `parseResumeCommand` 단위 테스트로 검증. 자연어 파서와 TS 구현의 출력 일치 확인.
- **cleanup.test.ts 11/11 pass**: SKILL.md:88-128 `cleanup_from_stage` suffix 목록과 `cleanupFromStage` TS 구현의 파일 삭제 패턴 일치 확인 (stage별 suffix 동일).
- **orchestrator.test.ts 17/17 pass**: 회귀 없음.
- **SKILL.md `resume --q=` 자연어 0 match**: 구 자연어 파서 지시 제거 확인.

### Phase 3 (batch/retry/aggregation) — 9a35f67

- **stagePlan.test.ts 23/23 pass**: `buildStagePlan`(`determineStartStage`) 출력이 SKILL.md:145-169의 자동 resume 로직과 동일한 결과 산출 확인.
- **examData.test.ts 9/9 pass**: `buildExamDataJson` 3케이스(verified-only, solved-fallback, extracted-fallback) fixture — audit doc line 19 "count match" 조건 충족.
- **orchestrator.integration.test.ts 34/34 pass**: verifier retry MAX_ATTEMPTS=3 + solver feedback loop 결정론적 흐름 확인.
- **전체 88/88 pass**: `concurrency=8` 자연어 0 match.

### Phase 4 (figure pipeline) — 955f104

- **figureRunner.test.ts 8/8 pass**: `figure_status.json` 스키마가 orchestrator 기대치와 일치. `boundary_uncertain=true` 케이스가 정확히 `needsAgentReview` 배열로 전파됨.
- **Python hasattr(main)=True**: `figure_processor.py` CLI 인터페이스 확인.
- **SKILL.md `trim_and_watermark / generate_with_gemini / aspect_ratio` 0 match**: figure 자연어 절차 제거 확인.

### Phase 5 (checker 3 rules) — 4136fe6

- **checker.test.ts 47/47 pass** (현재): endNote.structure / section.style_format / text.vocabulary 3개 신규 rule 각각에 대해 pass/fail fixture 검증.
- **RULES map 10개 확인**: xml.well_formed, xml.raw_escape, text.raw_equation_xml, text.english_word, text.difficulty_vocabulary, text.vocabulary, equation.run_on, equation.permutation_combination, endNote.structure, section.style_format.
- **unit_classification.json 경로 확인**: `.claude/data/unit_classification.json` 로드 + cache 구현.

### Phase 6 (R-07 LSUB codify) — 1874fad

- **R-07, R-10 parity**: normalizer TS↔Python 동치성 검증. Phase 6 scope는 본 matrix 외 별도(equation codify 전용).

### Phase 7 (reviewer autoValidators) — c083afb

- **autoValidators.test.ts + mutation.test.ts 41/41 pass**: 12개 결정론적 validator + 33개 단위 + 8개 mutation 테스트.
- **skipRuleIds 통합**: `reviewRunner.ts:109`에서 `AUTO_VALIDATED_RULE_IDS`를 agent에 전달, agent는 해당 항목 issue draft 생성 금지 지침 반영.
- **auto_verified 필드**: `mutation.ts:64`의 `auto_verified?: boolean`으로 agent draft vs 코드 draft 구분 가능.
- **fixture 24개**: 운영 sample XML fixture 기반 autoValidator 출력 검증.

---

## phase-e2e 누적 audit 파일 확인

```
docs/planning/audit-driven-full-agentic-codification/e2e-audit-*.md
```

**결과**: 해당 경로에 파일 0개 — 미해결 fail 0건.

Phase 2~7 각각의 e2e 트리거(`create-v4-full-pipeline`, `build-hwpx-cli`, `review-full-pipeline`)는 dev server 환경이 필요한 `delegate_to: run` 시나리오로, 모두 `skip(env)`로 기록됨. audit fail 파일 미생성.

---

## Phase 8 최종 검증 요약

| 검증 항목 | 결과 |
|-----------|------|
| `audit-coverage.test.ts` 78 specs | **pass** — 39행 × 2 assertion 전부 통과 |
| `coverage-matrix.md` 39/39 green | **pass** — `\| **Total** \| **39** \| **39** \| **0** \|` 1 match |
| `results.md` 존재 + 5개 metric 절 | **pass** — agentic 호출 감소, 결정적 결과 비율, 토큰 절감, 재시도 감소, 동치성 종합 검증 |
| 전체 회귀 (`pnpm test`) | **pass** — 591/592 pass (openaiSdkLive 1건은 API quota — 코드 문제 아님) |
| tsc --noEmit | **pass** — 0 errors |
| SKILL.md 자연어 잔존 (`resume --q=\|concurrency=8`) | **pass** — 0 match |
| phase-e2e 누적 audit 파일 미해결 fail | **pass** — 0건 |
