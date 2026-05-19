---
phase: 4
title: syn_div + Pascal 가변 생성기 + selector 통합
status: pending
depends_on: [3]
scope:
  - resources/hwpx_base/
  - tables.py
  - shapes.py
  - assemble.py
  - ngd-studio/server/stages/extractor.ts
intervention_likely: true
intervention_reason: "가변 생성기 셀 스타일(paraPr/charPr/border)을 사용자 본 양식지와 일치시키는 단계에서 시각 확인 필요. 첫 빌드 결과가 미세 차이 보일 가능성 큼."
---

# Phase 4: syn_div + Pascal — 가변 생성기 전환 + selector 통합

> **범위**: Backend (가변 생성기 함수) + Extractor (메타데이터 추출) + dispatch
> **난이도**: L
> **의존성**: Phase 3 (스키마 명세 완료, type tag 등록)
> **영향 파일**: `tables.py` / `shapes.py` (가변 생성기 함수 신설), `resources/hwpx_base/syn_div_cell_template.xml` / `pascal_cell_template.xml` (셀 단위 fixture), 기존 syn_div/Pascal fixture 7개 삭제, builder + extractor 정합

## 배경

Phase 1 사용자 결정: **syn_div 4종 + Pascal 3종 fixture 모두 제거**, 가변 생성기 함수로 전환. 사유:
1. 두 표는 수학적으로 규칙적 구조 (syn_div: degree 만큼 row 추가 / Pascal: row 수만큼 셀 1↗ 증가) — fixture 변형보다 코드 생성이 본질적
2. 기존 `make_increase_decrease_table` 가 유사 패턴 (n_x 따라 변형) 이미 존재 — 동일 스타일로 통합
3. fixture pool 부족 시 신규 양식지 확보 의존이 사라짐 — 결정론적 빌드

`hwpx-syn-div-pascal-selector` plan 도 본 phase 로 흡수.

## 설계

### 4-1. 셀 단위 fixture 도입

기존 표 전체 fixture (`synthetic_division_template_*`, `Pascal_triangle_*`) 대신 **셀 단위 템플릿** 2개만 보유:

```
resources/hwpx_base/
  syn_div_cell_template.xml      # syn_div 셀 1개 (border 스타일, paraPr, charPr 박힘)
  pascal_cell_template.xml       # Pascal 셀 1개 (centered, 작은 글씨, padding 등)
```

이 두 fixture 는 사용자 본 양식지 (`outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx`) 의 한 셀을 추출해 생성. 한 번 만들어 두면 이후 생성기가 행/열 수에 맞춰 복제 + grid 조립.

### 4-2. 가변 생성기 함수

```python
def make_syn_div_table(data, base_path):
    # data: {type:'synthetic_division', degree:int, rows:list[list[str]], n_rows:int, n_cols:int}
    # n_cols = degree + 1 (계수 컬럼) + α (조립 후 결과 컬럼)
    # 1. syn_div_cell_template.xml 1셀 Read
    # 2. n_rows x n_cols 그리드로 복제, 각 셀에 rows[r][c] 텍스트 주입
    # 3. <hp:tbl rowCnt=n_rows colCnt=n_cols> 조립
    return xml

def make_pascal_table(data, base_path):
    # data: {type:'pascal', n_rows:int, cells:list[list[str]]}
    # Pascal 삼각형은 r행에 r+1개 셀, span 그리드로 중앙 정렬
    # 1. pascal_cell_template.xml 1셀 Read
    # 2. 각 행 길이가 다른 grid 조립 (span/colSpan 활용)
    return xml
```

`tables.py` 에 두 함수 위치 (기존 `make_synthetic_division_table` 대체, 명명 통일).

### 4-3. fixture 7개 + ganada_table.xml 삭제

다음 파일 제거 (rename_map.md 결정 반영):
- `synthetic_division_template.xml`
- `synthetic_division_template_1.xml` ~ `_4.xml`
- `Pascal_triangle_1.xml` ~ `_3.xml`
- `ganada_table.xml`

`tools/fixture_remap.py`, `tools/header_def_mapper.py` 등 도구 파일에서도 위 파일명 참조 제거 (있다면).

### 4-4. extractor.ts 측 추가

