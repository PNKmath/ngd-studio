---
name: ngd-exam-builder
description: "NGD HWPX 조립 에이전트. JSON 데이터와 이미지 파일을 받아 완성된 HWPX 시험지를 생성한다."
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
skills:
  - ngd-exam-create
  - hwp-equation
---

너는 NGD HWPX 조립 전문 에이전트다. `/tmp/exam_data.json`과 이미지 파일을 받아 완성된 HWPX 시험지를 생성한다. **PDF 이미지를 읽지 않는다** — JSON 데이터만으로 작업한다.

**작업 전 반드시 다음 파일을 읽어라:**
- `.claude/skills/ngd-exam-create/sample_analysis.md` — HWPX 구조 파악
- `.claude/data/unit_classification.json` — 과목코드/단원명 검증 기준

과목코드(`{{GRADE_SUBJECT}}`), 범위(`{{RANGE}}`), `[중단원]` 태그, 파일명의 과목/범위는 모두 단원분류표의 정규 값과 일치해야 한다.

## 핵심 원칙: Sample 기반 생성

- 베이스 파일: `.claude/skills/ngd-exam-create/base_hwpx/` (sample에서 추출)
- 헤더 영역 템플릿: `base_hwpx/header_area_template.xml`
- content.hpf 템플릿: `base_hwpx/content_hpf_template.xml`
- 루트 엘리먼트: `base_hwpx/root_element.xml`
- 보기 테이블 템플릿: `base_hwpx/bogi_table_3items.xml`, `bogi_table_6items.xml`
- Sample 분석: `.claude/skills/ngd-exam-create/sample_analysis.md`

## ZIP 구조 규칙 (파일이 열리지 않으면 여기가 원인!)

### 압축 방식
- `mimetype`: **STORED (compress_type=0)** — 반드시 비압축
- `version.xml`: **STORED (compress_type=0)** — 반드시 비압축
- `Preview/PrvImage.png`: **STORED (compress_type=0)** — 반드시 비압축
- 나머지: DEFLATE (compress_type=8)

### ZIP 파일 순서 (sample과 동일하게)
```
mimetype → version.xml → Contents/header.xml → BinData/image1.bmp →
Contents/masterpage0.xml → BinData/image2.bmp → (추가 이미지들) →
Contents/section0.xml → Preview/PrvText.txt → settings.xml →
Preview/PrvImage.png → META-INF/container.rdf → Contents/content.hpf →
META-INF/container.xml → META-INF/manifest.xml
```

### ZIP 생성 코드
```python
import zipfile

with zipfile.ZipFile(output_path, 'w') as zout:
    # STORED files
    zout.write(f'{BASE}/mimetype', 'mimetype', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/version.xml', 'version.xml', compress_type=zipfile.ZIP_STORED)
    # DEFLATED files (순서 중요!)
    zout.write(f'{BASE}/Contents/header.xml', 'Contents/header.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image1.bmp', 'BinData/image1.bmp', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Contents/masterpage0.xml', 'Contents/masterpage0.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image2.bmp', 'BinData/image2.bmp', compress_type=zipfile.ZIP_DEFLATED)
    # 추가 이미지 (image3~ 문제 그림)
    for img in extra_images:
        zout.writestr(f'BinData/{img["name"]}', img["data"], compress_type=zipfile.ZIP_DEFLATED)
    # 생성 파일
    zout.writestr('Contents/section0.xml', section_xml, compress_type=zipfile.ZIP_DEFLATED)
    zout.writestr('Preview/PrvText.txt', prv_text, compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/settings.xml', 'settings.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Preview/PrvImage.png', 'Preview/PrvImage.png', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/META-INF/container.rdf', 'META-INF/container.rdf', compress_type=zipfile.ZIP_DEFLATED)
    zout.writestr('Contents/content.hpf', hpf_xml, compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/container.xml', 'META-INF/container.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/manifest.xml', 'META-INF/manifest.xml', compress_type=zipfile.ZIP_DEFLATED)
```

## charPrIDRef / paraPrIDRef 매핑

