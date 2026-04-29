# Phase 4 — 단원분류표(`unit_classification.json`) 재검증

> **에이전트 미션 브리프**: 신규 양식지 8페이지 단원분류표를 텍스트 추출하여 기존 `unit_classification.json`과 비교, 차이점이 있으면 JSON을 갱신한다. `source` 필드는 Phase 1에서 이미 갱신되었을 수도 있으나 본 페이즈에서 최종 확정.

상위 문서: [00-overview.md](./00-overview.md)

## 1. 목표

`/mnt/c/NGD/.claude/data/unit_classification.json`을 신규 양식지 기준으로 갱신한다.

- `source` 필드를 신규 양식지 경로로 갱신.
- 신규 양식지의 8p 단원분류표 텍스트와 JSON 본문(과목별 units/topics)이 1:1로 일치하도록 동기화.
- 변경 항목이 발견되면 표로 정리.

이 JSON은 builder가 단원 태그 [중단원]을 출력할 때 “정규 단원명”을 결정하는 단일 소스다 (`docs/guidelines-filename.md:35` 참조). 따라서 양식지와 어긋나면 단원 태그가 비표준이 된다.

## 2. 사전 조건

- **Phase 2 완료**: `diagnosis-report.md` §5.2에 신규 양식지 8p 단원분류표 raw 텍스트가 추출되어 있어야 한다.
- **Phase 1과 독립적**: Phase 1에서 source 필드를 이미 갱신했더라도 본 페이즈에서 다시 확인·갱신 가능.

## 3. 입력

| 항목 | 경로 |
|---|---|
| 기존 JSON | `/mnt/c/NGD/.claude/data/unit_classification.json` |
| 신규 양식지 | `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` |
| 진단 보고서 §5.2 | `/mnt/c/NGD/docs/planning/template-upgrade/diagnosis-report.md` |
| (참고) 기존 양식지 | `/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` |

## 4. 작업 단계

### 4.1 신규 양식지에서 단원분류표 텍스트 추출

방법은 둘 중 하나:

**방법 A: section0.xml에서 추출 (권장 — Phase 2 진단 결과 재활용)**

```python
# diagnosis-report.md §5.2의 raw 텍스트 사용
```

**방법 B: HWPX → PDF → 8페이지 텍스트 추출 (보조 검증)**

`PyMuPDF`로 PDF 변환 후 `page.get_text()` 사용. 다만 양식지에서 PDF로 변환하는 것은 한컴오피스 의존이라 까다로움. 실무에서는 방법 A로 충분.

추출된 텍스트는 `/tmp/new_unit_classification.txt`에 저장.

### 4.2 기존 JSON 파싱

```python
import json
with open('/mnt/c/NGD/.claude/data/unit_classification.json', encoding='utf-8') as f:
    data = json.load(f)

print(data['version'])     # "2015 개정교육과정"
print(data['source'])
for s in data['subjects']:
    print(f"[{s['code']} {s['name']} {s['grade']}학년]")
    for u in s['units']:
        print(f"  {u['code']} {u['name']}: {u['topics']}")
```

### 4.3 신규 양식지 8p와 JSON 비교

다음 차원에서 1:1 비교:

| 차원 | 비교 항목 | 검증 방법 |
|---|---|---|
| 과목 | `code`, `name`, `grade` | 양식지 8p 표의 “과목” 컬럼 |
| 단원 | `code`(A/B/C/...), `name` | 양식지 8p 표의 “대단원” 컬럼 |
| 주제 | `topics[]` 순서/내용 | 양식지 8p 표의 “중단원” 컬럼 (또는 “주제”) |

차이 분류:

- **UNCHANGED**: 글자 1개까지 동일.
- **REORDERED**: 같은 항목 집합이나 순서가 다름 → 양식지 순서로 맞춤.
- **RENAMED**: 같은 위치에 표기만 다름 (예: `유리식과 유리함수` ↔ `유리함수`) → **양식지 표기 그대로** 채택.
- **ADDED**: 양식지에 있고 JSON에 없음 → JSON에 추가.
- **REMOVED**: JSON에 있고 양식지에 없음 → JSON에서 제거.

### 4.4 JSON 갱신

위 분석 결과를 반영하여 JSON을 다시 쓴다.

```python
import json, copy
new_data = copy.deepcopy(data)
new_data['source'] = "ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx (8페이지 단원분류표)"

# 필요 시 version도 갱신 (양식지가 새 교과과정으로 바뀐 경우)
# new_data['version'] = "2022 개정교육과정"  ← 양식지가 명시한 경우만

# subjects/units/topics 동기화 (분석 결과 반영)
...

# 저장: 인덴트 2, ensure_ascii=False (한글 보존)
with open('/mnt/c/NGD/.claude/data/unit_classification.json', 'w', encoding='utf-8') as f:
    json.dump(new_data, f, ensure_ascii=False, indent=2)
    f.write('\n')  # POSIX EOL
```

### 4.5 사후 검증

