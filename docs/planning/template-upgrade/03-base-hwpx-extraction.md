# Phase 3 — base_hwpx 18개 템플릿 재추출

> **에이전트 미션 브리프**: Phase 2의 `diagnosis-report.md`를 기반으로, 신규 양식지에서 18개 base_hwpx XML을 다시 추출한다. 기존 파일은 백업 후 교체. ID 매핑 변경 시 builder 영향 점검 포함.

상위 문서: [00-overview.md](./00-overview.md)

## 1. 목표

신규 양식지(`[2025년08월10일].hwpx`)를 기준으로 다음을 갱신한다.

1. `.claude/skills/ngd-exam-create/base_hwpx/*.xml` 18개 템플릿 파일을 신규 양식지의 해당 영역에서 재추출.
2. 기존 파일은 `.backup-2022-05-20/` 디렉토리에 통째로 보존.
3. ID 매핑 변경(charPr/paraPr/borderFill)으로 인해 builder가 깨질 위험이 있는 곳을 식별하여 별도 보고.

## 2. 사전 조건

- **Phase 2 완료** (`docs/planning/template-upgrade/diagnosis-report.md` 존재).
- 신규 양식지가 `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`에 있음.
- `git status` 깨끗 (또는 base_hwpx/ 외에는 수정 사항 없음 — 변경 추적 용이성 위해).

## 3. 입력

| 항목 | 경로 |
|---|---|
| 신규 양식지 | `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` |
| 진단 보고서 | `/mnt/c/NGD/docs/planning/template-upgrade/diagnosis-report.md` |
| 기존 base_hwpx | `/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx/` |
| builder 코드 | `/mnt/c/NGD/build_hwpx.py` (특히 base_hwpx 사용 부분) |

## 4. 작업 단계

### 4.1 백업

```bash
SRC="/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx"
BAK="$SRC/.backup-2022-05-20"

# 백업이 이미 있으면 중단 (덮어쓰기 방지)
if [ -d "$BAK" ]; then
  echo "백업이 이미 존재합니다. 작업 중단." >&2
  exit 1
fi

mkdir -p "$BAK"
# 점잖게: 디렉토리 안의 모든 항목을 백업 디렉토리로 복사 (.backup-* 자기 자신 제외)
find "$SRC" -mindepth 1 -maxdepth 1 ! -name '.backup-*' -exec cp -a {} "$BAK/" \;
ls -la "$BAK" | head -30
```

검증: `$BAK`에 18개 XML + `BinData/`/`Contents/`/`META-INF/`/`Preview/` + `mimetype`/`root_element.xml`/`settings.xml`/`version.xml`이 있어야 한다.

### 4.2 진단 보고서 분석

`diagnosis-report.md` §6의 18개 매핑 표에서 각 행의 상태를 분류:

- **UNCHANGED**: 추출만 다시 해서 바이트 동일 확인. (정규화 비교)
- **CHANGED**: 신규 영역에서 추출. 기존 파일 덮어쓰기.
- **MISSING**: 신규 양식지에 없음. **삭제 금지**, 별도 보고 (§7 참조).

§3.5의 builder 영향 분석을 별도 메모. ID 매핑 변경이 있다면 §4.5에서 처리.

### 4.3 추출 알고리즘

신규 양식지에서 hp:tbl 단위로 잘라내는 표준 절차.

```python
import zipfile, re
import xml.etree.ElementTree as ET

NEW = '/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx'

def read_xml(path_in_zip):
    with zipfile.ZipFile(NEW) as z:
        return z.read(path_in_zip).decode('utf-8')

section = read_xml('Contents/section0.xml')

def find_table_by_marker(xml_str, marker_text, occurrence=1):
    """첫 셀 텍스트가 marker_text인 hp:tbl을 통째로 잘라 반환."""
    # diagnosis-report.md §5와 §6에서 식별한 마커 사용
    ...
```

각 템플릿마다 식별 마커는 Phase 2가 정해둔 값 사용. 식별 마커 예:

| 파일 | 마커 |
|---|---|
| `bogi_table_3items.xml` | hp:tbl with rowCnt=3, 첫 셀에 'ㄱ.' |
| `bogi_table_6items.xml` | hp:tbl with rowCnt=6, 첫 셀에 'ㄱ.' |
| `normal_dist_3rows.xml` | hp:tbl with rowCnt=4(헤더포함), 헤더에 'z' 'P(0≤Z≤z)' |
| `prob_dist_5cols.xml` | hp:tbl with colCnt=5, 헤더에 'X' 'P(X=x)' |
| `condition_rect_template.xml` | hp:rect 또는 borderFill 둘러싼 hp:p, '(가)' 텍스트 |
| `proof_table_template.xml` | hp:tbl, '증명' 또는 '(좌변)=(우변)' |
| `header_area_template.xml` | masterpage0.xml의 머릿말 hp:ctrl 영역 |
| `choice_table_NxM.xml` | hp:tbl rowCnt=N colCnt=M |
| `empty_box_template.xml` | borderFill 사각형, 빈 hp:p |

### 4.4 18개 파일 재생성

각 템플릿에 대해:

1. 신규 양식지의 해당 영역을 추출.
2. 기존 파일과 정규화 후 비교 (네임스페이스/instId 제외):
   ```python
   def normalize(xml_str):
       # zOrder, instId, id 등 매번 달라지는 속성 정규화
       xml_str = re.sub(r'\s+(zOrder|instId|id)="\d+"', '', xml_str)
       return xml_str
   ```
3. UNCHANGED면 신규 추출본으로 덮어쓰지 않음 (변경 없음 기록).
4. CHANGED면 신규 추출본으로 덮어쓰고 diff 요약 메모.
5. MISSING이면 기존 파일 보존, 추출 시도 안 함.

### 4.5 ID 매핑 마이그레이션

이게 Phase 3에서 가장 위험한 부분이다. 시나리오:

**시나리오 A: builder가 base_hwpx의 XML을 *그대로* 넣음**
- 신규 양식지의 header.xml과 base_hwpx XML의 charPrIDRef가 일치하면 OK.
- **확인 방법**: builder가 sample(또는 옛 양식지) 기준 ID를 사용하는지, 양식지(template) 기준 ID를 사용하는지 `build_hwpx.py`에서 grep.
  ```bash
  grep -nE "charPrIDRef|paraPrIDRef|borderFillIDRef" /mnt/c/NGD/build_hwpx.py | head -40
  ```

**시나리오 B: builder가 ID를 동적으로 매핑**
- 매핑 테이블이 어딘가에 있을 것. 그 테이블이 옛 양식지 기준이면 신규 매핑으로 갱신해야 함.

**시나리오 C: base_hwpx의 ID가 신규 양식지와 충돌**
- 가장 위험. 추출된 XML의 charPrIDRef=7이 신규 양식지에서 다른 의미를 가지면 글꼴/크기가 깨짐.
- 대응: 추출 직후 builder가 사용하는 charPrIDRef 매핑 표를 신규 기준으로 다시 작성하여 `docs/hwpx-pitfalls.md`에 추가, builder가 그 표를 참조하도록 변경 (이건 별도 이슈로 분리 권장).

본 페이즈는 *추출 자체*가 우선이고, 매핑 충돌은 발견 시 산출물 보고서에 명시한다. builder 코드 수정은 별도 페이즈가 아닌 별도 이슈로 분리하여 Phase 5에서 발견되는 회귀와 함께 처리.

### 4.6 추출 후 검증

각 신규 XML 파일에 대해:

1. **XML 파싱 가능 여부** (`xmllint` 또는 ET):
   ```bash
   for f in /mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx/*.xml; do
     python3 -c "import xml.etree.ElementTree as ET; ET.parse('$f')" || echo "FAIL: $f"
   done
   ```

2. **셀 수/행수 일치**: 기존 파일의 rowCnt/colCnt와 신규 파일의 rowCnt/colCnt가 같은지 (CHANGED인데 구조 자체가 깨졌는지 점검).