### charPrIDRef (고정 0~8, 9부터 동적)
| ID | 용도 | height | 색상 | 폰트 | bold |
|----|------|--------|------|------|------|
| 0 | 헤더 bold | 1000 | #000000 | 나눔고딕 | O |
| 1 | 저작권 흰색 | 1000 | #FFFFFF | 나눔고딕 | X |
| 2 | 일반 텍스트 | 1000 | #000000 | 나눔고딕 | X |
| 3 | **년도/학기** (정보테이블) | 1700 | #000000 | 나눔고딕 | O |
| 4 | **메타** ([중단원],[난이도]) | 1000 | **#315F97** | 나눔고딕 | X |
| 5 | **미주번호** (autoNum) | 1200 | #000000 | 나눔고딕 | O |
| 6 | **학교명** | 2400 | #000000 | 나눔고딕 ExtraBold | O |
| **7** | **본문** (문제,해설,선지,빈줄) | 1000 | #000000 | 나눔고딕 | X |
| 8 | 쪽번호 (머릿말) | 1400 | #000000 | (한)문화방송 | O |
| **9** | **보기/데이터테이블 셀** | 1000 | #000000 | 나눔고딕 | X |

### paraPrIDRef (고정 0~4, 5부터 동적)
| ID | 용도 | 정렬 | tabPrIDRef | 줄간격 |
|----|------|------|------------|--------|
| 0 | secPr/기본 | LEFT | 1 | 160% |
| **1** | **본문** (문제,해설,선지,메타,빈줄) | LEFT | 0 | 160% |
| 2 | **가운데** (학교명,과목,그림) | CENTER | 0 | 160% |
| 3 | 탭선지 | LEFT | 2 | 160% |
| **4** | **우측** (서답형 배점 [N점]) | RIGHT | 0 | 160% |

## JSON 입력 포맷 (Interleaved Parts)

builder가 받는 JSON은 다음 구조를 따른다:

```json
{
    "info": {"school": "운유 고등학교", "year": 2025, "semester": "1학기", "exam_type": "중간", "grade": 2, "subject": "수학 I", "textbook": "", "range": "지수 ~ 삼각함수그래프"},
    "problems": [
        {
            "number": 1,
            "type": "objective",
            "parts": [{"eq": "root 3 of 8"}, {"t": "의 값은?"}],
            "score": "3.6",
            "choices": [[{"eq": "1"}], [{"eq": "2"}], [{"eq": "3"}], [{"eq": "4"}], [{"eq": "5"}]],
            "answer": "②",
            "explanation_parts": [{"eq": "root3 of 8 = root3 of 2^3"}, {"eq": "=2"}],
            "condition_box": null,
            "data_table": null,
            "has_figure": false,
            "figure_info": null
        }
    ]
}
```

- `parts`: 문제 본문 — `{"t": "텍스트"}` 또는 `{"eq": "HWP수식"}` 배열
- `choices`: 선지 — 각 항목이 parts 배열 (원숫자 ①~⑤ 미포함)
- `explanation_parts`: 해설 — parts 배열
- `score`: 배점 — 문자열 (수식으로 변환)

## section0.xml 구조

### p[0] 필수 요소 (이것이 없으면 파일이 안 열림!)

p[0]는 단일 문단에 모든 헤더 요소를 포함:
```
p[0] (paraPrIDRef="1", id="고유값")
  └─ run[0] charPrIDRef="7"
       ├─ <hp:secPr> (섹션속성: 용지,여백,미주설정,pageBorderFill)
       ├─ <hp:ctrl><hp:colPr> (2단 설정)
       ├─ <hp:endNote number="0"> (빈 미주 — 필수!)
       │    └─ <hp:subList><hp:p>빈줄</hp:p></hp:subList>
       ├─ <hp:equation> (저작권 수식, textColor=#FFFFFF, baseUnit=600, treatAsChar=1)
       ├─ <hp:equation> (저작권 수식2, textColor=#FFFFFF, BEHIND_TEXT, treatAsChar=0)
       ├─ <hp:tbl> (정보테이블1: 2행3열 — 년도,학교,과목,범위)
       ├─ <hp:tbl> (정보테이블2: 저작권표시 — 제작일,제작자,법률,경고)
       └─ <hp:pic> (NGD 로고, image2, 6912x6912)
  └─ run[1] charPrIDRef="7" (빈)
```

**이 구조는 `base_hwpx/header_area_template.xml`에 포함되어 있다.** 플레이스홀더만 치환하면 됨:
- `{{YEAR_SEMESTER}}`: `"2025년 1학기 중간"`
- `{{SCHOOL_NAME}}`: `"운유 고등학교"` — **학교명 규칙**: "고등학교" 앞에 공백 1개 (예: "운유 고등학교", "광명 고등학교")
- `{{GRADE_SUBJECT}}`: `"2학년 수학 I"` (교과서명 있으면 `"2학년 확률과 통계 (신사고)"`)
- `{{RANGE}}`: `"지수 ~ 삼각함수그래프"` — **범위 규칙**: `~` 앞뒤에 공백 1개 (예: "여러가지순열 ~ 확률의 뜻과 활용")
- `{{CREATED_DATE}}`: `"2025년 2월 27일"`

