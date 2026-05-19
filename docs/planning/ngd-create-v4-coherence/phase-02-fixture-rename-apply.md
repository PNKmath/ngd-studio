---
phase: 2
title: fixture 일괄 rename + 호출부 동기화
status: pending
depends_on: [1]
scope:
  - resources/hwpx_base/
  - tables.py
  - shapes.py
  - assemble.py
  - tools/build_template_showcase.py
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

- [ ] rename_map.md 의 모든 매핑이 호출부 어디서 사용되는지 grep 결과 정리
- [ ] `git mv` 로 fixture 파일명 일괄 변경
- [ ] 호출부 (tables.py / shapes.py / assemble.py / build_template_showcase.py) 의 새 이름 반영
- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` exit 0
- [ ] `python3 tools/build_template_showcase.py` exit 0

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
