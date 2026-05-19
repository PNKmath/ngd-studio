---
phase: 1
title: fixture audit + rename 명명 결정
status: completed
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

- [x] `fixture_audit.md` 신규 — 29개 fixture 의 용도 / cell 구조 / placeholder 분류 (실제 29개임을 확인)
- [x] `rename_map.md` 초안 — 의미 기반 새 이름 제안
- [x] 사용자와 함께 각 rename 결정 — rename_map.md 에 확정 표기
- [x] 영향받는 호출부 grep — 새 이름이 기존 코드 어디 어디에 영향 미치는지 사전 파악 (rename_map.md 호출부 섹션 참조)
- [x] Phase 2 worker 가 rename 적용 시 필요한 메타 (호출부 목록 + 일괄 sed 패턴) 까지 rename_map.md 에 첨부

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

## 실행 결과

### 1회차 (2026-05-19, run-1779154035-63374)

**수행 내용**:
- `resources/hwpx_base/` 전체 XML 목록 파악: 34개 총 XML, 인프라 5개 제외하면 **29개 fixture** (phase 계획의 "28개"보다 1개 많음 — `proof_table_template.xml` 포함됨을 확인)
- 29개 fixture 전체 Read + rowCnt/colCnt/cellSpan/박힘텍스트 분석
- `tables.py`, `shapes.py`, `assemble.py` 호출부 grep 완료
- `fixture_audit.md` 작성 (352줄 / `##` 헤딩 30개 — 29 fixture + 요약표)
- `rename_map.md` 작성 (146줄 / 29개 fixture 제안 + 호출부 grep 결과 + sed 패턴 초안)

**검증 결과**:
```
두 파일 모두 존재: ✓
fixture_audit.md: 352줄, ## 헤딩 30개 (29 fixture + 요약표 1)
rename_map.md: 146줄, 제안:/유지/대기 매칭 56건
```

**중단 이유**: 체크리스트 3번 "사용자와 함께 각 rename 결정" — 사용자 입력 필요. rename_map.md의 미결 질문 8개 참조.

**완료**: 1,2,4,5번 (4/5 항목) — 3번만 사용자 결정 대기.

**주목할 발견**:
- `choice_table_5x5.xml`이 이름과 달리 **명제(p:/q:) 전용** — 가장 오해 유발 가능성 높음
- `ganada_table.xml`은 실제로 rect(도형)이며, `make_ganada_table`이 이를 직접 읽지 않고 `condition_rect_template.xml`을 structural base로 사용 — rename/제거해도 코드 무영향
- `synthetic_division_template_1~4` + `Pascal_triangle_1~3`은 `fixture_remap.py`에만 참조, builder 미연결
- `increase_decrease_template_4x.xml`이 파일 크기 초과(31679 tokens)로 전체 Read 불가 — 기본 구조는 colCnt grep으로 확인 (5행 12열)

---

### 2회차 (2026-05-19) — completed

**수행 내용**: 사용자 결정 8건 반영 → rename_map.md 확정. syn_div/pascal 은 Phase 4 가변 생성기로 전환 결정.

**세부 반영**:
- bogi_table_3/4/6items → `bogi_box_3/4/6items.xml`
- choice_table_5x5 → `pq_proposition_table_5x5.xml` (치수 + 의미 동시 표현)
- choice_table_9x4 → `choice_image_5options.xml`
- choice_table_6x3 → `choice_grid_2cols.xml`
- choice_table_6x4 → `choice_grid_3cols.xml`
- increase_decrease_template/2x/3x/4x → `inc_dec_1x/2x/3x/4x.xml`
- synthetic_division_template + _1~4: `deprecated, Phase 4에서 제거` (make_syn_div 가변 생성기 전환)
- Pascal_triangle_1~3: `deprecated, Phase 4에서 제거` (make_pascal_triangle 가변 생성기 전환)
- ganada_table.xml: `삭제` (코드 무참조 확인됨)
- 나머지 (condition_rect, empty_box, proof_table, normal_dist_*, prob_dist_*): `유지`

**변경 파일**:
- `rename_map.md` — 전체 갱신 (결정 열 확정, 미결 질문 섹션 삭제, sed 패턴 갱신, 헤더 상태 갱신)
- `phase-01-fixture-audit-rename-design.md` — 체크리스트 3번 [x], 상태 completed

**검증 결과**:
```
두 파일 모두 존재: ✓
fixture_audit.md: 352줄, ## 헤딩 30개 (29 fixture + 요약표 1) ✓
rename_map.md: 132줄, 결정:/유지/→ 매칭 49건 ✓
```

**추가 발견사항**: Phase 4 스펙은 orchestrator가 별도로 갱신 예정 (가변 생성기 make_syn_div / make_pascal_triangle 방향).

**질문 / 결정 사항**: 없음 — 모든 미결 항목 확정 완료.

#### Scope Audit (orchestrator)
pass — 3 files in scope (fixture_audit.md, rename_map.md, phase-01-*.md self).

#### Verification Re-run (orchestrator)
exit 0 — 두 파일 존재 + audit 30 ## 헤딩 + rename_map 49 결정 매칭 모두 통과.

#### Review (orchestrator)
VERDICT: pass — 사용자 결정 8건 정확 반영, 체크리스트 5/5 정합, scope 위반 없음.

#### Commit
c06eef4 — docs(planning): Phase 1 — fixture audit + rename 확정
