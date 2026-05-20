---
task: create-pipeline-stage-split
phase_count: 4
created: 2026-05-21
---

# create-pipeline-stage-split — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-checker-max-attempts.md](./phase-01-checker-max-attempts.md) | 6 | 6 | 100% | completed | c77056b |
| 2 | [phase-02-verifier-skip.md](./phase-02-verifier-skip.md) | 7 | 7 | 100% | completed | 4dd1075 |
| 3 | [phase-03-resume-from-ui.md](./phase-03-resume-from-ui.md) | 5 | 5 | 100% | completed | 5f9a02c |
| 4 | [phase-04-extraction-edit-rerun.md](./phase-04-extraction-edit-rerun.md) | 6 | 5 | 83% | completed | f867f48 |
| **Total** | | **24** | **23** | **96%** | | |

## Phase 의존성

```
Phase 1 ── (독립) ──┐
Phase 2 ── (독립) ──┤
Phase 3 ── (독립) ──┤
                   ↓
              Phase 4 (Phase 3의 재시작 UI 인프라 활용)
```

Phase 1/2/3은 scope 일부 교차 (`server/stages/orchestrator.ts`, `app/settings/page.tsx`, `lib/ai/settings.ts`, `lib/useJobRunner.ts`)로 **순차 실행 강제**.
Phase 4는 Phase 3의 `resumeFrom` UI 노출 + `lib/store.ts` buildResumeStages 동작을 전제로 함.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | checker auto-fix 시도 횟수를 사용자가 조정 | 15분 |
| P0 | Phase 2 | verifier 단독 스킵 (solver 출력만으로 진행) | 30분 |
| P1 | Phase 3 | 재시작 지점(extractor~checker) UI 선택 노출 | 20분 |
| P1 | Phase 4 | "추출 편집 → solver 재실행" 버튼 | 30분 |

## 권장 실행 순서

1. **Phase 1** → settings 타입/UI 패턴 확립 (작은 변경, 후속 phase 가이드)
2. **Phase 2** → orchestrator 분기 패턴 확립 (verifier-skip)
3. **Phase 3** → resumeFrom UI 노출 (Phase 4 전제)
4. **Phase 4** → extraction-editor + resumeFrom 결합

## 검증 체크리스트

### 공통 검증
- [ ] `pnpm --filter ngd-studio exec tsc --noEmit` 통과
- [ ] `pnpm --filter ngd-studio exec vitest run lib/__tests__ lib/ai/__tests__ server/stages/__tests__ --reporter=basic` 통과
- [ ] `/create` 페이지에서 PDF 업로드 → 빌드 → HWPX 산출까지 정상 동작 (full path 회귀 확인)
- [ ] `/settings`에서 추가된 옵션 변경 후 새로고침 → localStorage 복원 확인

### per-phase 검증
- 각 phase 파일의 `## 검증` 섹션 참조

## 관련 문서
- [README](./README.md)
