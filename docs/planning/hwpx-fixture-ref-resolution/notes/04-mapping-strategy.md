# 04 — 두 header 간 정의 매핑 자동화 전략

## 출처

- Phase 1 리서치 결과 (01~03 노트) 기반 설계
- 우리 header.xml 실측 데이터 (2026-05-19)
- HWP 공식 스펙: PNKmath/PNKLMS docs/hancom_official/

---

## 핵심 발견 (의사결정 요약)

### 1. "같다"고 판정하는 기준

#### paraPr 동일 판정 기준

두 paraPr 정의가 시각적으로 같은 문단 서식을 만들어내는 조건:

**필수 매칭 필드** (모두 일치해야 함):
| 필드 | 설명 | 예시 |
|------|------|------|
| `align.horizontal` | 정렬 | LEFT, CENTER, RIGHT, JUSTIFY |
| `align.vertical` | 수직 정렬 | BASELINE |
| `margin.left` | 왼쪽 여백 | HWPUNIT 값 |
| `margin.right` | 오른쪽 여백 | HWPUNIT 값 |
| `margin.prev` | 문단 앞 간격 | HWPUNIT 값 |
| `margin.next` | 문단 뒤 간격 | HWPUNIT 값 |
| `intent` | 들여쓰기/내어쓰기 | HWPUNIT 값 (음수=내어쓰기) |
| `lineSpacing.type` | 줄 간격 방식 | PERCENT, FIXED, etc. |
| `lineSpacing.value` | 줄 간격 값 | 160 = 160% |
| `borderFillIDRef` | 문단 테두리 → **매핑 후 borderFill id** | |
| `tabPrIDRef` | 탭 정의 → **매핑 후 tabPr id** | |

**판정 로직**: borderFillIDRef와 tabPrIDRef는 재귀적으로 대응 정의를 매핑한 후 비교.

**관측된 paraPr 구분 키** (우리 header 기준):
- align + margin (L/R/prev/next) + intent + lineSpacing + borderFillRef + tabPrRef
- 대부분이 lineSpacing=PERCENT:160, margin=0, 차이는 align과 intent 값에 있음

#### charPr 동일 판정 기준

**필수 매칭 필드**:
| 필드 | 설명 | 예시 |
|------|------|------|
| `height` | 글자 크기 (pt×100) | 1000=10pt, 1200=12pt |
| `textColor` | 글자 색상 | #000000 |
| `bold` | 진하게 여부 | `<hh:bold/>` 있으면 true |
| `italic` | 기울임 여부 | |
| `underline.type` | 밑줄 종류 | NONE, BOTTOM |
| `borderFillIDRef` | 글자 배경/테두리 → **매핑 후** | |
| `fontRef.hangul` | 한글 폰트 id | 0=나눔고딕, 1=나눔고딕ExtraBold |
| `fontRef.latin` | 영문 폰트 id | |

**secondary 필드** (선택적 검증):
- `shadeColor`, `spacing.hangul`, `ratio.hangul` — 대부분 기본값이므로 불일치 시 경고만

#### borderFill 동일 판정 기준

**필수 매칭 필드**:
| 필드 | 설명 |
|------|------|
| 4방향 border type (NONE, SOLID 등) | left/right/top/bottom |
| 4방향 border width | "0.1 mm" 등 |
| 4방향 border color | #000000 등 |
| `fillBrush` 전체 | `<hc:winBrush faceColor="..." hatchColor="..." alpha="0"/>` |
| `threeD`, `shadow` | 속성값 |

**실용적 경량 키** (빠른 매칭용):
```
borderKey = (leftType, rightType, topType, bottomType, leftColor, rightColor, topColor, bottomColor, fillFaceColor, fillHatchColor)
```

**주의**: borderFill id는 1-기반 — 우리 header에서 id=1이 "완전 비어있는 테두리(NONE all sides)" 이며 가장 자주 참조됨.

### 2. 매핑 도구 설계안 (Phase 2 구현 입력)

#### 입력

```
A: 우리 header.xml (resources/hwpx_base/Contents/header.xml)
B: 사용자/대상 header.xml (예: 사용자가 여는 한컴 문서의 header)
fixture.xml: 교체할 fixture (paraPrIDRef="N", charPrIDRef="M", borderFillIDRef="K" 포함)
```

