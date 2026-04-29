# Phase 2 — 신규 양식지 진단

> **에이전트 미션 브리프**: 신규 양식지(`[2025년08월10일].hwpx`)를 옛 양식지(`[2022년5월20일].hwpx`)와 비교하여, ZIP 내부의 모든 변경점을 카탈로그화한다. 결과는 `diagnosis-report.md`에 정리하여 Phase 3·4·5의 입력으로 제공한다.

상위 문서: [00-overview.md](./00-overview.md)

## 1. 목표

다음 다섯 가지를 정량/정성적으로 진단한다.

1. **content.hpf** — 매니페스트 변동: 추가/삭제된 BinData 항목, 등록된 폰트/스타일 항목.
2. **header.xml** — 스타일 ID 매핑(charPr/paraPr/borderFill/style)의 변경. 특히 `charPrIDRef`/`paraPrIDRef`가 builder에서 어떻게 사용되는지와 충돌 여부.
3. **masterpage0.xml** — 머릿말/꼬릿말 구조·텍스트 변경.
4. **section0.xml** — 페이지 설정(secPr), 단원분류표(8p) 위치, 18개 base_hwpx 추출 대상 템플릿의 신규 위치(또는 부재).
5. **단원분류표(8p)** — 과목/단원/주제 텍스트 변경 여부 (Phase 4에서 활용).

## 2. 사전 조건

- Phase 1과 병렬 가능. Phase 1 완료 여부와 무관하게 시작할 수 있다.
- 양식지 파일 두 개가 모두 존재.
  - 옛: `/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`
  - 신: `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`
- Python 3 + `zipfile`, `xml.etree.ElementTree` 표준 라이브러리.
- (선택) `lxml`이 있으면 namespace 처리가 편하나 표준 ET로도 충분.

## 3. 입력

| 항목 | 경로 |
|---|---|
| 신규 양식지 | `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` |
| 옛 양식지 | `/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` |
| 기존 base_hwpx 18개 | `/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx/*.xml` (목록은 §6 참조) |
| 기존 단원분류표 | `/mnt/c/NGD/.claude/data/unit_classification.json` |
| 기존 분석 노트 | `/mnt/c/NGD/.claude/skills/ngd-exam-create/sample_analysis.md` |
| 기존 함정 노트 | `/mnt/c/NGD/docs/hwpx-pitfalls.md` |
| 기존 템플릿 명세 | `/mnt/c/NGD/docs/hwpx-templates.md` |

## 4. 작업 단계

### 4.1 ZIP 구조 비교 (확인용 — 이미 알려짐)

```bash
python3 - <<'PY'
import zipfile, hashlib
old = '/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx'
new = '/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx'
def listzip(p):
    with zipfile.ZipFile(p) as z:
        return {n.filename:(n.file_size, hashlib.sha256(z.read(n.filename)).hexdigest()[:12]) for n in z.infolist()}
a, b = listzip(old), listzip(new)
for k in sorted(set(a)|set(b)):
    if a.get(k) != b.get(k):
        print(k, a.get(k), '->', b.get(k))
PY
```

산출물 §7의 `# 1. ZIP 구조`에 결과 표 그대로 정리.

### 4.2 content.hpf 비교

```bash
python3 - <<'PY'
import zipfile
for label, p in [('OLD','/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx'),
                  ('NEW','/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx')]:
    with zipfile.ZipFile(p) as z:
        x = z.read('Contents/content.hpf').decode('utf-8')
    open(f'/tmp/content_hpf_{label}.xml', 'w').write(x)
PY
diff -u /tmp/content_hpf_OLD.xml /tmp/content_hpf_NEW.xml | head -100
```

- 추가/삭제된 `<opf:item>` 항목 모두 표로 정리 (id, href, media-type).
- 특히 BinData/, fonts, header, masterpage 등 중요 항목 변경 강조.

### 4.3 header.xml 진단 (가장 중요)

