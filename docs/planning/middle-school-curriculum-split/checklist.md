---
task: middle-school-curriculum-split
phase_count: 5
created: 2026-05-21
---

# middle-school-curriculum-split — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run` 이 이 파일을 읽어 다음 phase 를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-build-middle-json.md](./phase-01-build-middle-json.md) | 5 | 5 | 100% | completed | 58fa239e |
| 2 | [phase-02-extractor-prompt-branch.md](./phase-02-extractor-prompt-branch.md) | 6 | 6 | 100% | completed | c9a71c59 |
| 3 | [phase-03-checker-school-level-chain.md](./phase-03-checker-school-level-chain.md) | 6 | 6 | 100% | completed | 2c980e93 |
| 4 | [phase-04-filename-school-level.md](./phase-04-filename-school-level.md) | 7 | 7 | 100% | completed | c4fe794f |
| 5 | [phase-05-header-and-regression.md](./phase-05-header-and-regression.md) | 5 | 4 | 80% | completed | 299a081a |
| **Total** | | **29** | **28** | **97%** | | |

## Phase 의존성

```
Phase 1 (CSV → unit_classification_middle.json)
   │
   ├──▶ Phase 2 (extractor + solver + verifier prompt 학교급 분기)  ┐
   │                                                                 │
   └──▶ Phase 3 (checker schoolLevel chain)                          │
                                                                     │
Phase 4 (filename "[고]" 하드코딩 해제 — TS + Python) ── (독립)      │
                                                                     │
                                                                     ▼
                                              Phase 5 (HWPX 헤더 표기 + 회귀 + 통합)
                                              (depends_on: 1, 2, 3, 4)
```

- **Phase 2 / 3 / 4** 는 scope 교집합 없으므로 (Phase 1 끝난 뒤) **병렬 가능**.
  - Phase 2: server/stages/prompts/* + extractor.ts + solver.ts + verifier.ts + orchestrator.ts (orchestrator 호출부 일부)
  - Phase 3: server/stages/checker.ts + orchestrator.ts (checker 호출부 일부) + checker.test.ts
  - Phase 4: examData.ts + assemble.py + v3cache-meta/route.ts + filenameMeta.ts + 각 test
  - **주의**: Phase 2 와 Phase 3 가 둘 다 `orchestrator.ts` 를 건드림 → orchestrator.test 가 양쪽 영향 흡수해야 함. scope audit 에서 ambiguous 매칭 가능성 있으므로 phase-run 이 순차로 떨어뜨릴 수 있음 (안전 기본값).

- **Phase 5** 는 1+2+3+4 모두 완료 후 단독 실행. `intervention_likely: true` — 헤더 표기 옵션 선택 필요.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 데이터 빌드 — 후속 phase 의 입력 | 15-20분 |
| P0 | Phase 3 | checker chain — 잘못된 vocab 이 prod 빌드 실패시키는 가장 큰 회귀 표면 | 25-30분 |
| P0 | Phase 4 | filename "[고]" 하드코딩 — 사용자 가시 결함 (산출물 파일명) | 15-20분 |
| P1 | Phase 2 | 3 개 모델 prompt 분기 — 즉시 회귀는 아니나 품질 영향 | 25-30분 |
| P1 | Phase 5 | 헤더 표기 정책 + 통합 회귀 | 20-30분 (헤더 결정 포함) |

## 권장 실행 순서

1. **Phase 1** → 데이터 빌드 (먼저, 의존성 unblock)
2. **Phase 2 + Phase 3 + Phase 4** (이상적으로 병렬, 현실적으로 순차) → prompt + checker + filename 분기
3. **Phase 5** → 헤더 표기 결정 + 통합 회귀 (e2e_triggers 발화)

## 검증 체크리스트

### 공통 검증
- [ ] `pnpm --filter ngd-studio exec tsc --noEmit` 통과
- [ ] `pnpm --filter ngd-studio exec vitest run lib/__tests__ server/stages/__tests__ --reporter=basic --exclude '**/providerDeepSeekLive*' --exclude '**/openaiSdkLive*' --exclude '**/openaiSdkClaudeCachingLive*'` 통과
- [ ] `node scripts/build_middle_curriculum.mjs` 결정론적 (재실행해도 동일 JSON)
- [ ] `pnpm --filter ngd-studio build` 통과 (Phase 5)
- [ ] 산출물 HWPX 파일명에 학교급 토큰 (`[중]` 또는 `[고]`) 정확히 박힘
- [ ] HWPX 머릿말의 학교급 표기 (Phase 5 결정 옵션) 정확히 반영

### per-phase 검증
- 각 phase 파일의 `## 검증` 섹션 참조

## 관련 문서
- [README](./README.md)
- 부모 작업: [create-pipeline-stage-split](../create-pipeline-stage-split/) (Phase A)
- E2E 카탈로그: [create-v4-full-pipeline](../../e2e/scenarios/create/create-v4-full-pipeline.md), [build-hwpx-cli](../../e2e/scenarios/create/build-hwpx-cli.md)
