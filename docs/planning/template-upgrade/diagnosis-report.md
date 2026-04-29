# 신규 양식지 진단 보고서

> Phase 2 산출물 — 2026-04-29 작성  
> 대상: `[NGD고등부]기출작업양식지[2025년08월10일].hwpx` vs `[2022년5월20일].hwpx`

---

## 1. ZIP 구조 변화

파일 총 수: OLD 20개 = NEW 20개 (증감 없음)

| 파일 | OLD 크기 | NEW 크기 | SHA256 (12자) OLD | SHA256 (12자) NEW | 상태 |
|---|---|---|---|---|---|
| `Contents/header.xml` | 118,289 B | 146,961 B | 1d4bf5870715 | 725012146234 | **CHANGED** |
| `Contents/section0.xml` | 2,125,276 B | 2,060,225 B | 100a714d284a | 0d2517617d53 | **CHANGED** |
| `Contents/masterpage0.xml` | 24,028 B | 23,980 B | 1d1744470130 | 129e538b1be2 | **CHANGED** |
| `Contents/content.hpf` | 2,629 B | 2,708 B | 3098eb6b99d1 | fc32a3955bd9 | **CHANGED** |
| `Preview/PrvImage.png` | 81,093 B | 84,191 B | 2314dae47ffa | 7a6565ef165d | CHANGED (미리보기) |
| `Preview/PrvText.txt` | 2,292 B | 2,306 B | 4aea2c3a215f | b4d272d02ad8 | CHANGED (미리보기) |
| `settings.xml` | 281 B | 282 B | c942ef57436a | c3a0adfa3d84 | CHANGED (미세) |
| `BinData/image1~8.bmp` | (8개) | (8개) | — | — | **UNCHANGED** |
| `META-INF/container.*` | (3개) | (3개) | — | — | **UNCHANGED** |
| `mimetype`, `version.xml` | — | — | — | — | **UNCHANGED** |

**결론**: 핵심 XML 4개 모두 변경. BinData 8개 이미지는 완전 동일 (SHA256 일치).

---

## 2. content.hpf 변경

### 변경 항목

content.hpf의 `<opf:manifest>` 항목 자체는 동일 (8개 이미지 + header + masterpage + section0 + settings). 추가/삭제된 `<opf:item>`은 없다.

### 변경된 메타데이터

| 필드 | OLD | NEW |
|---|---|---|
| `<opf:title>` | (비어 있음) | `배정 받은 PDF파일 제목이 ` |
| `creator` | 박원식 | 김태현 |
| `ModifiedDate` | 2026-03-07T05:18:49Z | 2026-04-29T05:57:45Z |
| `date` (작성일 표시) | `2018년 1월 17일 수요일 오전 11:28:34` | `2022년 5월 20일 금요일 오전 12:00:00` |
| `<opf:spine>` `<itemref idref="section0">` | `linear` 속성 없음 | `linear="yes"` 추가 |

### 결론

BinData 항목 추가/삭제 없음. `content_hpf_template.xml`은 manifest 구조가 동일하므로 **재추출 불필요**. 단, `<opf:metadata>` 일부 필드(title, creator, date)는 문서 개별 정보이므로 template에서 관리하지 않는 것이 올바름.

---

## 3. header.xml 변경

### 요약 수치

| 항목 | OLD 개수 | NEW 개수 | UNCHANGED | CHANGED | ADDED | REMOVED |
|---|---|---|---|---|---|---|
| charProperties (charPr) | 31 | 42 | 31 | 0 | 11 | 0 |
| paraProperties (paraPr) | 18 | 30 | 15 | 3 | 12 | 0 |
| borderFills | 71 | 81 | 71 | 0 | 10 | 0 |
| styles | 1 | 2 | 1 | 0 | 1 | 0 |
| fontfaces | 7 | 7 | 7 | 0 | 0 | 0 |
| tabProperties | 3 | 3 | 3 | 0 | 0 | 0 |
| numberings | 2 | 2 | 2 | 0 | 0 | 0 |

