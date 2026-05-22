---
task: legacy-pipeline-removal
phase_count: 7
created: 2026-05-22
---

# Legacy Claude Code Pipeline 제거 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run` 이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-orchestrator-review-mode.md](./phase-01-orchestrator-review-mode.md) | 8 | 8 | 100% | completed | 90ae123 |
| 2 | [phase-02-followup-route-orchestrator.md](./phase-02-followup-route-orchestrator.md) | 7 | 7 | 100% | completed | e3b9a40 |
| 3 | [phase-03-crop-mode-migration.md](./phase-03-crop-mode-migration.md) | 5 | 4 | 80% | completed | 4988714 |
| 4 | [phase-04-sse-legacy-removal.md](./phase-04-sse-legacy-removal.md) | 8 | 8 | 100% | completed | 0763faf |
| 5 | [phase-05-dead-code-cleanup.md](./phase-05-dead-code-cleanup.md) | 7 | 7 | 100% | completed | 0c4392c |
| 6 | [phase-06-settings-copy-and-manual-e2e.md](./phase-06-settings-copy-and-manual-e2e.md) | 8 | 1 | 13% | blocked | - (depends on Phase 7) |
| 7 | [phase-07-orchestrator-default-provider-routing.md](./phase-07-orchestrator-default-provider-routing.md) | 7 | 7 | 100% | completed | 86117c0 |
| **Total** | | **50** | **35** | **70%** | | |

## Phase 의존성

```
01 (orchestrator review + auto) ──┐
                                  ├──▶ 02 (followup) ──┐
03 (crop migration)               ┤                    ├──▶ 05 (cleanup) ──▶ 06 (UI + manual E2E)
                                  └──▶ 04 (sse legacy) ┘
```

병렬 가능: 01 ∥ 03 (의존성 없음). 01·03 완료 후 02 ∥ 04.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | orchestrator review mode 통합 — 후속 phase 전제 | 30분 |
| P0 | Phase 3 | crop 모드 jobRunner 의존 제거 — 후속 phase 전제 | 20분 |
| P0 | Phase 4 | sse.ts legacy 일괄 제거 — 가장 risk 큰 phase | 45분 |
| P1 | Phase 2 | followup route legacy 제거 | 15분 |
| P1 | Phase 5 | dead code 정리 | 30분 |
| P1 | Phase 6 | UI 카피 + 수동 E2E | 20분 |

## 권장 실행 순서

1. Phase 1, Phase 3 병렬 (서로 독립)
2. Phase 1·3 완료 후 Phase 2, Phase 4 병렬
3. Phase 2·4 완료 후 Phase 5
4. Phase 5 완료 후 Phase 6

## 검증 체크리스트

### 공통 검증
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] `cd ngd-studio && npx vitest run server/stages/__tests__/ server/__tests__/ lib/__tests__/ --reporter=basic` 통과
- [ ] 회귀: navigator action 5종 호출 시 SSE event 흐름이 기존과 동등 (stage / log / question / result)
- [ ] 회귀: create 처음~끝 실행 시 outputs/*.hwpx 정상 생성
- [ ] 회귀: review 처음~끝 실행 시 입력 hwpx 가 수정되고 리포트 생성

### Cross-platform 검증 (CLAUDE.md 규약)
- [ ] `path.join` / `path.resolve` 사용 (문자열 `"/"` 하드코딩 없음)
- [ ] Python 실행 시 `process.platform === "win32" ? "python" : "python3"` 패턴 (해당 경우)
- [ ] 임시 파일 경로는 `os.tmpdir()` (해당 경우)

## 관련 문서
- [README](./README.md)
