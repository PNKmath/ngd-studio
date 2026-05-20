---
task: audit-driven-full-agentic-codification
phase_count: 8
created: 2026-05-20
---

# audit-driven-full-agentic-codification — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경

선행 task `create-v4-deterministic-codification` (커밋 1caa034 ~ 3efa2a0)는 audit `docs/planning/agent-provider-operating-model/deterministic-code-candidates.md`의 12개 후보 중 일부(주로 solver/verifier prompt 규칙, checker autofix, reviewer mutation)만 cover했다. 사후 검증에서 다음이 미처리/부분처리로 확인됨:

**미처리 후보 (audit doc Group B)**:
1. resume parsing / downstream cleanup (skill 자연어 잔존)
2. cache scan / stage state detection (skill+orchestrator 중복)
3. batch scheduling / retry loop (skill 자연어 잔존)
4. verified JSON aggregation
5. figure processing (Python+agent 혼재)
6. checker "즉시 코드화" 3개 (endNote, section style, vocabulary)
7. R-07 leading `_` 변환 (선행 task에서 partial로 분류, 완전 codify 가능)
8. reviewer 22개 체크리스트 자동검증 강화

**사후 검증(2026-05-20)에서 추가 발견된 silent regression**:
9. R-10 단항 minus 처리 — TS와 Python이 운영 데이터에서 다른 출력. 선행 task Phase 7 parity test가 합성 fixture로만 검증해 단항 minus 케이스 누락. Phase 6에서 함께 정렬.

본 task는 audit doc 전체 cover + 위 사후 회귀 fix를 목적으로 한다.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-coverage-matrix.md](./phase-01-coverage-matrix.md) | 6 | 6 | 100% | completed | 7e1cf48 |
| 2 | [phase-02-resume-and-cleanup.md](./phase-02-resume-and-cleanup.md) | 9 | 9 | 100% | completed | ce07f91 |
| 3 | [phase-03-batch-and-aggregation.md](./phase-03-batch-and-aggregation.md) | 7 | 7 | 100% | completed | 9a35f67 |
| 4 | [phase-04-figure-pipeline.md](./phase-04-figure-pipeline.md) | 8 | 8 | 100% | completed | (pending commit) |
| 5 | [phase-05-checker-additional-rules.md](./phase-05-checker-additional-rules.md) | 7 | 7 | 100% | completed | 4136fe6 |
| 6 | [phase-06-r07-complete-codify.md](./phase-06-r07-complete-codify.md) | 11 | 11 | 100% | completed | 1874fad |
| 7 | [phase-07-reviewer-auto-validators.md](./phase-07-reviewer-auto-validators.md) | 8 | 0 | 0% | pending | - |
| 8 | [phase-08-e2e-and-coverage-verification.md](./phase-08-e2e-and-coverage-verification.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **61** | **48** | **79%** | | |

## Phase 의존성

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──┬──▶ Phase 4
                                  ├──▶ Phase 5
                                  ├──▶ Phase 6
                                  └──▶ Phase 7 ──▶ Phase 8
                                                    ▲
        Phase 4, 5, 6 ─────────────────────────────┘
```

병렬 가능 조합:
- Phase 4 ∥ Phase 5 ∥ Phase 6 ∥ Phase 7 (각각 다른 디렉터리/파일)
- Phase 7은 intervention_likely (agent prompt 재작성)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | coverage matrix — 후속 phase의 referent | 30분 |
| P0 | Phase 2 | resume/cleanup/state — orchestration foundation | 60분 |
| P0 | Phase 3 | batch/retry/aggregation — runner 안정화 | 90분 |
| P1 | Phase 4 | figure pipeline — Python+agent 분리 | 90분 |
| P1 | Phase 5 | checker 추가 룰 3개 | 60분 |
| P1 | Phase 6 | R-07 완전 codify + R-10 단항 minus parity 정렬 | 60분 |
| P1 | Phase 7 | reviewer auto-validators | 90분 |
| P0 | Phase 8 | e2e + coverage 100% 검증 | 60분 |

## 권장 실행 순서

1. **Phase 1** 단독 (audit 매트릭스 기준 수립)
2. **Phase 2** 단독 (foundation)
3. **Phase 3** 단독 (Phase 2 의존)
4. **Phase 4 ∥ Phase 5 ∥ Phase 6 ∥ Phase 7** 병렬 (Phase 7만 intervention 확인)
5. **Phase 8** 단독 (전체 cover 매트릭스 검증)

## 공통 검증

### TS 측
- [ ] `cd ngd-studio && pnpm tsc --noEmit` 통과
- [ ] `cd ngd-studio && pnpm test` 통과 (.env.local 있는 환경에서도 deterministic — 선행 task 회귀 학습)

### Python 측
- [ ] `python3 -m pytest tests/` 통과 (R-07 변경 포함)
- [ ] `python3 build_hwpx.py` 통합 회귀 (Phase 4 figure 통합 검증)

### audit doc cover
- [ ] `docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md`의 모든 행이 "covered" 상태
- [ ] `.claude/skills/ngd-exam-create/SKILL.md`에 resume 자연어 로직 잔존 0건 (grep 검증)

## 선행 task 회고 — phase 작성 시 지킬 것

1. **frontmatter scope에 spec body가 언급한 모든 파일 명시** — 선행 task Phase 6에서 reviewRunner.ts/postprocess.ts/vitest.config.ts 누락 사례
2. **`## 체크리스트`에 audit doc 항목 ID 명시 인용** (예: "audit doc Group B #5 figure 충족")
3. **`## 검증`은 audit cover 여부 직접 검사** (예: grep으로 skill 자연어 잔존 없음 확인)
4. **partial/지연 항목은 spec body에 명시적 사유 + fixture 정합** (R-07 같은 헷갈리는 경우 방지)
5. **worker silent omission 방지**: 양 언어 동시 변경(Python+TS)은 fixture 1개로 동치성 강제
6. **테스트가 환경 의존성 없게 작성** — 실제 provider 호출 대신 cache 사전 작성 패턴 (선행 task `3efa2a0` 학습)

## 비-스코프 (intentional out-of-scope)

다음은 본 task에서 codify하지 않고 agent에 잔존:
- 해설 완성도, 논리 충분성 판단
- 원본 PDF ↔ HWPX 다중모달 비교
- 그림 품질/라벨 누락 판단
- 수학 정확성 (verifier agent 계속 유지)
- figure crop 영역이 부정확해서 사람이 보는 수준 판단 필요한 경우 (Phase 4에서 agent 역할 명시 보존)

## 관련 문서

- audit 원본: `docs/planning/agent-provider-operating-model/deterministic-code-candidates.md`
- 선행 task: `docs/planning/create-v4-deterministic-codification/` (특히 `results.md`)
- 선행 task 사후 fix 커밋: `b503818`, `3efa2a0`