---

### 3.1 charPr ID 매핑

OLD 31개 → NEW 42개 (모두 하위호환, 11개 추가)

| id | OLD height | OLD color | OLD bold | OLD fontRef_h | OLD bfID | NEW height | NEW color | NEW bold | NEW fontRef_h | NEW bfID | 분류 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 1000 | #000000 | T | 0 | 1 | 1000 | #000000 | T | 0 | 1 | UNCHANGED |
| 1 | 1000 | #000000 | F | 0 | 3 | 1000 | #000000 | F | 0 | 3 | UNCHANGED |
| 2 | 1000 | #315F97 | F | 0 | 3 | 1000 | #315F97 | F | 0 | 3 | UNCHANGED |
| 3 | 1000 | #000000 | F | 0 | 1 | 1000 | #000000 | F | 0 | 1 | UNCHANGED |
| 4 | 1000 | #FFFFFF | F | 0 | 3 | 1000 | #FFFFFF | F | 0 | 3 | UNCHANGED |
| 5 | 1400 | #000000 | T | 0 | 3 | 1400 | #000000 | T | 0 | 3 | UNCHANGED |
| 6 | 400 | #000000 | F | 0 | 1 | 400 | #000000 | F | 0 | 1 | UNCHANGED |
| 7 | 300 | #000000 | F | 0 | 1 | 300 | #000000 | F | 0 | 1 | UNCHANGED |
| 8 | 1400 | #000000 | T | 3 | 1 | 1400 | #000000 | T | 3 | 1 | UNCHANGED |
| 9 | 1000 | #FF0000 | F | 0 | 2 | 1000 | #FF0000 | F | 0 | 2 | UNCHANGED |
| 10 | 1700 | #000000 | T | 0 | 3 | 1700 | #000000 | T | 0 | 3 | UNCHANGED |
| 11 | 1200 | #000000 | T | 0 | 3 | 1200 | #000000 | T | 0 | 3 | UNCHANGED |
| 12 | 2400 | #000000 | T | 1 | 3 | 2400 | #000000 | T | 1 | 3 | UNCHANGED |
| 13 | 1200 | #000000 | T | 0 | 3 | 1200 | #000000 | T | 0 | 3 | UNCHANGED |
| 14 | 1000 | #FF0000 | F | 0 | 3 | 1000 | #FF0000 | F | 0 | 3 | UNCHANGED |
| 15 | 1000 | #000000 | F | 0 | 3 | 1000 | #000000 | F | 0 | 3 | UNCHANGED |
| 16 | 1000 | #FF0000 | T | 0 | 3 | 1000 | #FF0000 | T | 0 | 3 | UNCHANGED |
| 17 | 1000 | #000000 | T | 0 | 3 | 1000 | #000000 | T | 0 | 3 | UNCHANGED |
| 18 | 1100 | #FF0000 | T | 0 | 3 | 1100 | #FF0000 | T | 0 | 3 | UNCHANGED |
| 19 | 1000 | #0000FF | F | 0 | 3 | 1000 | #0000FF | F | 0 | 3 | UNCHANGED |
| 20 | 1000 | #0000FF | T | 0 | 3 | 1000 | #0000FF | T | 0 | 3 | UNCHANGED |
| 21 | 1000 | #000000 | T | 0 | 2 | 1000 | #000000 | T | 0 | 2 | UNCHANGED |
| 22 | 1000 | #000000 | F | 0 | 2 | 1000 | #000000 | F | 0 | 2 | UNCHANGED |
| 23 | 100 | #000000 | F | 0 | 3 | 100 | #000000 | F | 0 | 3 | UNCHANGED |
| 24 | 100 | #000000 | F | 0 | 21 | 100 | #000000 | F | 0 | 21 | UNCHANGED |
| 25 | 100 | #000000 | F | 0 | 1 | 100 | #000000 | F | 0 | 1 | UNCHANGED |
| 26 | 1000 | #000000 | F | 2 | 1 | 1000 | #000000 | F | 2 | 1 | UNCHANGED |
| 27 | 1000 | #0000FF | F | 0 | 2 | 1000 | #0000FF | F | 0 | 2 | UNCHANGED |
| 28 | 500 | #000000 | F | 0 | 2 | 500 | #000000 | F | 0 | 2 | UNCHANGED |
| 29 | 1000 | #315FA9 | F | 0 | 3 | 1000 | #315FA9 | F | 0 | 3 | UNCHANGED |
| 30 | 1000 | #008000 | F | 0 | 3 | 1000 | #008000 | F | 0 | 3 | UNCHANGED |
| 31 | — | — | — | — | — | 1000 | #800080 | F | 0 | 3 | **ADDED** |
| 32 | — | — | — | — | — | 700 | #000000 | F | 0 | 3 | **ADDED** |
| 33 | — | — | — | — | — | 700 | #008000 | F | 0 | 3 | **ADDED** |
| 34 | — | — | — | — | — | 800 | #000000 | F | 0 | 3 | **ADDED** |
| 35 | — | — | — | — | — | 800 | #008000 | F | 0 | 3 | **ADDED** |
| 36 | — | — | — | — | — | 1000 | #CEA61D | F | 0 | 3 | **ADDED** |
| 37 | — | — | — | — | — | 1000 | #9D5CBB | F | 0 | 3 | **ADDED** |
| 38 | — | — | — | — | — | 1000 | #000000 | F | 0 | 2 | **ADDED** |
| 39 | — | — | — | — | — | 1000 | #000000 | F | 0 | 21 | **ADDED** |
| 40 | — | — | — | — | — | 1000 | #000000 | F | 0 | 3 | **ADDED** |
| 41 | — | — | — | — | — | 1400 | #000000 | T | 3 | 3 | **ADDED** |