```bash
python3 - <<'PY'
import zipfile, xml.etree.ElementTree as ET
NS = {'hh':'http://www.hancom.co.kr/hwpml/2011/head'}
for label, p in [('OLD','/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx'),
                  ('NEW','/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx')]:
    with zipfile.ZipFile(p) as z:
        root = ET.fromstring(z.read('Contents/header.xml'))
    refs = root.find('hh:refList', NS)
    counts = {child.tag.split('}')[-1]: len(list(child)) for child in refs}
    print(label, counts)
PY
```

이어서 다음 4개 ID 매핑 표를 신/구 모두 추출하여 비교한다. 각 표는 `id, name, height, fontRef, ...` 등 builder가 참조할 만한 키를 포함.

#### a) charPr (글자 모양)
- id, height(pt), fontRef, textColor, italic, bold, underline 등.
- 기존 함정: `docs/hwpx-pitfalls.md:45` — 양식지/샘플 charPr 매핑 불일치로 글꼴 크기가 깨졌던 사례.
- **확인 항목**: charPrIDRef=0 (바탕글), 1 (제목), 2 (수식), 7 (특수) 등 builder에서 자주 쓰이는 ID들의 height/fontRef 값.

#### b) paraPr (문단 모양)
- id, align, indent, lineSpacing 등.

#### c) borderFill (테두리/채우기)
- id, borders(top/bottom/left/right), fillBrush.
- 특수 박스(rectangle, condition_rect 등) 추출 시 참조.

#### d) style (단락 스타일)
- id, name, charPrIDRef, paraPrIDRef.
- 바탕글/머리말/제목 등.

각 표에서:
- `ADDED` (신규에만 있음)
- `REMOVED` (구에만 있음)
- `CHANGED` (id 같으나 속성 다름)
- `UNCHANGED` (수치까지 동일)

비율도 함께 표시: 예) charPr 31개 → 45개 중 ADDED 14, CHANGED 5, UNCHANGED 26.

### 4.4 masterpage0.xml 비교

```bash
python3 - <<'PY'
import zipfile
for label, p in [...]:
    ...
    open(f'/tmp/master_{label}.xml','w').write(z.read('Contents/masterpage0.xml').decode('utf-8'))
PY
diff -u /tmp/master_OLD.xml /tmp/master_NEW.xml | head -200
```

- 머릿말/꼬릿말 영역에 들어간 텍스트, 셀 구조 변경 여부.
- `header_area_template.xml`(base_hwpx)의 출처가 여기일 수 있음 — 확인.

### 4.5 section0.xml 진단

신/구 section0.xml은 매우 크므로 (2MB) 전체 diff 대신 항목별 비교한다.

#### a) secPr (페이지 설정)
- 페이지 크기, 여백, 단 수, 머릿말 영역. 변경 시 표.

#### b) 18개 base_hwpx 템플릿의 위치
각 템플릿이 신규 양식지에 존재하는지, 어느 위치에 있는지 매핑.

```bash
python3 - <<'PY'
import zipfile, re
new = '/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx'
with zipfile.ZipFile(new) as z:
    sec = z.read('Contents/section0.xml').decode('utf-8')

# 각 템플릿의 식별자(예: bogi_table은 셀 콘텐츠 'ㄱ', 'ㄴ', 'ㄷ' 등)로 검색
markers = {
    'bogi_table_3items': ['<보기>'],   # 또는 ㄱ. ㄴ. ㄷ.
    'normal_dist': ['표준 정규분포', 'P(0≤Z'],
    'prob_dist': ['확률분포표'],
    'synthetic_division': ['조립제법'],
    'condition_rect': ['(가)', '(나)', '(다)'],
    # ... 18개 모두
}
for name, kws in markers.items():
    hits = [(kw, sec.find(kw)) for kw in kws]
    print(f'{name}: {hits}')
PY
```

위는 단순화한 예. 실제로는 `<hp:tbl>` 단위로 추출해 셀 수·텍스트 패턴 매칭으로 식별한다. 식별 알고리즘:

1. `<hp:tbl ... rowCnt="N" colCnt="M">` 단위로 모든 테이블을 추출.
2. 각 테이블의 첫 셀 텍스트 또는 캡션 텍스트로 분류.
3. 18개 base_hwpx 템플릿의 첫 셀 텍스트와 매칭.

