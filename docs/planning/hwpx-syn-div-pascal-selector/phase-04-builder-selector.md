---
phase: 4
title: builder selector + dispatch — make_synthetic_division_table / make_pascal_triangle
status: pending
depends_on: [1, 2, 3]
scope:
  - tables.py
  - shapes.py
  - assemble.py
intervention_likely: false
intervention_reason: ""
---

# Phase 4: builder selector + dispatch

> **범위**: Backend (Python)
> **난이도**: M
> **의존성**: Phase 1 (schema), Phase 2 (fixture pool), Phase 3 (extractor 출력)
> **영향 파일**: `tables.py` (make_synthetic_division_table 갱신), `shapes.py` (make_pascal_triangle 신설), `assemble.py` (dispatch 등록)

## 배경

Phase 1~3 의 결과로 (a) 메타데이터 스키마, (b) 충분한 fixture pool, (c) extractor 의 정확한 출력 이 갖춰진 뒤, 본 phase 에서 builder 측 selector + dispatch 를 구현한다.

## 설계

### make_synthetic_division_table 갱신 (`tables.py`)

```python
def make_synthetic_division_table(explanation_table, base_path):
    degree = explanation_table.get("degree")
    nesting = explanation_table.get("nesting_count", degree - 1 if degree else None)
    n_rows = explanation_table.get("n_rows", len(explanation_table.get("rows", [])))
    n_cols = explanation_table.get("n_cols")

    # selector — Phase 2 의 fixture pool 매트릭스 기반
    # 예: nesting → rowCnt = 1 + 3*nesting
    tpl_map = {
        # (nesting, n_cols) → fixture name. n_cols 가 None 이면 nesting 만 보고 선택.
        (1, 5): "synthetic_division_template_1.xml",
        (2, 5): "synthetic_division_template_2.xml",
        (3, 5): "synthetic_division_template_3.xml",
        (4, 6): "synthetic_division_template_4.xml",
        # ... Phase 2 추가분
    }
    key = (nesting, n_cols)
    tpl_name = tpl_map.get(key) or _nearest_syn_div_fixture(nesting, n_cols, tpl_map)
    if tpl_name is None:
        # 최후 fallback — 레거시 단일 fixture
        tpl_name = "synthetic_division_template.xml"
    # rows 데이터를 fixture 셀에 주입
    ...
```

### make_pascal_triangle 신설 (`shapes.py` 또는 `tables.py`)

```python
def make_pascal_triangle(condition_box, base_path):
    n_rows = condition_box.get("n_rows", len(condition_box.get("cells", [])))
    display_form = condition_box.get("display_form", "binomial")
    # selector — n_rows + display_form 기반
    tpl_map = {
        # ... Phase 2 추가분
    }
    tpl_name = tpl_map.get((n_rows, display_form)) or _nearest_pascal_fixture(n_rows, display_form, tpl_map)
    ...
```

`make_pascal_triangle` 의 위치는 `make_condition_rect` 와 같은 모듈에 두는 게 자연스러움 (조건 박스 처리) — `shapes.py`. 단, syn_div 와 일관성을 원하면 `tables.py` 도 가능. worker 가 결정.

### assemble.py dispatch

```python
# 기존
if cond_type == "condition":
    box_xml = make_condition_rect(...)
elif cond_type == "ganada":   # hwpx-fixture-ref-resolution Phase 4 산출
    box_xml = make_ganada_table(...)

# 신규
elif cond_type == "pascal":
    box_xml = make_pascal_triangle(condition_box, base_path)

# explanation_table 측
elif exp_type == "synthetic_division":
    table_xml = make_synthetic_division_table(explanation_table, base_path)
```

### Fallback 정책

- selector 가 정확한 매칭을 못 찾을 때 `_nearest_syn_div_fixture` / `_nearest_pascal_fixture` 가 (`abs(n_rows - target)`, `display_form` 일치 우선) 기준으로 차선책 선택.
- 차선책도 부적합 시 레거시 단일 fixture 또는 programmatic 생성 fallback. `phase4_selector_fallback.log` 에 한 줄 기록.

## 체크리스트

- [ ] `make_synthetic_division_table` 의 selector 갱신 — Phase 2 fixture pool 매트릭스 반영
- [ ] `make_pascal_triangle` 신설 — n_rows + display_form 기반 selector
- [ ] `_nearest_syn_div_fixture` / `_nearest_pascal_fixture` helper 구현 (fallback)
- [ ] `assemble.py` 의 dispatch 분기에 `pascal` / `synthetic_division` 추가 (또는 기존 분기 확장)
- [ ] 단위 테스트 — 합성 input dict 로 selector 가 정확한 fixture 를 고르는지 확인
- [ ] 기존 빌드 + validate 통과 (회귀 없음)

## 영향 범위

- `tables.py` (~line 283 부근) — make_synthetic_division_table 갱신
- `shapes.py` 또는 `tables.py` — make_pascal_triangle 신설
- `assemble.py` (~line 377-395) — dispatch 분기 확장
- 기존 단일 syn_div fixture (`synthetic_division_template.xml`) 사용 경로는 최후 fallback 으로 유지 → 회귀 없음.

## 검증

```bash
# Python import + 함수 호출
python3 -c "
from tables import make_synthetic_division_table
from shapes import make_pascal_triangle  # 또는 tables 에 있으면 from tables

# syn_div 합성 input
syn = {'type': 'synthetic_division', 'degree': 4, 'nesting_count': 2, 'n_rows': 7, 'n_cols': 5, 'rows': [['1','2','3','4','5']] * 7}
xml = make_synthetic_division_table(syn, 'resources/hwpx_base')
assert '<hp:tbl' in xml, 'syn_div 호출 실패'
print('syn_div OK')

# pascal 합성 input
pas = {'type': 'pascal', 'n_rows': 5, 'display_form': 'binomial', 'cells': [['1']]*5}
xml = make_pascal_triangle(pas, 'resources/hwpx_base')
assert '<hp:tbl' in xml, 'pascal 호출 실패'
print('pascal OK')
"

# 빌드 회귀
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix
echo "exit=$?"
```

검증 통과 조건: Python import / selector 호출 성공 + 빌드 / validate exit 0.