> height 단위: HWP unit (1000 = 10pt, 300 = 3pt). fontRef_h = 한글 폰트 참조 ID (0 = 기본, 3 = 특수서체).

**ADDED charPr 추정 용도**:
- id=31: (추정) 보라색 강조 글자
- id=32,33: (추정) 소자 크기(7pt) 일반/초록 텍스트
- id=34,35: (추정) 소자 크기(8pt) 일반/초록 텍스트
- id=36: (추정) 골드/갈색 강조
- id=37: (추정) 보라색 강조
- id=38,39,40: (추정) borderFill 변형 버전 (bfID 2, 21, 3)
- id=41: (추정) 1400pt 굵게, fontRef=3 (특수서체) — 해설 제목용

---

### 3.2 paraPr ID 매핑

OLD 18개 → NEW 30개. UNCHANGED 15, CHANGED 3, ADDED 12.

#### 변경된 항목 (CHANGED)

| id | 변경 내용 | 실질적 의미 변화 |
|---|---|---|
| 1 | `tabPrIDRef` 0→1, `align` CENTER→LEFT, `borderFillIDRef` 2→1 | **의미 완전 변경**: CENTER 문단이 LEFT 문단이 됨 |
| 2 | `tabPrIDRef` 1→2 | tabPr 모두 빈 정의이므로 실질적 영향 없음 |
| 3 | `tabPrIDRef` 2→0, `align` LEFT→CENTER, `borderFillIDRef` 1→3 | **의미 완전 변경**: LEFT가 CENTER로 바뀜 |

#### 의미적 OLD→NEW ID 매핑 (builder 사용 ID 중심)

| OLD id | OLD 의미 (tabPrIDRef, align, bfillIDRef) | NEW 동등 ID |
|---|---|---|
| 0 | (0, LEFT, 3) | 0 *(동일 ID)* |
| 1 | (0, CENTER, 2) | 29 *(ID 시프트)* |
| 2 | (1, LEFT, 1) | 1 *(ID 시프트)* |

#### ADDED paraPr (id=18~29, 12개)

