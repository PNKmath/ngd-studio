---
task: deepseek-v4-provider-roadmap
phase_count: 6
created: 2026-05-16
---

# DeepSeek V4 provider roadmap — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-external-api-policy.md](./phase-01-external-api-policy.md) | 6 | 6 | 100% | completed | local |
| 2 | [phase-02-deepseek-hidden-adapter.md](./phase-02-deepseek-hidden-adapter.md) | 7 | 7 | 100% | completed | local |
| 3 | [phase-03-stage-override-data.md](./phase-03-stage-override-data.md) | 7 | 7 | 100% | completed | local |
| 4 | [phase-04-stage-override-settings-ui.md](./phase-04-stage-override-settings-ui.md) | 6 | 6 | 100% | completed | local |
| 5 | [phase-05-provider-telemetry.md](./phase-05-provider-telemetry.md) | 6 | 6 | 100% | completed | local |
| 6 | [phase-06-auto-stage-recommendation.md](./phase-06-auto-stage-recommendation.md) | 6 | 6 | 100% | completed | local |
| **Total** | | **38** | **38** | **100%** | | |

## Phase 의존성

```text
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5 ──▶ Phase 6
```

Phase 1에서 외부 API 전송 정책이 확정되어야 이후 구현이 가능하다. Phase 2 이후는 provider contract, settings storage, SSE job metadata, telemetry가 이어지는 순차 작업이다.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 외부 API 전송 정책과 opt-in 범위 확정 | 30분 |
| P0 | Phase 2 | DeepSeek V4 제한 stage adapter를 숨김 상태로 추가 | 30분 |
| P1 | Phase 3 | stage override 데이터 구조와 `/api/run` 전달 | 30분 |
| P1 | Phase 4 | settings 화면에서 stage override 관리 | 30분 |
| P1 | Phase 5 | provider별 실행 결과 telemetry 기록 | 30분 |
| P2 | Phase 6 | 관측치 기반 `auto` stage 추천 규칙 도입 | 30분 |

## 권장 실행 순서

1. Phase 1에서 정책 문서를 먼저 확정하고 금지 전송 범위를 체크리스트화한다.
2. Phase 2에서 DeepSeek V4 adapter를 추가하되 선택 UI에는 노출하지 않는다.
3. Phase 3에서 작업 전체 기본 provider와 stage override 구조를 분리한다.
4. Phase 4에서 사용자가 stage별 provider를 opt-in으로 관리할 수 있게 한다.
5. Phase 5에서 job metadata에 실행 시간, 재시도, 실패, 수정 필요 여부를 축적한다.
6. Phase 6에서 충분한 telemetry가 있는 stage만 `auto` 추천 대상으로 삼는다.

## 검증 체크리스트

### 공통 검증
- [x] `cd ngd-studio && pnpm test` 통과
- [x] `cd ngd-studio && npx vitest run lib/__tests__/provider*.test.ts --reporter=basic` 통과
- [x] `cd ngd-studio && npx tsc --noEmit` 통과
- [x] 정책 확정 전 원본 PDF/HWPX/문제 이미지 일괄 전송 코드가 추가되지 않음
- [x] 사용자 opt-in 없이 `deepseek-v4`가 자동 fallback으로 선택되지 않음

## 관련 문서
- [README](./README.md)
- [AI provider adapters roadmap](../ai-provider-adapters/roadmap.md)
- [AI provider adapters checklist](../ai-provider-adapters/checklist.md)
