---
phase: 7
generated: 2026-05-20
---

# create-v4 결정적 코드화 — 최종 검증 Metrics

Phase 2~6 완료 후 회귀 + 측정 결과.

---

## 1. 동치성 (Cross-language parity)

### 측정 방법

`orchestrator.integration.test.ts` 에 `Phase 7: normalizer parity — TS == Python for all fixtures` describe 블록 추가.  
각 fixture에서 TS `normalizeParts` 결과와 Python `normalize_parts` 결과(spawnSync subprocess)를 `JSON.stringify` 레벨로 비교.

### 결과

| 항목 | 수치 |
|------|------|
| 대상 fixture 수 | 28개 (R-01~R-10 + IDEMPOTENT + MULTI) |
| TS == Python 일치 | **28/28 (100%)** |
| TS 실패 | 0 |
| Python 실패 | 0 |
| 불일치 fixture | 0 |

**통과**: `pnpm test server/stages/__tests__/orchestrator.integration.test.ts` 33/33 (5 e2e + 28 parity).

---

## 2. Prompt Token 절감 (Phase 4)

### 측정 방법

Phase 4 커밋 전/후 `solverPrompt.ts` + `verifierPrompt.ts`의 `*_SYSTEM` 상수 길이 측정.  
토큰 추정: chars ÷ 4 (rough GPT/Claude 평균).

### Solver System Prompt

| | chars | ~tokens |
|-|-------|---------|
| Phase 4 이전 | 1,193 | ~298 |
| Phase 4 이후 | 930 | ~232 |
| **절감** | **-263 chars** | **~-66 tokens (-22%)** |

제거된 항목 (R-01~R-10 결정적 규칙):
- 통수식 금지 / 등호 단위 끊기
- 연산자 앞뒤 공백 규칙
- rm체 규칙 (단위/도형 대문자)
- 순열/조합 패턴 (`{it\`_n}{rm C}_{it r}`)
- `_` 로 시작하는 수식 금지
- DEG 붙여쓰기, LEFT/RIGHT 공백, cdot, cdots, 쉼표 뒤 `~`

→ 모두 `normalizeParts` (TS) / `normalize_parts` (Python)로 코드화되어 LLM 의존 제거.

### Verifier System Prompt

| | chars | ~tokens |
|-|-------|---------|
| Phase 4 이전 | 1,620 | ~405 |
| Phase 4 이후 | 1,637 | ~409 |
| **변화** | **+17 chars** | **~+4 tokens (+1%)** |

verifier는 서식 룰 6~9항목을 3항목으로 축약했으나, 대신 "포맷 세부사항은 후처리 normalizer가 교정" 설명 1줄이 추가되어 거의 동일한 길이.  
→ verifier는 **수학/논리 정확성 + 교과 범위**에 집중. format_rule 불필요 retry 감소 효과(정성).

### Combined (solver + verifier, 1 call each)

| | ~tokens |
|-|---------|
| 이전 | ~703 |
| 이후 | ~641 |
| 절감 | **~62 tokens/question (-8.8%)** |

문제당 최대 3회 verifier retry 고려 시: 최대 절감 ~248 tokens/question(solver+verifier×3).

---

## 3. Verifier Retry Rate (Phase 3 효과)

### 측정 방법

`verifier pass-on-first-try` 테스트: 3문제 mock pipeline에서 verifier 텔레메트리 항목 분석.

### 결과 (mock pipeline, deterministic fixture)

| 항목 | 수치 |
|------|------|
| 총 verifier 호출 | 3 (문제당 1회) |
| pass-on-first-try | **3/3 (100%)** |
| `retry: true` 항목 | 0 |
| `retry: false` 항목 | 3 |
| 최대 허용 시도 횟수 | 3 (`MAX_ATTEMPTS = 3`) |

정규화 전(Phase 2~3 이전): 같은 해설 JSON이 cache에 쓰여져도 `solverResultPath`에 normalizer를 거치지 않아 format 불일치로 verifier가 fail할 수 있었음.  
정규화 후: cache write 직전 `normalizeParts` 적용 → 동일 입력 = 동일 cache key → verifier 재시도 불필요.

실제 LLM 환경에서는 여전히 수학 오류 등으로 retry 발생 가능. 코드 기반 절감분은 "포맷 이유 retry" 제거.

---

## 4. Checker Fallback Rate (Phase 5 효과)

### 측정 방법

`checker.ts` RULES map + `runCheckerWithAutoFix` wrapper 분석 + checker 테스트 결과.

### 결과

| 항목 | 수치 |
|------|------|
| 결정적 룰 총 수 | 7 (`DETERMINISTIC_RULE_IDS`) |
| fix 핸들러가 있는 룰 | 1 (`equation.run_on → fixRunOnEquationsInXml`) |
| `maxAttempts` | 2 (1회 원본 + 1회 auto-fix) |
| checker 신규 테스트 | 23개 (Phase 5에서 추가) |
| `fallbackRequired: false` (auto-fix 후) | 테스트 23/23 통과 |