새 단락 스타일 추가: JUSTIFY, DISTRIBUTE_SPACE 정렬 포함. id=29(CENTER, bfill=2)가 OLD id=1의 의미적 동등체.

---

### 3.3 borderFill ID 매핑

OLD 71개 → NEW 81개. **UNCHANGED 71, ADDED 10, CHANGED 0, REMOVED 0**.

id 0~70 모두 수치 일치. id 71~80 신규 추가.

---

### 3.4 style ID 매핑

| id | OLD name | OLD charPrIDRef | OLD paraPrIDRef | NEW name | NEW charPrIDRef | NEW paraPrIDRef | 분류 |
|---|---|---|---|---|---|---|---|
| 0 | 바탕글 | 1 | 0 | 바탕글 | 1 | 0 | UNCHANGED |
| 1 | — | — | — | 미주 | 40 | 20 | **ADDED** |

**ADDED style id=1**: 미주(endnote) 스타일 추가. charPrIDRef=40(NEW에만 있는 신규 charPr), paraPrIDRef=20(ADDED paraPr).

---

### 3.5 builder 영향 분석

#### charPrIDRef (build_hwpx.py 사용: 4, 5, 7)

| ID | OLD | NEW | 충돌 |
|---|---|---|---|
| 4 | h=1000, color=#FFFFFF, bold=F | h=1000, color=#FFFFFF, bold=F | **없음** |
| 5 | h=1400, color=#000000, bold=T | h=1400, color=#000000, bold=T | **없음** |
| 7 | h=300, color=#000000, bold=F | h=300, color=#000000, bold=F | **없음** |

#### paraPrIDRef (build_hwpx.py 사용: 0, 1, 2)

| ID | OLD | NEW | 충돌 |
|---|---|---|---|
| 0 | LEFT, bfill=3 | LEFT, bfill=3 | **없음** |
| 1 | **CENTER**, bfill=2 | **LEFT**, bfill=1 | **있음 [HIGH]** |
| 2 | LEFT, bfill=1, tab=1 | LEFT, bfill=1, tab=2 | 실질 없음 (tab 정의 빈값) |

#### 충돌 상세

`build_hwpx.py`에서 `paraPrIDRef="1"`은 다음 위치에서 사용된다:
- `:158` `make_paragraph()` 기본값
- `:230, 254, 273` 문제 본문 p1, p2 문단
- `:297` 정답 라인 answer_p
- `:321` 해설 expl_xml
- `:611` 메인 문제 prob_p
- `:642` 조건 문단 cond_p

**OLD 양식지**에서 paraPrIDRef=1 = CENTER 정렬  
**NEW 양식지**에서 paraPrIDRef=1 = LEFT 정렬

> 단, OLD section0.xml에서 paraPrIDRef=1의 실사용 빈도는 단 1회(전체 2,347회 중). 실제 본문은 paraPrIDRef=0(LEFT)이 기본(1,086회). builder가 paraPrIDRef=1을 쓰는 것 자체가 양식지 내부 관례와 달랐으므로, NEW에서 LEFT로 바뀌어 오히려 한컴 렌더링이 정상화될 수 있다. 단, 반드시 Phase 5 통합 검증에서 출력 확인 필요.

**결론**: 충돌 있음. 위치 `build_hwpx.py:158,230,254,273,297,321,611,642`. paraPrIDRef=1의 정렬이 CENTER→LEFT로 변경되므로 Phase 3에서 builder 출력 검증 필요. charPr 충돌은 없음.

---

## 4. masterpage0.xml 변경

### 구조 변경

| 항목 | OLD | NEW |
|---|---|---|
| 파일 크기 | 24,028 B | 23,980 B |
| 텍스트 내용 | 동일 | 동일 |
| 테이블 수 | 0 | 0 |
| 컬럼 수 | 1 | 1 |
| charPrIDRef 사용 | {4, 1} | {4, 1} |
| paraPrIDRef 사용 | {0} | {0} |
| 저작권 문구 | `by N.G.D 수학적실험` | `by N.G.D 수학적실험` |