#### 알고리즘 개요

```python
def remap_fixture(fixture_xml: str, our_header: str, target_header: str) -> str:
    """
    fixture 내 모든 IDRef 값을 our_header 기준에서 target_header 기준으로 변환.
    """
    # 1. 정의 파싱
    our_paraPrs = parse_paraPrs(our_header)      # {id: ParaDef}
    our_charPrs = parse_charPrs(our_header)
    our_borderFills = parse_borderFills(our_header)
    
    target_paraPrs = parse_paraPrs(target_header)
    target_charPrs = parse_charPrs(target_header)
    target_borderFills = parse_borderFills(target_header)
    
    # 2. borderFill 매핑 먼저 (paraPr/charPr가 borderFillIDRef에 의존)
    border_map = build_border_map(our_borderFills, target_borderFills)
    #   border_map[our_id] = target_id | None (없으면)
    
    # 3. tabPr 매핑 (paraPr가 tabPrIDRef에 의존)
    tab_map = build_tab_map(our_tabPrs, target_tabPrs)
    
    # 4. paraPr 매핑 (borderFill + tabPr 이미 매핑됨)
    para_map = build_para_map(our_paraPrs, target_paraPrs, border_map, tab_map)
    
    # 5. charPr 매핑 (borderFill 이미 매핑됨)
    char_map = build_char_map(our_charPrs, target_charPrs, border_map)
    
    # 6. fixture XML에서 IDRef 치환
    return replace_all_idrefs(fixture_xml, para_map, char_map, border_map)
```

#### 정의 미존재 시 처리 (fallback 정책)

| 시나리오 | 처리 방법 |
|---------|---------|
| target에 완전히 동일한 정의 있음 | target id로 교체 |
| 완전 일치 없음 — 필수 필드만 일치 | 필수 필드 기준 가장 유사한 것 사용 (경고 로그) |
| 어떤 것도 일치 안 함 | **target header에 새 정의 추가** 후 새 id 사용 |
| borderFill id=1 (완전 빈 테두리) | 항상 target의 id=1 로 매핑 (보편적으로 존재) |

**fallback 우선순위**:
1. byte-equal (normalized) → 100% 일치 매핑
2. 필수 필드 일치 → best-match 매핑 (가장 많은 필드 일치)
3. 미존재 → 우리 정의를 target header에 추가 후 새 id 반환

### 3. 매핑 키 구현 (Phase 2에서 사용할 Python 함수)

```python
def paraPr_match_key(paraPr_elem):
    """paraPr 매핑 키 생성 — borderFill/tabPr은 ID 값 그대로 (이후 normalize)"""
    return (
        get_attr(paraPr_elem, 'hh:align', 'horizontal', 'LEFT'),
        get_attr(paraPr_elem, 'hh:align', 'vertical', 'BASELINE'),
        get_child_attr(paraPr_elem, 'hc:left', 'value', '0'),
        get_child_attr(paraPr_elem, 'hc:right', 'value', '0'),
        get_child_attr(paraPr_elem, 'hc:prev', 'value', '0'),
        get_child_attr(paraPr_elem, 'hc:next', 'value', '0'),
        get_child_attr(paraPr_elem, 'hc:intent', 'value', '0'),
        get_attr(paraPr_elem, 'hh:lineSpacing', 'type', 'PERCENT'),
        get_attr(paraPr_elem, 'hh:lineSpacing', 'value', '160'),
    )
    # borderFillIDRef, tabPrIDRef는 normalize 후 별도 비교

def charPr_match_key(charPr_elem):
    """charPr 매핑 키 생성"""
    return (
        charPr_elem.get('height', '1000'),
        charPr_elem.get('textColor', '#000000'),
        bool(charPr_elem.find('hh:bold')),   # bold 여부
        bool(charPr_elem.find('hh:italic')), # italic 여부
        get_attr(charPr_elem, 'hh:underline', 'type', 'NONE'),
        get_attr(charPr_elem, 'hh:fontRef', 'hangul', '0'),
        get_attr(charPr_elem, 'hh:fontRef', 'latin', '0'),
    )
    # borderFillIDRef는 normalize 후 별도 비교

def borderFill_match_key(bf_elem):
    """borderFill 매핑 키 생성"""
    return (
        # 4방향 type + width + color
        get_attr(bf_elem, 'hh:leftBorder', 'type', 'NONE'),
        get_attr(bf_elem, 'hh:leftBorder', 'width', '0.1 mm'),
        get_attr(bf_elem, 'hh:leftBorder', 'color', '#000000'),
        get_attr(bf_elem, 'hh:rightBorder', 'type', 'NONE'),
        get_attr(bf_elem, 'hh:rightBorder', 'width', '0.1 mm'),
        get_attr(bf_elem, 'hh:rightBorder', 'color', '#000000'),
        get_attr(bf_elem, 'hh:topBorder', 'type', 'NONE'),
        get_attr(bf_elem, 'hh:topBorder', 'width', '0.1 mm'),
        get_attr(bf_elem, 'hh:topBorder', 'color', '#000000'),
        get_attr(bf_elem, 'hh:bottomBorder', 'type', 'NONE'),
        get_attr(bf_elem, 'hh:bottomBorder', 'width', '0.1 mm'),
        get_attr(bf_elem, 'hh:bottomBorder', 'color', '#000000'),
        # fill brush
        get_fill_key(bf_elem),
    )
```

