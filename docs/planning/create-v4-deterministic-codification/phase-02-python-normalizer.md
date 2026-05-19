---
phase: 2
title: Python normalizer — equation.py safety net
status: completed
depends_on: [1]
scope:
  - equation.py
  - tests/test_parts_normalizer.py
  - pyproject.toml
intervention_likely: false
intervention_reason: ""
---

# Phase 2: Python normalizer (equation.py safety net)

> **범위**: Backend (Python builder)
> **난이도**: L
> **의존성**: Phase 1 (fixture)
> **영향 파일**: `equation.py`, `tests/test_parts_normalizer.py` (신규), `pyproject.toml` (minimal pytest 셋업)

## 배경

`equation.py:97 parts_to_run_content`는 모든 HWPX 출력의 single funnel point다. 여기서 정규화하면 어느 JSON 경로(create-v4 / 오검 / 수동 / legacy)로 들어와도 통수식 등의 위반이 절대 HWPX에 도달하지 않는다.

현재 `parts_to_run_content`는 입력 parts를 그대로 XML로 직렬화한다 (`equation.py:102-115`). LLM이 만든 raw parts에 통수식·DEG 공백·bullet 등이 그대로 통과할 수 있다.

## 설계

### 1. `normalize_parts` 추가

`equation.py`에 다음 함수 추가:

```python
def normalize_parts(parts: list) -> list:
    """Apply deterministic normalization rules to a parts array.

    Idempotent: normalize_parts(normalize_parts(x)) == normalize_parts(x).
    Rules implemented per docs/planning/create-v4-deterministic-codification/rule-taxonomy.md.
    """
    parts = _split_equation_chains(parts)        # R-01
    parts = [_normalize_part(p) for p in parts]
    return parts


def _normalize_part(part: dict) -> dict:
    if "eq" in part:
        script = part["eq"]
        script = _fix_deg(script)                # R-02
        script = _fix_bullet_to_cdot(script)     # R-03
        script = _wrap_cdots(script)             # R-04
        script = _comma_tilde(script)            # R-05
        script = _left_right_space(script)       # R-06
        script = _leading_underscore_to_lsub(script)  # R-07
        script = _fix_permutation_combination(script)  # R-08
        script = _operator_spaces(script)        # R-10
        return {**part, "eq": script}
    if "t" in part:
        text = part["t"]
        text = _enforce_rm_units(text)           # R-09 (text-side)
        return {**part, "t": text}
    return part
```

### 2. 통수식 split — depth-aware

`_split_equation_chains(parts)`는 각 `{eq}` 안의 **최상위 `=`** (depth 0)를 찾아 분리. depth tracking:

- `{` `}` — depth ±1
- `LEFT(` `RIGHT)` — 키워드 기반 depth ±1 (regex로 토큰 매칭)
- `LSUB` `LSUP` — 다음 토큰까지 별도 scope (`LSUB {...}` block)
- 백틱 \`...\` 내부는 raw — `=` 무시

알고리즘 (간략):
```
def _split_top_level_eq(script):
    parts = []
    depth = 0
    in_backtick = False
    start = 0
    i = 0
    while i < len(script):
        c = script[i]
        if c == '`': in_backtick = not in_backtick
        elif not in_backtick:
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            elif depth == 0 and script[i:].startswith('LEFT('): depth += 1; i += 5; continue
            elif depth == 1 and script[i:].startswith('RIGHT)'): depth -= 1; i += 6; continue
            elif depth == 0 and c == '=':
                parts.append(script[start:i].rstrip())
                start = i  # include '=' in next chunk
        i += 1
    parts.append(script[start:].rstrip())
    return [p for p in parts if p.strip()]
```

split 결과는 `[{eq: "f(x) = x^2"}, {t: " "}, {eq: "= (x+1)^2"}]` 형태. 사이에 `{t: " "}` 글루 삽입.

### 3. `parts_to_run_content` 진입 시 자동 호출

```python
def parts_to_run_content(parts):
    parts = normalize_parts(parts)  # ← 신규
    content = ""
    # ... 기존 로직 ...
```

idempotent 보장 — 이미 TS 측에서 정규화된 parts가 들어와도 추가 변화 없음.

### 4. 공유 fixture 기반 pytest

`pyproject.toml` (또는 `pytest.ini`) minimal 셋업:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = "test_*.py"
```

`tests/test_parts_normalizer.py`:

```python
import json, glob, os
import pytest
from equation import normalize_parts

FIXTURE_DIR = "ngd-studio/tests/fixtures/parts_normalization"

@pytest.mark.parametrize("fixture_path", glob.glob(f"{FIXTURE_DIR}/*.json"))
def test_normalize_parts_fixture(fixture_path):
    if fixture_path.endswith("/index.json"): pytest.skip("index file")
    fx = json.load(open(fixture_path))
    actual = normalize_parts(fx["input"]["parts"])
    assert actual == fx["expected"]["parts"], f"mismatch in {fx['id']}"

@pytest.mark.parametrize("fixture_path", glob.glob(f"{FIXTURE_DIR}/*.json"))
def test_idempotent(fixture_path):
    if fixture_path.endswith("/index.json"): pytest.skip("index file")
    fx = json.load(open(fixture_path))
    once = normalize_parts(fx["input"]["parts"])
    twice = normalize_parts(once)
    assert once == twice
```

