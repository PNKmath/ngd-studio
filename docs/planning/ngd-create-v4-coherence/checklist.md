---
task: ngd-create-v4-coherence
phase_count: 5
created: 2026-05-19
---

# NGD create v4 정합성 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경 요약

`hwpx-fixture-ref-resolution` (방금 종료) 의 디버깅 과정에서 시스템 전반의 **삼각 정합성 부재** 가 명백해졌다:

1. **fixture 의미 불투명** — 파일명 (`choice_table_5x5`, `9x4`) 이 표 차원만 표현, 실제 용도 (명제 템플릿 / 그림 객관식) 안 드러남
2. **데이터 스키마 합의 부재** — extractor (`ngd-studio/server/stages/extractor.ts`) 출력과 builder (`tables.py`, `shapes.py`, `assemble.py`) 입력 사이 명세 없음. fixture selector 가 잘못 라우팅하거나 데이터 위치가 placeholder 와 안 맞는 케이스 반복
3. **syn_div + Pascal selector 미연결** — fixture 7종 추가됐으나 코드 미연결, 별도 plan 으로 park (본 plan 이 흡수)

본 작업은 시험지 제작 (ngd-exam-create) 흐름의 V4 단계로 격상. **fixture 의미 ↔ 데이터 스키마 ↔ 빌더 selector** 의 삼각 일치를 확보하여, 사용자 양식지 본 (`outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx`) 수준의 빌드 결과를 코드만으로 결정론적으로 생성하는 것을 목표로 한다.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-fixture-audit-rename-design.md](./phase-01-fixture-audit-rename-design.md) | 5 | 5 | 100% | completed | c06eef4 |
| 2 | [phase-02-fixture-rename-apply.md](./phase-02-fixture-rename-apply.md) | 5 | 5 | 100% | completed | 7b034bc |
| 3 | [phase-03-schema-extractor-builder.md](./phase-03-schema-extractor-builder.md) | 6 | 6 | 100% | completed | 3922b91 |
| 4 | [phase-04-syn-div-pascal-integration.md](./phase-04-syn-div-pascal-integration.md) | 8 | 8 | 100% | completed | 49d4126 |
| 5 | [phase-05-e2e-verification.md](./phase-05-e2e-verification.md) | 10 | 10 | 100% | completed | (Phase 5 commit) |
| **Total** | | **34** | **34** | **100%** | | |

## Phase 의존성

```
1 → 2 → 3 → 4 → 5
```

모두 직렬 — 각 단계의 산출물이 다음 단계의 입력. 병렬 가능 phase 없음 (scope 겹침 + 순차적 결정 의존).

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | fixture audit + rename 명명 결정 (사용자 결정 다수) | 60분 |
| P0 | Phase 2 | rename 적용 + 호출부 동기화 (회귀 위험) | 60~90분 |
| P0 | Phase 3 | extractor 스키마 + builder 정합화 | 90분 |
| P0 | Phase 4 | syn_div + Pascal fixture 확장 + selector | 90~120분 |
| P1 | Phase 5 | E2E + 사용자 시각 확인 | 60분 |

## 권장 실행 순서

1. Phase 1 — 사용자와 함께 fixture 의 의미/용도 audit + rename 안 확정 (한 번에)
2. Phase 2 — rename 일괄 적용 + 호출부 grep 검증
3. Phase 3 — 스키마 명세 + extractor.ts + builder 코드 정합화
4. Phase 4 — syn_div / Pascal 추가 fixture 확보 + selector 구현
5. Phase 5 — 합성 + 실 시험지 빌드 후 사용자 시각 검증

## 흡수된 plan

- `docs/planning/hwpx-syn-div-pascal-selector/` — 본 plan 의 Phase 4 + 5 가 흡수. 향후 별도 실행 안 함.

## 검증 체크리스트

### 공통 검증

- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` 빌드 + validate exit 0
- [ ] `python3 tools/build_template_showcase.py` 빌드 + validate exit 0
- [ ] 결과 HWPX 의 모든 fixture 호출이 정답 본과 시각 일치 (Phase 5)
- [ ] `npx tsc --noEmit` 통과 (ngd-studio 측)

### 회귀 검증

- [ ] hwpx-fixture-ref-resolution 의 18개 user-range fixture remap 결과 유지
- [ ] bogi / ganada / inc_dec selector (Phase 4 of 선행 작업) 호출 흐름 유지
- [ ] validate.py 의 cellAddr colSpan fix 동작 유지
- [ ] `_ver{timestamp}` 출력 파일명 관행 유지

### 크로스 플랫폼

- [ ] Python pathlib + encoding=utf-8 명시 (Mac+Windows)
- [ ] TS 측 path.join 사용, 셸 호출 OS 분기
- [ ] LF 줄바꿈, 임시 파일은 os.tmpdir()

## 범위 밖 (touch 금지)

- 선행 작업 산출물 (`tools/header_def_mapper.py`, `tools/fixture_remap.py`, `mapping.md`, `_ver` 명명 관행)
- checker / verifier / figure / solver stage 의 본질적 동작 (fixture 호출 인터페이스 외)
- 양식지 PDF 원본
- ngd-exam-* 에이전트의 프롬프트 자체 (extractor 의 prompt 만 갱신)

## 관련 문서

- `docs/planning/hwpx-fixture-ref-resolution/` — 선행 작업 (mapping + 기본 selector + validate fix 완료)
- `docs/planning/hwpx-syn-div-pascal-selector/` — superseded by 본 plan
- `outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx` — 사용자 authoritative reference
- `resources/hwpx_base/` — fixture 디렉터리
- `ngd-studio/server/stages/extractor.ts` — extractor TS
- `tables.py` / `shapes.py` / `assemble.py` — builder Python 모듈