3. **폰트 ID 참조 일관성**: 추출된 XML에서 사용된 charPrIDRef가 신규 header.xml에 *존재하는* ID인지.

### 4.7 부산물(BinData/, Contents/, META-INF/, Preview/) 처리

`base_hwpx/` 안에는 18개 XML 외에 다음이 있다:

- `BinData/` 폴더
- `Contents/` 폴더
- `META-INF/` 폴더
- `Preview/` 폴더
- `mimetype`, `root_element.xml`, `settings.xml`, `version.xml`

이것들은 양식지 ZIP을 통째로 풀어둔 작업 사본일 가능성이 높다. 처리 방침:

1. `build_hwpx.py`에서 이 경로들이 *직접* 사용되는지 grep:
   ```bash
   grep -rnE "base_hwpx/(BinData|Contents|META-INF|Preview|mimetype|root_element|settings\.xml|version\.xml)" /mnt/c/NGD/build_hwpx.py /mnt/c/NGD/.claude/agents/ /mnt/c/NGD/ngd-studio/ 2>/dev/null
   ```
2. **사용처 있음** → 신규 양식지로부터 그 폴더/파일도 갱신 (zip extract).
3. **사용처 없음** → 기존 그대로 보존 (백업되어 있으니 안전), 신규로 갱신할 필요 없음.

진단 결과를 산출물 §3에 명시.

## 5. 산출물

### 5.1 디렉토리 구조 (after)

```
.claude/skills/ngd-exam-create/base_hwpx/
├── .backup-2022-05-20/      # ← 신규 (Phase 3에서 생성)
│   ├── bogi_table_3items.xml (구)
│   ├── ...
│   └── (전체 보존)
├── bogi_table_3items.xml    # ← 갱신
├── bogi_table_6items.xml    # ← 갱신
├── ... (18개)
└── (BinData/Contents/META-INF/Preview는 §4.7 결정에 따라)
```

### 5.2 보고서

다음 파일에 추출 결과 추가:

```
/mnt/c/NGD/docs/planning/template-upgrade/extraction-report.md
```

내용:

```markdown
# base_hwpx 재추출 보고서

## 1. 백업 위치
.claude/skills/ngd-exam-create/base_hwpx/.backup-2022-05-20/

## 2. 18개 템플릿 처리 결과
| # | 파일 | 상태 | 변경 요약 |
| 1 | bogi_table_3items.xml | UNCHANGED | bytes 동일 (정규화 후) |
| 2 | bogi_table_6items.xml | CHANGED   | rowCnt 6 → 6, 셀 텍스트 동일, charPrIDRef 0→0, paraPrIDRef 1→2 |
| ... |
| 17 | content_hpf_template.xml | CHANGED | <opf:item> 1개 추가 (...) |
| 18 | (보조 파일) | … | … |

## 3. 부산물 폴더 처리
- BinData/: 사용처 (있음/없음) → (보존/갱신)
- Contents/: …
- META-INF/: …
- Preview/: …

## 4. ID 매핑 충돌 분석
- builder의 charPrIDRef 사용처: build_hwpx.py:NNN, ...
- 신규 양식지 매핑과 일치/불일치 결과
- 불일치인 경우: 별도 이슈 #N (제목 + 영향 범위 요약)

## 5. 검증 결과
- 18개 XML 파싱 OK (예: 18/18 pass)
- 행/열 수 검증 OK
- 폰트 ID 존재성 검증 OK

## 6. Phase 5에서 점검할 항목
- (회귀 가능성 높은 템플릿 목록)
```

## 6. 검증 (Acceptance Criteria)

- [ ] 백업 디렉토리 `.backup-2022-05-20/`가 존재하고 기존 18개+보조파일 모두 들어있음
- [ ] 18개 XML 파일이 갱신되어 있음 (UNCHANGED 표시된 것은 미변경)
- [ ] 모든 XML이 `xml.etree.ElementTree.parse`로 에러 없이 파싱됨
- [ ] 행/열 수 검증 통과 (CHANGED인 템플릿도 구조 정합성 유지)
- [ ] `extraction-report.md` 5개 섹션 모두 채워짐
- [ ] ID 매핑 충돌 발견 시 별도 이슈 또는 보고서 §4에 명시
- [ ] `git diff --stat`이 base_hwpx/ + 보고서 외 다른 파일을 건드리지 않음

