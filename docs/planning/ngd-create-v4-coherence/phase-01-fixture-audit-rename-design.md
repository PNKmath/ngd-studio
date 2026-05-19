---
phase: 1
title: fixture audit + rename 명명 결정
status: pending
depends_on: []
scope:
  - docs/planning/ngd-create-v4-coherence/fixture_audit.md
  - docs/planning/ngd-create-v4-coherence/rename_map.md
intervention_likely: true
intervention_reason: "fixture 별 실제 용도 분류 + rename 명명은 양식지 관행과 사용자 명명 취향 결정 필요. 잘못 짓이면 호출부 전체 갱신 추가 비용."
---

# Phase 1: fixture audit + rename 명명 결정

> **범위**: Docs / Analysis (사용자 결정 받기)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `docs/planning/ngd-create-v4-coherence/fixture_audit.md` (신규), `rename_map.md` (신규)

## 배경

`resources/hwpx_base/` 의 fixture 파일명이 표 차원만 표현 (`choice_table_5x5`, `9x4` 등) — 실제 의미 (명제 / 그림 객관식 / 보기 / ...) 안 드러남. hwpx-fixture-ref-resolution Phase 4 / 5 디버깅에서 코드와 양식지 의도 불일치가 빈번히 발생한 직접 원인.

본 phase 에서 다음 두 산출물 작성:
1. **`fixture_audit.md`** — 전체 fixture 의 실제 용도 / cell 구조 / placeholder 위치 분류
2. **`rename_map.md`** — 의미 기반 새 파일명 매핑 (사용자 결정 반영)

## 설계

### fixture_audit.md 형식

각 fixture 마다:

```markdown
## bogi_table_3items.xml
- **용도**: 보기 3-item 박스 (ㄱ. ㄴ. ㄷ. 라벨)
- **rowCnt / colCnt**: 4 / 5
- **cellSpan 패턴**: row 2 col 1 에 colSpan=3 (3 라벨 셀)
- **placeholder 위치**: cell (1,2) — ㄱ./ㄴ./ㄷ. 라벨 + 본문 주입
- **fixture 박힘 (보존 대상)**: `< 보 기 >` 라벨 텍스트 + paraPr/charPr 매핑
- **호출**: `make_bogi_table` (tables.py:379), n_items <= 3 분기
```

전체 28개 fixture (`resources/hwpx_base/*.xml`, 제외: root_element / settings / version / content_hpf / header_area).

### rename_map.md 형식

```markdown
| 현재 이름 | 새 이름 (제안) | 의미 | 비고 |
|-----------|---------------|------|------|
| bogi_table_3items.xml | bogi_box_3items.xml | 보기 3-item | "table" 보다 "box" 가 더 정확 |
| bogi_table_4items.xml | bogi_box_4items.xml | 보기 4-item | |
| bogi_table_6items.xml | bogi_box_6items.xml | 보기 6-item | |
| choice_table_5x5.xml | proposition_5rows.xml | 명제 (5명제 × p:/가정/q:/결론) | "choice" 와 다른 용도 |
| choice_table_9x4.xml | choice_image_5options.xml | 그림 객관식 5보기 | rowSpan=3 이미지 placeholder |
| choice_table_6x3.xml | choice_grid_3choices.xml | 헤더 1행 + 1열 라벨 선지 | |
| choice_table_6x4.xml | choice_grid_4choices.xml | 동일 (4 항목) | |
| condition_rect_template.xml | (유지) | 조건 박스 programmatic | |
| ganada_table.xml | (유지) | (가)(나)(다) 조건 박스 | |
| empty_box_template.xml | (유지) | 빈 박스 | |
| increase_decrease_template.xml | increase_decrease_1x.xml | n_x=1 증감표 | n_x 표시로 통일 |
| increase_decrease_template_2x.xml | increase_decrease_2x.xml | 동일 | |
| increase_decrease_template_3x/4x | (그대로) | | |
| synthetic_division_template.xml | (deprecated, 추후 삭제) | 레거시 단일 | |
| synthetic_division_template_1~4 | syn_div_3차~6차.xml 또는 syn_div_nest1~4.xml | | Phase 4 결정 |
| Pascal_triangle_1~3 | pascal_triangle_5rows / 7rows / 9rows.xml | | Phase 4 결정 |
| 기타 (proof / normal_dist / prob_dist) | 그대로 | 의미 명확 | |
```

각 행에 대해 사용자 결정. 변경 안 하는 것도 포함.

### 사용자 결정 받기

phase 시작 시 worker 가 사용자와 한 번에:
- 각 후보 rename 에 대해 OK / 다른 이름 / skip 결정
- 의미 분류가 명확히 안 잡히는 fixture 는 사용자 설명 받기
- 결과를 rename_map.md 에 확정

## 체크리스트

- [ ] `fixture_audit.md` 신규 — 28개 fixture 의 용도 / cell 구조 / placeholder 분류
- [ ] `rename_map.md` 초안 — 의미 기반 새 이름 제안
- [ ] 사용자와 함께 각 rename 결정 — rename_map.md 에 확정 표기
- [ ] 영향받는 호출부 grep — 새 이름이 기존 코드 어디 어디에 영향 미치는지 사전 파악
- [ ] Phase 2 worker 가 rename 적용 시 필요한 메타 (호출부 목록 + 일괄 sed 패턴) 까지 rename_map.md 에 첨부

## 영향 범위

- 본 phase 는 문서 산출만. 코드 변경 없음.
- 산출물이 Phase 2 의 입력 (rename 적용 명세).

## 검증

```bash
ls docs/planning/ngd-create-v4-coherence/{fixture_audit.md,rename_map.md}
wc -l docs/planning/ngd-create-v4-coherence/{fixture_audit.md,rename_map.md}

# audit 가 28개 fixture 모두 포함
grep -c "^## " docs/planning/ngd-create-v4-coherence/fixture_audit.md

# rename_map 에 결정 표기 (각 행에 "결정:" 또는 "유지" 또는 "→")
grep -cE "결정:|유지|→" docs/planning/ngd-create-v4-coherence/rename_map.md
```

검증 통과 조건: 두 파일 모두 존재 + audit 28개 항목 + rename_map 각 항목 결정 표기.
