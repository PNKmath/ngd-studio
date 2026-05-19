---
phase: 4
title: pre-existing dead reference 정리 (.claude/tests/, archive/)
status: done
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

### 결정 사항 (확정 — 2026-05-19)

1. **check_integrity.sh 의 base_hwpx 검사**: **A. `resources/hwpx_base/` 로 경로 정정 + fixture 이름 갱신** (의미 살림). 현재 활성 fixture 이름은 `resources/hwpx_base/` 디렉터리 ls + Phase 1 산출물 + ngd-create-v4-coherence 산출물 참조.

2. **archive/ 옛 빌더 스크립트** (3개: build_gyeongbuk.py, build_gyeongbuk_new.py, build_gyeongbuk_v3.py): **B. 헤더 주석 추가 후 보존**. 각 파일 최상단에 deprecation 헤더:
   ```python
   # DEPRECATED — 옛 fixture 이름 사용. 현재 빌드는 build_hwpx.py 를 사용하세요.
   # 본 파일은 과거 기록 참고용으로만 보존됨.
   ```

3. `.claude/tests/README.md` 는 check_integrity.sh A안 적용에 맞춰 fixture 이름/경로 갱신.

### 작업 흐름

1. 사용자 결정 받기 (위 2 결정).
2. 결정에 따라 파일 갱신.
3. check_integrity.sh 직접 실행 → exit 0 확인 (검사 살린 경우) 또는 skip 안내 (폐기 경우).
4. 다른 옛 fixture 이름 잔존이 있는지 `git grep` 으로 전수 확인 후 phase 파일에 보고.

## 체크리스트

- [x] 사용자 결정 받기 — (1) A안: resources/hwpx_base/ 경로 정정 + 최신 fixture 이름 갱신 (2) B안: archive/ 헤더 주석 추가 후 보존 — phase 파일에 기록 완료
- [x] 결정 적용 — check_integrity.sh / README.md / archive 파일 갱신 완료 (check #2 scripts 경로도 resources/hwpx_scripts/ 로 추가 정정)
- [x] check_integrity.sh 실행 → exit 0 확인 (ALL PASS: agent 6종 실존 / scripts 2종 실존 / base_hwpx 핵심 템플릿 실존 / agent frontmatter 정상 / SKILL.md 절대경로 참조 유효)
- [x] 전수 grep 완료 — 잔존 파일: archive/build_gyeongbuk_v3.py (DEPRECATED 헤더 추가됨, B안 허용), docs/*.md (doc 파일, 정리 불요), shapes.py/assemble.py (ganada_table 은 함수명, dead 파일 참조 아님), tables.py (주석 내 분석 출처 기록, dead 파일 참조 아님) — 추가 정리 불요

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
