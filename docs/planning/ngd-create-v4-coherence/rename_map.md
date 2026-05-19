# rename_map.md — fixture 의미 기반 rename 제안

> 생성: 2026-05-19 (Phase 1 worker)
> 상태: **사용자 결정 확정 (2026-05-19)**

---

## rename 결정 테이블

| 현재 이름 | 새 이름 (제안:) | 의미 | 비고 | 결정 |
|-----------|----------------|------|------|------|
| bogi_table_3items.xml | 제안: bogi_box_3items.xml | 보기 3-item 박스 | "table"보다 "box"가 시각적 박스 의미에 더 적합. bogi_box_N 시리즈로 통일 | 결정: bogi_box_3items.xml |
| bogi_table_4items.xml | 제안: bogi_box_4items.xml | 보기 4-item 박스 | 동일 | 결정: bogi_box_4items.xml |
| bogi_table_6items.xml | 제안: bogi_box_6items.xml | 보기 6-item 박스 | 동일 | 결정: bogi_box_6items.xml |
| choice_table_5x5.xml | 제안: proposition_5rows.xml | 명제 p:/q: 5선지 테이블 | 이름 "choice_table_5x5"이 오해 유발 — 실제 용도는 명제(p→q) 전용. "5x5"는 5행×5열이나 의미는 완전히 다름 | 결정: pq_proposition_table_5x5.xml (치수 + 의미 둘 다 포함) |
| choice_table_9x4.xml | 제안: choice_image_5options.xml | 그림 5선지 테이블 (이미지 placeholder) | 9행×4열이나 실제 내용은 ①~⑤ + 이미지 5쌍. "image_5options" 또는 "choice_pic_5"도 고려 | 결정: choice_image_5options.xml |
| choice_table_6x3.xml | 제안: choice_grid_2cols.xml | (가)(나) 2열 헤더 + ①~⑤ 선지 그리드 | "6x3"보다 컬럼 수 의미 명확하게. 또는 choice_ganada_2cols.xml | 결정: choice_grid_2cols.xml |
| choice_table_6x4.xml | 제안: choice_grid_3cols.xml | (가)(나)(다) 3열 헤더 + ①~⑤ 선지 그리드 | 동일 패턴 | 결정: choice_grid_3cols.xml |
| condition_rect_template.xml | 제안: 유지 (condition_rect_template.xml) | 조건 박스 프로그래매틱 rect | 이름이 명확, 변경 불필요 | 결정: 유지 |
| empty_box_template.xml | 제안: 유지 (empty_box_template.xml) | 서술형 빈 답안 박스 | 이름 명확 | 결정: 유지 |
| ganada_table.xml | — | (가)(나)(다) 스타일 참조 rect | 코드에서 직접 파일 로드 없음. choice_grid_* 가 (가)(나)(다) 헤더 케이스를 커버 | 결정: 삭제 |
| proof_table_template.xml | 제안: 유지 (proof_table_template.xml) | [ 증 명 ] 테이블 | 의미 명확 | 결정: 유지 |
| increase_decrease_template.xml | 제안: inc_dec_1x.xml | 증감표 n_x=1 (3행 4열) | "1x" = 구간 1개. 시리즈 명명 통일: inc_dec_{N}x.xml | 결정: inc_dec_1x.xml |
| increase_decrease_template_2x.xml | 제안: inc_dec_2x.xml | 증감표 n_x=2 (3행 6열) | 동일 패턴 | 결정: inc_dec_2x.xml |
| increase_decrease_template_3x.xml | 제안: inc_dec_3x.xml | 증감표 n_x=3 (4행 8열) | 동일 | 결정: inc_dec_3x.xml |
| increase_decrease_template_4x.xml | 제안: inc_dec_4x.xml | 증감표 n_x=4~5 (5행 12열) | 동일 | 결정: inc_dec_4x.xml |
| normal_dist_3rows.xml | 제안: 유지 (normal_dist_3rows.xml) | 표준정규분포표 3행 | 이름 명확, rows 수가 의미 | 결정: 유지 |
| normal_dist_4rows.xml | 제안: 유지 (normal_dist_4rows.xml) | 표준정규분포표 4행 | 동일 | 결정: 유지 |
| normal_dist_5rows.xml | 제안: 유지 (normal_dist_5rows.xml) | 표준정규분포표 5행 | 동일 | 결정: 유지 |
| prob_dist_5cols.xml | 제안: 유지 (prob_dist_5cols.xml) | 이산확률분포표 5열 | 이름 명확 | 결정: 유지 |
| prob_dist_6cols.xml | 제안: 유지 (prob_dist_6cols.xml) | 이산확률분포표 6열 | 동일 | 결정: 유지 |
| prob_dist_7cols.xml | 제안: 유지 (prob_dist_7cols.xml) | 이산확률분포표 7열 | 동일 | 결정: 유지 |
| synthetic_division_template.xml | — | 레거시 조립제법 | Phase 4에서 가변 생성기로 전환 예정 | 결정: deprecated, Phase 4에서 제거 |
| synthetic_division_template_1.xml | — | 3차 조립제법 (4행 5열) | fixture_remap.py 참조 전용, builder 미연결 | 결정: deprecated, Phase 4에서 제거 |
| synthetic_division_template_2.xml | — | 4차 조립제법 (7행 5열) | 동일 | 결정: deprecated, Phase 4에서 제거 |
| synthetic_division_template_3.xml | — | 5차 조립제법 (10행 5열) | 동일 | 결정: deprecated, Phase 4에서 제거 |
| synthetic_division_template_4.xml | — | 6차 조립제법 (13행 6열) | 동일 | 결정: deprecated, Phase 4에서 제거 |
| Pascal_triangle_1.xml | — | 파스칼 삼각형 5행 (7행 18열 스팬) | fixture_remap.py 참조 전용, builder 미연결 | 결정: deprecated, Phase 4에서 제거 |
| Pascal_triangle_2.xml | — | 파스칼 삼각형 7행 (12행 23열 스팬) | 동일 | 결정: deprecated, Phase 4에서 제거 |
| Pascal_triangle_3.xml | — | 파스칼 삼각형 9행 (12행 23열 스팬) | Pascal_2와 행렬 크기 같으나 데이터 다름 | 결정: deprecated, Phase 4에서 제거 |

