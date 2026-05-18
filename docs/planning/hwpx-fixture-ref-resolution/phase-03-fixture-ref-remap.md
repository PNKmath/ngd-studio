---
phase: 3
title: 사용자 fixture ref 인덱스 재매핑 + 일괄 적용
status: completed
depends_on: [2]
scope:
  - resources/hwpx_base/
  - tools/fixture_remap.py
intervention_likely: true
intervention_reason: "fixture 18개 일괄 교체 — 잘못 매핑 시 광범위 회귀. 매핑 표 검토 후 적용 승인 필요."
---

# Phase 3: 사용자 fixture ref 재매핑 + `resources/hwpx_base/` 일괄 적용

> **범위**: Backend (Python tool) + Resources (fixture XML)
> **난이도**: L
> **의존성**: Phase 2 (mapping.json)
> **영향 파일**: `resources/hwpx_base/*.xml` (18개 기존 + 11개 신규 — 신규는 이미 commit, 기존만 본 phase 대상), `tools/fixture_remap.py` (신규)

## 배경

사용자 authoritative 본 `_TEMPLATE_SHOWCASE_fixed.hwpx` 의 fixture 들은 한컴 GC 후 ref 인덱스가 우리 header.xml 기준으로 어긋난 상태. Phase 2 mapping.json 으로 자동 재매핑한 뒤 `resources/hwpx_base/` 에 일괄 적용한다.

**대상 fixture 한정 (Phase 2-3 사이 sanity check 결과)**: `resources/hwpx_base/*.xml` 중 ref 가 user header 범위 (paraPr ≤ 11 / charPr ≤ 20 / borderFill ≤ 60) 에 모두 들어가는 **18개** 만 remap 대상. 나머지 10개는 이미 our-range ID 를 포함 (hand-edited 또는 이전 partial remap 흔적 추정) → 무차별 remap 시 회귀 위험. **본 phase 에서는 제외**, 향후 별도 분석.

### Remap 대상 18개 (user-range only)

- `bogi_table_4items`, `Pascal_triangle_1~3`, `ganada_table`, `increase_decrease_template_3x/4x`, `synthetic_division_template_1~4` (← `813f736` 신규 11개, 전부 user-range)
- `choice_table_5x5`, `choice_table_9x4`, `empty_box_template`, `prob_dist_5cols/6cols/7cols`, `proof_table_template` (← 기존 7개)

### Remap 제외 10개 (our-range 포함, untouched)

`bogi_table_3items`, `bogi_table_6items`, `choice_table_6x3`, `choice_table_6x4`, `increase_decrease_template`, `increase_decrease_template_2x`, `normal_dist_3rows/4rows/5rows`, `synthetic_division_template`

이들은 paraPr 29 / charPr 22, 25 / borderFill 39, 67 같이 user header 에 존재하지 않는 id 를 이미 사용 중. mapping.json 적용 시 의도와 다른 결과 발생 가능. Phase 5 시각 검증 시 별도 케이스로 평가.

## 설계

### 도구: `tools/fixture_remap.py`

```python
"""
fixture_remap.py — 사용자 fixture 의 ref 인덱스를 우리 header 기준으로 변환

사용:
  python3 tools/fixture_remap.py \\
      --mapping /tmp/mapping.json \\
      --src /tmp/showcase_extracted/<name>.xml \\
      --dst resources/hwpx_base/<name>.xml \\
      [--dry-run]

동작:
  1. src XML 읽기
  2. mapping.json 의 user→ours 매핑 적용:
     - paraPrIDRef="N" → paraPrIDRef="mapped(N)"
     - charPrIDRef="N" → charPrIDRef="mapped(N)"
     - borderFillIDRef="N" → borderFillIDRef="mapped(N)"
  3. ref 가 매핑 안 되는 (Unmapped) 경우 — 경고 출력 + 원본 값 유지 (또는 사용자가 지정한 fallback)
  4. dry-run: 변환 결과만 stdout, 파일 안 씀
  5. 정상 실행: dst 에 atomic write
```

### 일괄 적용 스크립트

