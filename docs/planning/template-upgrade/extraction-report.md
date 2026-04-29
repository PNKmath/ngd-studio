# base_hwpx 재추출 보고서

> Phase 3 산출물 — 2026-04-29 작성
> 대상: `[NGD고등부]기출작업양식지[2025년08월10일].hwpx`

---

## 1. 백업 위치

```
.claude/skills/ngd-exam-create/base_hwpx/.backup-2022-05-20/
```

백업 파일 목록 (25개):
- XML 18개: bogi_table_3items.xml, bogi_table_6items.xml, choice_table_5x5.xml, choice_table_6x3.xml, choice_table_6x4.xml, choice_table_9x4.xml, condition_rect_template.xml, content_hpf_template.xml, empty_box_template.xml, header_area_template.xml, normal_dist_3rows.xml, normal_dist_4rows.xml, normal_dist_5rows.xml, prob_dist_5cols.xml, prob_dist_6cols.xml, prob_dist_7cols.xml, proof_table_template.xml, root_element.xml
- 보조 파일: mimetype, settings.xml, version.xml
- 보조 폴더: BinData/ (image1.bmp, image2.bmp), Contents/ (header.xml, masterpage0.xml), META-INF/ (container.rdf, container.xml, manifest.xml), Preview/ (PrvImage.png, PrvText.txt)

---

## 2. 18개 템플릿 처리 결과

| # | 파일 | 상태 | 변경 요약 |
|---|---|---|---|
| 1 | `bogi_table_3items.xml` | **CHANGED** | NEW idx=6, row=4 col=5 유지. paraPrIDRef 2→1 반영 (의미 동일: LEFT,tab) |
| 2 | `bogi_table_6items.xml` | **CHANGED** | NEW idx=7, row=7 col=7 유지. paraPrIDRef 2→1 반영 |
| 3 | `proof_table_template.xml` | **CHANGED** | NEW idx=8, row=4 col=5 유지. paraPrIDRef 2→1 반영 |
| 4 | `choice_table_9x4.xml` | **CHANGED** | NEW idx=9, row=9 col=4 유지. paraPrIDRef 4→3 반영 |
| 5 | `choice_table_6x4.xml` | **CHANGED** | NEW idx=10, row=6 col=4 유지. paraPrIDRef 12→10 반영 |
| 6 | `choice_table_6x3.xml` | **CHANGED** | NEW idx=11, row=6 col=3 유지. paraPrIDRef 12→10 반영 |
| 7 | `choice_table_5x5.xml` | **CHANGED** | NEW idx=12, row=5 col=5 유지. `<hp:shapeComment>` 제거 확인 |
| 8 | `prob_dist_5cols.xml` | **CHANGED** | NEW idx=17, row=2 col=5 유지. paraPrIDRef 12→10 반영 |
| 9 | `prob_dist_6cols.xml` | **CHANGED** | NEW idx=18, row=2 col=6 유지. paraPrIDRef 12→10 반영 |
| 10 | `prob_dist_7cols.xml` | **CHANGED** | NEW idx=19, row=2 col=7 유지. paraPrIDRef 12→10 반영 |
| 11 | `normal_dist_4rows.xml` | **CHANGED** | NEW idx=22, row=6 col=2 유지. paraPrIDRef 4→3 반영 |
| 12 | `normal_dist_5rows.xml` | **CHANGED** | NEW idx=34, row=7 col=2 유지. paraPrIDRef 4→3 반영 |
| 13 | `normal_dist_3rows.xml` | **CHANGED** | NEW idx=39, row=5 col=2 유지. paraPrIDRef 4→3 반영 |
| 14 | `condition_rect_template.xml` | **UNCHANGED** | 수식 재생성 후 구조 동일 확인. BOM 제거(→UTF-8 BOM-less) |
| 15 | `header_area_template.xml` | **UNCHANGED** | 수동 구성 템플릿. IDs 모두 NEW header.xml에 유효. 재추출 불가 (§2 주석) |
| 16 | `content_hpf_template.xml` | **CHANGED** | image3~8 manifest 항목 추가. spine linear="yes" 이미 반영됨 |
| 17 | `empty_box_template.xml` | **UNCHANGED** | 진단 보고서 기준 UNCHANGED |
| 18 | `root_element.xml` / `settings.xml` / `version.xml` / `mimetype` | UNCHANGED (root_element.xml); 나머지는 §3 참조 | ZIP 보조 파일 |