---

## 호출부 영향 범위 (grep 결과)

### tables.py 호출 패턴

```python
# bogi_table — make_bogi_table (tables.py:401,403,405)
"bogi_table_3items.xml"    → n_items <= 3
"bogi_table_4items.xml"    → n_items == 4
"bogi_table_6items.xml"    → n_items >= 5

# choice_table — make_choice_table (tables.py:368)
f"choice_table_{table_type}.xml"   # table_type: 5x5, 9x4, 6x3(기본), 6x4

# increase_decrease — make_increase_decrease_table (tables.py:177~186)
"increase_decrease_template.xml"      → n_x == 1
"increase_decrease_template_2x.xml"   → n_x == 2
"increase_decrease_template_3x.xml"   → n_x == 3
"increase_decrease_template_4x.xml"   → n_x >= 4

# normal_dist — make_data_table_xml (tables.py:75~79)
"normal_dist_3rows.xml"   → rows == 3
"normal_dist_4rows.xml"   → rows == 4
"normal_dist_5rows.xml"   → rows == 5

# prob_dist — make_data_table_xml (tables.py:123~129)
"prob_dist_5cols.xml"   → cols == 5
"prob_dist_6cols.xml"   → cols == 6
"prob_dist_7cols.xml"   → cols == 7

# synthetic_division — make_synthetic_division_table (tables.py:339)
"synthetic_division_template.xml"   # 레거시, 직접 하드코딩
```

### shapes.py 호출 패턴

```python
# condition_rect_template.xml (shapes.py:51, 109)
with open(f"{base_path}/condition_rect_template.xml", ...)

# empty_box_template.xml (shapes.py:132)
with open(f"{base_path}/empty_box_template.xml", ...)

# proof_table_template.xml (shapes.py:148)
with open(f"{base_path}/proof_table_template.xml", ...)
```

### tools/fixture_remap.py (참조 전용)

```python
# 파일명 목록 (rename 대상 포함, 코드 동작 무관)
"synthetic_division_template_1.xml" ~ _4.xml
"Pascal_triangle_1.xml" ~ _3.xml
```

---

## Phase 2 일괄 sed 패턴 (rename 확정 후 적용)

```bash
# bogi_table → bogi_box (tables.py)
sed -i 's/bogi_table_3items\.xml/bogi_box_3items.xml/g' tables.py
sed -i 's/bogi_table_4items\.xml/bogi_box_4items.xml/g' tables.py
sed -i 's/bogi_table_6items\.xml/bogi_box_6items.xml/g' tables.py

# choice_table_5x5 → pq_proposition_table_5x5 (tables.py)
sed -i 's/choice_table_5x5\.xml/pq_proposition_table_5x5.xml/g' tables.py

# choice_table_9x4 → choice_image_5options (tables.py)
sed -i 's/choice_table_9x4\.xml/choice_image_5options.xml/g' tables.py

# choice_table_6x3 → choice_grid_2cols (tables.py)
sed -i 's/choice_table_6x3\.xml/choice_grid_2cols.xml/g' tables.py

# choice_table_6x4 → choice_grid_3cols (tables.py)
sed -i 's/choice_table_6x4\.xml/choice_grid_3cols.xml/g' tables.py

# increase_decrease_template → inc_dec_Nx (tables.py)
sed -i 's/increase_decrease_template\.xml/inc_dec_1x.xml/g' tables.py
sed -i 's/increase_decrease_template_2x\.xml/inc_dec_2x.xml/g' tables.py
sed -i 's/increase_decrease_template_3x\.xml/inc_dec_3x.xml/g' tables.py
sed -i 's/increase_decrease_template_4x\.xml/inc_dec_4x.xml/g' tables.py

# syn_div / Pascal: Phase 4에서 가변 생성기(make_syn_div, make_pascal_triangle)로 전환되며 fixture 파일은 제거됨. rename 대상 아님.

# ganada_table.xml 삭제 (rm resources/hwpx_base/ganada_table.xml)
```

**주의**: `choice_table_6x3`은 `table_type` 파라미터 문자열로 동적 조합됨. rename 시 `table_type` 값도 업데이트 필요:
- extractor JSON의 `"table_type": "6x3"` → `"2cols"` 로 변경 (스키마 동기화 필요, Phase 3 범위)
