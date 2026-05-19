---
phase: 2
title: fixture 일괄 rename + 호출부 동기화
status: completed
depends_on: [1]
scope:
  - resources/hwpx_base/
  - tables.py
  - shapes.py
  - assemble.py
  - tools/build_template_showcase.py
  - tools/fixture_remap.py
intervention_likely: true
intervention_reason: "rename 일괄 적용은 호출부 누락 시 빌드 실패 직결. 적용 전 grep 검증 + 적용 후 회귀 빌드 확인. 사용자 사전 승인 필요."
---

# Phase 2: fixture rename 일괄 적용 + 호출부 동기화

> **범위**: Resources (rename) + Backend (호출부)
> **난이도**: M
> **의존성**: Phase 1 (rename_map.md 확정)
> **영향 파일**: `resources/hwpx_base/*.xml` (파일명 변경), `tables.py` / `shapes.py` / `assemble.py` / `tools/build_template_showcase.py` (호출부)

## 배경

Phase 1 의 rename_map.md 결정을 일괄 적용. 호출부 (Python builder + showcase tool) 도 동시에 갱신해 빌드가 깨지지 않게 한다.

## 설계

### 작업 흐름

1. Phase 1 rename_map.md 의 (old → new) 매핑 dict 추출.
2. 각 매핑에 대해:
   - `git mv resources/hwpx_base/{old}.xml resources/hwpx_base/{new}.xml`
   - 호출부 grep — `tables.py`, `shapes.py`, `assemble.py`, `tools/build_template_showcase.py` 에서 old 사용처 찾기
   - sed 또는 Edit 으로 호출부 갱신
3. 빌드 + validate + showcase 회귀 테스트.
4. 깨지면 즉시 rollback (`git checkout` 으로 변경 되돌리기) + 어느 fixture 가 문제인지 보고.

### 호출부 검증 (적용 전 사전 grep)

```bash
# 모든 호출부 위치 식별
for old in $(grep -E "^\| .*\.xml " docs/planning/ngd-create-v4-coherence/rename_map.md | awk -F'|' '{gsub(/ /,"",$2); print $2}'); do
    echo "=== $old ==="
    grep -rn "$old" tables.py shapes.py assemble.py tools/build_template_showcase.py 2>/dev/null
done
```

### 적용 도구 (옵션)

`tools/fixture_rename.py` 신규 — rename_map.md 의 매핑을 읽어 `git mv` + 호출부 sed 자동화. 또는 worker 가 직접 Edit 으로 한 fixture 씩 처리.

## 체크리스트