**요약**: CHANGED 14 / UNCHANGED 4 / MISSING 0 / 실패 0

### 주석 — header_area_template.xml

이 파일은 실제 시험지 출력의 section0.xml 앞부분에서 수동으로 구성된 템플릿으로, yangshik section0에서 직접 슬라이스할 수 없다 (section0 내용이 다른 좌표/ID 체계를 가짐). 재추출 시도 결과:

1. 구조적 diff 없음 — 진단 §4에서 언급된 textheight 1000→1100 변경은 `Contents/masterpage0.xml` (§3에서 업데이트됨)에 있으며, header_area_template.xml에는 영향 없음.
2. 사용 중인 charPrIDRef {3,5,6,7,8}, paraPrIDRef {1,2} 모두 NEW header.xml에 유효.
3. paraPrIDRef=1 의미 변경 (CENTER→LEFT)은 실제 출력에서 LEFT로 렌더링되므로 오히려 정상화.

---

## 3. 부산물 폴더 처리

`build_hwpx.py`에서 `BASE/...` 직접 참조 확인:

```python
# build_hwpx.py:745-777 (실제 사용)
zout.write(f'{BASE}/mimetype', ...)
zout.write(f'{BASE}/version.xml', ...)
zout.write(f'{BASE}/Contents/header.xml', ...)
zout.write(f'{BASE}/BinData/image1.bmp', ...)
zout.write(f'{BASE}/Contents/masterpage0.xml', ...)
zout.write(f'{BASE}/BinData/image2.bmp', ...)
zout.write(f'{BASE}/settings.xml', ...)
zout.write(f'{BASE}/Preview/PrvImage.png', ...)
zout.write(f'{BASE}/META-INF/container.rdf', ...)
zout.write(f'{BASE}/META-INF/container.xml', ...)
zout.write(f'{BASE}/META-INF/manifest.xml', ...)
```

처리 결과:

| 폴더/파일 | 사용처 | 처리 |
|---|---|---|
| `Contents/header.xml` | build_hwpx.py:749 | **갱신** (NEW 양식지에서 추출, 146,961 B) |
| `Contents/masterpage0.xml` | build_hwpx.py:751 | **갱신** (NEW 양식지에서 추출, 23,980 B) |
| `BinData/image1.bmp` | build_hwpx.py:750 | **갱신** (NEW 양식지, 94,918 B — SHA256 동일) |
| `BinData/image2.bmp` | build_hwpx.py:752 | **갱신** (NEW 양식지, 359,714 B — SHA256 동일) |
| `BinData/image3~8.bmp` | 미직접 사용, 추출 목적 보존 | **갱신** (양식지 교체로 동기화) |
| `Preview/PrvImage.png` | build_hwpx.py:768 | **갱신** (NEW 미리보기, 84,191 B) |
| `Preview/PrvText.txt` | build_hwpx.py:없음, 완성도 목적 | **갱신** |
| `META-INF/container.rdf` | build_hwpx.py:771 | **갱신** (내용 동일 확인됨) |
| `META-INF/container.xml` | build_hwpx.py:776 | **갱신** (내용 동일) |
| `META-INF/manifest.xml` | build_hwpx.py:777 | **갱신** (내용 동일) |
| `mimetype` | build_hwpx.py:745 | **갱신** (내용 동일) |
| `settings.xml` | build_hwpx.py:765 | **갱신** (caret position 변경, 282 B) |
| `version.xml` | build_hwpx.py:746 | **갱신** (내용 동일 확인) |
| `root_element.xml` | 코드 주석에만 언급, 실제 미사용 | **보존** (미변경) |

---

## 4. ID 매핑 충돌 분석

### build_hwpx.py 하드코딩 ID 사용처

```
charPrIDRef 사용: 4, 5, 7
  build_hwpx.py:158 make_paragraph() 기본값 charPrIDRef="7"
  build_hwpx.py:291,295 answer_run charPrIDRef="5"
  build_hwpx.py:680,688 charPrIDRef="4"

paraPrIDRef 사용: 0, 1, 2
  build_hwpx.py:158 make_paragraph() 기본값 paraPrIDRef="1"
  build_hwpx.py:230,254,273,297,321,611,642 paraPrIDRef="1"
  build_hwpx.py:629,658,664 paraPrIDRef="2"
  build_hwpx.py:364 paraPrIDRef="0"
```