## 7. 주의사항

1. **MISSING 처리**: 신규 양식지에서 사라진 템플릿은 *삭제하지 않는다*. 보고서에 “MISSING (사용처: build_hwpx.py:NNN)” 명시. builder 사용처를 확인하여 `(a) 신규 대체본을 만들거나 (b) builder에서 해당 케이스 제거`를 별도 이슈로 분리.

2. **NEW 처리**: 신규 양식지에 추가된 템플릿은 본 페이즈 범위 밖. diagnosis-report에 NEW로 식별만 해두고, 별도 이슈로 분리.

3. **백업 디렉토리 이름**: `.backup-2022-05-20/`로 고정. 점(.) prefix로 git status에서 자연스럽게 구분되고, glob 무시도 쉬움. 절대 다른 이름 쓰지 말 것.

4. **section0.xml의 hp:tbl 식별**: 동일 마커가 여러 곳 등장할 수 있다 (예: 보기 ㄱ.ㄴ.ㄷ.은 양식지에 여러 페이지). 진단 보고서가 *몇 번째 occurrence*인지 명시했는지 확인. 없으면 양식지 페이지 순서대로 첫 번째를 우선 사용.

5. **정규화 비교에서 무시할 속성**: `zOrder`, `instId`, 일부 `id`(테이블 자체 id가 아닌 자동 발급 id), `cellAddr` 같은 위치 의존 속성. 단, charPrIDRef/paraPrIDRef/borderFillIDRef는 *반드시* 비교 대상에 포함.

6. **인코딩**: 모든 XML write는 `encoding='utf-8'`, **BOM 없이**. 한컴오피스가 BOM 있으면 깨지는 케이스 보고됨.

## 8. 함정

- ET가 직렬화하면 namespace prefix가 `ns0:`/`ns1:` 같이 바뀌어 builder가 못 읽는다. 추출 시 *원본 XML 텍스트를 그대로 슬라이스*해서 저장 (re/문자열 방식 추천). 절대 ET → tostring 하지 말 것.
- hp:tbl 안에 hp:tbl(중첩 테이블) 있을 수 있음. 시작/종료 태그 매칭으로 잘라내려면 깊이 카운트 필요.
- borderFill ID는 양식지마다 0부터 다시 매겨진다. base_hwpx 추출 후 이 값이 신규 header.xml의 borderFill 정의와 일치하는지 의미 단위로 검증.

## 9. 작업 시간 가이드

- 4.1 백업: 5분
- 4.2 진단 분석: 10분
- 4.3 추출 알고리즘 셋업: 15분
- 4.4 18개 추출: 30분
- 4.5 ID 매핑 분석: 20분
- 4.6 검증: 15분
- 4.7 부산물 처리: 15분
- 보고서 작성: 15분

총 ~125분.

## 10. 롤백

문제 발생 시:
```bash
SRC="/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx"
BAK="$SRC/.backup-2022-05-20"
# base_hwpx 복원 (백업에서 되돌리기) — 진단/.backup-* 자체는 보존
find "$SRC" -mindepth 1 -maxdepth 1 ! -name '.backup-*' -exec rm -rf {} +
cp -a "$BAK"/. "$SRC"/
```

## 11. 참조

- `/mnt/c/NGD/build_hwpx.py` (특히 `Generate data table using pre-extracted templates from 양식지` 함수)
- `/mnt/c/NGD/docs/hwpx-templates.md`
- `/mnt/c/NGD/docs/hwpx-pitfalls.md`
- `/mnt/c/NGD/.claude/skills/ngd-exam-create/sample_analysis.md`
- Phase 2 산출물: `/mnt/c/NGD/docs/planning/template-upgrade/diagnosis-report.md`
