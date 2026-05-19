# fixture_audit.md — resources/hwpx_base/ 전체 fixture 분류

> 생성: 2026-05-19 (Phase 1 worker)
> 기준: 29개 fixture XML (root_element / settings / version / content_hpf_template / header_area_template 제외)

---

## bogi_table_3items.xml
- **용도**: 보기 박스 (ㄱ. ㄴ. ㄷ. 3개 항목)
- **rowCnt / colCnt**: 4 / 5
- **cellSpan 패턴**:
  - row0 col0-1 (colSpan=2): 빈 좌측 패딩
  - row0 col2 (colSpan=1, rowSpan=2): `< 보 기 >` 라벨 (중앙)
  - row0 col3-4 (colSpan=2): NGD 로고 equation (흰색, 우측 패딩)
  - row1 col0-1, row1 col3-4: 빈 패딩 행
  - row2 col1 (colSpan=3): ㄱ./ㄴ./ㄷ. 3줄 본문 (주 내용 셀)
  - row2 col0, col4: 좌우 마진 셀
  - row3 col0-4 (colSpan=5): 하단 구분선 행
- **placeholder 위치**: row2 col1 — `<hp:t>ㄱ. </hp:t>` 뒤에 내용 주입
- **fixture 박힘 (보존 대상)**: `< 보 기 >` 텍스트 (paraPrIDRef=29 / charPrIDRef=0), NGD 로고 equation, ㄱ./ㄴ./ㄷ. 라벨
- **호출**: `make_bogi_table` (tables.py:401) — n_items <= 3 분기

---

## bogi_table_4items.xml
- **용도**: 보기 박스 (ㄱ. ㄴ. ㄷ. ㄹ. 4개 항목)
- **rowCnt / colCnt**: 4 / 5
- **cellSpan 패턴**: bogi_table_3items.xml과 동일 구조, row2 col1에 ㄱ~ㄹ 4줄
- **placeholder 위치**: row2 col1 — 4줄 라벨 뒤 주입
- **fixture 박힘**: `< 보 기 >` 텍스트, NGD 로고, ㄱ./ㄴ./ㄷ./ㄹ. 라벨
- **호출**: `make_bogi_table` (tables.py:403) — n_items == 4 분기

---

## bogi_table_6items.xml
- **용도**: 보기 박스 (ㄱ~ㅂ 6개 항목, 2열 3행 레이아웃)
- **rowCnt / colCnt**: 7 / 7
- **cellSpan 패턴**:
  - row0 col0-2 (colSpan=3): 좌측 패딩
  - row0 col3 (colSpan=1, rowSpan=2): `< 보 기 >` (중앙)
  - row0 col4-6 (colSpan=3): NGD 로고 (우측)
  - row2-4 col0 (colSpan=1, rowSpan=3): 좌 마진
  - row2-4 col6 (colSpan=1, rowSpan=3): 우 마진
  - row2 col1 (ㄱ.), row2 col2-4 (ㄴ.), row2 col5 (ㄷ.)
  - row3 col1, col2-4, col5: 내용 행 2 (빈 placeholder)
  - row4 col1 (ㄹ.), col2-4 (ㅁ.), col5 (ㅂ.)
  - row5 col0-6: 내용 행
  - row6 col0-6 (colSpan=7): 하단 구분선
- **placeholder 위치**: row2~5의 각 라벨 셀 내 내용 주입
- **fixture 박힘**: `< 보 기 >`, NGD 로고, ㄱ~ㅂ 라벨 (2열 배치)
- **호출**: `make_bogi_table` (tables.py:405) — n_items >= 5 분기 (6이 아니어도 사용됨)

---

## choice_table_5x5.xml
- **용도**: 명제 테이블 (p:/q: 기반 논리 선지 — ①②③④⑤ 행 × [번호/p:/내용/q:/내용] 열)
- **rowCnt / colCnt**: 5 / 5
- **cellSpan 패턴**: 5행 5열, 모든 셀 colSpan=1 rowSpan=1 (스팬 없음)
  - col0: ①②③④⑤ 번호 셀
  - col1: `p`:` equation (이탤릭, 각 행 동일)
  - col2: p 내용 (넓은 셀)
  - col3: `q`:` equation (이탤릭, 각 행 동일)
  - col4: q 내용 (넓은 셀)