`extractor.ts` 의 LLM 프롬프트에 다음 메타데이터 추출 지시 추가:
- `synthetic_division`: `degree`, `rows` (전체 셀 값 2D 배열), `n_rows`, `n_cols`
- `pascal`: `n_rows`, `cells` (각 행 셀 값 list)

기존 selector 분기 코드 (table_type=5x5/9x4 등) 와 동일 위치에 type 분기 추가.

### 4-5. dispatch 등록

`assemble.py` 의 condition_box / explanation_table 분기에 새 type tag 매핑:
- `type == 'synthetic_division'` → `make_syn_div_table`
- `type == 'pascal'` → `make_pascal_table`

기존 `make_synthetic_division_table` 호출부 정리 (이름 변경 또는 삭제).

## 체크리스트

- [ ] `outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx` 에서 syn_div / Pascal 한 셀씩 추출 → `syn_div_cell_template.xml`, `pascal_cell_template.xml` 신설
- [ ] `tables.py` 에 `make_syn_div_table(data, base_path)` 신설 (셀 복제 + 그리드 조립)
- [ ] `tables.py` 에 `make_pascal_table(data, base_path)` 신설 (가변 길이 행 조립)
- [ ] 기존 fixture 8개 삭제: `synthetic_division_template*.xml` (5개) + `Pascal_triangle_*.xml` (3개) + `ganada_table.xml`
- [ ] `tools/fixture_remap.py` / 기타 도구의 삭제 파일 참조 정리 (grep 후 일괄)
- [ ] `extractor.ts` LLM 프롬프트 갱신 — syn_div / Pascal 메타데이터 추출 항목 추가
- [ ] `assemble.py` dispatch 등록 — type tag 별 maker 라우팅
- [ ] 기존 `make_synthetic_division_table` 호출부 정리 (이름 통일 또는 alias)

## 영향 범위

- fixture 8개 삭제, 셀 템플릿 2개 신설 → 디렉터리 축소
- builder 신규 함수 2개 + 기존 함수 1개 정리
- extractor 프롬프트 + 출력 처리
- 기존 시험지 빌드: syn_div / Pascal 없으면 영향 없음. 있으면 새 가변 생성기 호출.

## 검증

```bash
# Python import + 가변 생성기 호출 (degree=3,4,5 / Pascal n_rows=5,7,9)
python3 -c "
from tables import make_syn_div_table, make_pascal_table

for deg in [3,4,5,6]:
    syn = {'type':'synthetic_division','degree':deg,'n_rows':deg+1,'n_cols':deg+2,'rows':[['1']*(deg+2)]*(deg+1)}
    xml = make_syn_div_table(syn, 'resources/hwpx_base')
    assert '<hp:tbl' in xml, f'syn_div deg={deg} 실패'

for n in [5,7,9]:
    pas = {'type':'pascal','n_rows':n,'cells':[['1']*(r+1) for r in range(n)]}
    xml = make_pascal_table(pas, 'resources/hwpx_base')
    assert '<hp:tbl' in xml, f'pascal n_rows={n} 실패'

print('syn_div + pascal 가변 생성기 OK')
"

# 삭제 fixture 가 실제로 없어졌는지
for f in synthetic_division_template.xml synthetic_division_template_1.xml synthetic_division_template_2.xml synthetic_division_template_3.xml synthetic_division_template_4.xml Pascal_triangle_1.xml Pascal_triangle_2.xml Pascal_triangle_3.xml ganada_table.xml; do
  test ! -f "resources/hwpx_base/$f" || { echo "FAIL: $f 잔존"; exit 1; }
done
echo "삭제 fixture 8개 모두 제거 ✓"

# 셀 템플릿 신규 fixture 존재
test -f resources/hwpx_base/syn_div_cell_template.xml && test -f resources/hwpx_base/pascal_cell_template.xml && echo "셀 템플릿 2개 ✓"

# 빌드 회귀
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
LATEST=$(ls -t "outputs/[고]"*_ver*.hwpx 2>/dev/null | head -1)
[ -n "$LATEST" ] && python3 resources/hwpx_scripts/validate.py "$LATEST" --fix

# TypeScript 컴파일
cd ngd-studio && npx tsc --noEmit && cd ..
```

검증 통과 조건: 가변 생성기 두 함수 호출 OK + 삭제 fixture 8개 부재 + 셀 템플릿 2개 존재 + 빌드 + tsc.
