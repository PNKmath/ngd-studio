# HWPX Sample 비교 분석 보고서

## 분석 대상
- **Sample 1 (광명고, 그림있음)**: `[04039][고][2025][2-1-a][경기광명시][광명고][수1][지수-삼각함수의그래프][04039][그림4-1-4-1] (1).hwpx`
- **Sample 2 (운유고, 그림없음)**: `[04039][고][2025][2-1-a][경기김포시][운유고][수1][지수-삼각함수의그래프][04039][그림0-0-0-0].hwpx`

---

## 1. ZIP 구조 및 파일 목록

### 공통
- mimetype: `application/hwp+zip` (비압축, compress_type=0)
- version.xml: 비압축 (compress_type=0)
- 나머지 모든 파일: DEFLATE 압축 (compress_type=8), Preview/PrvImage.png만 비압축 (compress_type=0)
- ZIP 파일 순서: `mimetype` -> `version.xml` -> `Contents/header.xml` -> `BinData/image1.bmp` -> `Contents/masterpage0.xml` -> `BinData/image2.bmp` -> ... (이미지들) -> `Contents/section0.xml` -> `Preview/PrvText.txt` -> `settings.xml` -> `Preview/PrvImage.png` -> `META-INF/container.rdf` -> `Contents/content.hpf` -> `META-INF/container.xml` -> `META-INF/manifest.xml`

### 차이
| 항목 | Sample 1 (광명고) | Sample 2 (운유고) |
|------|------------------|------------------|
| BinData 이미지 수 | 7개 (image1~image7.bmp) | 2개 (image1~image2.bmp) |
| image1.bmp | 저작권 바 이미지 (94,918 bytes) | 동일 (94,918 bytes) |
| image2.bmp | NGD 로고 이미지 (31,470 bytes) | 동일 (31,470 bytes) |
| image3~7.bmp | 문제 그림 4개 + 서술형 그림 1개 | 없음 |

### 규칙
- `mimetype`과 `version.xml`은 항상 비압축(STORED)으로 저장
- `Preview/PrvImage.png`도 비압축
- `image1.bmp` = 저작권 바 이미지, `image2.bmp` = NGD 로고 -- 고정
- 문제 그림은 `image3.bmp`부터 순차 번호

---

## 2. version.xml

### 공통 (100% 동일)
```xml
<hv:HCFVersion tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0"
  buildNumber="1" os="1" xmlVersion="1.4"
  application="Hancom Office Hangul" appVersion="11, 0, 0, 8362 WIN32LEWindows_10"/>
```

### 규칙
- version.xml은 양식지 고정값, 변경 불필요

---

## 3. META-INF/*.xml

### 공통 (3개 파일 모두 100% 동일)

**container.xml:**
```xml
<ocf:container>
  <ocf:rootfiles>
    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
    <ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/>
    <ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/>
  </ocf:rootfiles>
</ocf:container>
```

**container.rdf:** header.xml과 section0.xml을 참조하는 고정 구조

**manifest.xml:** 빈 매니페스트 `<odf:manifest/>`

### 규칙
- META-INF 파일들은 양식지 고정값, 변경 불필요

---

## 4. settings.xml

### 공통
- 구조: `<ha:CaretPosition listIDRef="0" paraIDRef="N" pos="0"/>`

### 차이
| 항목 | Sample 1 | Sample 2 |
|------|----------|----------|
| paraIDRef | 18 | 16 |

### 규칙
- paraIDRef는 문서의 현재 커서 위치 -- 내용에 따라 달라짐
- 생성 시 적절한 값 설정 (마지막 문단 근처)

---

## 5. Contents/content.hpf (매니페스트)

### 공통
- metadata 구조 동일:
  - `<opf:title xml:space="preserve">① </opf:title>`
  - `<opf:language>ko</opf:language>`
  - creator: `user`, lastsaveby: `abund`
  - CreatedDate: `2024-10-04T11:21:12Z` (양식지 생성일)
  - date: `2017년 8월 3일 목요일 오후 4:55:39`
- manifest 공통 항목: header, image1, masterpage0, image2, section0, settings
- spine: `header` -> `section0`

### 차이
| 항목 | Sample 1 | Sample 2 |
|------|----------|----------|
| ModifiedDate | 2026-03-07T08:23:25Z | 2026-03-07T08:23:49Z |
| 추가 이미지 | image3~image7 (각각 opf:item) | 없음 |
| spine linear | `linear="yes"` 명시 | `linear` 속성 없음 |

### 규칙
- 이미지 추가 시 `<opf:item id="imageN" href="BinData/imageN.bmp" media-type="image/bmp" isEmbeded="1"/>` 추가
- ModifiedDate는 저장 시점으로 갱신
- **isEmbeded="1"** (오타 그대로 유지: Embeded, not Embedded)
- manifest 항목 순서: header -> image1 -> masterpage0 -> image2 -> (추가 이미지들) -> section0 -> settings