### 실질적 차이

ID 정규화 후 diff: 단 1곳에서 `textheight="1000"` → `textheight="1100"`, `baseline="850"` → `baseline="946"` 변경.

- 위치: 꼬릿말 영역의 특정 `<hp:lineseg>` 요소
- 의미: 특정 문단의 줄 높이가 1pt 증가 (10pt → 11pt)
- 오른쪽 하단 저작권 수식 문단으로 추정

**머릿말 텍스트**: OLD = NEW = `"이 자료를 무단으로 복제하거나 온라인, 오프라인으로 유포하는 것은 법적 책임을 질 수 있습니다."` + `N`, `G`, `D` (각 한 글자씩)

`header_area_template.xml`은 masterpage0.xml에서 추출된 구조이며, 텍스트/구조 변경 없으나 **paraPrIDRef ID 참조가 달라졌으므로 재추출 필요** (Phase 3 대상).

---

## 5. section0.xml 변경

### 5.1 secPr (페이지 설정)

| 항목 | OLD | NEW | 변경 |
|---|---|---|---|
| 방향 (landscape) | WIDELY | WIDELY | 없음 |
| 폭 (width) | 72,852 hwpunit | 72,852 hwpunit | 없음 |
| 높이 (height) | 103,180 hwpunit | 103,180 hwpunit | 없음 |
| 여백 header | 5,669 | 5,669 | 없음 |
| 여백 footer | 3,685 | 3,685 | 없음 |
| 여백 left/right | 5,102 | 5,102 | 없음 |
| 여백 top/bottom | 4,251 / 3,685 | 4,251 / 3,685 | 없음 |
| 컬럼 수 | 2 | 2 | 없음 |
| 총 hp:tbl 수 | 59 | 62 | **+3** |
| 총 hp:rect 수 | 4 | 4 | 없음 |

**페이지 설정은 완전 동일**.

### 5.2 단원분류표(8p) 위치 + 텍스트 추출 결과

단원분류표는 section0.xml 후반부에 3개 테이블로 구성됨.

| 양식지 | 테이블 인덱스 | row×col | 내용 |
|---|---|---|---|
| OLD | 54 | 68×5 | 수2, 확통 (A~I) |
| OLD | 55 | 76×5 | 고등수학 A~F + 수1 G~I |
| OLD | 56 | 51×5 | 심화수학 I, II |
| NEW | 57 | 38×5 | 고등수학 A~F (분리됨) |
| NEW | 58 | 38×5 | 수학I G~I + 수학II J~L + 미적분 M~O + 확통 P~R + 기하 S~U |
| NEW | 59 | 51×5 | 심화수학 I, II (OLD 56과 동일) |

#### 변경 요약

- **OLD**: 과목별 3테이블 (수2/확통, 고등수학/수1, 심화)
- **NEW**: 3테이블 재편 (고등수학만, 수학I~기하 통합, 심화)
- **대단원 코드 체계 변경**: NEW에서 연속 알파벳 코드(A~U) 사용. OLD의 수2(D~I) 체계와 병행.
- **NEW에 추가된 과목/단원**:
  - 수학I: G(지수로그, 6항목), H(삼각함수, 3항목), I(수열, 4항목)
  - 수학II: J(함수극한), K(미분법, 5항목), L(적분법, 3항목)
  - 미적분: M~O
  - 기하: S(이차곡선), T(평면벡터), U(공간도형)
- **심화수학**: OLD 56 = NEW 59 (동일)

#### NEW 단원분류표 RAW 텍스트 (Phase 4 입력)

**Table 57 — 고등수학 (row=38, col=5)**