- [x] rename_map.md 의 모든 매핑이 호출부 어디서 사용되는지 grep 결과 정리
- [x] `git mv` 로 fixture 파일명 일괄 변경
- [x] 호출부 (tables.py / shapes.py / assemble.py / build_template_showcase.py) 의 새 이름 반영
- [x] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` exit 0
- [x] `python3 tools/build_template_showcase.py` exit 0

## 영향 범위

- `resources/hwpx_base/*.xml` 파일명 (git mv — 히스토리 추적 가능)
- builder 호출부 (Python) — fixture 이름 직접 참조하는 곳
- `tools/fixture_remap.py` 같은 외부 도구는 fixture 이름을 동적으로 받으므로 영향 없음 (확인 필요)

## 검증

```bash
# 새 이름 fixture 들이 build 에서 정상 호출
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py "outputs/[고]"*_ver*.hwpx --fix
echo "exam_exit=$?"

python3 tools/build_template_showcase.py
LATEST_SC=$(ls -t outputs/_TEMPLATE_SHOWCASE_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST_SC" --fix
echo "showcase_exit=$?"

# 옛 이름 fixture 가 호출부에 잔존하지 않는지 (rename 누락 검출)
for old in $(grep -E "^\| .*\.xml " docs/planning/ngd-create-v4-coherence/rename_map.md | awk -F'|' '{gsub(/ /,"",$2); print $2}'); do
    if grep -q "$old" tables.py shapes.py assemble.py tools/build_template_showcase.py 2>/dev/null; then
        echo "ORPHAN: $old still referenced"
    fi
done
```

검증 통과 조건: 두 빌드 exit 0 + 옛 이름 잔존 0건.

## 실행 결과

### 1회차 (2026-05-19) — completed

**세션 태그**: `__PHASERUN_TAG__ phase=2 run=run-1779154035-63374`

**수행 내용**:

#### 4-1. 사전 grep 결과
- `bogi_table_3/4/6items.xml`: tables.py:401/403/405 (make_bogi_table 분기)
- `increase_decrease_template.xml / _2x/_3x/_4x.xml`: tables.py:177/178/182/186 (make_increase_decrease_table 분기) + showcase 주석/라벨 4건
- `choice_table_5x5/9x4/6x3/6x4`: make_choice_table 동적 조합 (`f"choice_table_{table_type}.xml"`, tables.py:368) + showcase table_type 값 참조만
- `bogi_table_4items.xml`: showcase 주석/라벨 2건 (tables.py 외)

#### 4-2. git mv 실행 (11건 전부)
| old | new |
|-----|-----|
| bogi_table_3items.xml | bogi_box_3items.xml |
| bogi_table_4items.xml | bogi_box_4items.xml |
| bogi_table_6items.xml | bogi_box_6items.xml |
| choice_table_5x5.xml | pq_proposition_table_5x5.xml |
| choice_table_9x4.xml | choice_image_5options.xml |
| choice_table_6x3.xml | choice_grid_2cols.xml |
| choice_table_6x4.xml | choice_grid_3cols.xml |
| increase_decrease_template.xml | inc_dec_1x.xml |
| increase_decrease_template_2x.xml | inc_dec_2x.xml |
| increase_decrease_template_3x.xml | inc_dec_3x.xml |
| increase_decrease_template_4x.xml | inc_dec_4x.xml |

#### 4-3. 호출부 갱신
**tables.py**:
- `make_bogi_table`: `bogi_table_3/4/6items.xml` → `bogi_box_3/4/6items.xml` (직접 문자열 교체)
- `make_increase_decrease_table`: 4개 파일명 + 주석 → `inc_dec_1x/2x/3x/4x.xml`
- `make_choice_table`: `f"choice_table_{table_type}.xml"` 동적 조합 → `CHOICE_TABLE_MAP` dict로 교체. extractor의 `table_type` 키 (`5x5`/`9x4`/`6x3`/`6x4`)는 Phase 3에서 변경 예정으로 본 phase에서 유지.
  ```python
  CHOICE_TABLE_MAP = {
      "5x5": "pq_proposition_table_5x5.xml",
      "9x4": "choice_image_5options.xml",
      "6x3": "choice_grid_2cols.xml",
      "6x4": "choice_grid_3cols.xml",
  }
  ```

**tools/build_template_showcase.py**:
- `bogi_table_4items.xml` 주석/라벨 2건 → `bogi_box_4items.xml`
- `increase_decrease_template_3x.xml` 주석/라벨 2건 → `inc_dec_3x.xml`
- `increase_decrease_template_4x.xml` 주석/라벨 2건 → `inc_dec_4x.xml`

**shapes.py**: 해당 없음 (변경 대상 fixture 미참조)
**assemble.py**: 해당 없음 (테이블 호출은 tables.py 함수 경유)

#### 4-4. 빌드 회귀
```
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs → exit=0 (19문제, 이미지 1개)
python3 tools/build_template_showcase.py → exit=0
python3 resources/hwpx_scripts/validate.py {exam_hwpx} --fix → 통과
python3 resources/hwpx_scripts/validate.py {showcase_hwpx} --fix → 통과 (zOrder 중복 157건 자동 fix)
```

**고아 이름 잔존**: 0건 — 모든 builder 파일에서 옛 이름 완전 제거 확인.

**변경 파일**:
- `resources/hwpx_base/` — 11개 파일 git mv
- `tables.py` — make_bogi_table (3건), make_increase_decrease_table (4건+주석), make_choice_table (CHOICE_TABLE_MAP 추가 + 동적 조합 교체)
- `tools/build_template_showcase.py` — 주석/라벨 6건

**추가 발견사항**:
- `shapes.py` / `assemble.py` 변경 없음 — 이 두 파일은 rename 대상 fixture를 직접 참조하지 않음
- showcase 의 `table_type` 값 (`"5x5"`, `"9x4"`, `"6x3"`, `"6x4"`) 은 여전히 유효 — CHOICE_TABLE_MAP 이 내부 매핑을 처리하므로 showcase 동작에 영향 없음. Phase 3에서 extractor 스키마와 함께 정리 예정.

**질문 / 결정 사항**: 없음 — 모든 항목 완료.

---

### 2회차 (2026-05-19) — completed

**세션 태그**: `__PHASERUN_TAG__ phase=2 run=run-1779154035-63374`

**리뷰 피드백 반영** — fixture_remap.py FIXTURES_18 5건 갱신 + CHOICE_TABLE_MAP fallback 제거

**수행 내용**:

#### 수정 (1) tools/fixture_remap.py FIXTURES_18 갱신

FIXTURES_18 리스트에서 구 이름 5건을 신규 이름으로 교체:
| 구 이름 | 신규 이름 |
|---------|----------|
| `bogi_table_4items.xml` | `bogi_box_4items.xml` |
| `increase_decrease_template_3x.xml` | `inc_dec_3x.xml` |
| `increase_decrease_template_4x.xml` | `inc_dec_4x.xml` |
| `choice_table_5x5.xml` | `pq_proposition_table_5x5.xml` |
| `choice_table_9x4.xml` | `choice_image_5options.xml` |

파일 내 다른 곳 잔존 여부 grep → 해당 없음 (FIXTURES_18 블록만이 유일한 위치).

#### 수정 (2) tables.py CHOICE_TABLE_MAP fallback 제거

`make_choice_table` 내 `.get()` fallback → `KeyError` raise 로 교체:
```python
if table_type not in CHOICE_TABLE_MAP:
    raise KeyError(f"Unknown choice table_type: {table_type!r}")
tpl_name = CHOICE_TABLE_MAP[table_type]
```

**검증 결과**:
```
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs → exit=0 (19문제, 이미지 1개)
python3 tools/build_template_showcase.py → exit=0
fixture_remap 대상 5건 실재 OK (bogi_box_4items.xml, inc_dec_3x.xml, inc_dec_4x.xml, pq_proposition_table_5x5.xml, choice_image_5options.xml)
orphan check (구 이름 잔존): 0건 — fixture_remap.py 포함 전체 codebase 검색
```

**변경 파일**:
- `tools/fixture_remap.py` — FIXTURES_18 리스트 5건 갱신
- `tables.py` — make_choice_table fallback 제거 → KeyError raise

**추가 발견사항**: 없음.

**질문 / 결정 사항**: 없음 — 모든 검증 통과.

#### Scope Audit (orchestrator)
pass — 1회차: PHASE_FILE + tables.py + tools/build_template_showcase.py (모두 scope 내). 2회차: PHASE_FILE + tools/fixture_remap.py + tables.py (scope 확장 반영).

#### Verification Re-run (orchestrator)
1회차 exit 0, 2회차 exit 0 — 두 빌드 통과. Pre-existing orphan refs (`.claude/tests/`, `archive/`) 는 phase 책임 범위 밖.

#### Review (orchestrator)
1회차 VERDICT: fix_required — fixture_remap.py FIXTURES_18 + CHOICE_TABLE_MAP fallback 지적. 2회차 fix 적용 후 두 이슈 모두 해결 확인.

#### Commit
7b034bc — refactor(builder): Phase 2 — fixture rename + 호출부 동기화