**fallback 발동율 감소**: `equation.run_on` 위반이 있는 HWPX에서 LLM fallback 없이 XML-level fix로 자동 해결.  
Phase 5 이전: `fallbackRequired: true` → 상위 레이어에서 LLM 재생성 필요.  
Phase 5 이후: `fixRunOnEquationsInXml` XML 직접 패치 → `fallbackRequired: false`.

---

## 5. 전체 파이프라인 회귀 (mock e2e)

### 테스트: `orchestrator.integration.test.ts` (5개 시나리오)

| 시나리오 | 결과 |
|---------|------|
| solver → verifier → figure → builder → checker: done | PASS |
| solver stage SSE events 3문제 모두 emit | PASS |
| full pipeline create mode (extractor → solver → verifier → done) | PASS |
| abort mid-run: cancelled status | PASS |
| verifier pass-on-first-try: telemetry 정확히 3개 | PASS |

**5/5 PASS** — 회귀 없음.

---

## 6. Python 단위 테스트 (Phase 2)

```
pytest tests/test_parts_normalizer.py -q
56 passed in 0.02s
```

28 fixture × 2 suite (normalize + idempotent) = 56 테스트, **56/56 PASS**.

---

## 요약

| Phase | 목표 | 측정 결과 |
|-------|------|-----------|
| 2 | Python normalizer + pytest | 56/56 pass |
| 3 | TS normalizer + Vitest | 28/28 pass (+ 통합 테스트) |
| 4 | Solver prompt 슬림화 | ~22% 시스템 프롬프트 절감 (solver), verifier 서식 룰 → normalizer 이관 |
| 5 | Checker auto-fix | `equation.run_on` XML-level fix, fallback 불필요 |
| 6 | Reviewer mutation 분리 | mutation TS 분리 완료 |
| 7 | Cross-language parity | 28/28 fixture TS==Python byte-level equal |

모든 결정적 규칙(R-01~R-10)이 코드로 이전 완료. LLM은 수학적 풀이 / 논리 / 교과 범위에만 집중.

---

## 사후 검증 부록 (2026-05-20)

본 task 완료 후 사용자 요청으로 운영 데이터(`inputs/시험지 제작/.v3cache/`의 19개 cached solved JSON) 기반 동치성 검증을 추가 수행. 합성 fixture 검증의 빈 곳을 보완하기 위함.

### 검증 결과 요약

| Stage | 결과 | 발견 |
|-------|------|------|
| 1. Normalizer on real solver outputs | ✓ PASS | 19/19 안전 (5 정정, 14 idempotent, 0 손상) |
| 2. Cross-language parity on real data | ✗ **FAIL** | TS↔Python R-10 단항 minus drift (7+ mismatch) |
| 3. HWPX build regression | ✓ PASS | 차이 100% 의도된 normalize 효과 |
| 4. Checker autofix on real XML | ✓ PASS | 운영 통수식 8건 모두 분리 |
| 5. R-09 text-side (C1) 효과 | 효과 미측정 | 본 sample에 단위 표기 0건 (수2 미적분 특성) |

### Stage 2 silent regression 상세

Phase 7의 cross-language parity test는 28개 합성 fixture로만 검증되어 **단항 minus 케이스를 놓침**. 운영 19개 cached solved JSON 중 7+ 파일에서 TS와 Python 출력 불일치 확인:

```
input:  "= -2"           →  Python: "= - 2"   TS: "=-2"
input:  "k =-1"          →  Python: "k = -1"  TS: "k =-1"
input:  "=-{1 over 6}a^3" → Python: "= - {1 over 6}a^3"  TS: "=-{1 over 6}a^3"
```

운영 영향:
- 현재 build 경로(`build_hwpx.py`)는 Python normalize만 사용 → HWPX 출력 자체는 정상
- TS normalize는 cache write 시점에 적용 (verifier→cache 경로) → 같은 cache가 다음 build에서 Python을 다시 통과하면 의도되지 않은 추가 변환 발생, idempotency 명세 위반
- Phase 7 parity test는 합성 fixture로만 통과 → false sense of safety

### 후속 처리

후속 task `audit-driven-full-agentic-codification` Phase 6에 R-10 단항 minus parity 정렬 + 운영 fixture(19개 solved JSON) parity test 통합으로 보강.

### 검증 한계

- Stage 5는 본 sample 특성상 효과 미측정. 통계/물리/생활 응용 문제 sample 확보 시 R-09 text-side 실효성 별도 측정 필요.
- 검증은 build 경로 단방향만 다룸. solver→verifier feedback loop의 동치성은 verifier가 LLM 호출이라 결정적 검증 불가 (의도된 agentic 잔존).
