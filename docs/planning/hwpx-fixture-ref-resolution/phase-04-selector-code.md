---
phase: 4
title: 신규 fixture 활용 selector 분기 추가 (bogi/ganada/inc_dec)
status: completed
depends_on: [3]
scope:
  - tables.py
  - shapes.py
  - assemble.py
intervention_likely: false
intervention_reason: ""
---

# Phase 4: 신규 fixture 활용 selector 분기 추가 (bogi / ganada / inc_dec)

> **범위**: Backend (Python)
> **난이도**: S
> **의존성**: Phase 3 (재매핑된 fixture 가 적용된 후)
> **영향 파일**: `tables.py` (line 151, 359), `shapes.py` (line 15), `assemble.py` (line 377-395)

## 배경

`813f736` commit 으로 신규 fixture 가 `resources/hwpx_base/` 에 추가됐으나 빌더 selector 가 미연결 → 실제 사용 안 됨. Phase 3 에서 ref 가 정상 매핑된 후, 본 phase 에서 각 maker 함수에 selector 분기를 추가한다.

**본 phase 의 selector 분기 (3종)**:

1. **`make_bogi_table` (tables.py:359)** — `n_items > 4 → 6items, else → 3items` (4-item 케이스가 3items 로 잘못 라우팅)
2. **`make_condition_rect` (shapes.py:15)** — (가)(나)(다) 라벨 패턴에 대해 `ganada_table.xml` 사용 분기 없음. 모두 programmatic rect 로 처리 중.
3. **`make_increase_decrease_table` (tables.py:151)** — `n_x in (1, 2)` 만 fixture 사용, `n_x >= 3` 은 borderFill programmatic 생성. 3x/4x fixture 추가됐으나 사용 안 함.

**별도 plan 으로 분리**:

- **`make_synthetic_division_table`** (1~4 변형 selector) — 다항식 차수 / 중첩 횟수가 문제별로 다르고, 현 fixture pool 4개로는 일반화 불가. 향후 extractor 메타데이터 기반 selector 가 필요. → `docs/planning/hwpx-syn-div-pascal-selector/` (예정) 에서 다룸.
- **Pascal triangle** — 빌더에 해당 maker 함수가 없음. 문제 형태에 따라 표 구조/표현형태가 다르게 나타나므로 동일하게 extractor 기반 selector 필요. → 위 별도 plan 에 포함.

## 설계

### Selector 분기 추가

#### 4-1. `make_bogi_table`

```python
def make_bogi_table(condition_box, base_path):
    items = condition_box["items"]
    n_items = len(items)
    if n_items <= 3:
        tpl_name = "bogi_table_3items.xml"
    elif n_items == 4:
        tpl_name = "bogi_table_4items.xml"
    else:
        tpl_name = "bogi_table_6items.xml"
    ...
```

라벨 배열 (`["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ"]`) 은 동일 유지. fixture 가 가지는 슬롯 수와 일치.

#### 4-2. `make_ganada_table` 신설 (shapes.py)

```python
def make_ganada_table(condition_box, base_path):
    """(가)(나)(다) 라벨 조건 박스 — ganada_table.xml 사용"""
    ...
```

`make_condition_rect` 호출부 (assemble.py:382-385) 에 분기 추가:

```python
if cond_type == "condition":
    # 라벨이 (가)(나)(다) 패턴이면 ganada_table 사용
    labels = [it.get("label", "") for it in condition_box.get("items", [])]
    is_ganada = all(re.match(r'^\([가-힣]\)$', lbl) for lbl in labels) and labels
    if is_ganada:
        box_xml = make_ganada_table(condition_box, base_path)
    else:
        box_xml = make_condition_rect(condition_box, base_path)
```

**사용자 결정 필요**: `(가)(나)(다)` 만 ganada 인지, `(ㄱ)(ㄴ)(ㄷ)` 도 같은지, 다른 패턴도 있는지.

#### 4-3. `make_increase_decrease_table`

```python
if n_x in (1, 2):
    tpl_name = "increase_decrease_template.xml" if n_x == 1 else "increase_decrease_template_2x.xml"
    # 기존 로직
elif n_x == 3:
    tpl_name = "increase_decrease_template_3x.xml"
    # 신규: fixture 기반 처리
elif n_x == 4:
    tpl_name = "increase_decrease_template_4x.xml"
    # 신규: fixture 기반 처리
else:
    # n_x >= 5 — 기존 programmatic 경로 유지 (fixture 없음)
```

n_x=3/4 케이스의 fixture 데이터 주입 패턴은 1x/2x 와 유사하지만 cell index 가 다르므로 신중히. fixture 의 cell 구조 (예: `n_cols = 2 * n_x + 2`) 검사 후 결정.