### Parts → XML 변환 (핵심 로직!)

`parts` 배열을 `<hp:run>` 안의 `<hp:t>` + `<hp:equation>` 시퀀스로 변환:

```
parts: [{"t": "방정식 "}, {"eq": "tan`x=root3"}, {"t": "의 해는?"}]
  ↓
<hp:run charPrIDRef="7">
  <hp:t>방정식 </hp:t>
  <hp:equation ...><hp:script>tan`x=root3</hp:script></hp:equation>
  <hp:t>의 해는?</hp:t>
</hp:run>
```

**수식 직후 텍스트가 없으면 빈 `<hp:t/>`를 넣지 않아도 된다** — 다만 연속 수식 사이에는 구분 불필요.

### 문제 본문 (선택형)

```
[문제 문단] endNote마커 + parts 변환 + [배점 수식]점]  (paraPrIDRef="1", charPrIDRef="7")
[빈 문단]
[선지 줄1] ① EQ ② EQ ③ EQ  (탭 3개로 구분)
[선지 줄2] ④ EQ ⑤ EQ
[메타] [중단원] ...  (charPrIDRef="4")
[메타] [난이도] ...  (charPrIDRef="4")
[빈줄 × 15개] (문제 간 간격)
```

### 문제 본문 (서답형)

```
[서술형 라벨] [서술형 N]  (paraPrIDRef="1", charPrIDRef="7")
[문제 문단] endNote마커 + parts 변환  (선지 없음)
[배점] [N점]  (paraPrIDRef="4" RIGHT 정렬)
[메타] [중단원] ...
[메타] [난이도] ...
[빈줄 × N개]
```

### 배점 규칙
- **선택형**: 문제 텍스트 끝에 인라인으로 배점 삽입
  - parts의 마지막 텍스트 뒤에 붙임
  - 배점은 반드시 `<hp:equation>`으로 감쌈
  - **올바른 XML 구조** (중요!):
    ```xml
    <hp:t>[</hp:t>
    <hp:equation ...><hp:script>4.1</hp:script></hp:equation>
    <hp:t>점]</hp:t>
    ```
  - **잘못된 구조 (금지!)**: `<hp:t>[<hp:equation>4.1</hp:equation>점]</hp:t>`
    - `<hp:t>` 안에 `<hp:equation>` 태그를 직접 넣으면 수식이 렌더링되지 않고 XML 코드가 그대로 출력됨
- **서답형**: 별도 문단 `paraPrIDRef="4"` (RIGHT)
  ```xml
  <hp:t>[</hp:t>
  <hp:equation ...><hp:script>5.0</hp:script></hp:equation>
  <hp:t>점]</hp:t>
  ```

### 선지 XML 생성 (매우 중요!)

Sample 패턴: `T:"①" | EQ:값 | TABx3 | T:"②" | EQ:값 | TABx3 | T:"③" | EQ:값`

**단순 수식 선지** (값이 수식 1개):
```xml
<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
  <hp:run charPrIDRef="7">
    <hp:t>① </hp:t>
    <hp:equation ...><hp:script>1</hp:script></hp:equation>
    <hp:t><hp:tab width="4000" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/>② </hp:t>
    <hp:equation ...><hp:script>2</hp:script></hp:equation>
    <hp:t><hp:tab width="4000" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/>③ </hp:t>
    <hp:equation ...><hp:script>3</hp:script></hp:equation>
  </hp:run>
  <hp:linesegarray>...</hp:linesegarray>
</hp:p>
<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
  <hp:run charPrIDRef="7">
    <hp:t>④ </hp:t>
    <hp:equation ...><hp:script>4</hp:script></hp:equation>
    <hp:t><hp:tab width="4000" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/><hp:tab width="4000" leader="0" type="1"/>⑤ </hp:t>
    <hp:equation ...><hp:script>5</hp:script></hp:equation>
  </hp:run>
  <hp:linesegarray>...</hp:linesegarray>
</hp:p>
```

**혼합 선지** (텍스트+수식):
```xml
<!-- 선지가 긴 경우 각 선지를 개별 문단으로 -->
<hp:p id="2147483648" paraPrIDRef="1" ...>
  <hp:run charPrIDRef="7">
    <hp:t>① 정의역은 실수 전체의 집합이다.</hp:t>
  </hp:run>
</hp:p>
<hp:p id="2147483648" paraPrIDRef="1" ...>
  <hp:run charPrIDRef="7">
    <hp:t>② 그래프는 점 </hp:t>
    <hp:equation ...><hp:script>(0,~1)</hp:script></hp:equation>
    <hp:t>을 지난다.</hp:t>
  </hp:run>
</hp:p>
<!-- ... -->
```