```python
# tools/fixture_remap_all.py
# 18개 user-range only fixture만 remap. our-range 포함 10개는 untouched (배경 참조).
FIXTURES = [
    # 813f736 신규 11개 (전부 user-range)
    "bogi_table_4items.xml",
    "ganada_table.xml",
    "increase_decrease_template_3x.xml", "increase_decrease_template_4x.xml",
    "synthetic_division_template_1.xml", "synthetic_division_template_2.xml",
    "synthetic_division_template_3.xml", "synthetic_division_template_4.xml",
    "Pascal_triangle_1.xml", "Pascal_triangle_2.xml", "Pascal_triangle_3.xml",
    # 기존 7개 (user-range)
    "choice_table_5x5.xml", "choice_table_9x4.xml",
    "empty_box_template.xml",
    "prob_dist_5cols.xml", "prob_dist_6cols.xml", "prob_dist_7cols.xml",
    "proof_table_template.xml",
]

for name in FIXTURES:
    src = f"/tmp/showcase_extracted/{name}"
    dst = f"resources/hwpx_base/{name}"
    fixture_remap.remap(src, dst, mapping_path="/tmp/mapping.json")
```

### 대상 사전 검증 (worker 가 적용 전 반드시 수행)

Remap 시작 전, 대상 18개 각각이 정말 user-range only 인지 재확인 (worker 가 spec 의 분류를 맹신하지 않도록):

```python
USER_MAX = {'paraPrIDRef': 11, 'charPrIDRef': 20, 'borderFillIDRef': 60}
for name in FIXTURES:
    txt = open(f"resources/hwpx_base/{name}").read()
    for attr, umax in USER_MAX.items():
        vals = [int(v) for v in re.findall(rf'{attr}="(\d+)"', txt)]
        assert not vals or max(vals) <= umax, f"{name} {attr} max={max(vals)} > {umax} — out of user-range, remap 제외 대상"
```

위 assertion 이 깨지면 spec 의 분류가 잘못된 것 — worker 는 `needs_user` 로 보고하고 중단.

### Placeholder 재주입

`empty_box_template.xml` 은 빌더 코드가 `{{RECT_ID}}`, `{{ZORDER}}`, `{{HEIGHT}}`, `{{CENTER_Y}}`, `{{SCA_Y}}`, `{{INST_ID}}`, `{{ITEMS_CONTENT}}` placeholder 를 치환한다. 사용자 본은 한컴 저장 시 placeholder 가 구체 값으로 대체된 상태. 재매핑 후 placeholder 를 다시 주입 필요:

- RECT_ID, INST_ID, ZORDER → 정수 자리에 정확히 placeholder 복원
- HEIGHT, CENTER_Y, SCA_Y → 빌더가 동적 계산하므로 placeholder 복원
- ITEMS_CONTENT → `<hp:subList>...</hp:subList>` 안 본문을 placeholder 로 치환

복원 패턴은 현재 `resources/hwpx_base/empty_box_template.xml` 원본 (git HEAD) 을 참고해 위치 식별.

(`condition_rect_template.xml` 은 ref 가 없어 remap 대상에서 자동 제외 — 본 phase 무영향.)

### Unmapped ref 처리 정책

Phase 2 mapping.md 의 Unmapped 항목 — fixture 가 참조하지만 우리 header 에 대응 정의 없음:

| 카테고리 | Unmapped user idx | fixture 가 실제 참조하는가 | 정책 |
|----------|-------------------|---------------------------|------|
| paraPr | 3, 4, 8, 9 | 3, 4, 8 참조 | **fallback = align 동일한 가장 가까운 our 정의**. worker 가 user 정의 본문을 읽어 align 추출 후 our paraPr 중 같은 align 의 첫 항목으로 매핑. 결정 못 하면 `our[0]` (LEFT 기본). |
| charPr | 3, 7, 9, 10, 11 | 3, 7, 10, 11 참조 | **fallback = bold/strikeout/font 동일한 가장 가까운 our 정의**. 흰색 텍스트 (user[3,10] 등) → our 에 없으면 `our[0]` 으로 두되 fixture 별 메모 기록. |
| borderFill | 5, 21, 34, 35, 36, 40 | 6건 모두 참조 | **fallback = 4-side border 패턴 일치 여부 + fill 무시한 매칭**. 없으면 `our[1]` (단순 경계 없는 fill). |

worker 는 각 fallback 적용 시 `unmapped_fallback.log` 에 한 줄씩 기록 (예: `bogi_table_4items.xml paraPrIDRef user[3] → our[0] (fallback: align=LEFT 일치)`). Phase 5 시각 검증 시 사용자 참조.

### 안전장치 (intervention_likely true 의 근거)