- **placeholder 위치**: col2 (p 내용), col4 (q 내용) — 행별 데이터 주입
- **fixture 박힘**: p`:/q`: 수식 라벨 (각 행 5개씩 25셀), ①~⑤ 번호
- **호출**: `make_choice_table` (tables.py:368) — table_type="5x5" 시
- **주의**: 이름과 달리 "명제(p→q)" 전용 테이블, 일반 그리드 선지 아님

---

## choice_table_9x4.xml
- **용도**: 그림 객관식 선지 (①~⑤ 번호 + 이미지 placeholder 3쌍 = 총 9행 4열)
- **rowCnt / colCnt**: 9 / 4
- **cellSpan 패턴**:
  - col0 (번호 열): ① (row0), ③ (row3), ⑤ (row6) — 각 번호 rowSpan=1
  - col1 (이미지 열): row0-2 (rowSpan=3) → 이미지 placeholder 1
                       row3-5 (rowSpan=3) → 이미지 placeholder 2
                       row6-8 (rowSpan=3) → 이미지 placeholder 3
  - col2 (번호 열): ② (row0), ④ (row3) — 각 번호 rowSpan=1
  - col3 (이미지 열): 동일하게 rowSpan=3 이미지 placeholder 2쌍
  - row1,2,4,5,7,8 의 col0, col2: 빈 패딩 행
- **placeholder 위치**: col1 rowSpan=3 셀들 (이미지 주입 위치), col3 rowSpan=3 셀들
- **fixture 박힘**: ①②③④⑤ 번호 (col0/col2 교대)
- **호출**: `make_choice_table` (tables.py:368) — table_type="9x4" 시
- **주의**: 선지가 그림인 경우 전용 (보통 보기 이미지 5개를 2열로 배치)

---

## choice_table_6x3.xml
- **용도**: (가)(나) 2열 헤더 + ①~⑤ 번호 선지 그리드 (6행 3열)
- **rowCnt / colCnt**: 6 / 3
- **cellSpan 패턴**:
  - row0: col0(빈 번호), col1=(가) 헤더, col2=(나) 헤더
  - row1-5: col0=①~⑤ 번호, col1=내용, col2=내용
- **placeholder 위치**: row1~5의 col1, col2 (각 선지 두 항목)
- **fixture 박힘**: (가)/(나) 헤더 텍스트, ①~⑤ 번호
- **호출**: `make_choice_table` (tables.py:368) — table_type="6x3" 시 (기본값)

---

## choice_table_6x4.xml
- **용도**: (가)(나)(다) 3열 헤더 + ①~⑤ 번호 선지 그리드 (6행 4열)
- **rowCnt / colCnt**: 6 / 4
- **cellSpan 패턴**:
  - row0: col0(빈 번호), col1=(가), col2=(나), col3=(다) 헤더
  - row1-5: col0=①~⑤ 번호, col1~3=내용 (4번 째 열은 일부 빈 칸)
- **placeholder 위치**: row1~5의 col1, col2 (col3는 고정값 있는 경우도)
- **fixture 박힘**: (가)/(나)/(다) 헤더, ①~⑤ 번호
- **호출**: `make_choice_table` (tables.py:368) — table_type="6x4" 시

---

## condition_rect_template.xml
- **용도**: 조건 박스 프로그래매틱 직사각형 (가장 범용 조건 컨테이너)
- **구조**: `<hp:rect>` — 표가 아닌 도형(drawText 포함)
- **템플릿 placeholder**: `{{RECT_ID}}`, `{{ZORDER}}`, `{{INST_ID}}`, `{{HEIGHT}}`, `{{CENTER_Y}}`, `{{SCA_Y}}`, `{{ITEMS_CONTENT}}`
- **fixture 박힘**: 없음 (완전 프로그래매틱)
- **호출**: `make_condition_rect` (shapes.py:15), `make_ganada_table` (shapes.py:108) — 내부에서 이 파일을 structural base로 사용

---

## empty_box_template.xml
- **용도**: 서술형 빈 답안 박스
- **구조**: `<hp:rect>` (도형), 내부에 공백 텍스트만 있음
- **템플릿 placeholder**: `{{RECT_ID}}`, `{{ZORDER}}`, `{{INST_ID}}`, `{{HEIGHT}}`, `{{CENTER_Y}}`, `{{SCA_Y}}`
- **fixture 박힘**: 없음 (빈 박스)
- **호출**: `make_empty_box` (shapes.py:132)

---

