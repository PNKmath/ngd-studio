# NGD HWPX 특수 템플릿 참조 가이드

양식지(`inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`)에는
특수 문제 유형에 필요한 **XML 테이블 템플릿**이 포함되어 있다.

builder가 해당 유형의 문제를 만날 때, 양식지에서 XML을 추출하여 사용해야 한다.

## 템플릿 목록

### 1. 함수 증감표 (Function Increase/Decrease Table)

**용도**: f'(x), f(x)의 부호 변화와 증감을 표로 보여줌
**위치**: section0.xml 내 "함수 증감표양식" 텍스트 이후의 `<hp:tbl>` 요소들

**변형 종류**:
| 변형 | 열 수 | 행 | 용도 |
|------|-------|-----|------|
| 기본 (2열) | x, ..., 값, ... | f'(x), f(x) | 극값 1개 |
| 3열 | x, ..., 값, ..., 값, ... | f'(x), f(x) | 극값 2개 |
| 4열 (y', y'', y) | x + 여러 열 | y', y'', y | 2차 도함수 포함 |
| 6열 (f', f, F', F) | x + 6열 | f'(x), f(x), F'(x), F(x) | 원시함수 포함 |

**셀 내용 패턴**:
- 첫 행(x): 수식 `{x}` + 값 위치에 수식 또는 `{CDOTS}`
- f'(x) 행: `+`, `-`, `0` 값
- f(x) 행: `NEARROW`(↗), `SEARROW`(↘), 극값

**추출 방법**:
```python
import zipfile, re
with zipfile.ZipFile(양식지_경로, 'r') as z:
    xml = z.read('Contents/section0.xml').decode('utf-8')
# "함수 증감표양식" 텍스트 이후의 <hp:tbl> 요소들을 찾아 추출
```

### 2. 확률분포표 (Probability Distribution Table)

**용도**: 이산확률변수 X의 확률분포를 표로 표시
**위치**: "확률분포표 양식" 텍스트 이후의 `<hp:tbl>` 요소들

**구조**: 2행 N열 테이블
- 1행: X 값들 + "계"
- 2행: P(X=x) 값들 + "1"

**변형**:
- 3열 (X값 2개 + 계)
- 4열 (X값 3개 + 계)
- 5열 (X값 4개 + 계)

**수식 패턴**:
- 헤더: `{RM P IT (X=it x)}` 또는 `rmP LEFT ( it 0 le Z le z RIGHT )`
- "계" 셀: 일반 텍스트

### 3. 표준 정규분포표 (Standard Normal Distribution Table)

**용도**: P(0≤Z≤z) 값을 표로 제공 (확률/통계 문제)
**위치**: "표준 정규분포표" 또는 "<표준정규분포표>" 텍스트 이후의 `<hp:tbl>` 요소들

**구조**: 2열 테이블, N+1행
- 헤더: `z` | `P(0≤Z≤z)`
- 데이터행: z값 | 확률값

**변형 (약 20가지)**: z값 조합이 다름
- 기본 4행: 0.5, 1.0, 1.5, 2.0
- 5행: 0.5, 1.0, 1.5, 2.0, 2.5
- 소수점 2자리: 1.64, 1.96, 2.33, 2.58
- 기타 다양한 조합

**주의**: 양식지에 `글자취급` 상태로 되어있으므로, 본문에 사용 시 `어울림`(AROUND)으로 변경 필요

**수식 패턴**:
- z 헤더: `z\``
- P 헤더: `rmP LEFT ( it 0 le Z le z RIGHT )\``

### 4. 조립제법 틀 (Synthetic Division Template)

**용도**: 다항식 나눗셈(조립제법) 과정을 표로 보여줌
**위치**: "<조립제법 틀>" 텍스트 이후의 `<hp:tbl>` 요소

**구조**: 복잡한 테이블 (셀 병합, 밑줄 등)
- 상단: 나누는 수 | 피제식 계수들
- 중단: 중간 계산 결과
- 하단: 몫의 계수들 | 나머지

**참고**: 이 템플릿은 구조가 복잡하므로, 양식지에서 `<hp:tbl>` 전체를 추출하여 값만 치환하는 방식 권장

### 5. 파스칼삼각형 (Pascal's Triangle Template)

**용도**: 이항계수 삼각형을 시각적으로 표현
**위치**: "<파스칼삼각형그리기>" 텍스트 이후의 `<hp:tbl>` 요소들

**변형**:
- 수식 표기: `{}_n{rmC}_r` (조합 기호)
- 숫자 표기: 실제 값 (1, 1, 1, 2, 1, ...)

**구조**: 삼각형 모양의 테이블 (상위 셀 병합으로 정렬)
- 0행: ₀C₀
- 1행: ₁C₀, ₁C₁
- ...
- n행: ₙC₀ ~ ₙCₙ

## 추출 및 사용 방법

### builder에서의 사용 흐름

1. `exam_data.json`에서 해당 유형의 문제 감지:
   - 함수 증감표: `data_table.type == "increase_decrease"` 또는 해설에 증감 분석 포함
   - 확률분포표: `data_table.type == "probability"`
   - 표준정규분포표: 문제에 표준정규분포 조건이 있을 때
   - 조립제법: 해설에 조립제법 사용
   - 파스칼삼각형: 이항정리 관련 문제

2. 양식지 HWPX에서 해당 `<hp:tbl>` XML 추출

3. 플레이스홀더 값 치환 (셀 내 수식/텍스트)

4. section0.xml의 적절한 위치에 삽입

### XML 추출 코드 예시

```python
import zipfile, re

TEMPLATE_PATH = "inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx"

def extract_template_tables(template_type):
    """양식지에서 특정 유형의 테이블 XML을 추출"""
    with zipfile.ZipFile(TEMPLATE_PATH, 'r') as z:
        xml = z.read('Contents/section0.xml').decode('utf-8')

    # 마커 텍스트로 위치 찾기
    markers = {
        "increase_decrease": "함수 증감표양식",
        "probability": "확률분포표 양식",
        "normal_dist": "표준 정규분포표",
        "synthetic_div": "조립제법 틀",
        "pascal": "파스칼삼각형그리기",
    }

    marker = markers[template_type]
    pos = xml.find(marker)
    if pos == -1:
        return []

    # 마커 이후의 <hp:tbl> ~ </hp:tbl> 추출
    tables = []
    search_start = pos
    while True:
        tbl_start = xml.find('<hp:tbl', search_start)
        if tbl_start == -1:
            break
        tbl_end = xml.find('</hp:tbl>', tbl_start)
        if tbl_end == -1:
            break
        tables.append(xml[tbl_start:tbl_end + len('</hp:tbl>')])
        search_start = tbl_end + len('</hp:tbl>')
        # 다음 섹션 마커를 만나면 중단
        next_marker_pos = min(
            (xml.find(m, search_start) for m in markers.values() if xml.find(m, search_start) != -1),
            default=len(xml)
        )
        if search_start >= next_marker_pos:
            break

    return tables
```
