---
task: hwpx-build-llm-removal
phase_count: 6
created: 2026-05-18
---

# HWPX Build LLM 의존성 제거 + 리팩토링 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경 요약

HWP build 파이프라인(`build_hwpx.py` + `fix_namespaces.py` + `validate.py`)은 이미 순수 Python으로 동작하나, 다음 두 경로에서 LLM이 build 호출을 트리거하고 있다:

1. **legacy skill 경로** (`shouldUseCodeOrchestrator=false`): Claude가 `ngd-exam-create` skill의 Step 6에서 `Bash("python3 build_hwpx.py ...")`를 직접 호출
2. **deterministic builder 실패 fallback**: `sse.ts` / `orchestrator.ts`가 실패 시 `runLegacyPromptJob`으로 LLM에 재시도 위임

본 작업은 build 단계를 **항상 deterministic 코드 경로**로 단일화하고, 그 과정에서 `build_hwpx.py`(1232줄)를 모듈 분리하며, base_hwpx 자원을 `.claude/` 바깥의 `resources/`로 이동한다. checker/extractor/solver 등 다른 stage의 LLM 의존성은 범위 밖.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-resource-relocation.md](./phase-01-resource-relocation.md) | 5 | 5 | 100% | completed | 00bc41c |
| 2 | [phase-02-build-hwpx-modularize.md](./phase-02-build-hwpx-modularize.md) | 6 | 6 | 100% | completed | 43be499 |
| 3 | [phase-03-skill-doc-cleanup.md](./phase-03-skill-doc-cleanup.md) | 4 | 4 | 100% | completed | 6e2f59d |
| 4 | [phase-04-sse-orchestrator-llm-removal.md](./phase-04-sse-orchestrator-llm-removal.md) | 5 | 5 | 100% | completed | (pending) |
| 5 | [phase-05-unit-tests.md](./phase-05-unit-tests.md) | 4 | 0 | 0% | pending | - |
| 6 | [phase-06-e2e-build-verification.md](./phase-06-e2e-build-verification.md) | 4 | 0 | 0% | pending | - |
| **Total** | | **28** | **0** | **0%** | | |

## Phase 의존성

```
Phase 1 ──┬──▶ Phase 2 ──┐
          ├──▶ Phase 3 ──┤
                          ▼
                   Phase 4 ──▶ Phase 5 ──▶ Phase 6
```

- Phase 2 와 Phase 3 은 scope 무겹침 → 병렬 가능
- Phase 4 는 Phase 3 의 SKILL.md 변경 후 sse.ts 합성 결정에 영향
- Phase 6 (E2E) 은 모든 코드/문서 변경 완료 후

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 자원 이동 (다른 phase 기반) | 30분 |
| P0 | Phase 4 | LLM 의존성 제거 핵심 | 40분 |
| P1 | Phase 2 | 모듈 분리 (리팩토링) | 60분 |
| P1 | Phase 3 | SKILL.md 정리 | 20분 |
| P2 | Phase 5 | 단위 테스트 갱신 | 25분 |
| P2 | Phase 6 | E2E 검증 | 30분 |

## 권장 실행 순서

1. Phase 1 (단독)
2. Phase 2 ∥ Phase 3 (병렬)
3. Phase 4
4. Phase 5
5. Phase 6 (사용자 확인 필요)

## 검증 체크리스트

### 공통 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run` 통과 (특히 `sse.branch.test.ts`, `stageFoundation.test.ts`)
- [ ] `python3 build_hwpx.py <exam_data.json> outputs` 단독 실행 성공
- [ ] `fix_namespaces.py` + `validate.py --fix` 통과
- [ ] 결과 HWPX 한컴오피스에서 열림 (Phase 6에서 사용자 확인)

### 회귀 검증
- [ ] Phase 2 모듈 분리 전후 동일 `exam_data.json` 빌드 결과 byte-identical 또는 의미적 동등

### 크로스플랫폼
- [ ] Python 실행 분기 `process.platform === "win32" ? "python" : "python3"` 패턴 유지
- [ ] 경로는 `path.join` / `pathlib` 사용, 문자열 `"/"` 하드코딩 없음
- [ ] 신규 `resources/` 경로가 Windows에서도 정상 resolve

## 범위 밖 (touch 금지)

- checker stage 의 LLM 의존성 여부
- extractor / solver / verifier / figure stage 의 LLM provider 선택
- legacy 경로의 LLM provider 라우팅 자체 (build만 떼내는 게 목표)
- 양식지 hwpx 원본 파일 자체 (사용자가 별도로 쪼갬)

## 관련 문서

- `.claude/skills/ngd-exam-create/SKILL.md` — Step 6/8 build 호출
- `docs/hwpx-templates.md` — base_hwpx 위치 안내
- `docs/builder-upgrade-todo.md` — base_hwpx 추출 이력
