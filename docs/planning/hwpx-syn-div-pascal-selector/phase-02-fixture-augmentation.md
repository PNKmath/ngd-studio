---
phase: 2
title: 부족 fixture 보강 — syn_div / Pascal 신규 추가
status: pending
depends_on: [1]
scope:
  - resources/hwpx_base/
intervention_likely: true
intervention_reason: "추가할 fixture 의 출처 (사용자 본 vs 신규 작성) 와 fixture 별 표현 변형 (display_form, 중첩 횟수 등) 결정은 사용자 양식지 관행을 알아야 가능."
---

# Phase 2: 부족 fixture 보강

> **범위**: Resources (fixture XML)
> **난이도**: M
> **의존성**: Phase 1 (gap_analysis.md)
> **영향 파일**: `resources/hwpx_base/synthetic_division_template_N.xml` (신규), `resources/hwpx_base/Pascal_triangle_N.xml` (신규)

## 배경

Phase 1 gap_analysis.md 에서 식별된 부족 케이스를 메우는 fixture 추가 작업. 출처는 다음 중 하나:

1. **사용자 authoritative 본** — 사용자 양식지 HWPX 안에 해당 케이스가 있으면 추출 후 ref remap (hwpx-fixture-ref-resolution 의 fixture_remap.py 재사용)
2. **신규 작성** — 사용자 본에 없는 케이스는 기존 fixture 를 복제 후 cell 구조/내용 수정

사용자 결정 필요 — 어떤 케이스를 어떤 방식으로 채울지.

## 설계

### 작업 흐름

1. Phase 1 gap_analysis.md 의 부족 케이스 목록 검토.
2. 사용자에게 우선순위 + 출처 결정 받기 — phase 시작 직후 한 번에.
3. 결정된 fixture 를 `resources/hwpx_base/` 에 추가:
   - 사용자 본 출처: `/tmp/showcase_extracted/<name>.xml` (또는 사용자 제공 hwpx 압축 풀어 추출) → `fixture_remap.py` 적용 → 저장
   - 신규 작성: 가장 가까운 기존 fixture 를 복제 후 cell 구조 조정 (cellSpan/rowCnt/colCnt 등)
4. 추가된 fixture 의 ref 가 우리 header 범위 내 (paraPr≤29, charPr≤41, borderFill≤81) 인지 검증.
5. Phase 1 gap_analysis.md 갱신 — 추가된 fixture 항목을 "충족" 으로 표시.

### 명명 규칙

- syn_div 추가분: 기존 _1~_4 다음 번호. 예: 5회 중첩 → `synthetic_division_template_5.xml` (rowCnt=16 예상)
- Pascal 추가분: `Pascal_triangle_4.xml`, `Pascal_triangle_5.xml`, ... 또는 `Pascal_triangle_binomial.xml` 같은 display_form suffix

worker 와 사용자가 phase 시작 시 명명 컨벤션 합의.

## 체크리스트

- [ ] Phase 1 gap_analysis.md 의 부족 케이스 목록을 사용자와 함께 검토, 추가 대상 fixture N개 확정
- [ ] 각 신규 fixture 를 `resources/hwpx_base/` 에 추가 (사용자 본 추출 + remap 또는 신규 작성)
- [ ] 추가된 fixture 의 ref 가 우리 header 범위 내인지 assert (paraPr≤29, charPr≤41, borderFill≤81)
- [ ] gap_analysis.md 갱신 — 추가된 케이스를 "충족" 으로 마킹 + 추가된 fixture 의 cell 구조 매트릭스 보완

## 영향 범위

- `resources/hwpx_base/` 에 신규 XML N개 추가. 기존 fixture 수정 없음.
- Phase 4 selector 함수가 새 fixture 도 분기 대상으로 인식하도록 fixture 이름 컨벤션 일관성 유지.
- 신규 fixture 가 user-range ref 를 가지면 `tools/fixture_remap.py --src ... --dst resources/hwpx_base/<new>.xml` 로 remap.

## 검증

```bash
# 신규 fixture XML well-formed
for f in resources/hwpx_base/synthetic_division_template_*.xml resources/hwpx_base/Pascal_triangle_*.xml; do
  python3 -c "
import re
txt = open('$f').read()
# 간단한 well-formed 확인 — tbl 태그 열림/닫힘
assert txt.count('<hp:tbl') == txt.count('</hp:tbl>'), f'unbalanced tbl: $f'
print('OK', '$f', 'rowCnt=', re.search(r'rowCnt=\"(\d+)\"', txt).group(1))
"
done

# ref 범위 검사
python3 -c "
import re, glob
OUR_MAX = {'paraPrIDRef': 29, 'charPrIDRef': 41, 'borderFillIDRef': 81}
for f in sorted(glob.glob('resources/hwpx_base/synthetic_division_template_*.xml') + glob.glob('resources/hwpx_base/Pascal_triangle_*.xml')):
    txt = open(f).read()
    for attr, omax in OUR_MAX.items():
        vals = [int(v) for v in re.findall(rf'{attr}=\"(\d+)\"', txt)]
        if vals and max(vals) > omax:
            print(f'OUT_OF_RANGE: {f} {attr} max={max(vals)}')
            break
    else:
        continue
"

# gap_analysis.md 갱신 확인
grep -c "충족\|covered" docs/planning/hwpx-syn-div-pascal-selector/gap_analysis.md
```

검증 통과 조건: 신규 fixture 모두 well-formed + ref 우리 header 범위 + gap_analysis.md 에 충족 표시.
