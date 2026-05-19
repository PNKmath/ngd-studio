---
phase: 3
title: builder generator 셀 라우팅 명시화 (force_equation/force_text 정합)
status: pending
depends_on: []
scope:
  - tables.py
  - shapes.py
intervention_likely: false
intervention_reason: ""
---

# Phase 3: builder generator 셀 라우팅 명시화

> **범위**: Backend (Python)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `tables.py` (특히 `_inject_cell_value` + 가변 표 generator 함수들), 필요 시 `shapes.py`

## 배경

ngd-create-v4-coherence Phase 5 (3회차) 에서 발견: `_inject_cell_value` 의 자동 분기 heuristic (`re.search(r'[a-zA-Z_{}^\\\`]', value)`) 가 단순 정수 셀 (`1`, `-3`) 을 자동으로 text 경로로 떨어뜨림. syn_div 처럼 "모든 셀이 항상 equation" 이어야 하는 표는 이 heuristic 이 실패. 임시 fix 로 `force_equation` 파라미터 추가 + `make_syn_div_table` 에서 `force_equation=True` 호출.

문제: 신규 가변 표 generator 추가 시 같은 실수가 반복 가능. heuristic 의존을 generator 차원에서 강제로 끊고, 각 generator 가 "셀이 항상 equation 인가, text 인가, 둘 다 가능한가" 를 시그니처에 명시하는 패턴 필요.

## 설계

### 4-1. `_inject_cell_value` 의 routing 옵션 정합

현재:
```python
def _inject_cell_value(cell_xml, value, force_equation=False):
    if force_equation or re.search(r'[a-zA-Z_{}^\\`]', value):
        # equation path
    else:
        # text path
```

확장:
```python
def _inject_cell_value(cell_xml, value, *, force_equation=False, force_text=False):
    """force_equation 과 force_text 는 mutually exclusive.
    
    둘 다 False 면 heuristic 사용 (기존 동작 — 변수/특수문자 있으면 equation).
    force_equation=True 면 항상 equation.
    force_text=True 면 항상 text (escape).
    """
    if force_equation and force_text:
        raise ValueError("force_equation 과 force_text 동시 True 불가")
    # ...
```

### 4-2. 가변 표 generator 함수 시그니처에 라우팅 정책 명시

`tables.py` / `shapes.py` 의 다음 generator 들 검토:
- `make_syn_div_table` — 이미 `force_equation=True` (유지)
- `make_pascal_table` — 셀 값이 항상 binomial equation. 현재 코드 확인 후 같은 패턴 적용 (또는 별도 헬퍼)
- `make_increase_decrease_table` — 셀 값이 변수 (`x`, `f(x)`) + 부호 (`+`, `-`, `0`) 혼합. heuristic OK 일 가능성 — 검토 후 명시적 결정
- `make_choice_table` — fixture-based (placeholder 셀 채움). 호출 패턴 검토 후 결정
- `make_bogi_table` — items list 주입. 셀 라우팅 issue 없을 가능성
- `make_normal_dist_table` / `make_prob_dist_table` — 숫자 + 변수 (z, μ, σ) 혼합. heuristic 의존인지 확인

각 generator 의 셀 주입 호출에 routing 정책을 주석 또는 인자로 명시.

### 4-3. 신규 generator 컨벤션 문서화

`tables.py` 상단 docstring 또는 별도 주석 블록으로:

```python
"""
Generator 함수 컨벤션 (NGD V4 후속):

새 가변 표 generator 추가 시, 각 셀 주입 시점에 다음 중 하나를 명시 결정:

1. force_equation=True  → 셀이 항상 수식 (양식지가 HYhwpEQ 폰트로 렌더링하는 경우)
2. force_text=True      → 셀이 항상 일반 텍스트 (라벨, 한글 단어 등)
3. (둘 다 명시 안 함)    → heuristic 분기 (변수/특수문자 있으면 equation, 없으면 text)

heuristic 의존은 "정수 셀이 자동 text 됨" 같은 시각 회귀의 직접 원인이 된 적 있음
(ngd-create-v4-coherence Phase 5 3회차 참조). 정책 모호하면 generator 시그니처에 type tag
별 분기로 강제하는 것이 안전.
"""
```

### 4-4. 회귀 회피

기존 generator 들 동작 유지: 검토 결과 라우팅 정책이 "heuristic" 으로 결정되는 generator 는 변경 없음. "force_equation" 또는 "force_text" 로 명시 결정되는 generator 만 호출 변경.

## 체크리스트

- [ ] `_inject_cell_value` 시그니처에 `force_text` 추가 + mutually exclusive 가드 + 기존 동작 호환 (둘 다 False = heuristic)
- [ ] tables.py / shapes.py 의 모든 셀 주입 호출지점 audit — 라우팅 정책 명시 (force_equation / force_text / heuristic) 주석 또는 인자로 표기
- [ ] tables.py 상단에 generator 라우팅 컨벤션 docstring 추가
- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` exit 0 (회귀 없음)
- [ ] `python3 tools/build_template_showcase.py` exit 0 + 시각 회귀 없음 (특히 syn_div equation 유지 확인)

## 영향 범위

- tables.py, shapes.py 의 셀 주입 호출지점 (수개)
- 동작 변경 없음 (예상) — 명시화 + 컨벤션 문서화만. 단, audit 과정에서 잘못된 라우팅 발견 시 fix 동반.
- 신규 generator 추가 작업 (예: Phase 1 의 reference doc 패턴 확장 follow-up) 시 컨벤션 따름.

## 검증

```bash
# 회귀 빌드
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
echo exam=$?
python3 tools/build_template_showcase.py
echo sc=$?

# syn_div equation 라우팅 유지 sanity (Phase 5 3회차 fix 보존)
python3 -c "
from tables import make_syn_div_table
syn = {'type':'synthetic_division','degree':3,'n_rows':4,'n_cols':5,'rows':[['1','2','3','4','5'],['','','','',''],['','','','',''],['','1','2','3','4']]}
xml = make_syn_div_table(syn, 'resources/hwpx_base')
import re
n_eq = len(re.findall(r'<hp:equation', xml))
n_t = len(re.findall(r'<hp:t>[^<]+</hp:t>', xml))
print(f'syn_div: equation={n_eq}, text={n_t}')
assert n_eq == 9, f'syn_div 라우팅 회귀: equation cells = {n_eq}, 기대 9'
assert n_t == 0, f'syn_div text 셀 발생: {n_t}'
print('syn_div equation routing 유지 OK')
"

# force_text 신규 동작 sanity (정수 셀을 강제 text 로)
python3 -c "
from tables import _inject_cell_value
# 빈 셀 XML mock
cell = '<hp:tc><hp:run charPrIDRef=\"1\"/></hp:tc><hp:linesegarray><hp:lineseg/></hp:linesegarray>'
result = _inject_cell_value(cell, '1', force_text=True)
assert '<hp:t>' in result, 'force_text 가 text 경로 안 탐'
assert '<hp:equation' not in result, 'force_text 인데 equation 들어감'
print('force_text 동작 OK')
"
```

검증 통과 조건: 두 빌드 exit 0 + syn_div equation 라우팅 유지 + force_text 신규 동작 OK.