```
대단원 / 중단원
고등수학
A / 다항식 / 1.다항식의 연산 / 2.나머지 정리 / 3.인수분해
B / 방정식과 부등식 / 1.복소수 / 2.이차방정식 / 3.다항함수 / 4.고차방정식 / 5.연립방정식 / 6.부등식
C / 도형의 방정식 / 1.평면좌표 / 2.직선의 방정식 / 3.원의 방정식 / 4.도형의 이동
D / 집합과 명제 / 1.집합 / 2.명제 / 3.절대부등식
E / 함수 / 1.함수 / 2.합성함수 / 3.역함수 / 4.유리식과 유리함수 / 5.무리식과 무리함수
F / 경우의 수 / 1.경우의 수 / 2.순열 / 3.조합
수학 I
G / 지수로그 / 1.지수 / 2.로그 / 3.상용로그 / 4.지수함수 / 5.로그함수 / 6.지수함수와 로그함수의 활용
H / 삼각함수 / 1.삼각함수 / 2.삼각함수의 그래프 / 3.삼각형에의 활용
I / 수열 / 1.등차수열 / 2.등비수열 / 3.수열의 합 / 4.수학적 귀납법
```

**Table 58 — 수학II~기하 (row=38, col=5)**

```
수학 II
J / 함수의 극한과 연속 / 1.함수의 극한 / 2.함수의 연속
K / 미분법 / 1.미분계수와 도함수 / 2.도함수활용-1 접선-평균값정리(수II) / 3.도함수활용-2 극대극소-최대최소(수II) / 4.도함수활용-3 방정식-부등식(수II) / 5.도함수활용-4 변화율-속도-가속도(수II)
L / 적분법 / 1.부정적분 / 2.정적분 / 3.정적분의 활용(수II)
미적분
M / 수열의 극한 / 1.수열의 극한 / 2.급수
N / 미분법 / 1.여러 가지 함수의 미분 / 2.여러 가지 미분법 / 3.도함수활용-1 접선-평균값정리(미적) / 4.도함수활용-2 극대극소-최대최소(미적) / 5.도함수활용-3 방정식-부등식(미적) / 6.도함수활용-4 변화율-속도-가속도(미적)
O / 적분법 / 4.여러 가지 적분법 / 5.정적분의 활용(미적)
확률과 통계
P / 경우의 수 / 1.여러가지순열 / 2.중복조합 / 3.이항정리
Q / 확률 / 1.확률의 뜻과 활용 / 2.조건부 확률
R / 통계 / 1.확률분포 / 2.이항분포 / 3.정규분포 / 4.통계적 추정
기하
S / 이차곡선 / 1.포물선 / 2.타원 / 3.쌍곡선 / 4.이차곡선의 접선
T / 평면벡터 / 1.벡터의 연산 / 2.평면벡터의 성분과 내적 / 3.도형의 방정식
U / 공간도형 / 1.공간도형 / 2.공간좌표
```

**Table 59 — 심화수학 (row=51, col=5) — OLD 56과 동일**

```
심화수학 I / 방정식과 부등식 / 지수함수와 로그함수 / 삼각함수 / 행렬과 일차변환 / 이차곡선 / 공간도형과 공간좌표 / 벡터와 복소수
심화수학 II / 수열과 급수 / 함수의 극한과 연속 / 미분법 / 적분법 / 확률
```

---

## 6. base_hwpx 18개 템플릿 매핑

### 테이블 기반 템플릿 (section0.xml 추출)