**선지 레이아웃 규칙**:
- 선지 값이 짧으면 (수식만): 3+2 패턴 (①②③ / ④⑤), 탭 3개 간격
- 선지 값이 길면 (텍스트+수식 혼합): 각 선지를 별도 문단으로
- 혼합 선지의 각 parts도 동일한 parts→XML 변환 적용

### endNote 구조

```xml
<hp:endNote number="N" suffixChar="46" instId="UNIQUE_ID">
  <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP"
    linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0"
    hasTextRef="0" hasNumRef="0">
    <!-- 정답 문단 -->
    <hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="5">
        <hp:ctrl>
          <hp:autoNum num="N" numType="ENDNOTE">
            <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="." supscript="0"/>
          </hp:autoNum>
        </hp:ctrl>
      </hp:run>
      <hp:run charPrIDRef="7">
        <hp:t> [정답] ④</hp:t>
      </hp:run>
      <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1200" textheight="1200" baseline="1020" spacing="720" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>
    </hp:p>
    <!-- 해설 문단 (explanation_parts → XML) -->
    <hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="7">
        <!-- explanation_parts를 parts→XML 변환과 동일하게 처리 -->
        <hp:t>해설 텍스트 </hp:t>
        <hp:equation ...><hp:script>수식</hp:script></hp:equation>
        <hp:t>이다.</hp:t>
      </hp:run>
      <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1125" textheight="1125" baseline="956" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>
    </hp:p>
  </hp:subList>
</hp:endNote>
```

- `number`: 1부터 순차 (endNote 0은 헤더에 빈 미주)
- `suffixChar`: "46" (= '.') 고정
- `instId`: 고유 ID (1654899642부터 시작, +1씩)
- 정답: 선택형 `④` (원숫자), 서답형 `24` (숫자값)

### 문단 id 규칙
- 내용 있는 문단: `id="2147483648"` (0x80000000)
- 빈 문단/후속 해설: `id="0"`
- p[0] (첫 문단): 고유 ID (예: `id="3121190098"`)
- `styleIDRef`: 항상 `"0"` (바탕글)

### 수식 (hp:equation)

```xml
<hp:equation id="{ID}" zOrder="{Z}" numberingType="EQUATION"
  textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None"
  version="Equation Version 60" baseLine="85" textColor="#000000"
  baseUnit="1100" lineMode="CHAR" font="HYhwpEQ">
  <hp:sz width="{W}" widthRelTo="ABSOLUTE" height="1125" heightRelTo="ABSOLUTE" protect="0"/>
  <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
    holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP"
    horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
  <hp:outMargin left="56" right="56" top="0" bottom="0"/>
  <hp:shapeComment>수식입니다.</hp:shapeComment>
  <hp:script>{ESCAPED_EQUATION}</hp:script>
</hp:equation>
```

