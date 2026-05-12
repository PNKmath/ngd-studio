---
task: inputs-outputs-housekeeping
phase_count: 7
created: 2026-05-12
---

# inputs/outputs V3 기준 정리 + .gitignore 정책 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-inventory.md](./phase-01-inventory.md) | 5 | 5 | 100% | completed | 93707fd |
| 2 | [phase-02-standard-paths.md](./phase-02-standard-paths.md) | 4 | 4 | 100% | completed | c7cadf0 |
| 3 | [phase-03-archive-structure.md](./phase-03-archive-structure.md) | 5 | 5 | 100% | completed | 49096a4 |
| 4 | [phase-04-outputs-execute.md](./phase-04-outputs-execute.md) | 5 | 5 | 100% | completed | 3d56b10 |
| 5 | [phase-05-inputs-create-execute.md](./phase-05-inputs-create-execute.md) | 6 | 6 | 100% | completed | c6e62cf |
| 6 | [phase-06-inputs-review-execute.md](./phase-06-inputs-review-execute.md) | 4 | 4 | 100% | completed | cbd8dc5 |
| 7 | [phase-07-verify-report.md](./phase-07-verify-report.md) | 4 | 4 | 100% | completed | 5677097 |
| **Total** | | **33** | **33** | **100%** | | |

## Phase 의존성

```
Phase 1 ─┐
         ├──▶ Phase 3 ─┬──▶ Phase 4 ─┐
Phase 2 ─┘             ├──▶ Phase 5 ─┼──▶ Phase 7
                       └──▶ Phase 6 ─┘
```

병렬 가능 쌍:
- Phase 1 ∥ Phase 2 (분석/문서화, scope 분리)
- Phase 4 ∥ Phase 5 ∥ Phase 6 (각 폴더 독립)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | inventory + 분류 시안 — 전체 작업의 기반 | 25분 |
| P0 | Phase 2 | 양식지 표준 경로 — 다음 task의 입력 | 10분 |
| P1 | Phase 3 | archive 구조 + .gitignore | 20분 |
| P1 | Phase 4 | outputs/ 실행 | 25분 |
| P1 | Phase 5 | inputs/시험지 제작/ 실행 | 20분 |
| P1 | Phase 6 | inputs/오검/ 실행 | 15분 |
| P2 | Phase 7 | 검증 + 다음 task용 경로 보고 | 10분 |

## 권장 실행 순서

1. Phase 1 ∥ Phase 2 (병렬)
2. Phase 3 (1, 2 완료 후)
3. Phase 4 ∥ Phase 5 ∥ Phase 6 (병렬)
4. Phase 7 (4, 5, 6 완료 후)

## 검증 체크리스트

### 공통 검증
- [ ] `ls outputs/` 결과가 V3 산출물 + 일관된 파일명 규칙만
- [ ] `ls inputs/시험지 제작/` 양식지 0개 (또는 표준 1개) + 활성 작업 캐시만
- [ ] `ls inputs/오검/` 체크리스트 + 활성 작업본만
- [ ] `git status --ignored` 결과로 .gitignore 적용 확인
- [ ] `archive/` 폴더 구조 일관성
- [ ] V3 SKILL.md 본문 경로 vs 실제 디렉터리 일치 보고서 작성 (수정은 다음 task)

### 후속 작업 인계
- Phase 7의 최종 보고서가 다음 task `exam-skill-v3-promotion`의 입력이 됨
- 특히 양식지 표준 경로(Phase 2 산출물)가 V3 SKILL.md 본문 수정의 기준

## 관련 문서
- [Phase 1 분류 시안 (inventory.md)](./inventory.md) — Phase 1 산출물
- [Phase 2 표준 경로 (standard-paths.md)](./standard-paths.md) — Phase 2 산출물
- [Phase 7 최종 보고서 (final-report.md)](./final-report.md) — Phase 7 산출물
