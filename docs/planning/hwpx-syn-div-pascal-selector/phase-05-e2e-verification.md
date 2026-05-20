---
phase: 5
title: E2E 시각 검증 — 실 시험지 / 합성 데이터로 빌드 후 사용자 확인
status: pending
depends_on: [4]
scope:
  - tools/build_template_showcase.py
  - inputs/시험지 제작/.v3cache/
  - outputs/
intervention_likely: true
intervention_reason: "사용자가 한컴오피스에서 정답 양식지와 빌드 결과를 시각 비교해야 통과 판정 가능."
---

# Phase 5: E2E 시각 검증

> **범위**: Integration (빌드 + 시각 검증)
> **난이도**: M
> **의존성**: Phase 4 (selector 구현 완료 후)
> **영향 파일**: `tools/build_template_showcase.py` (확장 가능), 검증만

## 배경

Phase 1~4 의 결과로 syn_div / Pascal selector 가 동작하는지 사용자가 한컴오피스에서 정답 본과 시각 비교해 최종 판정.

검증 매트릭스:

| 검증 대상 | 비교 기준 | 통과 조건 |
|----------|----------|----------|
| 실 시험지 (`inputs/시험지 제작/.v3cache/exam_data.json`) 빌드 | 정답 양식지 (사용자 본) | syn_div / Pascal 문제 모두 시각 일치 |
| 합성 input — 차수별 / nesting 별 syn_div | 양식지 syn_div 정답 | 각 fixture 가 올바르게 선택되고 셀 값이 정확히 주입 |
| 합성 input — n_rows / display_form 별 Pascal | 양식지 Pascal 정답 | 각 fixture 가 올바르게 선택되고 셀 값이 정확히 주입 |

## 설계

### 작업 흐름

1. 실 시험지 데이터에 syn_div / Pascal 이 있으면 그대로 빌드 + 시각 확인.
2. 없으면 `tools/build_template_showcase.py` 또는 신규 스크립트로 합성 input 생성 → 빌드.
3. 사용자가 한컴오피스에서 정답 본과 나란히 비교 (시각 일치 / 불일치 보고).
4. 불일치 발견 시 Phase 1~4 의 어느 단계로 돌아가야 할지 분석 (extractor 출력 / fixture 선택 / 데이터 주입 등).

### Showcase 도구 확장 (선택)

`tools/build_template_showcase.py` 에 syn_div / Pascal 섹션 추가:

```python
SECTIONS.append({
    "label": "syn_div_3차",
    "type": "synthetic_division",
    "data": {"degree": 3, "nesting_count": 1, "rows": [...], ...},
})
SECTIONS.append({
    "label": "pascal_5행",
    "type": "pascal",
    "data": {"n_rows": 5, "display_form": "binomial", "cells": [...]},
})
```

빌드 후 사용자가 한컴오피스에서 각 라벨 섹션 확인.

## 체크리스트

- [ ] 실 시험지 빌드 + validate exit 0 — selector 호출 로그 확인 (어떤 fixture 가 선택됐는지)
- [ ] 합성 input 으로 syn_div 차수별 (3, 4, 5, 6, ...) 빌드 결과 생성
- [ ] 합성 input 으로 Pascal n_rows / display_form 별 빌드 결과 생성
- [ ] 사용자가 한컴오피스에서 정답 본과 시각 비교 → 통과/불일치 보고
- [ ] 불일치 발견 시 fix 회차 진행 (Phase 1~4 의 적절한 단계 재호출 또는 인라인 fix)

## 영향 범위

- 검증만, 직접적 코드 변경 거의 없음 (시각 일치 불일치 발견 시 fix 는 별도 회차).
- `tools/build_template_showcase.py` 확장 시 코드 변경.

## 검증

```bash
# 실 시험지 빌드 (셀렉터 로그 ON)
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs 2>&1 | grep -iE "syn_div|pascal|selector"

# 합성 input 빌드 (Showcase)
python3 tools/build_template_showcase.py

# 사용자가 한컴오피스에서 outputs/*.hwpx 열어 정답 본과 비교
# (자동화 불가 — 시각 검증)
ls -la outputs/*.hwpx | head -5
```

검증 통과 조건: 사용자 시각 검증 통과 (Phase 4 출력이 정답 본과 일치).
