# 양식지 교체 후속작업 — Phase 5 이후 잔여 이슈

> Phase 5(통합 검증)는 PASS — 회귀 0건으로 완료되었으나, 자동 검증 범위 외 / 양식지 교체와 무관한 잔여 이슈 2건이 식별되었다. 이 문서는 그 둘을 sonnet 에이전트 또는 사용자가 단독으로 처리할 수 있도록 정리한다.

상위 문서: [00-overview.md](./00-overview.md) · 진행: [06-checklist.md](./06-checklist.md)

---

## Issue #1 — paraPrIDRef=1 시각 정렬 확인 [양식지 교체 직접 영향]

### 배경

신규 양식지(`[2025년08월10일].hwpx`)에서 `paraPrIDRef=1`의 의미가 변경되었다.

| 양식지 | paraPrIDRef=1 정렬 |
|---|---|
| OLD (2022년5월20일) | **CENTER**, borderFillIDRef=2 |
| NEW (2025년08월10일) | **LEFT**, borderFillIDRef=1 |

`build_hwpx.py`의 다음 8개 위치에서 `paraPrIDRef="1"`을 하드코딩한다:
```
build_hwpx.py:158 (make_paragraph 기본값)
build_hwpx.py:230 (문제 본문 p1)
build_hwpx.py:254 (문제 본문 p2)
build_hwpx.py:273 (문제 단일 p)
build_hwpx.py:297 (정답 라인 answer_p)
build_hwpx.py:321 (해설 expl_xml)
build_hwpx.py:611 (메인 문제 prob_p)
build_hwpx.py:642 (조건 문단 cond_p)
```

Phase 5 빌드 결과 `section0.xml`에서 720회 사용됨.

### Phase 2 분석에서의 사전 추정

`diagnosis-report.md` §3.5에 따르면 OLD section0.xml에서 paraPrIDRef=1의 실사용 빈도는 단 1회(전체 2,347회 중). builder가 paraPrIDRef=1을 쓰는 것 자체가 양식지 내부 관례와 달랐으므로, NEW에서 LEFT로 바뀌어 오히려 한컴 렌더링이 정상화될 가능성이 있다 — 단, 시각 확인 필요.

### 검증 방법 (사용자 액션 필요)

WSL에서는 한컴오피스 직접 실행 불가. **Windows 환경**에서:

1. `/tmp/phase5_new_base.hwpx`를 Windows로 복사 (또는 다시 빌드)
   ```bash
   # WSL에서 다시 빌드하려면:
   cd /mnt/c/NGD && python3 build_hwpx.py
   # 산출물은 outputs/ 또는 명세 따라 /tmp/
   ```
2. 한컴오피스로 열기
3. 다음 항목 확인:
   - **문제 본문 문단 정렬**: 좌측 정렬이 자연스러운가, 아니면 가운데 정렬이 의도였던 것이 깨졌는가
   - **정답 라인** (`answer_p`): 정렬 이상 없는지
   - **해설** (`expl_xml`): 정렬 이상 없는지
   - **조건 박스** (`cond_p`): (가)/(나)/(다) 박스 안 정렬 정상인지

### 결과별 분기

#### 케이스 A: 정렬 정상 (예상 가능성 높음)

- `build_hwpx.py` 수정 없음
- 본 이슈 **CLOSED**
- `06-checklist.md` 후속 항목 [x]

#### 케이스 B: 정렬 깨짐 (CENTER 의도였던 것이 LEFT로 잘못 표시)

`build_hwpx.py`에서 `paraPrIDRef="1"`을 모두 `paraPrIDRef="0"`(LEFT, borderFillIDRef=3)으로 교체. 단 의미가 동일하므로 깨진 게 아니라면 그대로 둬도 무방.

만약 OLD CENTER 정렬을 유지하고 싶다면 NEW header.xml에서 `align=CENTER`인 paraPr ID를 찾아 매핑:
```bash
python3 -c "
import zipfile, xml.etree.ElementTree as ET
NS = {'hh':'http://www.hancom.co.kr/hwpml/2011/head'}
new = '/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx'
with zipfile.ZipFile(new) as z:
    root = ET.fromstring(z.read('Contents/header.xml'))
for pp in root.iter('{http://www.hancom.co.kr/hwpml/2011/head}paraPr'):
    align = pp.find('hh:align', NS)
    if align is not None and align.get('horizontal') == 'CENTER':
        print(pp.get('id'), 'CENTER')
"
```
출력된 ID로 8개 위치 일괄 교체 (Edit 도구, replace_all=False로 한 라인씩).

수정 후:
- 다시 빌드해 시각 재검증
- `build_hwpx.py` 변경분 별도 커밋
- 본 이슈 **CLOSED**

