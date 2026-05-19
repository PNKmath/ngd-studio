---
phase: 5
title: E2E 검증 + showcase round-trip
status: needs_user
depends_on: [4]
scope:
  - tools/build_template_showcase.py
  - inputs/시험지 제작/.v3cache/
  - outputs/
intervention_likely: true
intervention_reason: "사용자가 한컴오피스에서 _TEMPLATE_SHOWCASE_fixed.hwpx 와 빌드 결과를 시각 비교해야 통과 판정 가능."
---

# Phase 5: E2E 검증 + showcase round-trip

> **범위**: Integration (실제 빌드 + 사용자 시각 검증)
> **난이도**: M
> **의존성**: Phase 4 (selector 분기 완료 후)
> **영향 파일**: 없음 (도구 확장 외 검증만)

## 배경

Phase 1~4 의 결과로 코드만으로 양식지 수준의 HWPX 가 생성되는지 최종 확인. 단위 테스트로는 잡히지 않는 시각적 일치를 사용자가 한컴오피스에서 직접 확인.

검증 매트릭스:

| 검증 대상 | 비교 기준 | 통과 조건 |
|----------|----------|----------|
| 현 시험지 (`inputs/시험지 제작/.v3cache/exam_data.json`) 빌드 | `outputs/_TEMPLATE_SHOWCASE_fixed.hwpx` 의 각 라벨 섹션 | 보기/조건박스/표/수식/머릿말/ENDNOTE 모두 시각 일치 |
| `tools/build_template_showcase.py` 출력 | 동일 (28개 라벨 섹션 모두 정답 본과 비교) | 각 라벨 섹션이 정답 본과 동일 렌더링 |

## 설계

### 검증 절차

#### 5-1. 실제 시험지 빌드

```bash
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/fix_namespaces.py "outputs/[고][2026][1학기][강북고][수학 II].hwpx"
python3 resources/hwpx_scripts/validate.py "outputs/[고][2026][1학기][강북고][수학 II].hwpx" --fix
cp "outputs/[고][2026][1학기][강북고][수학 II].hwpx" \
   "outputs/[고][2026][1학기][강북고][수학 II]_fix_ver_final.hwpx"
```

#### 5-2. showcase round-trip

`tools/build_template_showcase.py` 확장:
- 새로 selector 가 사용 가능해진 11개 fixture 도 showcase 라벨 섹션으로 추가 (현재 18개만 → 28개)
- C 섹션 (FIXTURE × 코드) 도 4-item bogi, 3x/4x inc_dec, 1~4 syn_div, pascal triangle 호출 추가

```bash
python3 tools/build_template_showcase.py
python3 resources/hwpx_scripts/validate.py outputs/_TEMPLATE_SHOWCASE.hwpx --fix
```

#### 5-3. 사용자 시각 확인

```bash
open outputs/_TEMPLATE_SHOWCASE_fixed.hwpx        # 정답 reference
open outputs/_TEMPLATE_SHOWCASE.hwpx              # 우리 빌드
open "outputs/[고][2026][1학기][강북고][수학 II]_fix_ver_final.hwpx"  # 실제 시험지
```

사용자가 한컴오피스에서:
- 정답 본과 우리 showcase 의 동일 라벨 섹션 비교 — 시각 일치 여부 확인
- 실제 시험지 빌드 결과의 머릿말/ENDNOTE/보기/조건박스/표/수식 시각 정상 여부 확인

#### 5-4. 불일치 발견 시 처리

- 어느 라벨 섹션 / 어느 시각 요소가 어긋나는지 사용자가 명시
- Phase 3 (fixture ref) 또는 Phase 4 (selector) 로 회귀해 패치
- 본 phase 는 통과까지 반복 가능

### 산출물

- `outputs/[고][2026][1학기][강북고][수학 II]_fix_ver_final.hwpx` — 사용자 승인된 최종 빌드 결과
- `outputs/_TEMPLATE_SHOWCASE.hwpx` — 28개 라벨 모두 정답과 일치하는 showcase
- 검증 매트릭스 결과 (phase 파일 `## 실행 결과` 에 기록)

## 체크리스트

- [ ] `tools/build_template_showcase.py` 확장 — 11개 신규 fixture 포함 (B 섹션 28개, C 섹션도 확장)
- [ ] 실제 시험지 빌드 + validate 통과 + `_fix_ver_final.hwpx` 생성
- [ ] showcase 빌드 + validate 통과
- [ ] 사용자 시각 확인 (한컴오피스에서 정답 본 ↔ 우리 빌드 비교) — 통과/실패 결과 phase 파일에 기록
- [ ] 실패 발견 시 Phase 3/4 로 회귀 (반복 가능)

