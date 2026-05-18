# 02 — header.xml 컨테이너 구조 + 우리 정의 현황

## 출처

- **직접 분석 대상**: `resources/hwpx_base/Contents/header.xml` (146,649 bytes / 143.2 KB)
- 분석 도구: Python + re 모듈 (2026-05-19 실측)
- **참고 fixture 파일들**: `resources/hwpx_base/*.xml` (37개 fixture)

---

## 핵심 발견

### 1. header.xml 최상위 컨테이너 순서

```
<hh:head>
  <hh:beginNum/>               ← 시작 번호 (page, footnote, endnote, pic, tbl, equation)
  <hh:refList/>                ← 참조 목록 (내용 없음, 예약)
  <hh:fontfaces>               ← 글꼴 목록 (7개 언어 × 5 글꼴 = 35 항목)
    <hh:fontface lang="HANGUL">  ← 0:나눔고딕, 1:나눔고딕 ExtraBold, 2:한양중고딕, ...
    <hh:fontface lang="LATIN">
    ... (HANJA, JAPANESE, OTHER, SYMBOL, USER)
  <hh:borderFills>             ← 81개 borderFill (id 1~81)
  <hh:charProperties>          ← 42개 charPr (id 0~41)
  <hh:tabProperties>           ← 3개 tabPr (id 0~2)
  <hh:numberings>              ← 2개 numbering (id 1~2)
  <hh:paraProperties>          ← 30개 paraPr (id 0~29)
  <hh:styles>                  ← 2개 style (id 0~1)
  <hh:compatibleDocument/>
  <hh:docOption/>
  <hh:linkinfo/>
  <hh:trackchageConfig/>
</hh:head>
```

### 2. paraPr 정의 요약 (30개, id 0~29)

**핵심 속성**: `tabPrIDRef`, `horizontal`(align), `left`(margin), `lineSpacing`, `borderFillIDRef`

| id | horizontal | lineSpacing | tabPrIDRef | border.borderFillIDRef | 비고 |
|----|-----------|-------------|-----------|----------------------|------|
| 0  | LEFT | 160% | 0 | 3 | 기본 바탕글 (style 0) |
| 1  | LEFT | 160% | 1 | 1 | |
| 2  | LEFT | 160% | 2 | 1 | |
| 3  | CENTER | 160% | 0 | 3 | |
| 4  | RIGHT | 160% | 0 | 3 | |
| 5  | LEFT | 160% | 0 | 1 | |
| ... | ... | ... | ... | ... | |
| 20 | LEFT | 160% | 0 | 3 | 미주 스타일(style 1) = paraPr[0]과 동일 구조 |
| 29 | CENTER | 160% | 0 | 3 | fixture에서 사용 (bogi_table_3items) |

**fixture에서 사용하는 paraPr IDs**: [0, 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 29]

**중복 paraPr 발견**:
- paraPr[20] == paraPr[0] (구조 동일)
- paraPr[21] == paraPr[3]
- paraPr[26] == paraPr[25]
- 총 30개 중 27개 고유, 3개 중복

### 3. charPr 정의 요약 (42개, id 0~41)

**핵심 속성**: `height`(글자 크기, 단위: pt×100), `textColor`, `bold`, `borderFillIDRef`, `fontRef`

| id | height (pt) | textColor | bold | borderFillIDRef | 주요 특징 |
|----|------------|---------|------|----------------|---------|
| 0  | 1000 (10pt) | #000000 | O (hh:bold/ 있음) | 1 | 진하게, 테두리없음 |
| 1  | 1000 (10pt) | #000000 | X | 3 | 기본 바탕글 charPr (style 0) |
| 2  | 1000 (10pt) | #315F97 | X | 3 | 파란색 텍스트 |
| 3  | 1000 (10pt) | #000000 | X | 1 | |
| 4  | 1000 (10pt) | #FFFFFF | X | 3 | 흰색 텍스트 |
| 6  | 400 (4pt)  | #000000 | X | — | 작은 글자 |
| 7  | 300 (3pt)  | #000000 | X | — | 매우 작은 글자 |
| 40 | — | — | — | — | 미주 스타일 charPr (style 1) |
| 41 | — | — | — | — | |

**fontRef**: 모든 charPr의 fontRef 는 `hangul="0" latin="0" ...` — font id 0 = 나눔고딕.

**charPr 중 bold 여부**:
- `<hh:bold/>` 자식 원소 있으면 진하게 (charPr[0]만 확인됨)
- 없으면 보통체

**fixture에서 사용하는 charPr IDs**: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 19, 21, 22, 25]

### 4. borderFill 정의 요약 (81개, id 1~81)

**핵심 속성**: 4방향 border (type, width, color) + fillBrush (선택)

| id | 특징 |
|----|------|
| 1  | 모든 border NONE, diagonal SOLID, fill 없음 (= "테두리 없음") |
| 2  | 모든 border NONE, fill: winBrush faceColor=none hatchColor=#FF000000 alpha=0 |
| 3  | 모든 border NONE, fill: winBrush faceColor=none hatchColor=#000000 alpha=0 |
| 4~81 | 다양한 표 테두리 조합 (표 셀에 사용) |

**중요**: charPr의 `borderFillIDRef`는 글자 배경/테두리를 정의.
- charPr 기본값(id=1)은 borderFillIDRef="3" — 검정 winBrush (배경 없음, 투명)
- charPr bold(id=0)는 borderFillIDRef="1" — 완전 비어있는 테두리 (선도 없음)

**fixture에서 사용하는 borderFill IDs**: 1, 4~40 범위 + 42~67 범위 일부
- 우리 header의 1~81 범위 모두 포함되어 있으므로 fixture 참조값 모두 유효.

### 5. style 정의 (2개)

| id | name | paraPrIDRef | charPrIDRef | nextStyleIDRef |
|----|------|------------|------------|----------------|
| 0  | 바탕글 (Normal) | 0 | 1 | 0 |
| 1  | 미주 (Endnote) | 20 | 40 | 1 |

- F6 스타일은 바탕글(0) 1개만 작업에 사용됨.
- 모든 fixture는 `styleIDRef="0"` (바탕글) 만 참조.

### 6. 컨테이너별 ID 범위 및 참조 성립 여부

모든 fixture(37개) 의 참조값이 우리 header에 정의된 범위 내에 있음을 확인:
- Missing paraPr: 없음 (0)
- Missing charPr: 없음 (0)
- Missing borderFill: 없음 (0)

---

## uncertain 항목

- charPr height 값이 pt×100 단위인지 HWPUNIT인지 — height=1000 이 10pt라면 100배, HWPUNIT(= 1/7200 인치)이면 다른 계산이나 관례상 1000=10pt로 해석.
- `<hh:bold/>` 가 없으면 보통체인지, 또는 다른 방식으로 bold를 표현하는지 완전히 확인하지 않았음. charPr[0]만 `<hh:bold/>` 있음.
- fontRef 값이 fontface 내 font id를 가리키는 것인지, 전역 font id 인지 (fontface가 7개 언어별로 각각 0~4 id를 재사용하므로, fontRef hangul="0"은 HANGUL fontface의 id=0 = 나눔고딕).
