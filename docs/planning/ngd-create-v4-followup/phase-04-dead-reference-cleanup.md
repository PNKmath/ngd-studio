---
phase: 4
title: pre-existing dead reference 정리 (.claude/tests/, archive/)
status: pending
depends_on: []
scope:
  - .claude/tests/check_integrity.sh
  - .claude/tests/README.md
  - archive/
intervention_likely: true
intervention_reason: "archive/ 디렉터리 보존 vs 삭제 결정 + check_integrity.sh 의 .claude/skills/ngd-exam-create/base_hwpx/ 경로 (실재 안 함) 처리 방향 결정 사용자 입력 필요."
---

# Phase 4: pre-existing dead reference 정리

> **범위**: Docs / Tests (외곽 도구)
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `.claude/tests/check_integrity.sh`, `.claude/tests/README.md`, `archive/build_gyeongbuk_v3.py` (등)

## 배경

ngd-create-v4-coherence Phase 2 (1회차 리뷰) 와 후속 grep 에서 확인된 dead reference 잔존:

1. `.claude/tests/check_integrity.sh:29` — 옛 fixture 이름 `bogi_table_3items.xml`, `choice_table_5x5.xml` 참조. 동일 파일 line 28: `.claude/skills/ngd-exam-create/base_hwpx/*.xml` glob — **이 디렉터리는 실재하지 않음** (실제 fixture 위치는 `resources/hwpx_base/`). 따라서 check_integrity.sh 의 base_hwpx 검사 전체가 dead.

2. `.claude/tests/README.md:24` — 위와 같은 옛 fixture 이름 + 같은 dead 경로 인용.

3. `archive/build_gyeongbuk_v3.py` — 옛 fixture 이름이 코드/주석에 잔존. archive 정의상 옛 코드 보존이라 "유물 그대로 둘지 / 의미 있는 정리 할지" 결정 필요.

이 셋은 ngd-create-v4-coherence 의 빌드 회귀에 영향 없으므로 phase 2/4 의 "scope 외 잔존" 으로 두었으나, follow-up 으로 정리.

## 설계

### 결정 사항 (사용자 입력 필요 — 시작 시)

worker 가 사용자와 확정:

1. **check_integrity.sh 의 base_hwpx 검사 (line 28~34)**:
   - 옵션 A: `resources/hwpx_base/` 로 경로 정정 + fixture 이름 신규로 갱신 (의미 살림)
   - 옵션 B: base_hwpx 검사 자체 삭제 (선행 작업으로 의미 잃었음)
   - 옵션 C: skill 자체가 deprecated 면 check_integrity.sh 폐기

2. **archive/build_gyeongbuk_v3.py 등 옛 빌더 스크립트** (3개: build_gyeongbuk.py, build_gyeongbuk_new.py, build_gyeongbuk_v3.py):
   - 옵션 A: 그대로 보존 (archive 정의 — 옛 기록)
   - 옵션 B: 헤더 주석 추가 ("DEPRECATED: 옛 fixture 이름 사용. 현재 빌드는 build_hwpx.py 사용") 후 보존
   - 옵션 C: 삭제 (git history 에 남음)

3. `.claude/tests/README.md` 는 check_integrity.sh 결정에 따라 자동 갱신.

### 작업 흐름

1. 사용자 결정 받기 (위 2 결정).
2. 결정에 따라 파일 갱신.
3. check_integrity.sh 직접 실행 → exit 0 확인 (검사 살린 경우) 또는 skip 안내 (폐기 경우).
4. 다른 옛 fixture 이름 잔존이 있는지 `git grep` 으로 전수 확인 후 phase 파일에 보고.

## 체크리스트

- [ ] 사용자 결정 받기 — (1) check_integrity.sh 의 base_hwpx 검사 처리 (2) archive 빌더 스크립트 처리 — 결과 phase 파일에 기록
- [ ] 결정 적용 — check_integrity.sh / README.md / archive 파일 갱신
- [ ] check_integrity.sh 실행 → exit 0 (검사 살린 경우) 또는 의도된 폐기 확인
- [ ] 전수 grep: 옛 fixture 이름 (bogi_table_, choice_table_5x5, choice_table_9x4, choice_table_6x3, choice_table_6x4, increase_decrease_template, synthetic_division_template, Pascal_triangle_, ganada_table) 잔존 파일 목록 보고 — 추가 정리 필요 여부 사용자 결정

## 영향 범위

- `.claude/tests/check_integrity.sh` 동작 변경 (정정 또는 폐기)
- `.claude/tests/README.md` 갱신
- `archive/` 디렉터리 (결정에 따라 보존 / 헤더 추가 / 삭제)
- 실 빌드 (`build_hwpx.py`, `build_template_showcase.py`) 에는 영향 없음 — 본 phase 의 모든 변경은 외곽 도구만 touch.

## 검증

```bash
# check_integrity.sh 결정 적용 후 실행 (살린 경우)
if [ -f .claude/tests/check_integrity.sh ]; then
  bash .claude/tests/check_integrity.sh
  echo "integrity_exit=$?"
fi

# 옛 fixture 이름 잔존 확인 (전수)
echo "=== 옛 이름 잔존 grep ==="
git grep -nE "bogi_table_3items|bogi_table_4items|bogi_table_6items|choice_table_5x5|choice_table_9x4|choice_table_6x3|choice_table_6x4|increase_decrease_template|synthetic_division_template|Pascal_triangle_|ganada_table" \
  -- ':!docs/planning/' ':!*.log' ':!docs/extractor-reference/' || echo "(잔존 0건)"

# 실 빌드 회귀 (영향 없어야 함)
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
echo exam=$?
```

검증 통과 조건: check_integrity.sh exit 0 (살린 경우) + grep 잔존 0건 (또는 archive 만 잔존이고 사용자 그대로 보존 결정) + 빌드 회귀 없음.