---

## 6. Contents/header.xml

### 6.1 fontfaces (공통)
7개 언어 카테고리 (HANGUL, LATIN, HANJA, JAPANESE, OTHER, SYMBOL, USER) 각각 3개 폰트:
- id=0: `나눔고딕` (TTF, weight=6)
- id=1: `나눔고딕 ExtraBold` (TTF, weight=9)
- id=2: `(한)문화방송` (TTF, substFont=한컴바탕)

**100% 동일** -- OTHER 언어의 typeInfo만 다른 값 (contrast=2 등)

### 6.2 borderFills

| ID | 용도 | Sample 1 | Sample 2 |
|----|------|----------|----------|
| 1 | 기본 (NONE border) | 동일 | 동일 |
| 2 | fillBrush 있음 (none/999999) | 동일 | 동일 |
| 3 | NONE border 0.4mm | 동일 | 동일 |
| 4 | fillBrush (none/000000) | 동일 | 동일 |
| 5 | SOLID 0.12mm 검정 | 동일 | 동일 |
| 6 | SOLID 1.0mm #1E4936 (초록) | 동일 | 동일 |
| 7 | 좌우 초록+하단 0.12mm, 흰 배경 | 동일 | 동일 |
| 8 | 초록+하단 DASH | 동일 | 동일 |
| 9 | 초록+상단 DASH | 동일 | 동일 |
| 10 | SOLID 0.12mm + 흰 배경 | 동일 | 동일 |
| 11 | backSlash CENTER + SOLID 0.12mm | 없음 | **추가** |

**차이:**
- Sample 1: `itemCnt="10"` (borderFill 1~10)
- Sample 2: `itemCnt="11"` (borderFill 1~11, id=11 추가)
- id=11의 차이점: `<hh:backSlash type="CENTER">`이고, `<hh:diagonal>` 없음

### 6.3 charProperties (charPr)

| ID | 용도 | height | textColor | borderFillIDRef | bold | spacing | 비고 |
|----|------|--------|-----------|-----------------|------|---------|------|
| 0 | 헤더 bold | 1000 | #000000 | 1 | O | -5 | **공통** |
| 1 | 저작권 흰색 텍스트 | 1000 | #FFFFFF | 4 | X | -5 | **공통** |
| 2 | 일반 텍스트 | 1000 | #000000 | 4 | X | -5 | **공통** |
| 3 | 큰 bold 텍스트 | 1700 | #000000 | 4 | O | -5 | **공통** (shadow=#C0C0C0) |
| 4 | 메타 파란색 텍스트 | 1000 | #315F97 | 4 | X | -5 | **공통** |
| 5 | 미주번호 (12pt bold) | 1200 | #000000 | 4 | O | -5 | **공통** |
| 6 | 학교명 (24pt ExtraBold) | 2400 | #000000 | 4 | O | -5 | fontRef=1 (ExtraBold), **공통** |
| 7 | 본문 (바탕글 스타일) | 1000 | #000000 | 2 | X | -5 | **공통** |
| 8 | 저작권 (문화방송 14pt) | 1400 | #000000 | 1 | O | -5 | fontRef=2, **공통** |
| 9 | 빨간 텍스트 | 1000 | #FF0000 | 2 | X | -5 | **Sample 1만** |
| 10 | 일반 검정 (borderFill4) | 1000 | #000000 | 4 | X | -5 | **Sample 1만** |
| 11 | bold narrow spacing | 1000 | #000000 | 4 | O | **-14** | **Sample 1만** |
| 12 | 극소 텍스트 | **100** | #000000 | 1 | X | -5 | **Sample 1만** |
| 13 | 소형 텍스트 | **300** | #000000 | 1 | X | -5 | **Sample 1만** |
| 9 (S2) | 일반 검정 (borderFill4) | 1000 | #000000 | 4 | X | -5 | **Sample 2만** (=S1의 id10) |

**차이 요약:**
- Sample 1: `itemCnt="14"` (charPr 0~13)
- Sample 2: `itemCnt="10"` (charPr 0~9)
- charPr 0~8은 **100% 동일**
- Sample 1은 추가 charPr (9: 빨간색, 10: 일반, 11: narrow bold, 12: 극소, 13: 소형) 보유
- Sample 2는 charPr 9만 추가 (=Sample 1의 charPr 10과 동일)

