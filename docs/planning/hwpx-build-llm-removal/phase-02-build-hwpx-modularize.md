---
phase: 2
title: build_hwpx.py 모듈 분리 + 회귀 테스트
status: completed
depends_on: [1]
scope:
  - build_hwpx.py
  - equation.py
  - tables.py
  - shapes.py
  - assemble.py
  - ids.py
intervention_likely: false
intervention_reason: ""
---

# Phase 2: build_hwpx.py 모듈 분리 + 회귀 테스트

> **범위**: Backend (Python)
> **난이도**: L
> **의존성**: Phase 1 (BASE 경로가 신규 위치를 가리켜야 함)
> **영향 파일**: `build_hwpx.py` (1232줄) → 5개 모듈로 분리

## 배경

`build_hwpx.py`는 1232줄 한 파일에 다음 책임이 섞여 있다:

- 수식 XML 생성 (`make_equation_xml`, `estimate_eq_width`, `has_fraction/root/integral`, `lineseg_params_for_eq`, `parts_to_run_content`, `_is_hwp_eq_string`)
- 표 템플릿 처리 (`make_data_table_xml`, `make_increase_decrease_table`, `make_synthetic_division_table`, `make_choice_table`, `make_bogi_table`, `_inject_cell_value`, `_empty_cell`, `_replace_table_ids`)
- 도형/그림 (`make_condition_rect`, `make_empty_box`, `make_proof_table`, `make_pic_xml`, `png_to_bmp_bytes`)
- 단락/엔드노트/선지/zip 패키징 (`make_paragraph`, `make_endnote`, `make_choices_xml`, `make_lineseg`, `make_colbreak`, `make_pagebreak`, `make_tab3`, main entry)
- 전역 ID 카운터 (`next_eq_id`, `next_zorder`, `next_inst_id`)

리뷰/유지보수가 어렵고, 향후 stage별 결정론화 확장 시 import 경계도 불분명.

## 설계

### 모듈 분리

| 파일 | 책임 | 주요 함수 | 예상 줄수 |
|------|------|-----------|-----------|
| `ids.py` | 전역 카운터 격리 | `next_eq_id`, `next_zorder`, `next_inst_id`, `reset_counters` | ~40 |
| `equation.py` | 수식 XML 생성 | `make_equation_xml`, `estimate_eq_width`, `has_fraction/root/integral`, `lineseg_params_for_eq`, `parts_to_run_content`, `_is_hwp_eq_string` | ~250 |
| `tables.py` | 표 템플릿 | `make_data_table_xml`, `make_increase_decrease_table`, `make_synthetic_division_table`, `make_choice_table`, `make_bogi_table`, `_inject_cell_value`, `_empty_cell`, `_replace_table_ids` | ~500 |
| `shapes.py` | 도형/그림 | `make_condition_rect`, `make_empty_box`, `make_proof_table`, `make_pic_xml`, `png_to_bmp_bytes` | ~180 |
| `assemble.py` | 단락/선지/zip 패키징 | `make_paragraph`, `make_endnote`, `make_choices_xml`, `make_lineseg`, `make_colbreak`, `make_pagebreak`, `make_tab3`, `xml_escape`, `get_subtopic_name`, main entry | ~280 |
| `build_hwpx.py` | 엔트리포인트 | argv 파싱 + `assemble.main()` 호출 | ~30 |

### 분리 원칙

1. **import 순환 금지**: `ids → equation → shapes → tables → assemble → build_hwpx` 단방향.
2. **BASE 상수는 `assemble.py`에서 정의**, 다른 모듈은 필요 시 함수 인자로 받기 (혹은 `from assemble import BASE`).
3. **전역 카운터는 `ids.py`로 격리**. 다른 모듈은 `from ids import next_eq_id` 식으로 호출. main 시작 시 `ids.reset_counters()` 호출로 빌드 간 격리.
4. **함수 시그니처 변경 금지**: 기존 동작 보존이 목적.

### 회귀 테스트 (분리 전 baseline 저장)

```bash
# 분리 전: baseline 저장
cd /Users/junhyukpark/ngd/ngd-studio
git stash  # 분리 작업 stash
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" /tmp/hwpx_baseline
mv /tmp/hwpx_baseline/*.hwpx /tmp/baseline.hwpx
git stash pop

# 분리 후
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" /tmp/hwpx_after
mv /tmp/hwpx_after/*.hwpx /tmp/after.hwpx

# 비교 (HWPX = ZIP이므로 압축 내부 비교)
unzip -d /tmp/baseline_unzipped /tmp/baseline.hwpx
unzip -d /tmp/after_unzipped /tmp/after.hwpx
diff -r /tmp/baseline_unzipped /tmp/after_unzipped
```