- 일괄 적용 전에 `--dry-run` 모드로 변환된 fixture 미리보기
- 각 fixture 의 변환 전후 ref 분포 (예: `paraPrIDRef counts: {1:5, 2:6, ...} → {0:5, 1:6, ...}`) 를 출력
- 사용자가 mapping.md + dry-run 결과 검토 후 승인 → 실제 적용
- 적용 후 git diff 로 변경 범위 확인 가능

## 체크리스트

- [x] 대상 사전 검증 — 18개 fixture 의 ref 가 모두 user-range 임을 assert
- [x] `tools/fixture_remap.py` 구현 — 단일 fixture 변환 + dry-run + Unmapped fallback (위 정책표대로) + `unmapped_fallback.log`
- [x] `tools/fixture_remap_all.py` 구현 — 18개 fixture 일괄 변환 (또는 fixture_remap.py 에 batch 옵션)
- [x] placeholder 재주입 로직 구현 (`empty_box_template.xml`)
- [x] dry-run 실행 후 변환 요약 + Unmapped fallback 로그 출력
- [x] 18개 fixture 모두 `resources/hwpx_base/` 에 실제 적용
- [x] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` 정상 빌드 + validate 통과 (회귀 없음 확인 — selector 분기 아직 없으니 기존 사용 fixture 만 검증)

## 영향 범위

- 18개 fixture 파일 교체 (user-range only). 나머지 10개 (our-range 포함) 는 untouched.
- 빌더 코드 변경 없음 (selector 는 Phase 4)
- 기존 빌드 결과는 selector 미연결이라 변경 거의 없어야 함 — 단, ref 인덱스 변경으로 보기/조건 박스 등 시각적 개선 기대 (이게 본 phase 의 핵심 성과)
- `unmapped_fallback.log` 신규 산출 (Phase 5 시각 검증 시 fallback 케이스 추적 용도)

## 검증

```bash
# Dry-run 으로 변환 결과 검증 (대상 18개 중 대표 1개)
python3 tools/fixture_remap.py --dry-run \
    --mapping /tmp/mapping.json \
    --src /tmp/showcase_extracted/bogi_table_4items.xml \
    | head -50

# 실제 적용 후 빌드 정상
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix
echo "exit=$?"

# 18개 대상 fixture 가 정상 XML 인지 + ref 가 우리 header 범위 내 (paraPr<=29, charPr<=41, borderFill<=81)
python3 -c "
import re, glob, os
TARGETS = {'bogi_table_4items.xml','ganada_table.xml',
  'increase_decrease_template_3x.xml','increase_decrease_template_4x.xml',
  'synthetic_division_template_1.xml','synthetic_division_template_2.xml',
  'synthetic_division_template_3.xml','synthetic_division_template_4.xml',
  'Pascal_triangle_1.xml','Pascal_triangle_2.xml','Pascal_triangle_3.xml',
  'choice_table_5x5.xml','choice_table_9x4.xml','empty_box_template.xml',
  'prob_dist_5cols.xml','prob_dist_6cols.xml','prob_dist_7cols.xml',
  'proof_table_template.xml'}
OUR_MAX = {'paraPrIDRef': 29, 'charPrIDRef': 41, 'borderFillIDRef': 81}
ok = 0
for name in sorted(TARGETS):
    txt = open(f'resources/hwpx_base/{name}').read()
    for attr, omax in OUR_MAX.items():
        vals = [int(v) for v in re.findall(rf'{attr}=\"(\d+)\"', txt)]
        if vals and max(vals) > omax:
            print(f'OUT OF RANGE: {name} {attr} max={max(vals)}')
            break
    else:
        ok += 1
print(f'OK {ok}/{len(TARGETS)}')
"