## 체크리스트

- [x] `equation.py`에 `normalize_parts(parts)` + 헬퍼 함수 8개 (R-01~R-10에 대응) 구현
- [x] `_split_top_level_eq` depth tracking — `{}`, `LEFT(/RIGHT)`, 백틱 내부 모두 처리
- [x] `parts_to_run_content` 진입 첫 줄에 `parts = normalize_parts(parts)` 삽입
- [x] `pyproject.toml`에 minimal pytest 설정 추가 (`testpaths`, `python_files`)
- [x] `tests/test_parts_normalizer.py` — Phase 1 fixture 전체를 parametrize로 검증
- [x] idempotency 테스트: 모든 fixture에 대해 `normalize(normalize(x)) == normalize(x)`
- [x] `python3 -m pytest tests/test_parts_normalizer.py -v` 전부 pass
- [x] 기존 `build_hwpx.py` 회귀: 임의 cache fixture로 build 실행 시 HWPX 정상 생성 (validate.py --fix exit 0)

## 영향 범위

- `equation.py` 단일 파일 변경 — 다른 Python 모듈은 영향 없음.
- 정규화는 idempotent — 기존 정상 입력에는 no-op.
- `parts_to_run_content`를 통하는 모든 HWPX 출력 경로 (`build_hwpx.py`, 오검 mutation, legacy builder) 자동 적용.

## 검증

```bash
# unit
python3 -m pytest tests/test_parts_normalizer.py -v

# 회귀 (임의 캐시 사용)
python3 build_hwpx.py outputs/<sample>/exam_data.json outputs/<sample>/ \
  && python3 resources/hwpx_scripts/fix_namespaces.py outputs/<sample>/*.hwpx \
  && python3 resources/hwpx_scripts/validate.py outputs/<sample>/*.hwpx --fix

# idempotency 확인 — 같은 cache로 두 번 build, byte diff 0
python3 build_hwpx.py outputs/<sample>/exam_data.json /tmp/build1
python3 build_hwpx.py outputs/<sample>/exam_data.json /tmp/build2
diff -r /tmp/build1 /tmp/build2  # empty
```

## 실행 결과

### 1회차 (2026-05-20 08:30 KST) — completed

**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
`equation.py`에 `normalize_parts` + 헬퍼 함수 10개(R-01~R-10) 구현. `parts_to_run_content` 진입 시 자동 호출. `pyproject.toml` 및 `tests/test_parts_normalizer.py` 신규 생성. Phase 1 fixture 28개 × 2 suite = 56 테스트 전부 pass. 기존 build 회귀 없음, section0.xml 두 번 빌드 identical 확인.

#### 변경 파일
- `/Users/junhyukpark/ngd/ngd-studio/equation.py` (수정, 약 +280줄): normalize_parts 함수군 추가, parts_to_run_content 진입부에 normalize_parts 삽입
- `/Users/junhyukpark/ngd/ngd-studio/pyproject.toml` (신규, +3줄): minimal pytest 설정
- `/Users/junhyukpark/ngd/ngd-studio/tests/test_parts_normalizer.py` (신규, +56줄): parametrized fixture 테스트 + idempotency 테스트

#### 검증 결과
- [x] unit test: `python3 -m pytest tests/test_parts_normalizer.py -v` → 56 passed in 0.03s
- [x] 회귀: `build_hwpx.py` + `fix_namespaces.py` + `validate.py --fix` → "HWPX 검증 통과"
- [x] idempotency build: 두 번 빌드 후 section0.xml diff → IDENTICAL

#### 추가 발견사항
R-01 split 로직은 "2번째 이후 최상위 `=`에서 분리" (첫 번째 `=`는 chunk 0에 포함). R-09는 partial 규칙 특성상 숫자 뒤에 오는 단위만 변환(변수 오탐 방지). R-10은 `{}` + `()` 양쪽 depth 추적으로 지수·괄호 내부 보호.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)

pass — equation.py + pyproject.toml + tests/test_parts_normalizer.py 모두 scope 내. (Phase 2/3 batch에서 session_id 공유로 hook 로그 직접 격리 불가 → git diff 기반 파일 단위 확인.)

#### Verification Re-run (orchestrator)

exit 0 — `python3 -m pytest tests/test_parts_normalizer.py` 56 passed (build_hwpx 회귀/idempotency는 worker 기록 인정).

#### Simplify (orchestrator)

2 files, 5 edits — equation.py `_operator_spaces()` 래퍼 인라인화 + `_normalize_part` 중복 분기 병합 + `_replace` 데드 ternary 정리, test 파일 index.json 중복 가드 제거. 검증 재실행 pass.

#### Review (orchestrator)

pass — A~I 전부 OK. 56 passed/0.03s, idempotency 확인, scope 준수.

#### Commit

`4b74446` — feat(equation): Phase 2 — Python normalizer (R-01~R-10) + pytest fixture suite
