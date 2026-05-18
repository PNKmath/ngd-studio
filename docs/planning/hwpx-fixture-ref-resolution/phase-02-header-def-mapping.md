---
phase: 2
title: header 정의 의미 분류 + 두 header 간 매핑 도구
status: completed
depends_on: [1]
scope:
  - tools/header_def_mapper.py
  - docs/planning/hwpx-fixture-ref-resolution/mapping.md
intervention_likely: false
intervention_reason: ""
---

# Phase 2: header.xml 정의 의미 분류 + 매핑 도구

> **범위**: Tools (Python)
> **난이도**: M
> **의존성**: Phase 1 (ref 시스템 규칙 + 매핑 기준 확정 후)
> **영향 파일**: `tools/header_def_mapper.py` (신규), `docs/planning/hwpx-fixture-ref-resolution/mapping.md` (신규)

## 배경

우리 header.xml (147KB) 과 사용자 authoritative 본 `_TEMPLATE_SHOWCASE_fixed.hwpx` 안의 header.xml (82KB) 은 한컴 GC 영향으로 인덱스가 다르다. 사용자 fixture의 paraPrIDRef/charPrIDRef/borderFillIDRef 인덱스가 사용자 header 기준이므로, Phase 3 에서 우리 header 기준으로 재매핑하려면 두 header 간 정의의 의미적 대응 표가 필요하다.

수동으로 만들면 시간 낭비 + 오류 가능성 큼. 도구로 자동화.

## 설계

### 도구: `tools/header_def_mapper.py`

```python
"""
header_def_mapper.py — 두 header.xml 간 paraPr/charPr/borderFill 정의 매핑

사용:
  python3 tools/header_def_mapper.py <our_header.xml> <user_header.xml> > mapping.json

출력 (JSON):
{
  "paraPr": {
    "user_idx_to_our_idx": {1: 2, 4: ..., 8: ..., 11: 29, ...},
    "unmapped_user": [N, ...]   # 우리에게 없는 사용자 정의
  },
  "charPr": {...},
  "borderFill": {...}
}
```

### 매칭 알고리즘

Phase 1 `04-mapping-strategy.md` 의 결정에 따라:

- **paraPr 매칭 키**: align horizontal/vertical + margin (intent/left/right) + tabPrIDRef 존재 여부. 추가로 indent / spacing 등 시각 영향이 큰 attribute.
- **charPr 매칭 키**: font (fontRef.face + fontRef.italic 등) + bold + height + textColor + strikeout / underline.
- **borderFill 매칭 키**: 4-side border (color + width + style) + fillBrush 패턴.

세 종류 모두 동일 인터페이스:

```python
def fingerprint_paraPr(elem_xml: str) -> str:
    """정의 본문에서 매칭 키를 정규화된 문자열로 추출."""
    ...

def build_mapping(our_defs: list[str], user_defs: list[str]) -> dict[int, int]:
    """fingerprint 일치 기준으로 user_idx → our_idx 매핑."""
    ...
```

### 매핑 표 산출물

`docs/planning/hwpx-fixture-ref-resolution/mapping.md`:

```markdown
# Header 정의 매핑 — user → ours

## paraPr (사용자 12개 → 우리 30개)

| user_idx | our_idx | fingerprint (align, margin) | 비고 |
|----------|---------|----------------------------|------|
| 0 | 0 | LEFT, 0/0/0 | 본문 기본 |
| 1 | 1 | LEFT, 0/0/0, tabPr=1 | LEFT tab |
| 4 | ? (LEFT) | LEFT, ... | 우리 idx 4 는 RIGHT — 다른 인덱스로 매핑 |
| 11 | 29 | CENTER, 0/0/0 | 보기 헤더 |
| ... | ... | ... | ... |

## charPr (사용자 21개 → 우리 42개)
...

## borderFill (사용자 60개 → 우리 81개)
...

## Unmapped (사용자에게는 있는데 우리에게 없는 정의)
- paraPr user[N]: ... → 처리 방안: ?
- ...
```

### 매핑 실패 처리

매핑 자동 결정이 어려운 경우(여러 후보가 fingerprint 동일, 또는 0 매치):
- mapping.md 의 "비고" 컬럼에 `?` 또는 후보 목록 명시
- Phase 3 worker 가 fallback 규칙 (가장 가까운 align 만 매칭 등) 으로 처리하거나 사용자에게 escalate

## 체크리스트