```bash
# 1) JSON validity
python3 -c "import json; json.load(open('/mnt/c/NGD/.claude/data/unit_classification.json', encoding='utf-8'))"

# 2) source 필드 확인
python3 -c "import json; d=json.load(open('/mnt/c/NGD/.claude/data/unit_classification.json', encoding='utf-8')); print(d['source'])"

# 3) 과목/단원/주제 카운트 확인 (변경 전후 출력)
python3 -c "
import json
d = json.load(open('/mnt/c/NGD/.claude/data/unit_classification.json', encoding='utf-8'))
total_topics = sum(len(u['topics']) for s in d['subjects'] for u in s['units'])
total_units = sum(len(s['units']) for s in d['subjects'])
print(f'subjects={len(d[\"subjects\"])}, units={total_units}, topics={total_topics}')
"
```

기존값(작업 시점에 측정)과 비교하여 변화량 보고.

## 5. 산출물

### 5.1 갱신 파일

```
/mnt/c/NGD/.claude/data/unit_classification.json   ← 갱신 (또는 미변경)
```

### 5.2 보고서

```
/mnt/c/NGD/docs/planning/template-upgrade/unit-classification-report.md
```

내용:

```markdown
# 단원분류표 검증 보고서

## 1. source 필드 변경
- 변경 전: inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx (8페이지 단원분류표)
- 변경 후: ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx (8페이지 단원분류표)

## 2. version 필드
- 변경 전: 2015 개정교육과정
- 변경 후: (그대로 / 새 표기) — 양식지 명시 여부에 따름

## 3. 과목별 변경 요약
| 과목 | 변경 유형 | 상세 |
| 수상 (고1) | UNCHANGED | … |
| 수1 (고2) | RENAMED | "지수와 로그" → "지수와 로그함수" 등 |
| ... |

## 4. 항목 카운트
| 차원 | 변경 전 | 변경 후 |
| subjects | N | M |
| units | A | B |
| topics | X | Y |

## 5. 양식지와의 1:1 일치 검증
- 8p 단원분류표 raw 텍스트 (참조: diagnosis-report.md §5.2)
- JSON과의 매칭 결과: 100% (또는 차이 항목 별도 표시)

## 6. builder 영향
- 본 변경으로 인해 *기존* 시험지의 [중단원] 태그가 변할 수 있는 항목 (RENAMED 케이스)
- 과거 작업 결과물에는 옛 표기 그대로 두는 것이 원칙 (이력 보존)
```

## 6. 검증 (Acceptance Criteria)

- [ ] `unit_classification.json`이 valid JSON
- [ ] `source` 필드가 신규 양식지 경로로 갱신됨
- [ ] 신규 양식지 8p의 과목/단원/주제와 JSON이 1:1 일치
- [ ] 변경 항목이 있다면 모두 §3 표에 분류되어 보고서에 기록됨
- [ ] 변경 없으면 “UNCHANGED”로 명시 (보고서가 비어있지 않음)
- [ ] 파일 EOL이 LF (CRLF로 저장되지 않음)

## 7. 주의사항

1. **표기 충돌 시 양식지가 우선**: JSON과 양식지 표기가 다르면 *항상 양식지로 맞춘다*. JSON은 양식지의 미러일 뿐.
2. **이력 보존**: `data/jobs/*.json` 안의 옛 단원명은 그대로 둔다 (Phase 1 원칙과 동일).
3. **공백/특수문자 주의**: 양식지에서 추출한 텍스트에 NBSP(` `), zero-width space, 전각 공백 등이 섞여 있을 수 있음. 정규화 후 비교:
   ```python
   import unicodedata, re
   def norm(s): return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s)).strip()
   ```
4. **`code` 보존**: A/B/C/... 한 글자 코드는 builder가 파일명/태그에 사용하므로 함부로 바꾸면 회귀. 양식지에 같은 항목이 그대로 있으면 코드도 유지.
5. **`grade` 정수**: 1, 2, 3 정수로만 (학년). 문자열 변환 금지.
6. **순서 의미 있음**: subjects/units/topics 배열 순서는 양식지 표 순서를 따른다 (UI 노출 순서 동일).

## 8. 함정

- 한 단원이 양식지 표에서 두 줄에 걸쳐 표기될 수 있음 (예: `유리식과 유리함수` 가 줄바꿈으로 분리). 텍스트 추출 시 줄바꿈으로 끊기지 않도록 셀 단위 추출 필요.
- 신규 양식지가 *교과과정 자체*가 바뀐 경우 (2015→2022), 과목 코드/이름이 통째로 다를 수 있다. 이 경우 단순 갱신을 넘어 “스키마 호환성 검토”가 필요하므로 본 페이즈를 중단하고 별도 이슈로 보고.
- `code`는 양식지 표의 “과목” 약칭(수상/수1/수2/미적/확통/기벡/...)과 정확히 일치해야 builder가 작동.

## 9. 작업 시간 가이드

- 4.1: 5분 (Phase 2 결과 재활용)
- 4.2: 5분
- 4.3: 30분 — 가장 시간 들음
- 4.4: 15분
- 4.5: 5분
- 보고서: 10분

총 ~70분.

## 10. 참조

- `/mnt/c/NGD/.claude/data/unit_classification.json` (현재 데이터)
- `/mnt/c/NGD/docs/guidelines-filename.md` (단원명 사용 규칙)
- `/mnt/c/NGD/docs/planning/template-upgrade/diagnosis-report.md` §5.2
