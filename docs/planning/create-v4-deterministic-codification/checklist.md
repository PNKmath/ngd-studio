---
task: create-v4-deterministic-codification
phase_count: 7
created: 2026-05-20
---

# create-v4 결정적 코드화 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경

create-v4 파이프라인의 stage 중 결정적 규칙으로 코드화 가능한 부분을 최대한 코드로 옮긴다. 현재:

- `solverPrompt.ts:14-63` — 결정적 포맷 규칙 22개가 LLM prompt에 박혀 있음 (통수식 금지, DEG 붙여쓰기, cdot, cdots 역따옴표, 쉼표 뒤 `~`, rm체 enforcement, 순열/조합 패턴, leading `_` 금지 등)
- `checker.ts:234` — 통수식 detect만 하고 auto-fix 없음. `fallbackRequired: true` 플래그만 세움
- `equation.py:97 parts_to_run_content` — 모든 HWPX 출력의 single funnel point
- `ngd-exam-reviewer.md` — issue draft 판단과 HWPX mutation이 한 agent에 섞여 있음

핵심 방침:

- **TS normalizer** (`ngd-studio/lib/parts/normalize.ts`): solver/verifier 출력을 cache write 직전 정규화. cache가 깨끗 → verifier 재시도 fail 감소.
- **Python normalizer** (`equation.py`): `parts_to_run_content` 진입 직전 safety net. 오검/수동/legacy 경로 커버. idempotent.
- **공유 fixture** (`ngd-studio/tests/fixtures/parts_normalization/`): Vitest + pytest 양쪽 동일 fixture로 동치성 검증.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-rule-taxonomy-and-fixtures.md](./phase-01-rule-taxonomy-and-fixtures.md) | 6 | 0 | 0% | pending | - |
| 2 | [phase-02-python-normalizer.md](./phase-02-python-normalizer.md) | 8 | 0 | 0% | pending | - |
| 3 | [phase-03-ts-normalizer.md](./phase-03-ts-normalizer.md) | 7 | 0 | 0% | pending | - |
| 4 | [phase-04-prompt-slimming.md](./phase-04-prompt-slimming.md) | 5 | 0 | 0% | pending | - |
| 5 | [phase-05-checker-autofix.md](./phase-05-checker-autofix.md) | 6 | 0 | 0% | pending | - |
| 6 | [phase-06-reviewer-mutation-split.md](./phase-06-reviewer-mutation-split.md) | 7 | 0 | 0% | pending | - |
| 7 | [phase-07-e2e-verification.md](./phase-07-e2e-verification.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **44** | **0** | **0%** | | |

## Phase 의존성

```
Phase 1 ─┬─▶ Phase 2 ─┐
         └─▶ Phase 3 ─┴─▶ Phase 4 ─┐
                       │           ├─▶ Phase 7
                       └─▶ Phase 5 ┘
Phase 6 (독립, intervention_likely)
```

병렬 가능 조합:
- Phase 2 ∥ Phase 3 (같은 fixture를 다른 언어로 구현, 파일 교집합 없음)
- Phase 4 ∥ Phase 5 (다른 파일)
- Phase 6은 언제든 (다른 파일)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 규칙 taxonomy + 공유 fixture — 모든 후속 phase의 기준 | 40분 |
| P0 | Phase 2 | Python normalizer — HWPX 출력 single funnel 보장 | 90분 |
| P0 | Phase 3 | TS normalizer — cache 정규화, verifier 재시도 감소 | 45분 |
| P1 | Phase 4 | prompt 슬림화 — 토큰 절감, 모델 의미/논리 집중 | 25분 |
| P1 | Phase 5 | checker auto-fix — LLM 호출 없이 결정적 fix loop | 50분 |
| P2 | Phase 6 | reviewer mutation 분리 — 독립 진행 가능 | 70분 |
| P1 | Phase 7 | e2e 검증 — 회귀 + 토큰/재시도 metrics | 30분 |

## 권장 실행 순서

1. **Phase 1** 단독 (모든 후속이 fixture에 의존)
2. **Phase 2 ∥ Phase 3** (병렬, 같은 fixture로 양 언어 구현)
3. **Phase 4 ∥ Phase 5** (병렬, 다른 파일)
4. **Phase 7** (전체 회귀 검증)
5. **Phase 6** 은 언제든 — 독립 진행 권장 (Phase 1 의존 없음)

## 공통 검증

### TS 측
- [ ] `cd ngd-studio && pnpm tsc --noEmit` 통과
- [ ] `cd ngd-studio && pnpm test` 통과
- [ ] solver.ts / verifier.ts 회귀 테스트 통과

### Python 측
- [ ] `python3 -m pytest tests/` 통과 (Phase 2에서 셋업)
- [ ] `python3 build_hwpx.py outputs/<sample>/exam_data.json outputs/<sample>/` 실행 시 통수식 분리 후 HWPX 생성 성공
- [ ] `python3 resources/hwpx_scripts/validate.py <output.hwpx> --fix` exit 0

### 회귀
- [ ] 기존 e2e fixture (있다면)에서 HWPX 출력 byte-level diff가 normalize 차이만 보임
- [ ] checker 결정적 룰 통과 (7개 모두)

## 관련 문서

- 결정적 코드화 audit: `docs/planning/agent-provider-operating-model/deterministic-code-candidates.md`
- HWP 수식 문법: `.claude/skills/hwp-equation/reference.md`
- checker 룰 현재 구현: `ngd-studio/server/stages/checker.ts:98`
- solver prompt: `ngd-studio/server/stages/prompts/solverPrompt.ts`
