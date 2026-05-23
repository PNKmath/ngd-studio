---
task: exam-data-refactor
phase_count: 10
created: 2026-05-23
---

# exam-data-refactor — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-exam-meta-type.md](./phase-01-exam-meta-type.md) | 7 | 6 | 86% | completed | 7f99e5c |
| 2 | [phase-02-exam-data-dual-emit.md](./phase-02-exam-data-dual-emit.md) | 6 | 6 | 100% | completed | 08b8919 |
| 3 | [phase-03-figure-status-final-image.md](./phase-03-figure-status-final-image.md) | 7 | 6 | 86% | completed | 2456427 |
| 4 | [phase-04-assemble-camelcase.md](./phase-04-assemble-camelcase.md) | 6 | 6 | 100% | completed | 0a4d742 |
| 5 | [phase-05-session-meta-move.md](./phase-05-session-meta-move.md) | 5 | 5 | 100% | completed | 6288ed0 |
| 6 | [phase-06-create-start-atomic.md](./phase-06-create-start-atomic.md) | 8 | 7 | 88% | completed | 45747c4 |
| 7 | [phase-07-orchestrator-resume-safety.md](./phase-07-orchestrator-resume-safety.md) | 9 | 9 | 100% | completed | 80612d9 |
| 8 | [phase-08-housekeeping-orphans.md](./phase-08-housekeeping-orphans.md) | 6 | 6 | 100% | completed | 8f6214c |
| 9 | [phase-09-fixture-regression.md](./phase-09-fixture-regression.md) | 7 | 0 | 0% | pending | - |
| 10 | [phase-10-manual-smoke.md](./phase-10-manual-smoke.md) | 6 | 0 | 0% | pending | - |
| **Total** | | **66** | **51** | **77%** | | |

## Phase 의존성

```
                 ┌────────────────────────────────────────┐
                 │                                        ▼
P1 ──▶ P2 ──▶ P3 ──▶ P4 ──┐                            P7
 │                         │                            ▲
 ├──▶ P5 ──▶ P6 ──▶ P8 ────┘                            │
 │                                                      │
 └──────────────────────────────────────────────────────┘

P1 ─▶ P2 ─▶ P3 ─▶ P4 ─▶ P7 ─▶ P9 ─▶ P10
 │
 ├─▶ P5 ─▶ P6 ─▶ P7
 │              └─▶ P8 ─▶ P9
 └──────────────────▶ P9
```

병렬 가능 조합:
- **P3 ∥ P5** (의존성 동일하지만 scope 비교집합)
- **P5/P6 도중 P3/P4 진행** 가능 (다른 레이어)
- **P8 ∥ P9 부분** (P8은 housekeeping이라 P9 fixture 작성과 격리 가능 — 단 P9가 final grep을 포함하므로 P8 후 P9 권장)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | P3 | F1 load-bearing — figure_info.final_image 손실 차단 | 40분 |
| P0 | P5 | L1 load-bearing — session_meta 격리 폐기 | 20분 |
| P0 | P6 | L2 load-bearing — handleExtract 원자화 | 40분 |
| P1 | P1, P2, P4 | 컨트랙트 일원화 (선행 종속) | 90분 |
| P1 | P7 | F2/F3/F5/F8 통합 — resume 안전성 | 60분 |
| P2 | P8, P9 | housekeeping + 회귀 fixture | 60분 |
| P2 | P10 | 실제 PDF 수동 smoke (intervention) | 30분 |

## 권장 실행 순서

1. **P1** — 타입 통일 선행
2. **P2 → P3 → P4** (직렬, 데이터 경로 down-stream 순)
3. **P5 → P6** (병렬로 P2-P4와 같이 진행 가능, 서로 다른 레이어)
4. **P7** (P1-P4가 끝나야 시작; orchestrator 재구성)
5. **P8** (P6 끝나면 시작 가능)
6. **P9** (P1-P8 모두 끝난 뒤)
7. **P10** (P9 완료 후 실제 PDF, intervention)

## 공통 검증

- [ ] `npx tsc --noEmit` (ngd-studio 디렉터리에서)
- [ ] `npx vitest run --reporter=basic` 전체 통과
- [ ] `grep -r "school_level\|exam_type\|filename_base\|final_image\|aggregateVerifiedProblems" --include="*.ts" --include="*.tsx" ngd-studio/` 결과 0건 (Python adapter 제외)
- [ ] `grep -rn "session_meta" inputs/` 디렉터리에 `.v3cache` 밖 session_meta 없음
- [ ] 실제 PDF로 신규/재개 양 흐름 끝까지 통과 (P10에서 확인)

## 관련 문서
- [README](./README.md) — 진단 + 새 컨트랙트
- e2e 카탈로그: `docs/e2e/`
  - `create-v4-full-pipeline`
  - `build-hwpx-cli`
