---
phase: 4
title: syn_div + Pascal fixture 확장 + selector 통합
status: pending
depends_on: [3]
scope:
  - resources/hwpx_base/
  - tables.py
  - shapes.py
  - assemble.py
  - ngd-studio/server/stages/extractor.ts
intervention_likely: true
intervention_reason: "syn_div 변형 / Pascal 변형의 fixture 출처 (사용자 본 추출 vs 신규 작성) 와 selector 분기 조건 결정 필요. 부족 fixture 보강은 사용자 양식지 확보 의존."
---

# Phase 4: syn_div + Pascal — fixture pool 확장 + selector 통합

> **범위**: Resources (신규 fixture) + Backend (selector + dispatch)
> **난이도**: L
> **의존성**: Phase 3 (스키마 명세 완료, type tag 등록)
> **영향 파일**: `resources/hwpx_base/synthetic_division_*.xml` (확장), `Pascal_triangle_*.xml` (확장), builder + extractor 정합

## 배경

`hwpx-syn-div-pascal-selector` plan 의 5 phase 를 본 plan 으로 흡수해 한 phase 로 압축. 현재 fixture (syn_div 4종 + Pascal 3종) 만으로는 사용자 본 양식지의 모든 변형 케이스 표현 불가 — 부족 fixture 보강 + selector 의 데이터 기반 라우팅 구현.

## 설계

### 4-1. fixture pool gap 분석 + 보강

Phase 1 의 fixture_audit.md 에 syn_div / Pascal 도 포함되어 있음 — 거기서 (rowCnt, colCnt, 셀 구조, 추정 용도) 매트릭스 추출. 부족 케이스 식별 후:
- 사용자 본 (`/tmp/showcase_extracted/` 또는 사용자 추가 양식지) 에서 추출 → `tools/fixture_remap.py` 적용
- 또는 가장 가까운 기존 fixture 복제 후 cell 구조 수정

### 4-2. selector 구현

Phase 3 의 schema.md 의 type tag (`synthetic_division`, `pascal`) 사용:

```python
def make_synthetic_division_table(data, base_path):
    # data: {type, degree, nesting_count, rows, ...}
    # selector — fixture pool 의 (nesting_count, n_cols) 매트릭스 기반
    ...

def make_pascal_triangle(data, base_path):
    # data: {type, n_rows, display_form, cells}
    ...
```

`_nearest_*_fixture` helper — 정확한 매칭이 없으면 가장 가까운 후보 + `phase4_selector_fallback.log` 기록.

### 4-3. extractor.ts 측 추가

`extractor.ts` 의 LLM 프롬프트에 syn_div / Pascal 의 메타데이터 추출 지시 추가 (degree, nesting_count, display_form 등).

### 4-4. dispatch 등록

`assemble.py` 의 condition_box / explanation_table 분기에 새 type tag 매핑.

## 체크리스트

- [ ] Phase 1 audit 의 syn_div / Pascal 부분 검토 + gap 식별 (부족 케이스 목록)
- [ ] 부족 fixture 보강 (사용자 본 추출 또는 신규 작성, 사용자 결정)
- [ ] `make_synthetic_division_table` 의 selector 구현 (Phase 3 schema 의 입력 dict 기반)
- [ ] `make_pascal_triangle` 신설 — n_rows + display_form 기반 selector
- [ ] `extractor.ts` LLM 프롬프트 갱신 — syn_div / Pascal 메타데이터 추출
- [ ] `assemble.py` dispatch 등록

## 영향 범위

- 신규 fixture XML 파일 추가 (수개)
- builder 새 maker 함수 + selector
- extractor 측 프롬프트 + 출력 처리
- 기존 시험지 빌드는 syn_div / Pascal 없으면 영향 없음. 있으면 새 selector 호출.

## 검증

```bash
# Python import + 호출
python3 -c "
from tables import make_synthetic_division_table
from shapes import make_pascal_triangle

syn = {'type':'synthetic_division','degree':4,'nesting_count':2,'rows':[['1','2','3','4','5']]*7,'n_rows':7,'n_cols':5}
xml = make_synthetic_division_table(syn, 'resources/hwpx_base')
assert '<hp:tbl' in xml, 'syn_div 호출 실패'
print('syn_div OK')

pas = {'type':'pascal','n_rows':5,'display_form':'binomial','cells':[['1']]*5}
xml = make_pascal_triangle(pas, 'resources/hwpx_base')
assert '<hp:tbl' in xml, 'pascal 호출 실패'
print('pascal OK')
"

# 빌드 회귀 (기존 시험지)
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
LATEST=$(ls -t "outputs/[고]"*_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST" --fix

# TypeScript 컴파일
cd ngd-studio && npx tsc --noEmit && cd ..
```

검증 통과 조건: 두 maker 함수 import + 호출 OK + 빌드 + tsc + (가능하면) syn_div / Pascal 포함 합성 input 빌드.