## ganada_table.xml
- **용도**: (가)(나)(다) 조건 박스 — 구조 참조용 fixture
- **구조**: `<hp:rect>` (도형), `(가) `, `(나) `, `(다) ` 라벨 텍스트 내장
- **rowCnt / colCnt**: 없음 (rect, 표 아님)
- **fixture 박힘**: `(가) `, `(나) `, `(다) ` 텍스트 (paraPrIDRef=6/0/6 교대, charPrIDRef=1)
- **호출**: `make_ganada_table` (shapes.py:65) — 실제로는 condition_rect_template.xml 기반으로 생성, ganada_table.xml은 스타일 참조용

---

## increase_decrease_template.xml
- **용도**: 증감표 — n_x=1 (3행 4열: x 헤더 + ··· 1구간 + ···, f'(x), f(x))
- **rowCnt / colCnt**: 3 / 4
- **cellSpan 패턴**: 3행 4열 균등. col0={x}, col1={CDOTS}, col2=빈 구간, col3={CDOTS}
  - row0: x 헤더 + 구간 경계값들
  - row1: f'(x) + 부호/화살표
  - row2: f(x) + 값
- **fixture 박힘**: `{x}`, `{CDOTS}`, `{f prime(x)}`, `{f(x)}` 수식
- **호출**: `make_increase_decrease_table` (tables.py:177) — n_x == 1 분기

---

## increase_decrease_template_2x.xml
- **용도**: 증감표 — n_x=2 (3행 6열: x 헤더 + 구간 2개 + 경계 2개)
- **rowCnt / colCnt**: 3 / 6
- **cellSpan 패턴**: 3행 6열 균등, CDOTS 4개 + 빈 구간 셀 2개
- **fixture 박힘**: `{x}`, `{CDOTS}` ×4, `{f prime(x)}`, `{f(x)}` 수식
- **호출**: `make_increase_decrease_table` (tables.py:177) — n_x == 2 분기

---

## increase_decrease_template_3x.xml
- **용도**: 증감표 — n_x=3 (4행 8열: y', y'' 행 포함)
- **rowCnt / colCnt**: 4 / 8
- **cellSpan 패턴**: 4행 8열. row3 (y행)은 그래프 시각화 구간용 (더 큰 높이)
  - row0: x 헤더 + CDOTS 구간
  - row1: y' (= f' 부호)
  - row2: y'' (= f'' 부호)
  - row3: y 값 (그래프 구간 묘사)
- **fixture 박힘**: `x`, `{CDOTS}`, `y'`, `y''`, `y` 수식 (charPrIDRef=3)
- **호출**: `make_increase_decrease_table` (tables.py:182) — n_x == 3 분기

---

## increase_decrease_template_4x.xml
- **용도**: 증감표 — n_x=4 또는 5 (5행 12열)
- **rowCnt / colCnt**: 5 / 12
- **cellSpan 패턴**: 5행 12열. y', y'', y + 그래프 구간용 확장
- **fixture 박힘**: `x`, `{CDOTS}`, `y'`, `y''`, `y` 수식
- **호출**: `make_increase_decrease_table` (tables.py:186) — n_x >= 4 분기

---

## normal_dist_3rows.xml
- **용도**: 표준정규분포표 — 3개 데이터 행 (z: 1.0, 1.5, 2.0)
- **rowCnt / colCnt**: 5 / 2
- **cellSpan 패턴**: row0 (colSpan=2) `<표준정규분포표>` 타이틀, row1 z/P(0≤Z≤z) 헤더, row2-4 데이터 (1.0→0.3413, 1.5→0.4332, 2.0→0.4772)
- **fixture 박힘**: 타이틀 텍스트, z/P 헤더 수식, 고정 데이터값 (1.0, 1.5, 2.0, 0.3413, 0.4332, 0.4772)
- **호출**: `make_data_table_xml` (tables.py:75) — row수=3 분기

---

## normal_dist_4rows.xml
- **용도**: 표준정규분포표 — 4개 데이터 행 (z: 0.5, 1.0, 1.5, 2.0)
- **rowCnt / colCnt**: 6 / 2
- **cellSpan 패턴**: 동일 구조, 데이터 (0.5→0.1915, 1.0→0.3413, 1.5→0.4332, 2.0→0.4772)
- **fixture 박힘**: 타이틀, 헤더, 4줄 데이터값
- **호출**: `make_data_table_xml` (tables.py:77) — row수=4 분기

---

## normal_dist_5rows.xml
- **용도**: 표준정규분포표 — 5개 데이터 행 (z: 0.5, 1.0, 1.5, 2.0, 2.5)
- **rowCnt / colCnt**: 7 / 2
- **cellSpan 패턴**: 동일 구조, 추가 행 (2.5→0.4938)
- **fixture 박힘**: 타이틀, 헤더, 5줄 데이터값
- **호출**: `make_data_table_xml` (tables.py:79) — row수=5 분기

---

## prob_dist_5cols.xml
- **용도**: 이산확률분포표 — X 값 4개 + 계 (5열 2행)
- **rowCnt / colCnt**: 2 / 5
- **cellSpan 패턴**: 2행 5열. row0 = X / 값1~4 / 계, row1 = P(X=x) / 확률값들 / 1
- **fixture 박힘**: X, P(X=x) 수식, `계` 텍스트, 합=1 수식
- **호출**: `make_data_table_xml` (tables.py:123) — col수=5 분기

---

## prob_dist_6cols.xml
- **용도**: 이산확률분포표 — X 값 5개 + 계 (6열 2행)
- **rowCnt / colCnt**: 2 / 6
- **fixture 박힘**: X, P(X=x) 수식, 계, 합=1
- **호출**: `make_data_table_xml` (tables.py:126) — col수=6 분기

---

## prob_dist_7cols.xml
- **용도**: 이산확률분포표 — X 값 6개 + 계 (7열 2행)
- **rowCnt / colCnt**: 2 / 7
- **fixture 박힘**: X, P(X=x) 수식, 계, 합=1
- **호출**: `make_data_table_xml` (tables.py:129) — col수=7 분기

---

## proof_table_template.xml
- **용도**: `[ 증 명 ]` 테이블 (증명 박스)
- **rowCnt / colCnt**: 4 / 5
- **cellSpan 패턴**: bogi_table_3items.xml과 유사 구조
  - row0 col0-1 (colSpan=2): 좌 패딩
  - row0 col2 (colSpan=1, rowSpan=2): `[ 증 명 ]` 라벨
  - row0 col3-4 (colSpan=2): NGD 로고
  - row2 col1 (colSpan=3): 증명 본문 (빈 placeholder)
  - row3 col0-4 (colSpan=5): 하단 구분선
- **placeholder 위치**: row2 col1 — 빈 셀, 본문 주입 위치
- **fixture 박힘**: `[ 증 명 ]` 텍스트 (charPrIDRef=0), NGD 로고 수식
- **호출**: `make_proof_table` (shapes.py:144), `make_proof_table_wrapped` (tables.py:433)

---

## synthetic_division_template.xml (레거시)
- **용도**: 조립제법 표 — n=3차 (10행 5열) — 레거시 단일 템플릿
- **rowCnt / colCnt**: 10 / 5
- **cellSpan 패턴**: 10행 5열. 조립제법 계산 행 구조 (제수 / 계수행 / 결과행 반복)
- **fixture 박힘**: 없음 (데이터 주입 위치들만)
- **호출**: `make_synthetic_division_table` (tables.py:339) — 현재 이 레거시 버전만 호출됨
- **주의**: synthetic_division_template_1~4.xml 로 대체 예정 (아직 코드 미연결)

---

## synthetic_division_template_1.xml
- **용도**: 조립제법 — 3차 단항식 (4행 5열, 제수 1개)
- **rowCnt / colCnt**: 4 / 5
- **fixture 박힘**: 조립제법 구조 셀 (경계선 포함)
- **호출**: 미연결 (Phase 4에서 selector 구현 예정)

---

## synthetic_division_template_2.xml
- **용도**: 조립제법 — 4차 (중첩1) (7행 5열)
- **rowCnt / colCnt**: 7 / 5
- **fixture 박힘**: 조립제법 2단계 구조
- **호출**: 미연결

---

## synthetic_division_template_3.xml
- **용도**: 조립제법 — 5차 (중첩2) (10행 5열)
- **rowCnt / colCnt**: 10 / 5
- **fixture 박힘**: 조립제법 3단계 구조
- **호출**: 미연결

---

## synthetic_division_template_4.xml
- **용도**: 조립제법 — 6차 (중첩3) (13행 6열)
- **rowCnt / colCnt**: 13 / 6
- **fixture 박힘**: 조립제법 4단계 구조 (6열 확장)
- **호출**: 미연결

---

## Pascal_triangle_1.xml
- **용도**: 파스칼 삼각형 — 5행 (row 0~4, 7행 18열 스팬 구조)
- **rowCnt / colCnt**: 7 / 18
- **cellSpan 패턴**: 삼각형 시각화를 위해 대부분 셀이 병합됨 (centered layout). 실제 hp:tr 1개만 있음 (모든 셀 rowSpan으로 처리)
- **fixture 박힘**: 파스칼 삼각형 숫자들 (1, 1 1, 1 2 1, 1 3 3 1, 1 4 6 4 1)
- **호출**: 미연결

---

## Pascal_triangle_2.xml
- **용도**: 파스칼 삼각형 — 7행 (row 0~6, 12행 23열 스팬 구조)
- **rowCnt / colCnt**: 12 / 23
- **fixture 박힘**: 파스칼 7행까지 숫자
- **호출**: 미연결

---

## Pascal_triangle_3.xml
- **용도**: 파스칼 삼각형 — 9행 (row 0~8, 12행 23열 스팬 구조, Pascal_2와 동일 크기이나 더 많은 행 데이터)
- **rowCnt / colCnt**: 12 / 23
- **fixture 박힘**: 파스칼 9행까지 숫자
- **호출**: 미연결
- **주의**: Pascal_triangle_2.xml과 rowCnt/colCnt 동일 — 실제 내용(데이터 행 수)으로 구분

---

## 요약 표

| fixture | 타입 | rowCnt | colCnt | 현재 호출함수 |
|---------|------|--------|--------|--------------|
| bogi_table_3items | hp:tbl | 4 | 5 | make_bogi_table |
| bogi_table_4items | hp:tbl | 4 | 5 | make_bogi_table |
| bogi_table_6items | hp:tbl | 7 | 7 | make_bogi_table |
| choice_table_5x5 | hp:tbl | 5 | 5 | make_choice_table |
| choice_table_9x4 | hp:tbl | 9 | 4 | make_choice_table |
| choice_table_6x3 | hp:tbl | 6 | 3 | make_choice_table |
| choice_table_6x4 | hp:tbl | 6 | 4 | make_choice_table |
| condition_rect_template | hp:rect | — | — | make_condition_rect / make_ganada_table |
| empty_box_template | hp:rect | — | — | make_empty_box |
| ganada_table | hp:rect | — | — | (참조용, make_ganada_table 에서 조건 분기) |
| proof_table_template | hp:tbl | 4 | 5 | make_proof_table_wrapped |
| increase_decrease_template | hp:tbl | 3 | 4 | make_increase_decrease_table (n_x=1) |
| increase_decrease_template_2x | hp:tbl | 3 | 6 | make_increase_decrease_table (n_x=2) |
| increase_decrease_template_3x | hp:tbl | 4 | 8 | make_increase_decrease_table (n_x=3) |
| increase_decrease_template_4x | hp:tbl | 5 | 12 | make_increase_decrease_table (n_x≥4) |
| normal_dist_3rows | hp:tbl | 5 | 2 | make_data_table_xml (rows=3) |
| normal_dist_4rows | hp:tbl | 6 | 2 | make_data_table_xml (rows=4) |
| normal_dist_5rows | hp:tbl | 7 | 2 | make_data_table_xml (rows=5) |
| prob_dist_5cols | hp:tbl | 2 | 5 | make_data_table_xml (cols=5) |
| prob_dist_6cols | hp:tbl | 2 | 6 | make_data_table_xml (cols=6) |
| prob_dist_7cols | hp:tbl | 2 | 7 | make_data_table_xml (cols=7) |
| synthetic_division_template | hp:tbl | 10 | 5 | make_synthetic_division_table (레거시) |
| synthetic_division_template_1 | hp:tbl | 4 | 5 | 미연결 |
| synthetic_division_template_2 | hp:tbl | 7 | 5 | 미연결 |
| synthetic_division_template_3 | hp:tbl | 10 | 5 | 미연결 |
| synthetic_division_template_4 | hp:tbl | 13 | 6 | 미연결 |
| Pascal_triangle_1 | hp:tbl | 7 | 18 | 미연결 |
| Pascal_triangle_2 | hp:tbl | 12 | 23 | 미연결 |
| Pascal_triangle_3 | hp:tbl | 12 | 23 | 미연결 |

**총 fixture 수**: 29개 (레거시 synthetic_division_template.xml 포함)
