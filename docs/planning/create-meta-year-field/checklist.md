---
task: create-meta-year-field
phase_count: 5
created: 2026-05-21
---

# create 페이지 연도 필드 추가 + HWPX 빌드 연결 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run` 이 이 파일을 읽어 다음 phase 를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-types-year.md](./phase-01-types-year.md) | 5 | 5 | 100% | completed | 2ca8cfa |
| 2 | [phase-02-metaform-ui.md](./phase-02-metaform-ui.md) | 8 | 8 | 100% | completed | 21d9fd9 |
| 3 | [phase-03-filename-prefill.md](./phase-03-filename-prefill.md) | 5 | 5 | 100% | completed | 665bb8f |
| 4 | [phase-04-prompts-year.md](./phase-04-prompts-year.md) | 6 | 6 | 100% | completed | 2e84f9f |
| 5 | [phase-05-e2e-build-year.md](./phase-05-e2e-build-year.md) | 7 | 7 | 100% | completed | d07aab6 |
| **Total** | | **31** | **31** | **100%** | | |

## Phase 의존성

```
Phase 1 (타입)
   ├──▶ Phase 2 (UI)
   ├──▶ Phase 3 (parser)
   └──▶ Phase 4 (prompts)
                 └──▶ Phase 5 (e2e 빌드 검증)
```

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | 1 | 타입 레이어 통일 (이후 모든 phase 의 전제) | 10분 |
| P0 | 2 | UI — 사용자가 실제로 연도 입력 가능 | 30분 |
| P0 | 5 | 빌드 산출물에 연도가 정확히 박히는지 검증 | 30분 |
| P1 | 3 | 파일명 drop prefill (편의 기능) | 15분 |
| P1 | 4 | solver/verifier 컨텍스트 정확도 (다년도 작업 시 강함) | 20분 |

## 권장 실행 순서

1. Phase 1 단독 실행 (타입 기반 마련)
2. Phase 2, 3, 4 병렬 실행 가능 (scope 교집합 없음 — UI / parser / prompts 분리)
   - 단, Phase 2 와 Phase 1 은 `extractorPrompt.ts` 변경 없이도 UI 동작 가능하므로 Phase 1 의 store/MetaForm 타입만 완료되면 Phase 2 시작 가능
3. Phase 5 는 2/3/4 모두 완료 후 (UI 입력 → 빌드 흐름 end-to-end 검증)

## 검증 체크리스트

### 공통 검증

- [ ] `npx tsc --noEmit` 통과 (모든 phase 후)
- [ ] `npx vitest run ngd-studio/lib/pdf/__tests__/filenameMeta.test.ts --reporter=basic` 통과
- [ ] `npx vitest run ngd-studio/server/stages/__tests__/prompts.test.ts --reporter=basic` 통과
- [ ] `pnpm build` 통과
- [ ] phase-05 fixture 빌드 → section0.xml + 파일명 연도 검증

### E2E 카탈로그 매칭

- `create-v4-full-pipeline` (phase 1, 2, 3, 4, 5) — UI → build pipeline
- `build-hwpx-cli` (phase 5) — server-side 조립 단독
- catalog mutation 적용 완료 (2026-05-21): `app/create-v4/**` → `app/create/**`, `lib/pdf/**` 추가

## 관련 문서

- [README](./README.md)
