---
phase: 1
title: extractor 메타데이터 스키마 정의 + 현 fixture pool gap 분석
status: pending
depends_on: []
scope:
  - docs/planning/hwpx-syn-div-pascal-selector/schema.md
  - docs/planning/hwpx-syn-div-pascal-selector/gap_analysis.md
intervention_likely: false
intervention_reason: ""
---

# Phase 1: extractor 메타데이터 스키마 + fixture pool gap 분석

> **범위**: Docs / Analysis
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `docs/planning/hwpx-syn-div-pascal-selector/schema.md` (신규), `docs/planning/hwpx-syn-div-pascal-selector/gap_analysis.md` (신규)

## 배경

syn_div / Pascal selector 가 동적으로 결정되려면 extractor 가 문제 분석 시 **정확한 메타데이터** 를 출력해야 한다. 현재 extractor 가 무엇을 추출하는지 / 무엇을 추가로 추출해야 하는지가 정의되지 않았다. 또한 현 fixture pool (syn_div 4 + Pascal 3) 이 어떤 케이스를 커버하고 어떤 케이스를 못 표현하는지가 미분석.

본 phase 는 다음 두 산출물로 후속 phase 의 토대를 마련:

1. **메타데이터 스키마** — extractor 출력 필드 명세 (Python dict 또는 JSON schema)
2. **gap 분석** — 현 fixture 7종 의 구조 매트릭스 + 부족 케이스 식별

## 설계

### 메타데이터 스키마 산출물 (`schema.md`)

#### synthetic_division

```python
{
  "type": "synthetic_division",         # type tag (assemble.py 분기 키)
  "degree": int,                        # 다항식 차수 (3, 4, 5, 6, ...)
  "nesting_count": int,                 # 조립제법 중첩 횟수 (보통 degree - 1)
  "coefficients": list[str],            # 원 다항식 계수 (문자열, 수식 가능)
  "rows": list[list[str]],              # 각 행의 셀 값 (수식/숫자)
  "n_rows": int,                        # = len(rows)
  "n_cols": int,                        # 최대 cols
  # selector 보조 필드
  "divisor": str | None,                # 나누는 수 (예: "1", "x-2") — 선택
}
```

- `degree` 와 `nesting_count` 가 selector 의 1차 기준.
- `rows` 는 실제 셀 값 (빌더가 fixture 슬롯에 주입).
- fixture pool 이 모든 (degree, nesting_count) 조합을 커버 못하면 가장 가까운 fixture + 빌더 후처리.

#### Pascal triangle

```python
{
  "type": "pascal",
  "n_rows": int,                        # 행 수 (피라미드 높이)
  "cells": list[list[str]],             # 각 행의 셀 값 (문자열, 수식 가능)
  # selector 보조 필드
  "display_form": str,                  # "binomial" | "fraction" | "root" | ...
                                        # 셀의 표현 형태 (분수형/일반형 등)
}
```

- `n_rows` 만으로 selector 결정 불가 — `display_form` 추가.
- Pascal_triangle_2 / _3 의 차이는 `display_form` 차이일 가능성 (Phase 2 에서 검증).

### gap 분석 산출물 (`gap_analysis.md`)

#### 현 fixture 7종 매트릭스

| fixture | rowCnt | colCnt | 빈/채워짐 | 추정 용도 | 셀 패턴 |
|---------|--------|--------|----------|----------|--------|
| synthetic_division_template_1 | 4 | 5 | 빈 | 1회 중첩 (3차) | 분석 후 채움 |
| synthetic_division_template_2 | 7 | 5 | 빈 | 2회 중첩 (4차) | |
| synthetic_division_template_3 | 10 | 5 | 빈 | 3회 중첩 (5차) | |
| synthetic_division_template_4 | 13 | 6 | 빈 | 4회 중첩 (6차) | |
| Pascal_triangle_1 | 7 | ? | ? | 작은 케이스 | |
| Pascal_triangle_2 | 12 | 23 | ? | 중간 케이스 | |
| Pascal_triangle_3 | 12 | 23 | ? | 표현형 변형 | |

worker 는 각 fixture XML 의 cell 구조 (cellSpan, 셀 내 텍스트/수식, 너비/높이) 를 분석해 표 채움.

#### 부족 케이스 식별

- syn_div: 5회 이상 중첩 (7차 다항식 이상) — 현재 미지원. 실제 양식지에서 등장 빈도 확인 필요.
- Pascal: `display_form` 별 변형. 양식지에서 어떤 형태로 나오는지 확인.

worker 는 `/tmp/showcase_extracted/` 또는 사용자 양식지 PDF 를 참조해 실제 syn_div / Pascal 문제 사례를 수집 (없으면 가설 기록).

## 체크리스트

- [ ] `schema.md` 신규 — syn_div / Pascal 메타데이터 스키마 (Python dict 형식 + 필드 의미)
- [ ] `gap_analysis.md` 신규 — 현 fixture 7종 cell 구조 분석 표
- [ ] gap_analysis.md 에 부족 케이스 (degree, nesting_count, display_form 별) 목록 명시
- [ ] schema.md 가 extractor 가 현재 출력하는 필드와 어떻게 다른지 (=새로 추가해야 하는 필드) 명시
- [ ] Phase 2 (fixture 보강) 와 Phase 3 (extractor 갱신) 가 둘 다 본 phase 산출을 참고 가능한 상태

## 영향 범위

- 본 phase 는 문서 산출만. 코드 변경 없음.
- Phase 2 가 gap_analysis.md 의 부족 케이스 목록을 입력으로 사용해 추가할 fixture 결정.
- Phase 3 이 schema.md 의 필드 정의를 입력으로 사용해 extractor 코드 갱신.

## 검증

```bash
ls docs/planning/hwpx-syn-div-pascal-selector/{schema.md,gap_analysis.md}
wc -l docs/planning/hwpx-syn-div-pascal-selector/{schema.md,gap_analysis.md}

# schema.md 가 두 type 모두 정의
grep -c "synthetic_division\|pascal" docs/planning/hwpx-syn-div-pascal-selector/schema.md

# gap_analysis.md 에 7종 fixture 모두 분석됨
for f in synthetic_division_template_1 synthetic_division_template_2 synthetic_division_template_3 synthetic_division_template_4 Pascal_triangle_1 Pascal_triangle_2 Pascal_triangle_3; do
  grep -q "$f" docs/planning/hwpx-syn-div-pascal-selector/gap_analysis.md || echo "MISSING: $f"
done
```

검증 통과 조건: schema.md / gap_analysis.md 두 파일 모두 존재 + 50줄 이상 + 7종 fixture 모두 분석 + 부족 케이스 목록 명시.