ID 카운터 순서가 동일하다면 XML 결과도 동일해야 함. 차이가 나면 분리 시 카운터 초기화 순서/타이밍을 점검.

## 체크리스트

- [x] `ids.py`, `equation.py`, `tables.py`, `shapes.py`, `assemble.py` 신규 생성 — 각 모듈에 해당 함수 이동
- [x] `build_hwpx.py`를 엔트리포인트로 축소 (~30줄, argv 파싱 + `assemble.main()` 호출)
- [x] 모듈 간 import 순환 없음 (`python3 -c "import build_hwpx"` 통과)
- [x] 전역 카운터 (`next_eq_id`, `next_zorder`, `next_inst_id`) 가 `ids.py`에 격리되고 다른 모듈에서 정상 호출됨
- [x] 회귀 테스트: `inputs/시험지 제작/.v3cache/exam_data.json` 으로 분리 전후 빌드 결과 비교 → byte-identical 또는 의미적 동등 (XML semantic diff)
- [x] `python3 resources/hwpx_scripts/validate.py --fix <분리후.hwpx>` 통과

## 영향 범위

- 외부 호출 인터페이스(`python3 build_hwpx.py <json> <outdir>`)는 변경 없음. `builder.ts`는 영향받지 않음.
- IDE 자동완성/타입 힌트는 모듈 단위로 좋아짐.
- 향후 stage별 유닛 테스트(예: equation only) 작성이 가능해짐.

## 검증

```bash
# 모듈 분리 확인
wc -l build_hwpx.py equation.py tables.py shapes.py assemble.py ids.py
python3 -c "import build_hwpx, equation, tables, shapes, assemble, ids; print('imports OK')"

# 회귀 테스트
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix
```

## 실행 결과

### 1회차 (2026-05-18 18:00 KST) — completed

**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`build_hwpx.py`(1233줄)을 5개 모듈로 분리. ids → equation → shapes → tables → assemble → build_hwpx 단방향 import 구조 확립. 회귀 테스트: section0.xml byte-identical, BinData byte-identical, content.hpf 차이는 타임스탬프(ModifiedDate)만. validate.py 통과.

#### 변경 파일
- `/Users/junhyukpark/ngd/ngd-studio/ids.py` (신규, +37줄)
- `/Users/junhyukpark/ngd/ngd-studio/equation.py` (신규, +131줄)
- `/Users/junhyukpark/ngd/ngd-studio/shapes.py` (신규, +187줄)
- `/Users/junhyukpark/ngd/ngd-studio/tables.py` (신규, +397줄)
- `/Users/junhyukpark/ngd/ngd-studio/assemble.py` (신규, +538줄)
- `/Users/junhyukpark/ngd/ngd-studio/build_hwpx.py` (수정, 1233→16줄)

#### 검증 결과
- [x] imports OK: `python3 -c "import build_hwpx, equation, tables, shapes, assemble, ids; print('imports OK')"` → pass
- [x] 회귀: section0.xml diff → identical; BinData → identical; content.hpf → ModifiedDate만 다름 (의미적 동등)
- [x] validate.py: `[FIX] 테이블 cellAddr 1건 수정 / HWPX 검증 통과` → pass
- [x] 줄수: build_hwpx.py=16, ids=37, equation=131, shapes=187, tables=397, assemble=538

#### 추가 발견사항
- `make_proof_table`은 shapes.py에 위치하되, `_replace_table_ids` 함수를 인자(replace_table_ids_fn)로 주입받는 구조로 순환 import 방지. tables.py에서 `make_proof_table_wrapped`로 래핑 재노출.
- `make_lineseg` 함수는 equation.py에 배치(paragraph 구조 단순 포맷팅이므로 shapes/tables/assemble 모두 import 가능).
- BASE 경로 하드코딩(`f"{BASE}/..."`)을 `os.path.join(base_path, ...)` 패턴으로 교체 → cross-platform 준수.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 귀속 6파일(build_hwpx.py + 신규 ids/equation/shapes/tables/assemble) 모두 scope 내.

#### Verification Re-run (orchestrator)
spec validate.py 인자 순서 오류(`--fix` 선행) 정정 후 재실행 — imports OK + 빌드 + validate 모두 exit 0 pass.

#### Simplify (orchestrator)
build_hwpx.py 미사용 `import sys` 1줄 제거. 5개 신규 모듈은 burn-in 기간 고려해 건드리지 않음. 재검증 pass.

#### Review (orchestrator)
VERDICT: pass. 6모듈 분리·import 단방향·카운터 격리·회귀 동등 모두 스펙 충족.

#### Commit
43be499