- [x] `tools/header_def_mapper.py` 구현 (paraPr/charPr/borderFill 3종 매칭)
- [x] fingerprint 함수 단위 테스트 (Bash one-liner 또는 `if __name__ == "__main__"` 자가검증)
- [x] 우리 header.xml 과 사용자 본 (`/tmp/showcase_fixed/Contents/header.xml`) 로 실행 → mapping.json 산출
- [x] `docs/planning/hwpx-fixture-ref-resolution/mapping.md` 생성 (사람이 읽을 수 있는 표 + Unmapped 목록 명시)
- [x] 매핑 결과 의 sanity check — 알려진 케이스 (`user_idx=11 → our_idx=29` CENTER 정렬) 가 도구에서 정확히 나오는지 확인

## 영향 범위

- 본 phase 는 도구 + 분석 산출. 코드 운영 파일 변경 없음.
- Phase 3 가 본 phase 의 mapping.json 을 입력으로 사용.
- 도구는 `tools/` 에 있어 재사용 가능 (다른 양식지 header 비교에도 활용 가능).

## 검증

```bash
# 도구 동작 확인
python3 tools/header_def_mapper.py \
  resources/hwpx_base/Contents/header.xml \
  /tmp/showcase_fixed/Contents/header.xml \
  > /tmp/mapping.json
python3 -c "import json; m=json.load(open('/tmp/mapping.json')); print('paraPr mapped:', len(m['paraPr']['user_idx_to_our_idx']))"

# 알려진 매핑 검증
python3 -c "
import json
m = json.load(open('/tmp/mapping.json'))
para = m['paraPr']['user_idx_to_our_idx']
# user 11 (CENTER align) 은 우리에서 align CENTER 항목으로 매핑되어야 함
# our header 에서 align CENTER 정의 위치 확인 후 일치 확인
print('user 11 → our:', para.get('11', para.get(11)))
"

# 매핑 노트 존재 확인
ls docs/planning/hwpx-fixture-ref-resolution/mapping.md
grep -c "^|" docs/planning/hwpx-fixture-ref-resolution/mapping.md
```

## 실행 결과

### 1회차 (2026-05-19 KST) — 완료

**상태**: completed
**소요 시간**: 약 20분
**진행 모델**: claude-sonnet-4-6

#### 요약

`tools/header_def_mapper.py` 를 신규 구현했다. paraPr/charPr/borderFill/tabPr 4종 fingerprint 기반 매핑을 지원하며, `--selftest` 플래그로 단위 테스트, `--markdown` 플래그로 사람이 읽는 표를 출력한다. 실제 header 2개로 실행 결과 paraPr 12/12, charPr 21/21, borderFill 60/60 모두 처리 완료 (일부 unmapped 항목 있음). 알려진 케이스 user[11] → our[29] 정확히 확인됨.

#### 변경 파일

- `tools/header_def_mapper.py` (신규, +350줄)
- `docs/planning/hwpx-fixture-ref-resolution/mapping.md` (신규, +127줄)

#### 검증 결과

- [x] `paraPr mapped: 12` — `python3 tools/header_def_mapper.py ... > /tmp/mapping.json` → pass
- [x] `user 11 → our: 29` — 알려진 케이스 일치 → pass
- [x] `ls mapping.md` → 존재 → pass
- [x] `grep -c "^|" mapping.md` → 99줄 → pass
- [x] `--selftest` — 3개 assertion 모두 PASS

#### 추가 발견사항

- **unmapped paraPr**: user[3,4,8,9] — intent 값이 우리 header에 없는 값 (-2056, -1695, -1656, -1695 CENTER). Phase 3 fallback 처리 필요.
- **unmapped charPr**: user[3,7,9,10,11] — textColor=#FFFFFF (흰색), 높이 1400/1700/1200/2400 등 우리 header에 없는 정의.
- **unmapped borderFill**: user[5,21,34,35,36,40] — 우리에 없는 border+fill 조합. Phase 3에서 대응 처리 필요.
- borderFill id=1 (no fillBrush)과 id=3 (hatchColor=#000000)은 fingerprint 동일 → 둘 다 our[1]로 수렴. 시각적으로 동일하므로 무해.

#### 질문 / 결정 사항

없음

#### Scope Audit (orchestrator)
pass — tools/header_def_mapper.py 와 mapping.md (shell redirect 생성, hook 미캡처지만 scope 내) 모두 scope 적합. PHASE_FILE exempt.

#### Verification Re-run (orchestrator)
exit 0 — mapper 실행 + mapping.json 생성 + user[11]→our[29] 확인 + mapping.md 99 pipe-lines.

#### Simplify (orchestrator)
1 edit — `_user_fp` 내 border_map/tab_map 이중 `.get()` 호출을 `or` 패턴으로 단순화. VERIFY pass.

#### Review (orchestrator)
VERDICT: pass — 스펙 완전 구현, 4단계 매핑·JSON 구조·알려진 케이스 일치. Minor 경고: `parse_header()`에서 `ref_list=None` None-guard 부재 (현 입력 범위 무해, Phase 3 전 opportunistic 추가 권장).

#### Commit
442a84e
