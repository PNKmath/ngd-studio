---
phase: 5
title: E2E 검증 — 합성 + 실 시험지 + 사용자 시각 확인
status: pending
depends_on: [4]
scope:
  - tools/build_template_showcase.py
  - inputs/시험지 제작/.v3cache/
  - outputs/
intervention_likely: true
intervention_reason: "사용자가 한컴오피스에서 빌드 결과 vs 정답 본을 시각 비교해야 통과 판정 가능. 불일치 발견 시 회귀 fix 회차 진행."
---

# Phase 5: E2E 검증

> **범위**: Integration (빌드 + 시각 검증)
> **난이도**: M
> **의존성**: Phase 4 (전체 정합화 완료)
> **영향 파일**: 없음 (도구 확장 외 검증만)

## 배경

Phase 1~4 의 결과로 fixture 의미 / 데이터 스키마 / builder selector 의 삼각 일치가 확보됐는지, 코드만으로 양식지 본 수준의 HWPX 가 생성되는지 사용자가 한컴오피스에서 최종 확인.

## 설계

### 검증 매트릭스

| 검증 대상 | 비교 기준 | 통과 조건 |
|----------|----------|----------|
| `tools/build_template_showcase.py` 출력 | `_TEMPLATE_SHOWCASE_fixed_origin.hwpx` 의 라벨 섹션 | C 섹션 (FIXTURE × 코드) 의 모든 maker 호출 시 정답 본과 시각 일치 |
| 실 시험지 (`exam_data.json`) 빌드 | 정답 본의 동일 문제 섹션 | 보기 / 조건 박스 / 표 / 수식 / 머릿말 / ENDNOTE 시각 일치 |
| 합성 syn_div / Pascal input 빌드 | 양식지의 syn_div / Pascal 정답 | 새 selector 정확 작동 |

### 작업 흐름

1. showcase 빌드 + 사용자 시각 확인 (모든 fixture maker 노출)
2. 실 시험지 빌드 + 사용자 시각 확인
3. 합성 syn_div / Pascal input 빌드 (또는 사용자 양식지에 해당 문제 있으면 실 빌드)
4. 불일치 발견 시 fix 회차 — 어느 phase 로 회귀할지 분석 (스키마 / extractor / builder / fixture)

### Showcase 확장

`build_template_showcase.py` 에 새 fixture 의 C 섹션 (FIXTURE × 코드) 호출 추가 (이미 일부 있으면 갱신).

## 체크리스트

- [ ] `build_template_showcase.py` 확장 — 새 maker (proposition, choice_image, syn_div, pascal 등) 의 C 섹션 호출 추가
- [ ] showcase 빌드 + validate exit 0 → 사용자 한컴 시각 확인
- [ ] 실 시험지 빌드 + validate exit 0 → 사용자 한컴 시각 확인
- [ ] (가능하면) syn_div / Pascal 포함 합성 input 빌드 + 사용자 시각 확인
- [ ] 불일치 발견 시 → 어느 phase 로 회귀해 fix 할지 결정 후 회차 진행

## 영향 범위

- `build_template_showcase.py` 확장 시 코드 변경. 외에는 검증만.
- 통과 시 본 task (`ngd-create-v4-coherence`) 종료. ngd-exam-create V4 단계로 격상.

## 검증

```bash
# Showcase 빌드
python3 tools/build_template_showcase.py
LATEST_SC=$(ls -t outputs/_TEMPLATE_SHOWCASE_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST_SC" --fix
echo "showcase_exit=$?"

# 실 시험지 빌드
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
LATEST_EX=$(ls -t "outputs/[고]"*_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST_EX" --fix
echo "exam_exit=$?"

# 사용자 시각 확인용 파일 안내
echo "Compare files:"
echo "  $LATEST_SC vs outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx"
echo "  $LATEST_EX vs (사용자 양식지 정답)"
```

검증 통과 조건: 빌드 모두 exit 0 + 사용자 시각 검증 통과.