**규칙:**
- charPr 0~8은 양식지 고정값
- 문제 내용에 따라 추가 charPr가 필요하면 id=9부터 추가
- 주요 용도별 고정 ID:
  - 본문/선지: **charPr 7** (나눔고딕 10pt, spacing -5)
  - 메타 ([중단원],[난이도]): **charPr 4** (#315F97)
  - 미주번호: **charPr 5** (12pt bold)
  - 학교명: **charPr 6** (24pt ExtraBold)

### 6.4 tabProperties

**100% 동일** (3개):
- id=0: autoTabLeft=0, autoTabRight=0 (빈 탭)
- id=1: autoTabLeft=1, autoTabRight=0 (좌측 자동탭)
- id=2: autoTabLeft=0, tabItem pos=8198 type=LEFT leader=NONE (선지용 고정탭)

### 6.5 numberings

**100% 동일** (1개, id=1): 10레벨 번호매기기 정의

### 6.6 bullets

**차이:**
- Sample 1: `itemCnt="1"` 있음
- Sample 2: `bullets` 없음

### 6.7 paraProperties (paraPr)

| ID | 용도 | tabPrIDRef | align | intent | lineSpacing | borderFillIDRef | 비고 |
|----|------|------------|-------|--------|-------------|-----------------|------|
| 0 | secPr/기본 | 1 | LEFT | 0 | 160% | 4 | **공통** |
| 1 | 본문 (바탕글 기반) | 0 | LEFT | 0 | 160% | 2 | **공통** |
| 2 | 중앙정렬 | 0 | CENTER | 0 | 160% | 2 | **공통** |
| 3 | 선지 탭 | 2 | LEFT | 0 | 160% | 2 | **공통** |
| 4 | 우측정렬 | 0 | RIGHT | 0 | 160% | 2 | **공통** |
| 5~11 | 음수 intent 문단 | 0 | LEFT | 음수값 | 160%(대부분) | 2 | **값이 다름** |

**차이 (paraPr 5~11의 intent 값):**

| paraPr ID | Sample 1 intent | Sample 2 intent |
|-----------|-----------------|-----------------|
| 5 (S1=heading bullet, S2=일반) | S1: heading BULLET idRef=1 / intent 0 | S2: intent -2056 |
| 6 | -6119 | -2647 |
| 7 | -1180 | -3324 |
| 8 | -1264 | -3174 |
| 9 | lineSpacing **80%** | -7656 |
| 10 | -1656 | -1612 |
| 11 | -1695 | -937 |

**핵심 차이:**
- Sample 1의 paraPr 5는 `heading type="BULLET" idRef="1"`, Sample 2의 paraPr 5는 일반 intent
- Sample 1의 paraPr 9는 lineSpacing=**80%** (축소 줄간격), Sample 2는 160% 유지
- intent 값들은 모두 문서별로 다름 (수식 크기에 따라 동적 계산)

**규칙:**
- paraPr 0~4: **양식지 고정값**
- paraPr 5~11: **문제 내용에 따라 동적으로 생성** (수식의 indent 보정용)
  - 음수 intent = 수식이 줄 시작보다 왼쪽으로 돌출하는 보정
  - intent 값 = -(수식 너비의 절반) 정도로 추정
- paraPr ID 매핑:
  - 본문/선지/문제: **paraPr 1** (tabPr=0, LEFT, spacing 160%)
  - 이미지 단독: **paraPr 2** (CENTER 정렬)
  - 선지 탭포함: **paraPr 3** (tabPr=2)
  - 우측정렬 [점]: **paraPr 4** (RIGHT)

### 6.8 styles

**100% 동일:**
```xml
<hh:style id="0" type="PARA" name="바탕글" engName="Normal"
  paraPrIDRef="1" charPrIDRef="7" nextStyleIDRef="0" langID="1042" lockForm="0"/>
```

### 6.9 memoProperties

**100% 동일:**
```xml
<hh:memoPr id="1" width="15591" lineWidth="1" lineType="SOLID"
  lineColor="#B6D7AE" fillColor="#F0FFE9" activeColor="#CFF1C7" memoType="NOMAL"/>
```

### 6.10 기타 header 요소

**100% 동일:**
- compatibleDocument targetProgram="HWP201X"
- docOption linkinfo (빈)
- trackchageConfig flags="56"

---

## 7. Contents/masterpage0.xml

### 공통 (100% 동일)

구조:
```xml
<masterPage id="masterpage0" type="BOTH" pageNumber="0" pageDuplicate="0" pageFront="0">
  <hp:subList textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP"
    textWidth="62648" textHeight="85890">
```

내용:
1. 첫 문단: `<hp:colPr type="NEWSPAPER" layout="LEFT" colCount="2" sameSz="1" sameGap="2268">` (2단 설정)
2. 저작권 경고문: "이 자료를 무단으로 복제하거나..."
3. N, G, D 각 한 글자씩 별도 문단
4. 다수의 빈 문단 (charPrIDRef="2")
5. 저작권 바 이미지 (`image1`, 84660x2100, 축소 62648x1554)
6. 수식으로 된 저작권 표시 (textColor=#FFFFFF, baseLine=86, baseUnit=600, font=HYhwpEQ)

특이사항:
- 모든 문단: `id="2147483648"`, `paraPrIDRef="0"`, `styleIDRef="0"`
- 저작권 바 pic: `textWrap="IN_FRONT_OF_TEXT"`, `treatAsChar="0"`
- lineseg: 모두 `vertsize=1000 textheight=1000 baseline=850 spacing=600 horzsize=30188 flags=393216`

### 규칙
- masterpage0.xml은 **양식지 고정값**, 변경 불필요
- colPr sameGap=2268은 2단 사이 간격 고정

---

## 8. Contents/section0.xml

### 8.1 secPr (섹션 속성)

**100% 동일:**
```xml
<secPr textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000"
  tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1"
  memoShapeIDRef="1" textVerticalWidthHead="0" masterPageCnt="1">
  <grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>
  <startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>
  <visibility hideFirstHeader="0" ... border="SHOW_ALL" fill="SHOW_ALL"/>
  <pagePr landscape="WIDELY" width="72852" height="103180" gutterType="LEFT_ONLY">
    <margin header="5669" footer="3685" gutter="0"
      left="5102" right="5102" top="4251" bottom="3685"/>
  </pagePr>
  <footNotePr>
    <autoNumFormat type="DIGIT" suffixChar=")" supscript="0"/>
    <noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>
    <noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>
    <numbering type="CONTINUOUS" newNum="1"/>
    <placement place="EACH_COLUMN" beneathText="0"/>
  </footNotePr>
  <endNotePr>
    <autoNumFormat type="DIGIT" suffixChar="." supscript="0"/>
    <noteLine length="30188" type="SOLID" width="0.12 mm" color="#000000"/>
    <noteSpacing betweenNotes="1984" belowLine="567" aboveLine="850"/>
    <numbering type="CONTINUOUS" newNum="1"/>
    <placement place="END_OF_DOCUMENT" beneathText="0"/>
  </endNotePr>
  <pageBorderFill type="BOTH" borderFillIDRef="3" textBorder="PAPER".../>
  <pageBorderFill type="EVEN" borderFillIDRef="1".../>
  <pageBorderFill type="ODD" borderFillIDRef="1".../>
  <masterPage idRef="masterpage0"/>
</secPr>
```

### 규칙
- secPr은 **양식지 고정값**
- 용지: A4 가로(WIDELY) 72852x103180 HWP단위
- 여백: 좌우 5102, 상 4251, 하 3685
- endNote: END_OF_DOCUMENT 배치, 미주선 length=30188, suffixChar="."
- footNote: EACH_COLUMN 배치, suffixChar=")"

### 8.2 전체 문단 수 및 분류

| 문단 유형 | Sample 1 | Sample 2 |
|----------|----------|----------|
| 총 top-level 문단 | 316 | 343 |
| INFO_TABLE_PARA | 1 | 1 |
| PROBLEM (미주 포함) | 20 | 22 |
| CHOICES (선지) | 34 | 43 |
| META_JUNGDANWON | 20 | 22 |
| META_NANIDO | 20 | 22 |
| EMPTY | 193 | 213 |
| COLBREAK | 4 | 6 |
| PAGEBREAK | 5 | 6 |
| RIGHT_ALIGNED ([점]) | 5 | 2 |
| TEXT_WITH_EQ | 6 | 4 |
| PIC_PARA (본문 그림) | 4 | 0 |
| SEOSULHYUNG | 3 | 2 |
| TEXT_ONLY | 1 | 0 |

### 8.3 정보 테이블 구조 (첫 번째 문단 p[0])

첫 문단에 secPr + 2개 테이블 + 로고 이미지 + 저작권 수식이 포함.

**공통 구조:**
```
p[0] (paraPrIDRef="1", styleIDRef="0")
  ├── run[0] charPrIDRef="7"
  │     ├── <ctrl>
  │     │     ├── <secPr> (섹션 속성 전체)
  │     │     └── <colPr type="NEWSPAPER" colCount="2" sameSz="1" sameGap="2268">
  │     ├── <endNote number="0" suffixChar="46" instId="1654899641">
  │     │     └── <subList> (빈 미주)
  │     ├── <equation> (저작권 텍스트, textColor=#FFFFFF, baseUnit=600, treatAsChar=1)
  │     ├── <equation> (저작권 텍스트, textColor=#FFFFFF, BEHIND_TEXT, treatAsChar=0)
  │     ├── <tbl> (정보 테이블 1: 2행3열)
  │     │     ├── tc borderFill=6: "[년도] [학기] [차수]"
  │     │     ├── tc borderFill=7: "[학교명]"
  │     │     ├── tc borderFill=8: "[학년] [과목]"
  │     │     └── tc borderFill=9: "[범위]"
  │     ├── <tbl> (정보 테이블 2: 저작권 정보, textWrap=SQUARE)
  │     │     ├── tc: 저작권 표시 텍스트
  │     │     ├── tc: (빈)
  │     │     └── tc: 무단복제 경고문
  │     └── <pic> (NGD 로고, image2, 6912x6912, treatAsChar=0)
  └── run[1] charPrIDRef="7" (빈)
```

**공통 속성:**
- 정보 테이블 1: `textWrap="TOP_AND_BOTTOM"`, `rowCnt="2" colCnt="3"`, `borderFillIDRef="5"`
- 정보 테이블 2: `textWrap="SQUARE"`, `rowCnt="2" colCnt="2"`, `borderFillIDRef="10"`
- NGD 로고: `textWrap="TOP_AND_BOTTOM"`, `sz width="6912" height="6912"`, `binaryItemIDRef="image2"`
- 저작권 수식 1: `treatAsChar="1"`, `textWrap="TOP_AND_BOTTOM"`, `width="59625" height="600"`
- 저작권 수식 2: `treatAsChar="0"`, `textWrap="BEHIND_TEXT"`, `width="10725" height="600"`

**차이 (내용만):**
- 학교명: "광명 고등학교" vs "운유 고등학교"
- 범위: "지수 ~ 삼각함수의 그래프" vs "지수 ~ 삼각함수그래프" (띄어쓰기 차이)
- 제작일: "2026년 2월 08일" vs "2025년 2월 27일"

### 8.4 문제 본문 문단 구조

각 문제는 다음 문단 시퀀스로 구성:

```
[PROBLEM para] endNote 마커 + 문제 텍스트 + 수식들
[EMPTY para]   빈 줄
[CHOICES para]  ① ... ② ... ③ ... (한 줄 또는 여러 줄)
[CHOICES para]  ④ ... ⑤ ...
[META para]     [중단원] ...
[META para]     [난이도] ...
[EMPTY para]    문제 간 구분
[EMPTY para]    (추가 빈 줄)
```

**공통 문단 속성:**
```xml
<hp:p id="..." paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
```
- 모든 문제/선지/메타 문단: `paraPrIDRef="1"`, `styleIDRef="0"`
- id 값: 내용이 있는 문단은 대부분 `"2147483648"` (=0x80000000), 빈 문단은 `"0"`

### 8.5 endNote 구조

**공통:**
```xml
<hp:ctrl>
  <hp:endNote number="N" suffixChar="46" instId="NNNNNNNNNN">
    <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP"
      linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0"
      hasTextRef="0" hasNumRef="0">
      <hp:p paraPrIDRef="1" styleIDRef="0">
        <hp:run charPrIDRef="5">[빈]</hp:run>  <!-- 미주번호 스타일 -->
        <hp:run charPrIDRef="7"> [정답] ...</hp:run>  <!-- 정답 + 해설 -->
      </hp:p>
      ... (해설 추가 문단들)
    </hp:subList>
  </hp:endNote>
</hp:ctrl>
```

**공통 속성:**
- suffixChar="46" (= ASCII '.', 미주번호 뒤 점)
- instId: 첫 미주 1654899642, 이후 문제별 고유값
- number: 1부터 순차 증가
- 첫 번째 p의 첫 run: `charPrIDRef="5"` (미주번호 스타일, 12pt bold)
- 첫 번째 p의 두번째 run: `charPrIDRef="7"` (본문 스타일) + " [정답] N"

**차이:**
- 해설이 있는 문제: subList 안에 **여러 개의 p** (정답 1줄 + 해설 단계별 각 1줄)
- 해설이 없는 문제: subList 안에 2개의 p (정답 + 빈 줄)
- Sample 1의 첫 미주: 5개 문단 (정답 + 해설 4줄) — 풀이 단계별로 분리
- Sample 2의 첫 미주: 2개 문단 (정답 + 수식 해설 1줄)
- **핵심**: 해설은 **논리적 풀이 단계마다 별도 `<hp:p>` 문단**으로 생성해야 한다
- 각 해설 문단: `id="0"`, `paraPrIDRef="1"`, `charPrIDRef="7"`

**규칙:**
- endNote의 number는 1부터 순차 (문제 번호와 동일)
- instId는 첫 번째가 1654899642 (양식지 고정), 이후는 고유 ID
- 정답 라인: `" [정답] "` + 원문자 (①~⑤) 또는 숫자값
- 해설: 별도 p로 추가, 각 p는 `paraPrIDRef="1" styleIDRef="0"`
- 해설 문단의 id: 첫 번째만 `"2147483648"`, 나머지는 `"0"`

### 8.6 선지 구조

**패턴 A: 3+2 선지 (한 줄에 3개, 다음 줄 2개)**
```xml
<hp:p paraPrIDRef="1">
  <hp:run charPrIDRef="7">
    <hp:t>① </hp:t>
    <hp:equation ...>선지1 수식</hp:equation>
    <hp:t>
      <hp:tab width="645" leader="0" type="1"/>   <!-- 잔여 공간 -->
      <hp:tab width="4000" leader="0" type="1"/>   <!-- 고정 탭 -->
      <hp:tab width="4000" leader="0" type="1"/>   <!-- 고정 탭 -->
      ② </hp:t>
    <hp:equation ...>선지2 수식</hp:equation>
    <hp:t>
      <hp:tab .../>
      <hp:tab .../>
      <hp:tab .../>
      ③ </hp:t>
    <hp:equation ...>선지3 수식</hp:equation>
    <hp:t/>
  </hp:run>
</hp:p>
```

**선지 탭 구조:**
- 선지 사이에 `<hp:tab>` 3개 삽입
- 첫 번째 tab: `width` = 가변 (잔여 공간 채움)
- 두세 번째 tab: `width="4000"` 고정
- 모든 tab: `leader="0" type="1"` (LEFT 타입, 리더 없음)
- 탭은 `<hp:t>` 요소의 **자식**으로 포함됨 (텍스트와 혼합)

**패턴 B: 개별 선지 (각 줄에 1개)**
```xml
<hp:p paraPrIDRef="1">
  <hp:run charPrIDRef="7">
    <hp:t>① 정의역은 실수 전체 집합이다.
      <hp:tab width="2212" leader="0" type="1"/>
      <hp:tab width="4000" leader="0" type="1"/>
      <hp:tab width="4000" leader="0" type="1"/>
    </hp:t>
  </hp:run>
</hp:p>
```
- 텍스트가 긴 선지는 개별 줄에 배치
- 줄 끝에도 tab 3개 추가 (정렬 유지)

**규칙:**
- 모든 선지 문단: `paraPrIDRef="1"`, `charPrIDRef="7"`
- 선지 사이 구분: `<hp:tab>` 3개 (첫 번째는 가변 width, 나머지 2개는 4000 고정)
- tab 속성: `leader="0" type="1"` 고정
- 텍스트만 있는 선지도 끝에 tab 3개 추가
- 선지 시작: 원문자(①~⑤) + 공백 1개

### 8.7 메타 구조

**공통:**
```xml
<hp:p paraPrIDRef="1" styleIDRef="0">
  <hp:run charPrIDRef="4">
    <hp:t>[중단원] 삼각함수</hp:t>
  </hp:run>
</hp:p>
<hp:p paraPrIDRef="1" styleIDRef="0">
  <hp:run charPrIDRef="4">
    <hp:t>[난이도] 하</hp:t>
  </hp:run>
</hp:p>
```

**규칙:**
- charPrIDRef="4" (#315F97 파란색)
- 항상 [중단원] 다음 줄에 [난이도]
- 각 문제의 선지 뒤에 배치

### 8.8 빈 문단 구조

**공통:**
```xml
<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
  <hp:run charPrIDRef="7"/>
  <hp:linesegarray>
    <hp:lineseg textpos="0" vertpos="..." vertsize="1000" textheight="1000"
      baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/>
  </hp:linesegarray>
</hp:p>
```

**규칙:**
- id="0" 또는 "2147483648"
- run은 charPrIDRef="7", 내용 없음
- lineseg: vertsize=1000 textheight=1000 baseline=850 spacing=600 horzsize=30188 flags=393216

### 8.9 break 문단 (COLBREAK, PAGEBREAK)

**공통:**
```xml
<!-- COLBREAK -->
<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="1" merged="0">
  <hp:run charPrIDRef="7"/>
  <hp:linesegarray>
    <hp:lineseg textpos="0" vertpos="0|11074" vertsize="1000" textheight="1000"
      baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/>
  </hp:linesegarray>
</hp:p>

<!-- PAGEBREAK -->
<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0">
  <hp:run charPrIDRef="7"/>
  <hp:linesegarray>
    <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000"
      baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/>
  </hp:linesegarray>
</hp:p>
```

**규칙:**
- COLBREAK: `columnBreak="1"` -- 2단 구조에서 오른쪽 단으로 넘김
- PAGEBREAK: `pageBreak="1"` -- 다음 페이지로 넘김
- 교대 패턴: COLBREAK -> (문제들) -> PAGEBREAK -> (문제들) -> COLBREAK -> ...
- 일반적으로 빈 문단이지만, 서술형 시작 등에서 텍스트를 포함할 수도 있음
- 첫 COLBREAK의 vertpos는 11074 (이전 내용의 끝 위치), 이후는 0
- charPrIDRef는 보통 "7" (일부 예외로 "4" 가능)

### 8.10 서답형 구조

**공통:**
```xml
<!-- 서답형 안내 -->
<hp:p paraPrIDRef="1"><hp:run charPrIDRef="7">
  <hp:t>※ 여기서 부터는 서답형 문제입니다.</hp:t>
</hp:run></hp:p>

<!-- 서술형 문제 -->
<hp:p paraPrIDRef="1"><hp:run charPrIDRef="7">
  <hp:t>[서술형 N]</hp:t>
</hp:run></hp:p>
```

**차이:**
- Sample 1: 서술형 3개 ([서술형 1], [서술형 2], [서술형 3])
- Sample 2: 서술형 2개 ([서술형 1], [서술형 2])
- 서술형은 선지(①~⑤)가 없고, 정답/해설만 endNote에 포함

### 8.11 이미지 삽입 구조 (hp:pic)

**Sample 1에만 존재** (그림 4개 + 서술형 그림 1개):

```xml
<hp:p paraPrIDRef="2" styleIDRef="0">   <!-- paraPr 2 = CENTER 정렬 -->
  <hp:run charPrIDRef="7">
    <hp:pic id="..." zOrder="..." numberingType="PICTURE"
      textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0"
      dropcapstyle="None" groupLevel="0" instid="..." reverse="0">
      <hp:offset x="0" y="0"/>
      <hp:orgSz width="..." height="..."/>
      <hp:curSz width="..." height="..."/>
      <hp:flip horizontal="0" vertical="0"/>
      <hp:rotationInfo angle="0" centerX="..." centerY="..." rotateimage="1"/>
      <hp:renderingInfo>...</hp:renderingInfo>
      <hp:imgRect>...</hp:imgRect>
      <hp:imgClip left="0" right="..." top="0" bottom="..."/>
      <hp:inMargin left="0" right="0" top="0" bottom="0"/>
      <hp:imgDim dimwidth="..." dimheight="..."/>
      <hc:img binaryItemIDRef="imageN" bright="0" contrast="0"
        effect="REAL_PIC" alpha="0"/>
      <hp:effects/>
      <hp:sz width="..." widthRelTo="ABSOLUTE" height="..." heightRelTo="ABSOLUTE" protect="0"/>
      <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
        holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP"
        horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
      <hp:shapeComment>그림입니다....</hp:shapeComment>
    </hp:pic>
    <hp:t/>
  </hp:run>
</hp:p>
```

**규칙:**
- 그림 단독 문단: `paraPrIDRef="2"` (CENTER 정렬)
- 그림이 문제 본문에 포함될 때: 해당 문제 문단 안에 인라인
- pic 속성: `textWrap="TOP_AND_BOTTOM"`, `treatAsChar="1"`, `flowWithText="1"`
- img: `binaryItemIDRef="imageN"`, `effect="REAL_PIC"`, `alpha="0"`
- 이미지 크기: orgSz = 원본, curSz = 현재 표시 크기, sz = 삽입 크기
- outMargin: 모두 0
- run 안에서 `<hp:pic>` 다음 빈 `<hp:t/>`

### 8.12 수식 구조 (hp:equation)

**공통 속성 (본문 수식):**
```xml
<hp:equation id="..." zOrder="..." numberingType="EQUATION"
  textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0"
  dropcapstyle="None" version="Equation Version 60"
  baseLine="85" textColor="#000000" baseUnit="1100"
  lineMode="CHAR" font="HYhwpEQ">
  <hp:sz width="..." widthRelTo="ABSOLUTE" height="..." heightRelTo="ABSOLUTE" protect="0"/>
  <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"
    holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA"
    vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
  <hp:outMargin left="56" right="56" top="0" bottom="0"/>
  <hp:shapeComment>수식입니다.</hp:shapeComment>
  <hp:script>...</hp:script>
</hp:equation>
```

**고정 속성:**
- version: `"Equation Version 60"`
- lineMode: `"CHAR"`
- font: `"HYhwpEQ"`
- textWrap: `"TOP_AND_BOTTOM"` (본문) / `"BEHIND_TEXT"` (저작권)
- textFlow: `"BOTH_SIDES"`
- pos: `treatAsChar="1"` (인라인), `flowWithText="1"`
- outMargin: `left="56" right="56" top="0" bottom="0"`
- shapeComment: `"수식입니다."`

**가변 속성:**
- id: 고유 ID
- zOrder: 문서 내 순서
- baseLine: 수식 유형에 따라 다름
  - 일반 텍스트급: `85`
  - 분수: `65`
  - 루트: `87` 또는 `88`
  - 저작권: `86`
- baseUnit: 본문 수식 `1100` (=11pt), 저작권 수식 `600` (=6pt)
- textColor: 본문 `#000000`, 저작권 `#FFFFFF`
- sz: 수식 크기에 따라 가변 (width, height)

**저작권 수식 (특수):**
```xml
<hp:equation ... textColor="#FFFFFF" baseUnit="600" ...>
  <!-- textWrap="TOP_AND_BOTTOM" treatAsChar="1" 또는 -->
  <!-- textWrap="BEHIND_TEXT" treatAsChar="0" -->
</hp:equation>
```

### 8.13 linesegarray 구조

모든 문단에 `<hp:linesegarray>` 포함.

**빈 문단 (기본값):**
```xml
<hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000"
  baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/>
```

**수식 포함 문단:**
- vertsize, textheight, baseline: 수식 높이에 따라 가변
  - 일반 수식: `vertsize="1125" textheight="1125" baseline="956"`
  - 분수: `vertsize="2580" textheight="2580" baseline="1677"`
  - 루트: `vertsize="1478" textheight="1478" baseline="1301"`
- spacing: 항상 `600`
- horzsize: 항상 `30188`
- flags: 항상 `393216`
- horzpos: 항상 `0`
- vertpos: 누적 위치값 (이전 lineseg의 vertpos + vertsize + spacing)
- textpos: 0 또는 해당 줄의 텍스트 시작 위치

**미주(endNote) 내부 lineseg:**
- 첫 번째 줄: `vertsize="1200" textheight="1200" baseline="1020" spacing="720"` (미주번호 12pt)
- 이후 줄: 수식 크기에 따라 가변

**규칙:**
- 여러 줄 문단: lineseg가 여러 개 (줄 수만큼)
- 한 줄 문단: lineseg 1개
- vertpos 계산: 첫 줄은 이전 문단의 마지막 vertpos + vertsize + spacing, 이후 줄은 이전 vertpos + vertsize + spacing
- flags: `393216` = `0x60000` (고정값)

### 8.14 RIGHT_ALIGNED 문단 ([점])

**공통:**
```xml
<hp:p paraPrIDRef="4" styleIDRef="0">  <!-- paraPr 4 = RIGHT 정렬 -->
  <hp:run charPrIDRef="7">
    <hp:t>[</hp:t>
    <hp:equation ...>N</hp:equation>  <!-- 배점 수식 -->
    <hp:t>점]</hp:t>
  </hp:run>
</hp:p>
```

- 주관식(서술형) 문제의 배점 표시
- `paraPrIDRef="4"` (RIGHT 정렬)
- 배점 숫자는 수식으로 표현

### 8.15 특수 문단: paraPrIDRef="3" (탭 정의 선지)

**공통:**
- 일부 문제에서 선지가 아닌 본문에서 `paraPrIDRef="3"`을 사용
- tabPr id=2 참조 (고정 탭 pos=8198)
- 문제 본문에 탭이 포함된 경우에 사용

---

## 9. 종합 규칙 요약

### 양식지 고정값 (절대 변경하지 않는 것)
1. `version.xml` - 전체
2. `META-INF/*` - 3개 파일 전체
3. `masterpage0.xml` - 전체
4. `secPr` - 전체
5. `header.xml`:
   - fontfaces (7 언어 x 3 폰트)
   - borderFills 1~10
   - charPr 0~8
   - tabPr 0~2
   - numberings
   - styles (바탕글 1개)
   - memoProperties
   - compatibleDocument, docOption, trackchageConfig

### 문제별 동적 생성
1. `content.hpf`: 이미지 항목 추가, ModifiedDate 갱신
2. `header.xml`:
   - borderFills: 필요 시 id=11부터 추가
   - charPr: 필요 시 id=9부터 추가 (빨간색, 좁은간격 등)
   - paraPr: id=5부터 동적 생성 (수식 indent 보정값)
   - bullets: 필요 시 추가
3. `section0.xml`:
   - p[0]: 학교명, 범위, 제작일 등 변경
   - 문제 문단들: endNote(정답+해설) + 문제텍스트 + 수식
   - 선지: tab 3개 패턴으로 배치
   - 메타: [중단원], [난이도]
   - 이미지: `<hp:pic>` + BinData 참조
   - COLBREAK/PAGEBREAK: 페이지 넘김
4. `settings.xml`: paraIDRef 갱신

### 문단 ID 규칙
- 내용이 있는 문단: `id="2147483648"` (0x80000000)
- 빈 문단/해설 후속 문단: `id="0"`
- 첫 문단 (p[0]): 고유 ID (예: "3121190098")
- styleIDRef: 항상 `"0"` (바탕글)
- paraPrIDRef: 1=일반, 2=중앙, 3=탭선지, 4=우측

### 수식 규칙
- baseUnit: 본문 `1100` (11pt), 저작권 `600` (6pt)
- font: `HYhwpEQ` 고정
- baseLine: 85(일반), 65(분수), 87~88(루트), 86(저작권)
- outMargin: left=56 right=56 top=0 bottom=0
- sz width/height: 수식 내용에 따라 가변
- treatAsChar="1": 인라인 수식 (대부분)

### endNote 규칙
- number: 1부터 순차
- suffixChar: "46" (='.') 고정
- instId: 첫 번째 1654899642 (양식지), 이후 고유값
- subList: 고정 속성 세트
- 첫 p: run[0] charPr=5 (미주번호) + run[1] charPr=7 " [정답] N"
- 해설 p들: charPr=7, id="0"

### 선지 탭 규칙
- 선지 간 구분: `<hp:tab>` 3개
  - 첫 번째: width=가변 (이전 내용 뒤 잔여 공간), leader="0", type="1"
  - 두세 번째: width=4000 고정
- 탭은 `<hp:t>` 요소 **내부**에 자식으로 삽입
- 3+2 선지: ①②③ 한 줄, ④⑤ 다음 줄
- 개별 선지: 각각 별도 문단, 줄 끝에도 tab 3개 추가
