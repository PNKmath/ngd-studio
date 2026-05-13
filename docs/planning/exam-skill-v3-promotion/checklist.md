---
task: exam-skill-v3-promotion
phase_count: 6
created: 2026-05-12
---

# V3 → 표준 "시험지 제작" 승격 + studio 풀 일반화 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-studio-regression-tests.md](./phase-01-studio-regression-tests.md) | 6 | 6 | 100% | completed | 95c8b53 |
| 2 | [phase-02-claude-integrity-tests.md](./phase-02-claude-integrity-tests.md) | 5 | 5 | 100% | completed | 6c6432f |
| 3 | [phase-03-skill-promotion.md](./phase-03-skill-promotion.md) | 6 | 6 | 100% | completed | fdbe82b |
| 4 | [phase-04-studio-generalization.md](./phase-04-studio-generalization.md) | 8 | 8 | 100% | completed | 198341b |
| 5 | [phase-05-backend-cleanup.md](./phase-05-backend-cleanup.md) | 6 | 6 | 100% | completed | c3ec88d |
| 6 | [phase-06-claude-md-update.md](./phase-06-claude-md-update.md) | 4 | 4 | 100% | completed | d878b8a |
| **Total** | | **35** | **29** | **83%** | | |

## Phase 의존성

```
Phase 1 ─┐
         ├──▶ Phase 3 ──▶ Phase 4 ─┬──▶ Phase 5
Phase 2 ─┘                         └──▶ Phase 6
```

병렬 가능 쌍:
- Phase 1 ∥ Phase 2 (scope 분리: ngd-studio vs .claude)
- Phase 5 ∥ Phase 6 (scope 분리: 파일 삭제 vs CLAUDE.md)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | studio 회귀 테스트 baseline | 30분 |
| P0 | Phase 2 | .claude 무결성 baseline | 20분 |
| P1 | Phase 3 | V3 SKILL.md 승격 (이름·명령어 일반화) | 10분 |
| P1 | Phase 4 | studio 풀 일반화 (이름·페이지·mode) | 40분 |
| P2 | Phase 5 | V1/V2 backend 잔재 정리 | 15분 |
| P2 | Phase 6 | CLAUDE.md V3 흐름 반영 | 15분 |

## 권장 실행 순서

1. Phase 1 ∥ Phase 2 (병렬)
2. Phase 3 (1, 2 완료 후)
3. Phase 4 (3 완료 후)
4. Phase 5 ∥ Phase 6 (병렬)

## 검증 체크리스트

### 공통 검증
- [x] Phase 1 회귀 테스트가 baseline → 갱신본 모두 통과 (Phase 6 후 vitest 27/27 pass, 2026-05-13)
- [x] Phase 2 무결성 테스트가 Phase 3, 5 후에도 통과 (`check_integrity.sh` ALL PASS, 2026-05-13)
- [x] `grep -rn "ngd-exam-create-v3\|ngd-exam-reader" .claude/ ngd-studio/lib ngd-studio/app CLAUDE.md` → 0건 (Phase 5 검증, 빌드 캐시 제외)
- [x] `grep -rn "create-v3\|resume-v3\|V3 resume\|V3 작업" ngd-studio/lib ngd-studio/app ngd-studio/server` → 0건 (Phase 4 검증)
- [ ] `cd ngd-studio && npm run build` 통과 (Phase 5/6 ngd-studio 소스 변경 0 → skip)
- [x] `cd ngd-studio && npm test` 통과 (Phase 6 후 vitest 27/27, 2026-05-13)

### 보존 항목 (절대 건드리지 말 것)
- [ ] `.claude/skills/ngd-exam-create/scripts/` (fix_namespaces.py, validate.py) 유지
- [ ] `.claude/skills/ngd-exam-create/base_hwpx/` (XML 템플릿) 유지
- [ ] `.claude/skills/ngd-exam-crop/` (PDF 크롭 스킬) 유지
- [ ] `ngd-studio/app/create-v4/` (crop UI, 사용자 디벨롭 의사) 유지
- [ ] `ngd-studio/inputs/png/양식지 헤더.png` 유지
- [ ] `workspaces/crop/gemini_crop.py` (crop 스킬 본체) 유지

## 직전 task 산출물 (입력)

- [docs/planning/inputs-outputs-housekeeping/final-report.md](../inputs-outputs-housekeeping/final-report.md)
- [docs/planning/inputs-outputs-housekeeping/standard-paths.md](../inputs-outputs-housekeeping/standard-paths.md)

## 관련 문서
- 양식지 표준 경로: `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` (변경 불필요, housekeeping Phase 2 확정)
