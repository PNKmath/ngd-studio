# schema.md — fixture 입력 dict 명세

> 생성: 2026-05-19 (Phase 3 worker)
> 기준: Phase 2 rename 확정 이름 + fixture_audit.md + assemble.py 디스패치 패턴
>
> **범위**: syn_div / Pascal 계열은 Phase 4 결정 사항이므로 이 문서에서 제외.

---

## 개요

extractor 출력 JSON → Python builder(`assemble.py`) 흐름에서 각 fixture를 올바르게 호출하기 위한 **입력 dict 명세**다.

### 최상위 구조

```json
{
  "condition_box": { "type": "<tag>", ... } | null,
  "data_table": { "type": "<tag>", ... } | null,
  "explanation_table": { "type": "<tag>", ... } | null
}
```

`assemble.py`는 `condition_box["type"]`과 `data_table["type"]`을 기준으로 maker 함수로 dispatch한다.

---

## condition_box 계열

### bogi (보기 박스)

**fixture 파일**: `bogi_box_3items.xml` / `bogi_box_4items.xml` / `bogi_box_6items.xml`  
**cond_type tag**: `"bogi"`  
**maker 함수**: `make_bogi_table(condition_box, base_path)` (`tables.py`)

**입력 dict**:
```json
{
  "type": "bogi",
  "items": [
    {"parts": [{"t": "텍스트"}, {"eq": "수식"}]},
    {"parts": [{"eq": "x > 0"}]},
    {"parts": [{"t": "세 번째 항목"}]}
  ]
}
```

**selector 조건**:
- `n_items <= 3` → `bogi_box_3items.xml`
- `n_items == 4` → `bogi_box_4items.xml`
- `n_items >= 5` → `bogi_box_6items.xml`

**placeholder 위치**:
- `bogi_box_3items.xml`: row2 col1 — `ㄱ.` 라벨 뒤에 각 item 내용 주입 (ㄱ/ㄴ/ㄷ 순)
- `bogi_box_4items.xml`: 동일 구조, ㄱ/ㄴ/ㄷ/ㄹ 4줄
- `bogi_box_6items.xml`: row2~4의 각 라벨 셀 (2열 레이아웃, ㄱ~ㅂ)

**fixture 박힘**: `< 보 기 >` 텍스트, NGD 로고 equation, ㄱ./ㄴ./ㄷ. 라벨

---

### condition (조건 박스)

**fixture 파일**: `condition_rect_template.xml` (프로그래매틱 rect)  
**cond_type tag**: `"condition"`  
**maker 함수**: `make_condition_rect(condition_box, base_path)` 또는 `make_ganada_table(condition_box, base_path)` (`shapes.py`)

**입력 dict**:
```json
{
  "type": "condition",
  "items": [
    {"label": "(가)", "parts": [{"t": "조건 내용 텍스트"}, {"eq": "f(x) > 0"}]},
    {"label": "(나)", "parts": [{"eq": "x > 0"}]},
    {"label": "(다)", "parts": [{"t": "세 번째 조건"}]}
  ]
}
```

**selector 조건**:
- `label`이 전부 `(가-힣)` 패턴 → `make_ganada_table` (경계선 스타일 강화)
- 그 외 → `make_condition_rect` (범용 직사각형)

**placeholder 위치**: `{{ITEMS_CONTENT}}` — 프로그래매틱 생성 (템플릿 치환)

**필수 필드**: `items[*].label`, `items[*].parts`

---

### image_choice (이미지 조건 박스)

**fixture 파일**: `condition_rect_template.xml`  
**cond_type tag**: `"image_choice"`  
**maker 함수**: `make_condition_rect(condition_box, base_path)` (`shapes.py`)

**입력 dict**:
```json
{
  "type": "image_choice",
  "items": [
    {"label": "(가)", "parts": [{"t": "이미지 설명"}]}
  ]
}
```

---

### empty_box (서술형 빈 답안 박스)

**fixture 파일**: `empty_box_template.xml`  
**cond_type tag**: `"empty_box"`  
**maker 함수**: `make_empty_box(condition_box, base_path)` (`shapes.py`)

**입력 dict**:
```json
{
  "type": "empty_box",
  "height": 5059
}
```

**필드 설명**:
- `height`: 박스 높이 (HWPUNIT, 기본값 5059). 서술형 답안 라인 수에 따라 조정.

**fixture 박힘**: 없음 (빈 rect)

---

### proof (증명 박스)

**fixture 파일**: `proof_table_template.xml`  
**cond_type tag**: `"proof"`  
**maker 함수**: `make_proof_table_wrapped(condition_box, base_path)` (`tables.py`)

**입력 dict**:
```json
{
  "type": "proof",
  "items": [
    {"parts": [{"t": "첫 번째 줄"}, {"eq": "f(x) = x^2"}]},
    {"parts": [{"eq": "f prime(x) = 2x"}]}
  ]
}
```

**placeholder 위치**: row2 col1 — 내용 주입 (colAddr=1, rowAddr=2)

