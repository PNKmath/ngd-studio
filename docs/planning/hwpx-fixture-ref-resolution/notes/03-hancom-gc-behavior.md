# 03 — 한컴 저장 시 GC/컴팩션 동작

## 출처

- **우리 header.xml 실측**: `resources/hwpx_base/Contents/header.xml` (146,649 bytes)
- **비교 대상 ("user header")**: 스펙 기술 기준 ~82KB (실제 사용자 HWPX에서 관측된 크기로 추정)
- **관찰 방법**: Python re 모듈로 paraPr/charPr/borderFill 참조 집계 (2026-05-19)
- **참고 문서**: PNKmath/PNKLMS 04-docinfo-records.md — HWPTAG_ID_MAPPINGS 섹션

---

## 핵심 발견

### 1. 한컴오피스가 저장 시 수행하는 GC 동작

한컴오피스는 HWPX 저장 시 **참조되지 않는 정의를 제거하고 id를 재매김** 한다.
이것이 우리 header(147KB)와 사용자 한컴오피스 저장 header(~82KB) 사이의 크기 차이 원인이다.

GC 과정:
1. 현재 문서 본문(section*.xml)에서 모든 paraPrIDRef/charPrIDRef/borderFillIDRef 수집
2. 참조되지 않는 정의 제거
3. 남은 정의의 id를 0(또는 1)부터 연속으로 재매김
4. 모든 참조값도 새 id로 업데이트

### 2. 우리 header의 참조 coverage (47KB 제거 가능)

| 종류 | 정의 수 | 실제 참조됨 | 미참조 | 제거 가능 바이트 |
|------|--------|-----------|-------|--------------|
| paraPr | 30 | 14 | 16 | ~19,419 |
| charPr | 42 | 21 | 21 | ~16,994 |
| borderFill | 81 | 60 | 21 | ~11,190 |
| **합계** | **153** | **95** | **58** | **~47,603** |

- 순수 GC만으로 147KB → 99KB 로 줄어들 것으로 추산.
- 한컴 저장 후 ~82KB가 된다면 추가 17KB는 다른 요소(XML 압축 차이, fontface 차이, 기타 메타데이터) 때문.

### 3. 미참조 paraPr/charPr/borderFill 목록

**미참조 paraPr IDs** (16개): [6, 9, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28]
- paraPr[20]은 미주 스타일에서 참조됨
- paraPr[21] = paraPr[3]와 구조 동일, 미참조

**미참조 charPr IDs** (21개): [9, 16, 18, 20, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41]
- charPr[40]은 미주 스타일에서 참조됨
- charPr[41]은 미참조

**미참조 borderFill IDs** (21개): [41, 48, 49, 60~63, 68~81]
- 고번호 borderFill들이 주로 미참조

### 4. GC 후 id 재매김 패턴

한컴오피스 GC는 다음 변환을 수행한다:

```
Before GC:
  paraPr: [0,1,2,3,4,5, (6 없음), 7,8, (9 없음), 10,11,12,13, (14~19 없음), 20,21→0,...]
  
After GC (가상):
  paraPr: 살아남은 14개 → id 0,1,2,...,13 으로 재매김
```

이 재매김이 **fixture.xml과 사용자 header.xml의 ref mismatch 원인**이다.
- 우리 fixture는 우리 header.xml 기준 id로 작성됨 (예: paraPrIDRef="5")
- 사용자 한컴 문서의 header.xml은 GC 후 id가 다름 (paraPrIDRef="5"가 다른 paraPr를 가리킴)

### 5. "중복 정의" 문제

우리 header에서 발견된 중복 정의:
- paraPr[20] == paraPr[0] (byte-equal, id만 다름)
- paraPr[21] == paraPr[3]
- paraPr[26] == paraPr[25]

한컴 GC는 의미적 중복도 제거하지 않는 것으로 추정 (참조 유무만 보고 내용 비교는 안 함).
즉, 두 다른 id가 동일한 정의를 갖더라도 모두 참조되면 둘 다 유지됨.

### 6. HWPTAG_ID_MAPPINGS (바이너리 HWP 명세에서의 GC)

HWP 5.x 바이너리에서 `HWPTAG_ID_MAPPINGS`는 각 정의 목록의 개수를 저장한다.
인덱스 8=borderFill 개수, 9=charShape 개수, 13=paraShape 개수, 14=style 개수.
저장 시 이 카운트 값이 줄어든다 = GC 발생.

OWPML(HWPX)에서는 이 카운트가 실제 `<hh:paraPr>` 원소 수로 암묵 표현된다.

---

## uncertain 항목

- 실제 사용자 HWPX 82KB header를 직접 분석하지 않았음 — 크기 및 정의 수는 추정값.
- 한컴오피스가 "저장 시" GC를 수행하는지, 아니면 편집 중에도 실시간으로 수행하는지 불명확.
- paraPr 중 tabPrIDRef 변경 시 tabPr 정의도 GC/재매김 되는지 불확실 (현재 tabPr 3개 모두 참조됨이므로 문제없음).
- 한컴오피스가 fixture XML 삽입 후 재저장 시 fixture 내 ref들도 모두 새 id로 업데이트 해주는지, 아니면 그냥 두는지 — **이것이 fixture 교체 실패의 핵심 원인**일 가능성 높음.