## 실행 결과

### 1회차 (자동검증) — needs_user

**실행일**: 2026-05-19
**run_id**: run-1779116264-26908

#### 체크리스트 진행 상태

- [x] `tools/build_template_showcase.py` 확장 — bogi 4items, inc_dec 3x, inc_dec 4x 추가 (ganada_table.xml은 B 섹션 자동 포함). Pascal/syn_div 1~4 skip (maker 함수 없음 / 단일 호출 분기 없음).
- [x] 실제 시험지 빌드 + validate 통과 + `_fix_ver_final.hwpx` 생성
  - build exit 0: `HWPX written: outputs/[고][2026][1학기][강북고][수학 II].hwpx`
  - fix_namespaces exit 0
  - validate exit 0: `HWPX 검증 통과` (cellAddr 1건 FIX 후)
  - `outputs/[고][2026][1학기][강북고][수학 II]_fix_ver_final.hwpx` 생성 완료
- [x] showcase 빌드 + validate 통과
  - build exit 0: `HWPX written: outputs/_TEMPLATE_SHOWCASE.hwpx`
  - validate exit 0: `HWPX 검증 통과` (cellAddr 12건 / zOrder 중복 115건 FIX 후)
  - hp/hc 네임스페이스 정상, 신규 라벨 3종 확인
- [ ] 사용자 시각 확인 — **[준비완료, 사용자 검증 대기]**
  - `outputs/_TEMPLATE_SHOWCASE_fixed.hwpx` (정답 reference)
  - `outputs/_TEMPLATE_SHOWCASE.hwpx` (신규 빌드 — bogi4/inc3x/inc4x 섹션 추가)
  - `outputs/[고][2026][1학기][강북고][수학 II]_fix_ver_final.hwpx` (실제 시험지)
- [ ] 실패 발견 시 Phase 3/4 로 회귀 — 사용자 보고 대기

#### 자동 검증 결과

| 항목 | exit | 비고 |
|------|------|------|
| build_hwpx.py | 0 | 19문제 (선택12/서술7), 이미지 1개 |
| fix_namespaces.py | 0 | namespace 정상 |
| validate (시험지) | 0 | cellAddr 1건 자동 FIX |
| build_template_showcase.py | 0 | C 섹션 +3 항목 (bogi4, inc3x, inc4x) |
| validate (showcase) | 0 | cellAddr 12건 / zOrder 115건 자동 FIX |

**STATUS: needs_user** — 빌드+validate 모두 exit 0. 사용자가 한컴오피스에서 시각 비교해야 최종 통과 판정 가능.

### 2회차 (시각) — fix_required 처리

**실행일**: 2026-05-19
**run_id**: run-1779116264-26908
**원인**: bogi_table_4items.xml 깨짐 — `borderFill user[1,3,11] → our[1]` collision (fingerprint 에 diagonal 누락)

#### 패치 내용

1. **`tools/header_def_mapper.py` fingerprint 개선**
   - `fingerprint_borderFill()` 에 `diagonal` 요소 (type/width/color) 추가
   - `fillBrush` presence flag 명시 (`fill_present: bool`)
   - 결과: user[1]→our[1], user[3]→our[3], user[11]→our[11] — collision 0건

2. **매핑 지표 개선 (새 mapping.json)**
   - borderFill collision: 3 → **0**
   - charPr unmapped: [3,7,9,10,11] → **[7]** (4개 해소)
   - paraPr unmapped: [3,4,8,9] → **[]** (4개 모두 해소)

3. **18개 fixture 재 remap**
   - `python3 tools/fixture_remap.py --batch --mapping /tmp/mapping.json ...`
   - 18/18 ref 범위 OK (paraPr≤29, charPr≤41, borderFill≤81)

#### 검증 결과

| 항목 | 결과 | 비고 |
|------|------|------|
| user[11] borderFill → our[11] | **OK** | assertion 통과 |
| borderFill collision | **0건** | assertion 통과 |
| 18/18 fixture ref 범위 | **OK** | paraPr≤29, charPr≤41, borderFill≤81 |
| bogi_table_4items borderFill cells | **OK** | 3items와 첫 9셀 동일 (11→11 포함) |
| build_hwpx.py | exit 0 | 19문제 (선택12/서술7), 이미지 1개 |
| validate (시험지) | exit 0 | cellAddr 1건 자동 FIX |
| build_template_showcase.py | exit 0 | `_TEMPLATE_SHOWCASE.hwpx` 생성 |
| validate (showcase) | exit 0 | cellAddr 12건 / zOrder 115건 자동 FIX |