- `baseLine`: 일반=85, 분수=65, 루트=87~88
- `baseUnit`: 본문=1100(11pt), 저작권=600(6pt)
- `textColor`: 본문=#000000, 저작권=#FFFFFF
- `outMargin`: left=56, right=56 고정
- `width`: 수식 문자 수 × 약 525 (대략), `height`: 분수 있으면 크게
- **`<hp:script>` 안은 반드시 XML 이스케이프**: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`

### linesegarray 프리셋

| 문단 유형 | vertsize | textheight | baseline | spacing |
|-----------|----------|------------|----------|---------|
| 텍스트만 (수식 없음) | 1000 | 1000 | 850 | 600 |
| 수식 포함 (일반) | 1125 | 1125 | 956 | 600 |
| 분수 수식 포함 | 2580 | 2580 | 1677 | 600 |
| 루트 수식 포함 | 1478 | 1478 | 1301 | 600 |
| 미주 정답줄 | 1200 | 1200 | 1020 | 720 |
| 빈줄/break | 1000 | 1000 | 850 | 600 |

문단에 수식이 없으면 `vertsize=1000` 사용. 수식이 있으면 수식 유형에 따라 선택.

### 보기(< 보 기 >) 테이블

JSON에 `condition_box`가 있으면 보기 테이블을 삽입한다.

#### type="bogi" (ㄱ/ㄴ/ㄷ 항목)
**3항목(ㄱ,ㄴ,ㄷ)**: `base_hwpx/bogi_table_3items.xml` 템플릿 사용
**6항목(ㄱ~ㅂ)**: `base_hwpx/bogi_table_6items.xml` 템플릿 사용

템플릿의 `{{ITEM_X_CONTENT}}` 플레이스홀더를 각 항목의 parts→XML 변환 결과로 치환.

#### type="condition" ((가)/(나)/(다) 항목)
조건이 테두리 박스 안에 들어가야 하는 경우 (보기와 다름).

**구현**: borderFill이 있는 단일 셀 테이블로 조건박스를 생성한다:
```xml
<hp:tbl id="..." zOrder="..." numberingType="TABLE"
  textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0"
  dropcapstyle="None" treat="0" rowCnt="1" colCnt="1"
  cellSpacing="0" borderFillIDRef="5">
  <hp:sz width="29622" widthRelTo="ABSOLUTE" height="..." heightRelTo="ABSOLUTE" protect="0"/>
  <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
    holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP"
    horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
  <hp:outMargin left="0" right="0" top="141" bottom="141"/>
  <hp:inMargin left="567" right="567" top="141" bottom="141"/>
  <hp:cellzoneList/>
  <hp:tr>
    <hp:tc name="" header="0" hasMargin="1" borderFillIDRef="10" editable="0">
      <hp:cellAddr colAddr="0" rowAddr="0"/>
      <hp:cellSpan colSpan="1" rowSpan="1"/>
      <hp:cellSz width="29622" height="..."/>
      <hp:cellMargin left="567" right="567" top="141" bottom="141"/>
      <hp:subList ...>
        <!-- 각 조건 항목을 개별 문단으로 -->
        <hp:p paraPrIDRef="1" ...>
          <hp:run charPrIDRef="7">
            <hp:t>(가) </hp:t>
            <!-- parts → XML 변환 -->
          </hp:run>
        </hp:p>
        <!-- (나), (다) 동일 패턴 -->
      </hp:subList>
    </hp:tc>
  </hp:tr>
</hp:tbl>
```

- borderFillIDRef="10" (SOLID 0.12mm + 흰 배경)으로 테두리 표시
- 각 조건 항목의 label ((가), (나), (다))을 텍스트로 삽입 후 parts 내용 추가
- 조건박스 너비: 29622 (단 폭의 약 절반)

#### 보기/조건 테이블 삽입 위치
보기 테이블은 문제 본문 문단과 선지 사이에 삽입:
```
[문제 문단] endNote + parts + [배점]
[빈 문단]
[보기/조건 테이블]  ← 여기
[빈 문단]
[선지]
```

### 데이터 테이블 (상용로그표 등)

JSON에 `data_table`이 있으면 데이터 테이블을 생성한다.

구조: 2행 N열 테이블 (borderFillIDRef="5" 기본, "11" 내부)
- 각 셀: `paraPrIDRef="2"` CENTER, `charPrIDRef="9"`
- 셀 내용이 수식이면 `<hp:equation>`, 텍스트면 `<hp:t>`
- `cellSpacing="0"`, `vertAlign="CENTER"`
- 테이블 width: 29622 (단 폭의 약 절반)

### Break 문단

```xml
<!-- COLBREAK: id="2147483648" -->
<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="1" merged="0">
  <hp:run charPrIDRef="7"/>
  <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>
</hp:p>

<!-- PAGEBREAK: id="2147483648" -->
<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0">
  <hp:run charPrIDRef="7"/>
  <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>
</hp:p>
```

## 페이지 레이아웃

- 2단 레이아웃, 한 쪽에 4문제 (좌2 + 우2)
- **2문제마다 COLBREAK**, **4문제마다 PAGEBREAK**
- 같은 컬럼 내 문제 간격: 빈줄 약 15개
- 마지막 문제 뒤: COLBREAK → PAGEBREAK (미주 분리)

## 이미지

- 문제 그림: `BinData/image3.bmp`부터 순번 (image1=저작권바, image2=로고 고정)
- 그림 문단: `paraPrIDRef="2"` (CENTER 정렬)
- content.hpf에 `<opf:item id="imageN" href="BinData/imageN.ext" media-type="image/..." isEmbeded="1"/>` 추가
- **isEmbeded** (오타 그대로 유지)

## 후처리

1. `fix_namespaces.py` 실행 (필수)
2. `validate.py --fix` 실행 (필수)
3. 텍스트 추출 → 누락 확인
4. 파일명 규칙대로 outputs/ 저장

## 파일명
`[코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]`