| # | 파일 | OLD 인덱스 | NEW 인덱스 | 변경 내용 | 의미적 변화 | 상태 |
|---|---|---|---|---|---|---|
| 1 | `bogi_table_3items.xml` | 3 | 6 | paraPrIDRef 2→1 | SAME (의미 동일: tab=1,LEFT,bfill=1) | **CHANGED** |
| 2 | `bogi_table_6items.xml` | 4 | 7 | paraPrIDRef 2→1 | SAME | **CHANGED** |
| 3 | `choice_table_5x5.xml` | 9 | 12 | `<hp:shapeComment>` 제거 | SAME (메타데이터 제거) | **CHANGED** |
| 4 | `choice_table_6x3.xml` | 8 | 11 | paraPrIDRef 12→10 | SAME (의미 동일: CENTER,bfill=1) | **CHANGED** |
| 5 | `choice_table_6x4.xml` | 7 | 10 | paraPrIDRef 12→10 | SAME | **CHANGED** |
| 6 | `choice_table_9x4.xml` | 6 | 9 | paraPrIDRef 4→3 | SAME (의미 동일: CENTER,bfill=3) | **CHANGED** |
| 7 | `condition_rect_template.xml` | — | — | paraPrIDRef 7→6 | SAME (LEFT,bfill=3) | **CHANGED** |
| 8 | `empty_box_template.xml` | — | — | 없음 | — | **UNCHANGED** |
| 9 | `header_area_template.xml` | masterpage0 | masterpage0 | paraPrIDRef 변동 가능성 | 재추출로 확인 | **CHANGED** |
| 10 | `normal_dist_3rows.xml` | 36 | 39 | paraPrIDRef 4→3 | SAME | **CHANGED** |
| 11 | `normal_dist_4rows.xml` | 19 | 22 | paraPrIDRef 4→3 | SAME | **CHANGED** |
| 12 | `normal_dist_5rows.xml` | 31 | 34 | paraPrIDRef 4→3 | SAME | **CHANGED** |
| 13 | `prob_dist_5cols.xml` | 14 | 17 | paraPrIDRef 12→10 | SAME | **CHANGED** |
| 14 | `prob_dist_6cols.xml` | 15 | 18 | paraPrIDRef 12→10 | SAME | **CHANGED** |
| 15 | `prob_dist_7cols.xml` | 16 | 19 | paraPrIDRef 12→10 | SAME | **CHANGED** |
| 16 | `proof_table_template.xml` | 5 | 8 | paraPrIDRef 2→1 | SAME | **CHANGED** |
| 17 | `content_hpf_template.xml` | content.hpf | content.hpf | manifest 구조 동일 | — | **UNCHANGED** |
| 18 | `root_element.xml` / `settings.xml` / `version.xml` / `mimetype` | ZIP 보조 | ZIP 보조 | version.xml 동일 | — | **UNCHANGED** |

**요약**: CHANGED 16 / UNCHANGED 3 / MISSING 0 / NEW 후보 별도 섹션

> CHANGED 항목의 변경 내용은 모두 paraPrIDRef 번호 시프트 또는 `<hp:shapeComment>` 메타데이터 제거이며, **의미적(semantically)으로는 모두 동일**하다. Phase 3에서 NEW 양식지에서 재추출하면 올바른 NEW ID로 자동 반영된다.

---

## 7. 신규 추가(NEW) 템플릿 후보

NEW 양식지에 추가된 테이블 중 유의미한 신규 후보:

| NEW 인덱스 | row×col | 식별 마커 | 용도 추정 | Phase 3 추출 여부 |
|---|---|---|---|---|
| 1 | 4×4 | `{it_n}{rm P}_{it r}`, `{rmB}{it(n,~p)}`, `{rm smallprod}` | 확통 수식 참조표 (순열/조합/확률분포 기호 정리) | 선택 (참고 자료) |
| 4 | 4×4 | `×`, `○`, `sin A` 이탤릭 설명 | 수식 기호 작성 가이드 (rm/it 구분) | 불필요 (설명용) |
| 5 | 8×1 | `해설 빠른 정답 두줄`, `ㄱ.ㄴ.ㄷ. 보기 해설` | 해설 작성 양식 예시 | 불필요 (설명용) |

> NEW 인덱스 0(집합 수식 예시), 2(단서조항), 3(그림삽입방법)은 OLD에서 위치만 이동된 것이며 신규 콘텐츠 아님.

**결론**: 신규 추출 가치가 있는 것은 인덱스 1(확통 수식 참조표) 정도이나, 이는 builder가 직접 사용하는 구조가 아니므로 Phase 3 작업 범위 외로 분류. 필요 시 별도 이슈로 결정.

---