### charPrIDRef 충돌 분석

| ID | OLD 의미 | NEW 의미 | 충돌 |
|---|---|---|---|
| 4 | h=1000, #FFFFFF, bold=F | h=1000, #FFFFFF, bold=F | **없음** |
| 5 | h=1400, #000000, bold=T | h=1400, #000000, bold=T | **없음** |
| 7 | h=300, #000000, bold=F | h=300, #000000, bold=F | **없음** |

### paraPrIDRef 충돌 분석

| ID | OLD 의미 | NEW 의미 | 충돌 |
|---|---|---|---|
| 0 | LEFT, bfill=3 | LEFT, bfill=3 | **없음** |
| 1 | **CENTER**, tabPr=0, bfill=2 | **LEFT**, tabPr=1, bfill=1 | **있음 [HIGH]** |
| 2 | LEFT, tabPr=1, bfill=1 | LEFT, tabPr=2, bfill=1 | 실질 없음 (tab 정의 빈값) |

### 충돌 상세

`build_hwpx.py`에서 `paraPrIDRef="1"` 하드코딩 위치:
- `:158` make_paragraph() 기본값
- `:230, 254, 273` 문제 본문 p1, p2, p 문단
- `:297` 정답 라인 answer_p
- `:321` 해설 expl_xml
- `:611` 메인 문제 prob_p
- `:642` 조건 문단 cond_p

**영향**: OLD 양식지에서 paraPrIDRef=1 = CENTER 정렬 → NEW 양식지에서 paraPrIDRef=1 = LEFT 정렬로 변경.

**완화 요인**: 진단 보고서(§3.5) 분석 결과, OLD section0.xml 실사용에서 paraPrIDRef=1은 2,347회 중 단 1회 사용(나머지는 paraPrIDRef=0). builder가 paraPrIDRef=1을 쓰는 것이 사실상 LEFT를 의도한 것이었으면 오히려 정상화됨.

**Phase 5에서 확인 필요**: 출력 HWPX를 한컴에서 열어 문단 정렬이 CENTER가 되는 문제가 없는지 검증.

---

## 5. 검증 결과

### 5.1 XML 파싱 — 검증 방식 재정의

**원 명세(`03-base-hwpx-extraction.md` §4.6)는 단순 `ET.parse` 검증을 요구했으나, 이는 fragment XML에 부적절하다.** `build_hwpx.py` 사용 패턴을 분석하여 다음과 같이 재정의했다.

#### Direct ET.parse 결과

| 결과 | 파일 | 원인 |
|---|---|---|
| **PASS 3/20** | `content_hpf_template.xml`, `settings.xml`, `version.xml` | 자체 완전 XML 문서 (xmlns 선언 포함) |
| **FAIL 17/20** | 13개 tbl 템플릿 + `condition_rect`, `empty_box`, `header_area`, `root_element` | `unbound prefix` (xmlns 선언 없음) 또는 `no element found` (fragment) |

#### Builder 사용 패턴 분석

`build_hwpx.py` grep 결과:
- **String concat 사용** (자체 parse 안 함): `condition_rect:372`, `normal_dist_*:400`, `prob_dist_*:442`, `header_area:531`, `content_hpf:707`
- **ZIP에 직접 write**: `mimetype`, `version.xml`, `settings.xml`, `Contents/header.xml`, `Contents/masterpage0.xml`, `BinData/*`, `Preview/*`, `META-INF/*` (line 745-777)
- **builder가 fragment를 자체적으로 ET.parse하는 코드는 없음**

#### 적절한 검증: namespace wrap 후 parse

부모 컨텍스트(section0.xml)에서 사용되는 namespace 선언으로 wrap 후 parse:

```python
WRAP = '<root xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hh="..." xmlns:hc="...">'
ET.fromstring(WRAP + fragment + '</root>')
```

| 검증 | 결과 |
|---|---|
| `bogi_table_3items.xml` wrap-parse | PASS (rowCnt=4, colCnt=5, borderFillIDRef=12 추출 OK) |
| 백업본 동일 검증 | PASS (회귀 없음) |

**결론**: ET.parse 17/20 fail은 fragment XML의 정상 동작이며 회귀가 아니다. 진짜 정합성은 Phase 5의 builder 빌드 완주 + ZIP 무결성 + 한컴오피스 열기로 검증한다.

### 5.1.1 백업 비교 (회귀 신호 부재 확인)