#### c) 단원분류표(8p) 영역 식별
- 8페이지 구분 마커는 `<hp:pageBreak/>` 또는 페이지 전환 인디케이터.
- 또는 `'단원분류표'` 텍스트로 검색해서 그 직전·직후 hp:tbl을 추출.
- 추출한 텍스트를 줄별로 정리해 Phase 4의 입력으로 보존.

### 4.6 18개 템플릿 매핑 표

다음 18개 파일이 `.claude/skills/ngd-exam-create/base_hwpx/`에 있다. 각각이 신규 양식지의 어느 영역에서 추출되어야 하는지 1:1 매핑.

| # | 기존 파일 | 신규 양식지 내 위치 | 식별 마커 | 변경 |
|---|---|---|---|---|
| 1 | `bogi_table_3items.xml` | (조사 필요) | 보기 ㄱ.ㄴ.ㄷ. 3행 | UNCHANGED / CHANGED / MISSING |
| 2 | `bogi_table_6items.xml` | … | 보기 ㄱ~ㅂ 6행 | … |
| 3 | `choice_table_5x5.xml` | … | 5행 5열 보기 | … |
| 4 | `choice_table_6x3.xml` | … | 6행 3열 보기 | … |
| 5 | `choice_table_6x4.xml` | … | 6행 4열 보기 | … |
| 6 | `choice_table_9x4.xml` | … | 9행 4열 보기 | … |
| 7 | `condition_rect_template.xml` | … | (가)/(나)/(다) rectangle | … |
| 8 | `empty_box_template.xml` | … | 빈 사각형 | … |
| 9 | `header_area_template.xml` | masterpage0.xml | 머릿말 영역 | … |
| 10 | `normal_dist_3rows.xml` | … | 표준정규분포 3행 | … |
| 11 | `normal_dist_4rows.xml` | … | 표준정규분포 4행 | … |
| 12 | `normal_dist_5rows.xml` | … | 표준정규분포 5행 | … |
| 13 | `prob_dist_5cols.xml` | … | 확률분포표 5열 | … |
| 14 | `prob_dist_6cols.xml` | … | 확률분포표 6열 | … |
| 15 | `prob_dist_7cols.xml` | … | 확률분포표 7열 | … |
| 16 | `proof_table_template.xml` | … | 증명 테이블 | … |
| 17 | `content_hpf_template.xml` | content.hpf | 매니페스트 baseline | … |
| 18 | `root_element.xml` / `settings.xml` / `version.xml` / `mimetype` | (보조) | ZIP 조립 보조 | … |

각 항목에 대해:
- **UNCHANGED**: 신규 양식지의 해당 영역 XML이 기존 파일과 정확히 동일 (정규화 후 비교).
- **CHANGED**: 동일 위치에 있으나 셀 속성/텍스트가 달라짐. 차이 요약 기재.
- **MISSING**: 신규 양식지에 더이상 없음. Phase 3에서 builder 사용처 검토 필요.
- **NEW**: 신규 양식지에만 있는 새 템플릿. 추출 후보로 제안.

### 4.7 신규 양식지에 추가된 템플릿(NEW) 식별

신규 section0.xml의 모든 hp:tbl을 순회하며 옛 양식지에 없던 패턴을 발견하면 표에 추가한다. (예: 새 도형 박스, 새 표 양식)

## 5. 산출물

신규 파일 1개:

```
/mnt/c/NGD/docs/planning/template-upgrade/diagnosis-report.md
```

내용 구조:

