---
task: checker-stage-ux-semantics
phase_count: 7
created: 2026-05-23
---

# checker stage UX/시맨틱 정리 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-orchestrator-skip-logs.md](./phase-01-orchestrator-skip-logs.md) | 4 | 4 | 100% | completed | 4a9bcb0 (e2e: skip) |
| 2 | [phase-02-ui-checkbox-tooltip.md](./phase-02-ui-checkbox-tooltip.md) | 3 | 3 | 100% | completed | 8b1c20b (e2e: manual_pending) |
| 3 | [phase-03-regression-tests.md](./phase-03-regression-tests.md) | 3 | 3 | 100% | completed | 05571fb (e2e: skip) |
| 4 | [phase-04-checker-guard-leak.md](./phase-04-checker-guard-leak.md) | 4 | 4 | 100% | completed | 1264b7c+2c1730d (e2e: manual_pending) |
| 5 | [phase-05-skip-log-message.md](./phase-05-skip-log-message.md) | 2 | 2 | 100% | completed | 8d5809c (e2e: skip) |
| 6 | [phase-06-ui-label-layout.md](./phase-06-ui-label-layout.md) | 5 | 5 | 100% | completed | 0c722dc (e2e: manual_pending) |
| 7 | [phase-07-remove-log-pdf-button.md](./phase-07-remove-log-pdf-button.md) | 2 | 2 | 100% | completed | 24cfcd7 (e2e: manual_pending) |
| **Total** | | **23** | **23** | **100%** | | |

## Phase 의존성

```
Phase 1 (orchestrator)
  ├─→ Phase 2 (UI checkbox + 툴팁)   ← scope: app/create/page.tsx
  └─→ Phase 3 (회귀 테스트)            ← scope: server/stages/__tests__/checker.test.ts

후속 4건 (2026-05-23 추가):
Phase 4 (checker 가드 누락 path 추적)  ← scope: server/stages/orchestrator.ts (+ 추적용 read)
  └─→ Phase 5 (skip 로그 메시지 단축)   ← scope: server/stages/orchestrator.ts

Phase 6 (UI 라벨/위치/스타일 통일)     ← scope: app/create/page.tsx
  └─→ Phase 7 ('PDF 열기' 버튼 제거)   ← scope: app/create/page.tsx

{4,5} 와 {6,7} 는 scope disjoint → /phase-run 이 병렬 dispatch 가능.
Phase 2·3 은 scope disjoint → /phase-run 이 병렬 dispatch 가능.
```

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | orchestrator: 0=skip 분기 + builder/checker 완료 logEvent | 15-20분 |
| P1 | Phase 2 | UI: number input → checkbox + 툴팁 정정 | 10분 |
| P1 | Phase 3 | checker.test.ts 회귀 보강 | 15분 |
| P0 | Phase 4 | checker 가드 누락 path 추적 + 적용 (legacy/resume 흐름 의심) | 20-30분 |
| P2 | Phase 5 | orchestrator skip 로그 메시지 단축 | 5분 |
| P1 | Phase 6 | UI '자동수정' → '자동검수' + 풀이검증 좌측 + 자동분할 스타일 통일 | 15분 |
| P2 | Phase 7 | 로그 영역 'PDF 열기' 버튼 제거 | 5분 |

## 권장 실행 순서

1. **Phase 1** — orchestrator 의 시맨틱 확정 (0=skip 동작). 후속 2·3 은 이 시맨틱을 전제.
2. **Phase 2·3 병렬** — UI 와 테스트는 서로 독립.
3. **Phase 4·6 병렬** — orchestrator 추적과 UI 재구성은 서로 독립.
4. **Phase 5 (Phase 4 완료 후), Phase 7 (Phase 6 완료 후)** — 각각 같은 파일 순차.

## 검증 체크리스트

### 공통 검증
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과
- [ ] `cd ngd-studio && npx vitest run server/stages/__tests__/checker.test.ts --reporter=basic` 통과

### Phase 1 전용 (수동 smoke)
- [ ] 설정 자동수정 = 0 → 새 잡 figure 후 확인 완료 클릭 → checker 단계 미발화 (stage indicator 안 뜸)
- [ ] 설정 자동수정 ≥ 1 → checker 진행, 완료 시 로그 패널에 "검수 완료: N건 issue" 한 줄 노출
- [ ] builder 완료 시 로그 패널에 "HWPX 조립 완료 → outputs/<path>" 한 줄 노출

### Phase 2 전용 (수동 smoke)
- [ ] 자동수정 컨트롤이 checkbox 로 표시 (on=2, off=0 으로 저장됨)
- [ ] 툴팁이 "체크 해제 = HWPX 검수 단계 생략 / 체크 = 검수 후 자동수정 적용" 의미를 명확히 전달
- [ ] 기존 localStorage 에 number 값이 있어도 checkbox 상태로 정상 로드

### Phase 3 전용
- [ ] runCheckerWithAutoFix 의 maxAttempts 1·2·3 별 동작 명세 테스트 추가/검증
- [ ] (선택) orchestrator level 에서 checkerMaxAttempts=0 시 checker stage 진입 안 함 단위 테스트

### Phase 4 전용 (수동 smoke)
- [ ] 자동검수 체크 해제 + 새 작업 → checker stage 미발화 ([checker] 로그 라인 안 뜸)
- [ ] 자동검수 체크 + 새 작업 → checker stage 정상 진행

### Phase 5 전용
- [ ] orchestrator skip 로그 텍스트 검증 (`grep "checker 단계 건너뜀"` 한 줄, 괄호 부연 없음)

### Phase 6 전용 (수동 smoke)
- [ ] '자동수정' 라벨이 '자동검수'로 노출
- [ ] '자동검수' 컨트롤이 '풀이검증' 왼쪽에 배치
- [ ] 체크박스 스타일이 '자동 분할'/'이미지 정리' 와 동일 (className·spacing 일치)

### Phase 7 전용 (수동 smoke)
- [ ] No Active Session placeholder (로그 영역) 에 'PDF 열기' 버튼 미노출
- [ ] 헤더의 'PDF 열기' 버튼(659행 부근) 은 유지

## 관련 문서
- 직전 task: `docs/planning/create-page-followup-uxbugs/` (이번 작업의 직접적 후속)
- 메모리: `feedback-uiux-consistency` (UI 일관성 — verifierMaxAttempts number input 과 차이 정당화 필요), `feedback-systematic-audit` (checker.ts off-by-one 보정 시 회귀 위험)

## E2E 카탈로그 매칭

- Phase 1·2 모두 `create-v4-full-pipeline` (type: full, trigger: last_touch) 와 매칭
- 마지막 touch = Phase 2 → `e2e_triggers: [create-v4-full-pipeline]` 자동 부여
- Gemini API 한도 해소됨 — 자동 발화 OK
- Phase 3 (테스트) 는 catalog 시나리오와 무관 → e2e_refs 비어있음

### 후속 4건 (Phase 4-7)
- Phase 4·5 (orchestrator.ts) + Phase 6·7 (page.tsx) 모두 `create-v4-full-pipeline` 매칭
- 마지막 touch = Phase 6 (UI 변경) → `e2e_triggers: [create-v4-full-pipeline]` 부여
- **사용자 결정**: e2e 는 직전 task 패턴대로 **수동 smoke 로 대체** (자동 dispatch 안 함). 재발화 필요 시 `/phase-e2e checker-stage-ux-semantics --phase 6`.