### 산출물

`build_hwpx.py` 수정 (필요 시) + 시각 검증 결과를 [06-checklist.md](./06-checklist.md) 후속 항목에 기록.

---

## Issue #2 — `build_hwpx.py` 메타데이터 하드코딩 [양식지 교체와 무관]

### 배경

Phase 5 빌드 중 발견. `build_hwpx.py`가 `info` 객체에서 받는 메타데이터의 *일부만* 사용하고 나머지는 단일 시험지(소명여고 04039 확통)에 맞춰 하드코딩되어 있다.

| 라인 | 변수 | 현재 값 | 원본 |
|---|---|---|---|
| `:17` | `EXAM_JSON` | `/tmp/exam_data.json` | 하드코딩 |
| `:29` | `SCHOOL_NAME` | `"소명여 고등학교"` | **하드코딩** (info.school 무시) |
| `:31` | `RANGE_STR` | `"조건부확률 ~ 통계적추정"` | **하드코딩** (info.range 무시) |
| `:733` | `code` | `"04039"` | 하드코딩 |
| `:734-735` | `filename` | `[고][2025][3-1-b][경기부천시][소명여고][확통][조건부확률-통계적추정][...]` | **하드코딩 전체** |

`info`에서 정상적으로 사용되는 것: `year`, `semester`, `exam_type`, `grade`, `subject` (line 28, 30).

### 영향

- `build_hwpx.py`를 다른 시험지에 재사용하려면 매번 본문 코드를 수정해야 함
- ngd-studio V3 파이프라인은 별도 빌더를 호출할 수 있으나, 본 스크립트가 단독 호출되는 케이스(Phase 5 같은 직접 실행)에서는 사실상 작동 불가
- 양식지 교체와는 무관 — 이전부터 있던 구조적 한계

### 우선순위

[LOW] — 양식지 교체로 인해 *새로 발생한* 회귀가 아니므로 이번 작업군 외부 이슈로 분리. 우선 `06-checklist.md`에 기록만 하고 차후 별도 PR로 처리.

### 수정 방향 (참고)

전부 `info`/`exam_data.json`에서 받도록 변경:

```python
# Before (line 29, 31, 733-735)
SCHOOL_NAME = "소명여 고등학교"
RANGE_STR = "조건부확률 ~ 통계적추정"
code = "04039"
filename = (f"[{code}][고][2025][3-1-b][경기부천시][소명여고][확통]"
            f"[조건부확률-통계적추정][{code}][그림1-0-1-0].hwpx")

# After (필드 추가 필요: school/range/region/code/semester_short/exam_type_short/figure_code/worker_code/checker_code)
SCHOOL_NAME = info["school"]
RANGE_STR = info["range"]
code = info["code"]
filename = (
    f"[{info['code']}][고][{info['year']}][{info['semester_short']}]"
    f"[{info['region']}][{info['school_short']}][{info['subject']}]"
    f"[{info['range_short']}][{info['code']}]"
    f"[{info.get('worker_code','')}][{info.get('checker_code','')}]"
    f"[{info.get('figure_code','')}].hwpx"
)
```

`exam_data.json` 스키마 확장 필요. reader 에이전트(`ngd-exam-reader.md`)에서 추출하도록 수정.

### 산출물 (이 이슈를 처리할 때)

- `build_hwpx.py` 수정
- `exam_data.json` 스키마 (`.claude/data/` 어딘가에 명세가 있다면) 동기화
- `ngd-exam-reader.md` 추출 항목 갱신
- 회귀 빌드 1회 (Phase 5 방식 그대로)

---

## 처리 순서 권고

1. **Issue #1 먼저** — 양식지 교체 직접 영향. 사용자가 한컴오피스 시각 확인 → 케이스 A 가능성 높음 → CLOSED 처리.
2. **Issue #2는 별도 작업** — 양식지 교체 작업군 외부. 시간 여유 있을 때 별도 PR로 처리.

Issue #1이 케이스 B로 판정되면, 시각적으로 깨진 시험지가 이미 만들어졌을 가능성이 있으므로 우선 처리 필수.

## 참조

- 양식지 교체 작업군 5개 페이즈 보고서:
  - `diagnosis-report.md` §3.5 (paraPrIDRef 충돌 분석)
  - `extraction-report.md` §4 (ID 매핑 마이그레이션)
  - `integration-report.md` §4 (paraPrIDRef=1 영향 분석) §5 (회귀 비교)
- 백업: `.claude/skills/ngd-exam-create/base_hwpx/.backup-2022-05-20/`
- 산출 HWPX (재빌드 가능): `python3 /mnt/c/NGD/build_hwpx.py` 단, EXAM_JSON 경로 확인