**fixture 박힘**: `[ 증 명 ]` 텍스트, NGD 로고 equation

---

### choice_table (그리드형 선지 테이블)

**fixture 파일**: `pq_proposition_table_5x5.xml` / `choice_image_5options.xml` / `choice_grid_2cols.xml` / `choice_grid_3cols.xml`  
**cond_type tag**: `"choice_table"`  
**maker 함수**: `make_choice_table(condition_box, base_path)` (`tables.py`)

`condition_box["table_type"]`으로 fixture를 선택한다.

#### choice_table — proposition (명제 p:/q: 5선지)

**fixture 파일**: `pq_proposition_table_5x5.xml`  
**table_type**: `"proposition"` (신규) 또는 `"5x5"` (호환)

```json
{
  "type": "choice_table",
  "table_type": "proposition",
  "rows": [
    ["h1", "c1"],
    ["h2", "c2"],
    ["h3", "c3"],
    ["h4", "c4"],
    ["h5", "c5"]
  ]
}
```

**placeholder 위치**:
- col2 (p 내용, 각 행): 가정(hypothesis) 내용 주입
- col4 (q 내용, 각 행): 결론(conclusion) 내용 주입
- col0 (`①~⑤`), col1 (`p:`), col3 (`q:`) — fixture 박힘 보존

---

#### choice_table — choice_image (그림 5선지)

**fixture 파일**: `choice_image_5options.xml`  
**table_type**: `"choice_image"` (신규) 또는 `"9x4"` (호환)

```json
{
  "type": "choice_table",
  "table_type": "choice_image",
  "rows": []
}
```

**placeholder 위치**:
- col1 rowSpan=3 셀들 (row=0,3,6): 이미지 placeholder 1~3
- col3 rowSpan=3 셀들 (row=0,3): 이미지 placeholder 4~5
- col0/col2의 `①~⑤` — fixture 박힘 보존

---

#### choice_table — choice_grid_2cols ((가)(나) 2열 선지)

**fixture 파일**: `choice_grid_2cols.xml`  
**table_type**: `"choice_grid_2cols"` (신규) 또는 `"6x3"` (호환)

```json
{
  "type": "choice_table",
  "table_type": "choice_grid_2cols",
  "rows": [
    ["", "(가)", "(나)"],
    ["①", "val1", "val2"],
    ["②", "val3", "val4"],
    ["③", "val5", "val6"],
    ["④", "val7", "val8"],
    ["⑤", "val9", "val10"]
  ]
}
```

**placeholder 위치**: `rows[1..5][1..2]` (각 선지의 (가)/(나) 내용)

**fixture 박힘**: `(가)`/`(나)` 헤더, `①~⑤` 번호

---

#### choice_table — choice_grid_3cols ((가)(나)(다) 3열 선지)

**fixture 파일**: `choice_grid_3cols.xml`  
**table_type**: `"choice_grid_3cols"` (신규) 또는 `"6x4"` (호환)

```json
{
  "type": "choice_table",
  "table_type": "choice_grid_3cols",
  "rows": [
    ["", "(가)", "(나)", "(다)"],
    ["①", "v1", "v2", "v3"],
    ["②", "v4", "v5", "v6"],
    ["③", "v7", "v8", "v9"],
    ["④", "v10", "v11", "v12"],
    ["⑤", "v13", "v14", "v15"]
  ]
}
```

**placeholder 위치**: `rows[1..5][1..3]` (각 선지의 (가)/(나)/(다) 내용)

**fixture 박힘**: `(가)`/`(나)`/`(다)` 헤더, `①~⑤` 번호

---

## data_table 계열

### normal_dist (표준정규분포표)

**fixture 파일**: `normal_dist_3rows.xml` / `normal_dist_4rows.xml` / `normal_dist_5rows.xml`  
**type tag**: `"normal_dist"`  
**maker 함수**: `make_data_table_xml(data_table, base_path)` (`tables.py`)

**입력 dict**:
```json
{
  "type": "normal_dist",
  "row_parts": [
    [[{"eq": "1.0"}], [{"eq": "0.3413"}]],
    [[{"eq": "1.5"}], [{"eq": "0.4332"}]],
    [[{"eq": "2.0"}], [{"eq": "0.4772"}]]
  ]
}
```

**selector 조건**:
- `n_data_rows <= 3` → `normal_dist_3rows.xml`
- `n_data_rows <= 4` → `normal_dist_4rows.xml`
- `n_data_rows >= 5` → `normal_dist_5rows.xml`

**placeholder 위치**: 데이터 행의 z값 셀 (홀수 인덱스) + P값 셀 (짝수 인덱스)

**fixture 박힘**: `<표준정규분포표>` 타이틀, `z`/`P(0≤Z≤z)` 헤더 수식

---

### probability (이산확률분포표)

**fixture 파일**: `prob_dist_5cols.xml` / `prob_dist_6cols.xml` / `prob_dist_7cols.xml`  
**type tag**: `"probability"`  
**maker 함수**: `make_data_table_xml(data_table, base_path)` (`tables.py`)

