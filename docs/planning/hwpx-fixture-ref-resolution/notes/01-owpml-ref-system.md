# 01 — OWPML Ref 시스템 핵심 규칙

## 출처

- **HWP 공식 스펙 문서**: `PNKmath/PNKLMS` → `docs/hancom_official/04-docinfo-records.md` (commit main)
  - URL: https://github.com/PNKmath/PNKLMS/blob/main/docs/hancom_official/04-docinfo-records.md
- **본문 레코드 문서**: `docs/hancom_official/05-body-records.md`
  - URL: https://github.com/PNKmath/PNKLMS/blob/main/docs/hancom_official/05-body-records.md
- **한컴 공식 DVC (Document Validation Checker)**: `hancom-io/dvc` Source/CParaShape.cpp, CStyle.cpp
  - URL: https://github.com/hancom-io/dvc
- **우리 header.xml 직접 분석**: `resources/hwpx_base/Contents/header.xml` (146,649 bytes)

---

## 핵심 발견

### 1. `paraPrIDRef` / `charPrIDRef` / `borderFillIDRef` 는 **id 속성 매칭** (인덱스 아님)

- `<hh:paraPr id="N">` 원소의 `id` attribute 값과 `paraPrIDRef="N"` 이 **직접 매칭**된다.
- paraPr: id 0부터 시작, charPr: id 0부터 시작, borderFill: **id 1부터 시작** (0번 없음).
- 실증: 우리 header.xml의 paraPr ids = [0..29] (연속), charPr ids = [0..41] (연속), borderFill ids = [1..81] (연속, 0번 없음).
- HWP 바이너리 포맷의 `HWPTAG_PARA_HEADER`에서도 `문단 모양 아이디`, `글자 모양 ID`는 해당 정의 목록의 **0-기반 순서 인덱스**이며, OWPML XML로 변환 시 `id` attribute와 동일하게 대응된다.

### 2. borderFill id는 1-기반 (0번 없음)

- borderFill 컨테이너의 첫 번째 항목: `id="1"` — 0번이 아님.
- `charPrIDRef="4294967295"` (0xFFFFFFFF)는 특수값 — "정의 없음/기본값 사용" 의미 (numbering paraHead 등에서 사용).

### 3. 컨테이너 구조

| 컨테이너 | 포함 정의 | id 시작 | 우리 header 개수 |
|---------|---------|--------|--------------|
| `<hh:paraProperties>` | `<hh:paraPr>` | 0 | 30 |
| `<hh:charProperties>` | `<hh:charPr>` | 0 | 42 |
| `<hh:borderFills>` | `<hh:borderFill>` | 1 | 81 |
| `<hh:tabProperties>` | `<hh:tabPr>` | 0 | 3 |
| `<hh:numberings>` | `<hh:numbering>` | 1 | 2 |
| `<hh:styles>` | `<hh:style>` | 0 | 2 |

### 4. `<hh:style>` 은 paraPrIDRef + charPrIDRef를 속성으로 포함

```xml
<hh:style id="0" type="PARA" name="바탕글" engName="Normal"
  paraPrIDRef="0" charPrIDRef="1" nextStyleIDRef="0" langID="1042" lockForm="0"/>
```

- 스타일 자체는 paraPr/charPr의 **패키지 별명**이다.
- `styleIDRef="N"` 은 style id N을 가리킨다.

### 5. ref 체인 구조

```
section0.xml/fixture.xml
  → paraPrIDRef="N"    → header.xml <hh:paraPr id="N">
  → charPrIDRef="N"    → header.xml <hh:charPr id="N">
  → borderFillIDRef="N" → header.xml <hh:borderFill id="N">
  → styleIDRef="N"     → header.xml <hh:style id="N">
                           → <hh:style paraPrIDRef="M">  → <hh:paraPr id="M">
                           → <hh:style charPrIDRef="K">  → <hh:charPr id="K">
```

### 6. `tabPrIDRef` 는 paraPr 내부에서 사용

- `<hh:paraPr tabPrIDRef="N">` — paraPr 내에서 탭 정의를 참조.
- tabPr ids = [0, 1, 2], 우리 header에 3개.

### 7. HWP 바이너리(5.x) vs OWPML(HWPX) 의 id 체계 차이

- **HWP 바이너리**: 정의 목록은 저장 순서 기반 0-기반 인덱스 (id attribute 없음, 순서가 곧 id).
- **OWPML(HWPX XML)**: 각 정의 원소에 `id="N"` attribute 명시 — 하지만 실제로는 저장 순서와 id가 항상 일치 (0, 1, 2, … 연속 순서). borderFill만 1부터 시작.
- 따라서 `paraPrIDRef="N"` 은 실질적으로 "N번째 paraPr (0-based)" 와 동의어이지만, **공식적으로는 id 매칭**이다.

---

## uncertain 항목

- OWPML 공식 XSD/스펙은 공개된 문서에서 직접 확인 불가 (한컴 공식 OWPML 1.0/1.5 스펙 PDF 미입수). id 속성이 "순차 연속이어야 한다"는 강제 규정이 있는지 불명확.
- `borderFill id=0` 이 왜 없는지 스펙 근거 불명 (관찰 사실: 실제 header.xml에서 1부터 시작). "0 = 테두리 없음" 의 특수 의미일 가능성.
- 한컴이 중간 id 삭제(GC) 후 renumbering 시 id 갭이 생기는지 여부 — 관찰로는 모두 연속이나, 파손/편집 시 갭 발생 여부 불확실.