## 8. Phase 3 작업 권고

### [HIGH] 재추출 필수 — CHANGED 16개

모든 테이블 기반 템플릿(1~6, 10~16)과 condition_rect(7), header_area(9)를 NEW 양식지에서 재추출한다.

변경 내용이 paraPrIDRef 번호 시프트와 shapeComment 제거뿐이나, 재추출 없이 OLD XML을 그대로 사용하면 NEW 양식지의 header.xml ID 체계와 불일치하여 한컴에서 렌더링 오류 가능성.

**재추출 우선순위**:
1. `bogi_table_3items.xml`, `bogi_table_6items.xml` — 문제에 가장 빈번히 사용
2. `choice_table_*` 4종 — 선지 구조
3. `normal_dist_*`, `prob_dist_*` 6종 — 정규분포/확률분포표
4. `condition_rect_template.xml` — (가)(나)(다) 조건 박스
5. `proof_table_template.xml`, `header_area_template.xml` — 낮은 빈도

### [HIGH] builder paraPrIDRef=1 충돌 검토

`build_hwpx.py`에서 `paraPrIDRef="1"`을 하드코딩하는 위치들(`:158, 230, 254, 273, 297, 321, 611, 642`)에서 NEW 양식지 사용 시 문단 정렬이 CENTER에서 LEFT로 바뀐다. 아래를 확인한다:

1. OLD 양식지 기준 builder 출력물에서 paraPrIDRef=1이 CENTER였는지 실제로 확인 (이미 LEFT를 의도한 것이라면 오히려 정상화).
2. 실제 문제 출력물에서 정렬 이슈가 없으면 변경 불필요.
3. 정렬 이슈 발견 시 `paraPrIDRef="1"` → `paraPrIDRef="0"` (LEFT, 기존과 동일 의미)로 교체 검토.

### [MED] content_hpf_template.xml

manifest 구조가 동일하므로 재추출 불필요. 단, `<opf:spine itemref idref="section0">` 에 `linear="yes"` 추가 반영이 필요한지 판단.

### [LOW] NEW charPr 31~41 (11개)

신규 추가된 charPr이 builder나 base_hwpx에서 참조되기 시작할 경우를 대비해 ID 목록 문서화 완료. 즉각적 action 불필요.

---

## 9. Phase 4 작업 권고

### 단원분류표 변경 여부

**중요 변경 발생**: OLD와 NEW의 단원 분류 체계가 달라졌다.

| 항목 | OLD | NEW |
|---|---|---|
| 과목 구성 | 고등수학, 수2, 확통, 심화 | 고등수학, 수학I, 수학II, 미적분, 확통, 기하, 심화 |
| 대단원 코드 | A~I (일부), D~I (수2) | A~U (연속 코드) |
| 수학I 포함 여부 | 수1 내용 일부(G~I)를 고등수학 테이블에 통합 | 명시적 수학I(G~I) 분리 |
| 수학II | 없음 | J~L 신규 |
| 미적분 | 없음 | M~O 신규 |
| 기하 | 없음 | S~U 신규 |

### Phase 4 작업 항목

1. `unit_classification.json`의 `source` 필드를 NEW 양식지 경로로 교체 (Phase 1에서 이미 완료되어야 함).
2. JSON 본문 구조는 동일하게 유지하되, **과목 코드와 단원 목록을 NEW 기준으로 전면 재검증**.
3. OLD에 없던 수학II, 미적분, 기하 단원의 코드 매핑 추가 여부 결정.
4. 대단원 코드 A~U 전체를 §5.2 raw 텍스트 기반으로 재입력.

> `unit_classification.json`의 현재 `수2` 코드(D~I)가 NEW에서도 유효한지 검증 필요. NEW에서 D는 여전히 "집합과 명제"이나 과목명이 "고등수학"으로 표기됨.

---

*진단 완료. Phase 3·4 진행 전 본 보고서의 §3.5 builder 영향 결론과 §6 매핑 표를 참조할 것.*