**입력 dict**:
```json
{
  "type": "probability",
  "header_parts": [
    [{"eq": "0"}],
    [{"eq": "1"}],
    [{"eq": "2"}],
    [{"eq": "3"}]
  ],
  "row_parts": [
    [{"eq": "1 over 6"}],
    [{"eq": "1 over 3"}],
    [{"eq": "1 over 3"}],
    [{"eq": "1 over 6"}]
  ]
}
```

**selector 조건** (n_data = `len(header_parts)`):
- `n_data <= 3` → `prob_dist_5cols.xml` (5열 = X + 3값 + 계)
- `n_data <= 4` → `prob_dist_6cols.xml` (6열 = X + 4값 + 계)
- `n_data >= 5` → `prob_dist_7cols.xml` (7열 = X + 5값 + 계)

**placeholder 위치**:
- row0: X값들 (`cells[1..n_data]`)
- row1: P값들 (`cells[n_total+1..n_total+n_data]`)

**fixture 박힘**: `X`, `P(X=x)` 수식, `계` 텍스트, 합=1 수식

---

## explanation_table 계열

### increase_decrease (증감표)

**fixture 파일**: `inc_dec_1x.xml` / `inc_dec_2x.xml` / `inc_dec_3x.xml` / `inc_dec_4x.xml` (또는 프로그래매틱)  
**type tag**: `"increase_decrease"`  
**maker 함수**: `make_increase_decrease_table(explanation_table, base_path)` (`tables.py`)

**입력 dict**:
```json
{
  "type": "increase_decrease",
  "x_values": ["a", "b"],
  "rows": [
    {"label": "f prime(x)", "values": ["+", "0", "-", "0", "+"]},
    {"label": "f(x)", "values": ["NEARROW", "극대", "SEARROW", "극소", "NEARROW"]}
  ]
}
```

**selector 조건** (`n_x = len(x_values)`):
- `n_x == 1` → `inc_dec_1x.xml` (3행 4열)
- `n_x == 2` → `inc_dec_2x.xml` (3행 6열)
- `n_x == 3` → `inc_dec_3x.xml` (4행 8열)
- `n_x in (4, 5)` → `inc_dec_4x.xml` (5행 12열)
- `n_x >= 6` → 프로그래매틱 생성 (borderFill 패턴)

**placeholder 위치**: 헤더 행의 x값 셀 (col idx 2, 4, ...) + 데이터 행의 값 셀 (col idx 1~)

**fixture 박힘**: `{x}`, `{CDOTS}`, `{f prime(x)}`, `{f(x)}` 수식 (charPrIDRef=1)

---

### synthetic_division (조립제법)

> Phase 4에서 가변 생성기로 전환 예정. 현재는 레거시 단일 템플릿 사용.

**type tag**: `"synthetic_division"`  
**maker 함수**: `make_synthetic_division_table(explanation_table, base_path)` (`tables.py`)

**입력 dict**:
```json
{
  "type": "synthetic_division",
  "divisor": "2",
  "coefficients": ["1", "-3", "4", "-2"],
  "result": ["1", "-1", "2"]
}
```

---

## CHOICE_TABLE_MAP 신규/호환 키 매핑

`tables.py`의 `CHOICE_TABLE_MAP`은 신규 type tag와 옛 키를 모두 지원한다:

| 신규 table_type | 옛 table_type | fixture 파일 |
|----------------|--------------|-------------|
| `"proposition"` | `"5x5"` | `pq_proposition_table_5x5.xml` |
| `"choice_image"` | `"9x4"` | `choice_image_5options.xml` |
| `"choice_grid_2cols"` | `"6x3"` | `choice_grid_2cols.xml` |
| `"choice_grid_3cols"` | `"6x4"` | `choice_grid_3cols.xml` |

---

## assemble.py dispatch 매핑 표

### condition_box.type → maker 함수

| `cond_type` | maker 함수 | 파일 |
|-------------|-----------|------|
| `"condition"` | `make_ganada_table` 또는 `make_condition_rect` | `shapes.py` |
| `"image_choice"` | `make_condition_rect` | `shapes.py` |
| `"bogi"` | `make_bogi_table` | `tables.py` |
| `"empty_box"` | `make_empty_box` | `shapes.py` |
| `"proof"` | `make_proof_table_wrapped` | `tables.py` |
| `"choice_table"` | `make_choice_table` (→ `table_type`으로 fixture 결정) | `tables.py` |

### data_table.type → maker 함수

| `dt_type` | maker 함수 | 파일 |
|-----------|-----------|------|
| `"normal_dist"` | `make_data_table_xml` | `tables.py` |
| `"probability"` | `make_data_table_xml` | `tables.py` |

### explanation_table.type → maker 함수

| `et_type` | maker 함수 | 파일 |
|-----------|-----------|------|
| `"increase_decrease"` | `make_increase_decrease_table` | `tables.py` |
| `"synthetic_division"` | `make_synthetic_division_table` | `tables.py` |
