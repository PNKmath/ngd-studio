---
task: hwpx-syn-div-pascal-selector
phase_count: 5
created: 2026-05-19
---

# HWPX synthetic_division + Pascal triangle — extractor 기반 selector — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경 요약

`hwpx-fixture-ref-resolution` 작업의 Phase 4 selector 구성 단계에서, `synthetic_division_template_1~4` (4종) 와 `Pascal_triangle_1~3` (3종) fixture 는 문제별 **다항식 차수 / 중첩 횟수 / 표 구조 변동** 에 따라 동적으로 결정되어야 함이 확인됐다. 단순 행 수 / 열 수 기반 selector 만으로는 부족하고, 현 fixture pool (4 + 3) 만으로는 모든 케이스를 표현할 수 없다.

본 작업은 다음을 일괄 처리한다:

1. extractor (ngd-studio) 가 문제에서 추출해야 하는 syn_div / Pascal 메타데이터 스키마 정의
2. 현 fixture pool 의 구조 분석 vs 필요 케이스의 gap 식별
3. 부족한 fixture 보강 (사용자 본 추출 또는 신규 작성)
4. selector 함수 (`make_synthetic_division_table`, `make_pascal_triangle`) 구현 + builder dispatch
5. E2E — 실 시험지 또는 합성 데이터로 빌드 + 시각 검증

배포 전 필수 작업 — 시험지 제작 / 오검 양쪽 흐름에 syn_div / Pascal 문제가 적게는 한 시험지당 1~2개 등장한다.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-metadata-schema-gap.md](./phase-01-metadata-schema-gap.md) | 5 | 0 | 0% | pending | - |
| 2 | [phase-02-fixture-augmentation.md](./phase-02-fixture-augmentation.md) | 4 | 0 | 0% | pending | - |
| 3 | [phase-03-extractor-update.md](./phase-03-extractor-update.md) | 4 | 0 | 0% | pending | - |
| 4 | [phase-04-builder-selector.md](./phase-04-builder-selector.md) | 6 | 0 | 0% | pending | - |
| 5 | [phase-05-e2e-verification.md](./phase-05-e2e-verification.md) | 5 | 0 | 0% | pending | - |
| **Total** | | **24** | **0** | **0%** | | |

## Phase 의존성

```
1 ──┬─▶ 2 ─┐
    └─▶ 3 ─┼─▶ 4 ─▶ 5
```

- Phase 2 와 3 은 Phase 1 완료 후 병렬 가능 (scope 격리: 2 = resources/, 3 = ngd-studio/)
- Phase 4 는 1, 2, 3 모두 완료 후 시작 (fixture + extractor 출력 둘 다 필요)

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 스키마 + gap 분석 (모든 후속의 토대) | 60분 |
| P0 | Phase 2 | 신규 fixture 보강 — **사용자 결정 필요** | 60~120분 |
| P0 | Phase 3 | extractor 갱신 | 60분 |
| P0 | Phase 4 | builder selector + dispatch | 60분 |
| P1 | Phase 5 | E2E 시각 검증 — **사용자 시각 확인 필요** | 30~60분 |

## 권장 실행 순서

1. Phase 1 (단독, 분석 산출)
2. Phase 2 + Phase 3 (병렬 가능, 단 Phase 2 는 사용자 개입 사전 승인 필요)
3. Phase 4 (selector 구현)
4. Phase 5 (시각 검증)

## 전제

- **선행 작업**: `hwpx-fixture-ref-resolution` (특히 Phase 5 — E2E 검증) 가 완료되어 bogi / ganada / inc_dec selector 가 안정화된 후 시작 권장. fixture pool 의 ref 인덱스가 우리 header 기준으로 정렬돼 있어야 본 작업의 신규 fixture 추가도 동일 인덱스 체계로 가능.
- **배포 필수**: 사용자 결정 (2026-05-19) — syn_div / Pascal 은 "옵션 B (보류)" 가 아닌 "옵션 A (fixture pool + extractor 기반)" 로 가야 함.

## 검증 체크리스트

### 공통 검증

- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` 빌드 + validate exit 0
- [ ] 신규 syn_div / Pascal 케이스 빌드 시 정답 본 (사용자 양식지) 과 시각 일치 (Phase 5)
- [ ] 기존 빌드 (bogi/ganada/inc_dec 등) 회귀 없음

### 회귀 검증

- [ ] hwpx-fixture-ref-resolution 의 18개 user-range fixture remap 결과 유지
- [ ] `make_synthetic_division_table` 단일 fixture 경로(레거시) 가 새 selector 와 충돌하지 않음

### 크로스 플랫폼

- [ ] Python 모듈 import 가능 (`python3 -c "import tables, shapes, assemble"`)
- [ ] extractor TS 변경 `npx tsc --noEmit` 통과
- [ ] Windows 환경 동작 확인 (사용자 별도)

## 범위 밖 (touch 금지)

- hwpx-fixture-ref-resolution 작업 산출물 (Phase 5 시각 검증 통과 결과)
- bogi / ganada / inc_dec selector (이미 다른 작업에서 처리)
- checker / verifier / figure / 기타 stage
- 양식지 PDF 원본

## 관련 문서

- `docs/planning/hwpx-fixture-ref-resolution/` — 선행 작업 (LLM 제거 + 18개 fixture remap + 기본 selector)
- `resources/hwpx_base/synthetic_division_template_1~4.xml` — 현 syn_div fixture
- `resources/hwpx_base/Pascal_triangle_1~3.xml` — 현 Pascal fixture
- `resources/hwpx_base/synthetic_division_template.xml` — 레거시 단일 fixture (당분간 fallback 으로 유지)
- `ngd-studio/server/stages/extractor.ts` — extractor TS 코드
- `tables.py`, `shapes.py`, `assemble.py` — builder Python 모듈
