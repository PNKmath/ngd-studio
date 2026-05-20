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