```markdown
# 신규 양식지 진단 보고서

## 1. ZIP 구조 변화
(§4.1 결과 표)

## 2. content.hpf 변경
- 추가된 item: …
- 삭제된 item: …
- 속성 변경된 item: …

## 3. header.xml 변경
### 3.1 charPr ID 매핑
| id | OLD (height/font/...) | NEW | 분류 |
…
### 3.2 paraPr ID 매핑
…
### 3.3 borderFill ID 매핑
…
### 3.4 style ID 매핑
…
### 3.5 builder 영향 분석
- builder가 사용하는 charPrIDRef 0/1/2/7이 신규 양식지에서 어떤 의미로 매핑되는지 판정.
- 부적합한 경우 Phase 3 작업 시 수정 필요한 코드 위치 (예: `build_hwpx.py:NNN`).

## 4. masterpage0.xml 변경
- 머릿말 텍스트/구조 변경 요약
- header_area_template.xml 재추출 필요 여부

## 5. section0.xml 변경
### 5.1 secPr (페이지 설정)
…
### 5.2 단원분류표(8p) 위치 + 텍스트 추출 결과
(Phase 4 입력)

## 6. base_hwpx 18개 템플릿 매핑
| # | 파일 | 상태 | 신규 위치 | 비고 |
…

## 7. 신규 추가(NEW) 템플릿 후보
…

## 8. Phase 3 작업 권고
- 우선순위 [HIGH] CHANGED 템플릿 N개
- 우선순위 [MED]  ID 매핑 변경에 따른 builder 검토
- 우선순위 [LOW]  NEW 템플릿 추출 여부 결정 (별도 이슈로 분리 가능)

## 9. Phase 4 작업 권고
- 단원분류표 변경 여부 + 변경 항목 요약
```

## 6. 검증 (Acceptance Criteria)

- [ ] `diagnosis-report.md` 파일이 §5의 9개 섹션 모두 포함하여 생성됨
- [ ] §1~5의 각 표가 *수치* 기반으로 채워짐 (`(조사 필요)` 같은 미해결 항목 없음)
- [ ] §6의 18개 행이 모두 `UNCHANGED`/`CHANGED`/`MISSING` 중 하나로 분류됨
- [ ] §5.2의 단원분류표 텍스트가 raw로 보존됨 (Phase 4가 사용 가능)
- [ ] §3.5에 builder 영향 분석 결론(있음/없음 + 위치)이 명시됨

## 7. 주의사항

1. **section0.xml은 매우 큼**: 정규식 한 번에 다 검색하면 메모리/시간 폭증. hp:tbl 단위로 잘라서 처리하거나 SAX 사용.
2. **네임스페이스 주의**: HWPX는 `hp`, `hh`, `hc`, `opf` 등 다수 NS를 사용한다. ET로 검색 시 NS 매핑 누락하면 결과 0건.
3. **인코딩 통일**: 모든 read는 UTF-8. Windows에서 만들어진 파일이라 BOM이 있을 수 있음 (`utf-8-sig`로 강제).
4. **diff 노이즈**: 셀 ID(zOrder, instId)는 양식지마다 매번 다르게 발급되므로 의미 없는 차이로 잡힌다. 비교 시 이런 ID 필드는 정규화하여 제외.
5. **base_hwpx의 BinData/, Contents/, META-INF/ 폴더**: 이건 단일 추출 템플릿이 아니라 *기존에 통째로 풀어둔 양식지 ZIP 부산물*일 수 있다. 이 부분이 필요한지(빌더가 참조하는지) `build_hwpx.py`에서 grep으로 확인하여 보고서에 명시.

## 8. 함정

- ID 매핑이 *순서*만 다르고 의미는 같을 수 있음 → 단순 id 비교가 아닌 (height,fontRef) 튜플 매칭으로 의미적 동일성 판정.
- 신규 양식지에 추가된 charPr 14개가 어떤 용도인지 양식지 자체로는 알기 어렵다. 추정만 가능하면 추정으로 표시(`(추정) 보기 글자모양 - 진하기 보강`).

## 9. 작업 시간 가이드

- 4.1~4.2: 10분
- 4.3 (header): 20분 — 가장 무거움
- 4.4 (master): 5분
- 4.5: 30분 — section0의 hp:tbl 분류
- 4.6: 20분 — 18개 매핑
- 4.7: 10분
- 산출물 작성: 15분

총 ~110분.

## 10. 참조

- `/mnt/c/NGD/.claude/skills/ngd-exam-create/sample_analysis.md` (기존 양식지 구조 메모)
- `/mnt/c/NGD/docs/hwpx-pitfalls.md`
- `/mnt/c/NGD/docs/changelog.md` (charPrIDRef 매핑 사고 사례)