# Unmapped fallback 로그 존재
test -f /tmp/unmapped_fallback.log && wc -l /tmp/unmapped_fallback.log
```

## 실행 결과

### 1회차 (2026-05-19 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
18개 fixture 의 대상 사전 검증(user-range only assert) 통과. `tools/fixture_remap.py` 작성 (단일/batch/dry-run + fallback 정책표 + unmapped_fallback.log). `empty_box_template.xml` placeholder 재주입 로직 구현 및 적용. 18개 모두 resources/hwpx_base/ 에 atomic write 완료. 빌드 + validate 통과.

#### 변경 파일
- `tools/fixture_remap.py` (신규, ~260줄)
- `resources/hwpx_base/bogi_table_4items.xml` (수정 — paraPr/charPr/borderFill ref remap)
- `resources/hwpx_base/ganada_table.xml` (수정)
- `resources/hwpx_base/increase_decrease_template_3x.xml` (수정, borderFill fallback 8건)
- `resources/hwpx_base/increase_decrease_template_4x.xml` (수정)
- `resources/hwpx_base/synthetic_division_template_1~4.xml` (4파일 수정)
- `resources/hwpx_base/Pascal_triangle_1~3.xml` (3파일 수정)
- `resources/hwpx_base/choice_table_5x5.xml`, `choice_table_9x4.xml` (수정)
- `resources/hwpx_base/empty_box_template.xml` (수정 + placeholder 재주입)
- `resources/hwpx_base/prob_dist_5cols~7cols.xml` (3파일 수정)
- `resources/hwpx_base/proof_table_template.xml` (수정)

#### 검증 결과
- [x] 대상 18개 user-range assert: `OK 18/18` → pass
- [x] dry-run 변환 요약 출력: 18개 before→after ref 분포 확인 → pass
- [x] 18개 our-range 검증 (paraPr≤29, charPr≤41, borderFill≤81): `OK 18/18` → pass
- [x] `python3 build_hwpx.py "..."` → `HWPX written` 정상 → pass
- [x] `validate.py ... --fix` → `HWPX 검증 통과` exit=0 → pass
- [x] `/tmp/unmapped_fallback.log` 존재 (32줄, dry-run + actual 중복 포함) → pass

#### 추가 발견사항
- Unmapped fallback 적용 총 16건 (unique): paraPr user[3,4,8]×4, borderFill user[5,21,34,35,36,40]×8
  - user[35] borderFill → our[1] (패턴 미일치, spec 기본값 사용)
- `empty_box_template.xml` placeholder 재주입 시 ITEMS_CONTENT 는 condition_rect 전용임을 확인 → 제외 (shapes.py make_empty_box 참조)
- scaMatrix e6 값이 "0" (정수) 임을 확인 → regex `[\d.]+` 패턴으로 대응
- ganada_table.xml 은 paraPr ref만 있고 borderFillIDRef 없음 → 정상

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 18개 target fixture + tools/fixture_remap.py 모두 scope 내. bogi_table_3items.xml 변경은 phase-run 시작 이전 working tree 상태(pre-existing) — Phase 3 무관, 커밋 제외.

#### Verification Re-run (orchestrator)
**부분 실패 (1회차)** — stage1 (`--dry-run --src X` without `--dst`) exit 2 (argparse 거부). stage2 build exit 0, stage3 validate exit 0, stage4 range check 18/18 OK. 본질적 remap 동작은 정상이나 spec 의 검증 명령과 CLI 시그니처 불일치 → **fix_required** 자동 재호출.

**재검증 (2회차)** — stage1 dry-run exit 0 (변환 요약 + XML 출력 정상). build/validate/range check 모두 pass 유지.

#### Simplify (orchestrator)
skip — fix_required retry 후 코드가 spec 의도대로 정렬됨. 추가 정리 불필요.

#### Review (orchestrator)
VERDICT: pass — 0 issues. 18개 target 정확 remap, untouched 10개 변경 없음, argparse 분기 정상, placeholder 6종이 shapes.py:make_empty_box L77-82 와 일치, fallback 로그 정책표와 부합.

#### Commit
1742aaf

### 2회차 (2026-05-19 KST) — 완료
**상태**: completed
**수정 내용**: `tools/fixture_remap.py` argparse 분기 수정 — `--dry-run` 시 `--dst` optional 처리 (line 320-325). `--src` 만 필수로 분리, `--dst` 는 non-dry-run 시에만 required. dry-run 경로에서 `Path(None)` TypeError 방지용 `dst_path` fallback 추가 (`src` 경로로 대체, remap() 내부에서 dry_run=True 이면 dst 미사용이므로 안전).

**검증 결과**:
- [x] stage1 dry-run: `python3 tools/fixture_remap.py --dry-run --mapping /tmp/mapping.json --src /tmp/showcase_extracted/bogi_table_4items.xml | head -50` → exit 0 (변환 요약 + XML 출력 확인) → pass
- [x] stage4 range check: `OK 18/18` → pass
- [x] `/tmp/unmapped_fallback.log` 존재 (44줄) → pass