**STATUS: needs_user** — 빌드+validate 모두 exit 0, borderFill 구조 수정 완료. 사용자가 한컴오피스에서 bogi_table_4items 시각 확인 필요.

### 3회차 (근본 원인 fix) — needs_user

**실행일**: 2026-05-19
**run_id**: run-1779116264-26908
**원인**: `make_choice_table` 평면 배열 인덱싱 + `_inject_cell_value` 채워진 셀 미덮어쓰기

#### 패치 내용

1. **`tables.py` — `make_choice_table` cellAddr 기반 재작성**
   - 기존: `cell_idx = ri * n_cols + ci` → 9x4(24셀)에서 36개 인덱스 생성 → 범위 초과 silent skip + 빈 `<hp:tr>` 생성
   - 개선: `re.sub(r'<hp:tc\b.*?</hp:tc>', _sub_cell, tbl_xml, flags=re.DOTALL)` — cellAddr(col, row) 기반 in-place 치환
   - 결과: `<hp:tr>` 재구성 없이 fixture 원본 구조(rowSpan 병합 등) 완전 보존

2. **`tables.py` — `_inject_cell_value` 채워진 셀 덮어쓰기 지원**
   - 기존: `<hp:run charPrIDRef="N"/>` self-closing만 매칭 → `(가)(나)(다)` 헤더 절대 안 바뀜
   - 개선: self-closing 없으면 `<hp:run charPrIDRef="N">...</hp:run>` 전체 교체 (count=1, re.DOTALL)
   - 결과: 6x3/6x4 첫 행 헤더 `(가)(나)(다)` → ①, 데이터 정상 주입

3. **`tools/build_template_showcase.py` — 타임스탬프 파일명**
   - 기존: `_TEMPLATE_SHOWCASE.hwpx` 매번 덮어씀
   - 개선: `_TEMPLATE_SHOWCASE_ver{YYYYMMDD-HHMMSS}.hwpx` — 이전 빌드와 비교 가능
   - showcase validate 시 `outputs/_TEMPLATE_SHOWCASE_ver*.hwpx` 명시 (glob `outputs/*.hwpx` 사용 금지)

#### 단위 테스트 결과

| 테스트 케이스 | 결과 |
|---|---|
| 9x4 cell count = 24 (재구성 없음) | **PASS** |
| 9x4 ① 주입 확인 | **PASS** |
| 6x3 ① 덮어쓰기, (가) 잔존 없음 | **PASS** |
| 6x4 24 cells | **PASS** |
| 5x5 25 cells | **PASS** |

#### 빌드 검증 결과

| 항목 | exit | 비고 |
|------|------|------|
| build_hwpx.py | 0 | 19문제 (선택12/서술7), 이미지 1개 — 회귀 없음 |
| validate (시험지) | 0 | cellAddr 1건 자동 FIX |
| build_template_showcase.py | 0 | `_TEMPLATE_SHOWCASE_ver20260519-090201.hwpx` 생성 |
| validate (showcase) | 0 | cellAddr 11건 / zOrder 105건 자동 FIX |

**STATUS: needs_user** — 코드 fix 완료 + 빌드/validate exit 0. 사용자가 한컴오피스에서 9x4/6x3/6x4 choice_table 시각 확인 필요.
- 신규 파일: `outputs/_TEMPLATE_SHOWCASE_ver20260519-090201.hwpx`

## 영향 범위

- `tools/build_template_showcase.py` 만 수정 (스코프 밖 변경 없음)
- 빌드 결과물은 outputs/ 에 새 파일 생성 (기존 덮어쓰지 않음 — `_fix_ver_final` 접미사)
- 통과 시 본 task 종료. 후속 시험지 빌드부터는 정답 수준 결과 보장.

## 검증

```bash
# 빌드 + 검증
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix

# Showcase 빌드 + 검증
python3 tools/build_template_showcase.py
python3 resources/hwpx_scripts/validate.py outputs/_TEMPLATE_SHOWCASE.hwpx --fix

# 사용자 시각 확인용 파일 열기
open outputs/_TEMPLATE_SHOWCASE_fixed.hwpx outputs/_TEMPLATE_SHOWCASE.hwpx
open "outputs/[고][2026][1학기][강북고][수학 II]_fix_ver_final.hwpx"
```

검증 통과 조건: 빌드 + validate exit 0 + 사용자가 한컴오피스에서 시각 일치 확인.