### 4. 우리 header에서 매핑에 쓸 "의미적으로 다른" paraPr들

우리 header의 paraPr 14개 고유 키 목록 (fixture에서 실제 사용):

| paraPr id | align | intent | lineSpacing | borderFillRef | tabRef | 시각적 의미 |
|----------|-------|--------|-------------|--------------|--------|----------|
| 0  | LEFT | 0 | 160% | 3 | 0 | 기본 좌정렬 |
| 1  | LEFT | 0 | 160% | 1 | 1 | 탭 있는 좌정렬 |
| 2  | LEFT | 0 | 160% | 1 | 2 | 탭 있는 좌정렬2 |
| 3  | CENTER | 0 | 160% | 3 | 0 | 가운데정렬 |
| 4  | RIGHT | 0 | 160% | 3 | 0 | 우정렬 |
| 5  | LEFT | -1695 | 160% | 3 | 0 | 내어쓰기 A |
| 7  | LEFT | -2940 | 160% | 3 | 0 | 내어쓰기 B |
| 8  | LEFT | -1740 | 160% | 3 | 0 | 내어쓰기 C |
| 10 | CENTER | 0 | 160% | 1 | 0 | 가운데, 테두리없음 |
| 11 | LEFT | 0 | 160% | 1 | 0 | 좌정렬, 테두리없음 |
| 12 | LEFT | -1656 | 160% | 3 | 0 | 내어쓰기 D |
| 13 | CENTER | -1695 | 160% | 3 | 0 | 내어쓰기 센터 |
| 20 | LEFT | 0 | 160% | 3 | 0 | (paraPr[0]과 동일, 미주용) |
| 29 | CENTER | 0 | 160% | 2 | 0 | 가운데, fillBrush |

### 5. Phase 2에서 구현할 매핑 도구 입력/출력 스펙

```
입력:
  --our-header    resources/hwpx_base/Contents/header.xml
  --target-header <사용자 HWPX 압축 해제 후>/Contents/header.xml
  --fixture       <fixture.xml 경로>
  --output        <출력 fixture.xml 경로>

출력:
  - 매핑된 fixture.xml (IDRef 값 갱신)
  - 매핑 리포트 (어떤 id가 어떤 id로 바뀌었는지, fallback 사용 여부)
  - target header에 추가된 정의 목록 (있으면)
```

---

## uncertain 항목

- "target header에 정의 추가" 케이스: 새 정의를 추가할 때 id를 max(existing)+1로 배정하면 되지만, 이후 한컴오피스 재저장 시 GC에 의해 id가 다시 바뀔 가능성 있음. 단, HWPX를 직접 수정해서 저장하면 한컴이 재저장하기 전까지는 유효.
- target header의 fontface가 우리것과 다를 경우 (나눔고딕 없음) → charPr의 fontRef 매핑도 필요. Phase 2에서 fontRef 매핑 여부 결정 필요.
- 실제 사용자 HWPX를 확보해 테스트 필요 — 현재 target header가 없어 매핑 알고리즘 검증 불가.