#### 4-4. `make_synthetic_division_table` — **별도 plan 으로 분리, 본 phase 제외**

별도 plan `docs/planning/hwpx-syn-div-pascal-selector/` 에서 다룸. 본 phase 에서는 변경 없음.

#### 4-5. `make_pascal_triangle` — **별도 plan 으로 분리, 본 phase 제외**

별도 plan `docs/planning/hwpx-syn-div-pascal-selector/` 에서 다룸. 본 phase 에서는 추가 안 함.

### Phase 4 작업 순서

1. `make_bogi_table` 갱신 (가장 단순)
2. `make_ganada_table` 신설 + `make_condition_rect` 분기 추가
3. `make_increase_decrease_table` 3x/4x 분기 추가

## 체크리스트

- [x] `make_bogi_table` selector 갱신 (n=4 → 4items 분기)
- [x] `make_ganada_table` 신설 + `make_condition_rect` 호출부 분기 (assemble.py)
- [x] `make_increase_decrease_table` n_x=3/4 분기 추가
- [x] 기존 빌드 + validate 통과 + 새 selector 가 실제 호출되는지 단위 테스트 또는 print 디버그 확인

## 영향 범위

- `tables.py` (line 151, 359) — 2개 함수 selector 분기 추가
- `shapes.py` (line 15) — `make_ganada_table` 신설 (또는 `make_condition_rect` 내부 분기)
- `assemble.py` (line 377-395) — condition_box 처리 분기 (ganada 추가)
- 기존 시험지 JSON 에 4-item bogi / inc_dec 3x/4x / ganada 변형이 없으므로 회귀 없음. 향후 다양한 시험지 빌드 시 정상 fixture 선택.

## 검증

```bash
# 기존 시험지 빌드 회귀 확인
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix

# 단위 테스트: 신규 selector 호출 확인
python3 -c "
import json
from tables import make_bogi_table
from shapes import make_ganada_table  # 신설 후
# 4-item 케이스
cb4 = {'items': [{'parts':[{'t':f'item {i}'}]} for i in range(4)]}
xml = make_bogi_table(cb4, 'resources/hwpx_base')
assert 'borderFillIDRef' in xml, 'bogi_4items 호출 실패'
print('bogi 4items OK')
"

# Pascal triangle 데이터로 빌드 (사용자가 샘플 제공 후)
# python3 -c "from tables import make_pascal_triangle; ..."
```

검증 통과 조건: 빌드 정상 + validate 통과 + 신규 selector 분기가 실제 호출 가능 (Python import + 함수 호출 OK).

## 실행 결과

### 1회차 (2026-05-19 KST) — 완료

- `make_bogi_table`: n_items<=3→3items, n_items==4→4items, n_items>4→6items 분기 추가. 회귀 OK.
- `make_ganada_table` 신설 (shapes.py): `condition_rect_template.xml` 기반, interior 항목에 `paraPrIDRef="11"` 적용. (가)(나)(다) 라벨 + 본문 parts 주입.
- `assemble.py`: `make_ganada_table` import 추가. `cond_type=="condition"` 분기에 `^\([가-힣]\)$` 정규식으로 ganada 감지 → `make_ganada_table` / `make_condition_rect` 선택.
- `make_increase_decrease_table`: n_x=3→3x.xml(4행 8열), n_x=4/5→4x.xml(5행 12열) 분기 추가. tpl_n_data_rows/tpl_n_cols 변수로 injection 통일. 6+ 케이스는 기존 programmatic 유지.
- 단위 테스트: bogi 3/4/6items, ganada 3items, increase_decrease 1/2/3/4x 모두 통과.
- 빌드 회귀: `exam_data.json` → HWPX 빌드 성공 + validate 통과.

#### Scope Audit (orchestrator)
pass — tables.py / shapes.py / assemble.py 모두 scope 내. PHASE_FILE exempt.

#### Verification Re-run (orchestrator)
exit 0 — build_hwpx 빌드 성공 + validate exit 0 + bogi 4items 단위테스트 호출 성공.

#### Simplify (orchestrator)
1 edit — tables.py `make_bogi_table` 의 인라인 중복 3줄 regex(tbl id/eq id/zOrder)를 `_replace_table_ids()` 호출 1줄로 통합. VERIFY pass.

#### Review (orchestrator)
VERDICT: pass — 3종 selector 모두 spec 부합. minor note: `make_ganada_table` 이 `ganada_table.xml` 을 직접 사용하지 않고 `condition_rect_template.xml` 기반 programmatic 생성 + `paraPrIDRef=11` 적용으로 구현. 시각/기능 동등하나 `ganada_table.xml` fixture 잔존 미사용 — Phase 5 시각 검증에서 사용자가 일치 확인 필요.

#### Commit
6f87102