| 파일 | NEW ET.parse | OLD(backup) ET.parse |
|---|---|---|
| 17개 fragment | FAIL (unbound prefix) | FAIL (unbound prefix, 동일) |
| 3개 완전 XML | PASS | PASS |

회귀 없음 확인.

### 5.2 행/열 수 검증

| 파일 | 기대 row | 기대 col | 실제 row | 실제 col | 결과 |
|---|---|---|---|---|---|
| bogi_table_3items.xml | 4 | 5 | 4 | 5 | OK |
| bogi_table_6items.xml | 7 | 7 | 7 | 7 | OK |
| proof_table_template.xml | 4 | 5 | 4 | 5 | OK |
| choice_table_9x4.xml | 9 | 4 | 9 | 4 | OK |
| choice_table_6x4.xml | 6 | 4 | 6 | 4 | OK |
| choice_table_6x3.xml | 6 | 3 | 6 | 3 | OK |
| choice_table_5x5.xml | 5 | 5 | 5 | 5 | OK |
| prob_dist_5cols.xml | 2 | 5 | 2 | 5 | OK |
| prob_dist_6cols.xml | 2 | 6 | 2 | 6 | OK |
| prob_dist_7cols.xml | 2 | 7 | 2 | 7 | OK |
| normal_dist_3rows.xml | 5 | 2 | 5 | 2 | OK |
| normal_dist_4rows.xml | 6 | 2 | 6 | 2 | OK |
| normal_dist_5rows.xml | 7 | 2 | 7 | 2 | OK |

**13/13 행/열 수 일치 OK**

### 5.3 폰트 ID 존재성 검증

NEW header.xml 기준 charPrIDRef (0~41), paraPrIDRef (0~29) 대조:

| 파일 | charPrIDRef 사용 | paraPrIDRef 사용 | 미존재 ID |
|---|---|---|---|
| bogi_table_3items.xml | {0,1,6,7} | {1,2,5,12,29} | 없음 |
| bogi_table_6items.xml | {0,1,6,7} | {1,2,3,5,13} | 없음 |
| proof_table_template.xml | {0,1,6,7} | {0,1,2,3} | 없음 |
| choice_table_9x4.xml | {1} | {0,3} | 없음 |
| choice_table_6x4.xml | {3,17,22} | {3,10} | 없음 |
| choice_table_6x3.xml | {3,17,22} | {3,10} | 없음 |
| choice_table_5x5.xml | {1} | {0} | 없음 |
| prob_dist_5cols.xml | {1} | {10} | 없음 |
| prob_dist_6cols.xml | {1} | {10} | 없음 |
| prob_dist_7cols.xml | {1} | {10} | 없음 |
| normal_dist_3rows.xml | {1,21,22} | {3,10} | 없음 |
| normal_dist_4rows.xml | {1,21} | {3} | 없음 |
| normal_dist_5rows.xml | {1,21,22} | {3,10} | 없음 |

**13/13 폰트 ID 존재성 OK**

---

## 6. Phase 5에서 점검할 항목

1. **paraPrIDRef=1 CENTER→LEFT 회귀**: build_hwpx.py에서 paraPrIDRef=1을 사용하는 모든 문단이 OLD 양식지에서 CENTER, NEW 양식지에서 LEFT로 렌더링되는지 확인. 특히 `make_paragraph()` 기본 호출, 문제 본문 p 문단, 정답 라인.
   - 위험도: MEDIUM (실사용에서 paraPrIDRef=1이 CENTER 의도였는지 불명확)
   - 대응 방안: 확인 후 paraPrIDRef="1" → paraPrIDRef="0" 일괄 변경 검토

2. **content_hpf_template.xml image3~8 추가**: builder가 image3~8을 BinData에 포함할 경우 manifest 충돌 없는지 확인.

3. **bogi_table paraPrIDRef 변경 확인**: bogi_table의 paraPrIDRef=29(NEW)가 bogi 셀 스타일에 적합한 값인지(CENTER,bfill=2 = OLD paraPrIDRef=1의 의미적 동등체) 확인.

4. **header_area_template.xml 재구성 이슈**: 현재 OLD 양식지 기반 수동 구성 템플릿을 NEW 기반으로 재구성하는 작업이 필요한지 결정. 특히 copyright 문구 변경("공동 작업 파일이므로..." → "이 자료를 무단으로...") 반영 여부.
