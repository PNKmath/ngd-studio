---
phase: 1
title: 규칙 taxonomy + 공유 fixture 셋업
status: completed
depends_on: []
scope:
  - docs/planning/create-v4-deterministic-codification/rule-taxonomy.md
  - ngd-studio/tests/fixtures/parts_normalization/
intervention_likely: false
intervention_reason: ""
---

# Phase 1: 규칙 taxonomy + 공유 fixture 셋업

> **범위**: 문서/fixture only
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `rule-taxonomy.md` (신규), `tests/fixtures/parts_normalization/*.json` (신규)

## 배경

Phase 2(Python)와 Phase 3(TS)이 동일한 정규화 규칙을 독립 구현하는데, 양 구현이 어긋나지 않으려면 **공유 spec + 공유 fixture**가 선행되어야 한다.

현재 결정적 규칙은 `solverPrompt.ts:14-63`에 자연어로 분산되어 있어 코드 구현 시 누락/해석 차이가 발생한다.

## 설계

### 1. 규칙 taxonomy 문서

`docs/planning/create-v4-deterministic-codification/rule-taxonomy.md`에 각 규칙을 다음 스키마로 정리:

```markdown
### R-XX: <규칙 이름>

- **카테고리**: equation-syntax | text-formatting | structure
- **적용 대상**: parts[].eq | parts[].t | parts 전체
- **transform**: input → output 매핑 규칙 한 문장
- **idempotent**: yes (재적용해도 변화 없음)
- **출처**: solverPrompt.ts:NN
- **예시**: `<before>` → `<after>`
```

대상 규칙 (최소):

| ID | 규칙 | 출처 |
|----|------|------|
| R-01 | 통수식 split (top-level `=` ≥ 2 → 다중 `{eq}` + `{t:"="}` 글루) | solverPrompt.ts:28 |
| R-02 | `60 DEG` → `60DEG` (DEG 숫자 붙여쓰기) | solverPrompt.ts:38 |
| R-03 | bullet `·` `•` `⋅` → `cdot` | hwp-equation reference |
| R-04 | `cdots` → `` `cdots` `` (양쪽 backtick) | solverPrompt.ts:42 |
| R-05 | 쉼표 뒤 `~` 자동 삽입 (수식 내부) | solverPrompt.ts:41 |
| R-06 | `LEFT(` → `LEFT (`, `RIGHT)` → `RIGHT )` (공백 보강) | solverPrompt.ts:38 |
| R-07 | leading `_` (예: `_n`)을 LSUB로 변환 (`_{n}` → `{...} LSUB {n}`) | solverPrompt.ts:32 |
| R-08 | 순열/조합 패턴 정규화 (`_nC_r` → `{it~_n}{rm C}_{it~r}`) | solverPrompt.ts:33 |
| R-09 | rm체 단위 enforcement (`kg`, `m`, `cm`, `A`, ... 단독 텍스트 → `rm`) | CLAUDE.md |
| R-10 | 수식 연산자 앞뒤 공백 (`x+y=3` → `x + y = 3`) | solverPrompt.ts:29 |

규칙별로 **codifiable: yes/partial/no**를 표시. partial은 휴리스틱 한계 명시.

### 2. 공유 fixture

`ngd-studio/tests/fixtures/parts_normalization/`에 fixture 디렉토리 생성. 각 fixture는:

```json
{
  "id": "R-01-basic",
  "rule_ids": ["R-01"],
  "description": "기본 통수식 split",
  "input": {
    "parts": [
      {"t": "따라서 "},
      {"eq": "f(x) = x^2 + 2x = (x+1)^2 - 1"}
    ]
  },
  "expected": {
    "parts": [
      {"t": "따라서 "},
      {"eq": "f(x) = x^2 + 2x"},
      {"t": " "},
      {"eq": "= (x+1)^2 - 1"}
    ]
  }
}
```

최소 fixture 수:
- 각 규칙당 basic 1개 + edge case 1개 = 20개
- idempotency 검증용 (이미 정규화된 입력 = 동일 출력) = 3개
- 복합 케이스 (여러 규칙 동시 적용) = 3개

**파일명**: `{rule-id}-{slug}.json` (예: `R-01-basic.json`, `R-01-nested-braces.json`)

### 3. fixture index

`ngd-studio/tests/fixtures/parts_normalization/index.json`에 전체 fixture 목록 자동 생성용 메타. Phase 2/3 테스트가 이 index를 읽어 모든 fixture를 자동 실행.

## 체크리스트

- [x] `docs/planning/create-v4-deterministic-codification/rule-taxonomy.md` 작성 — R-01~R-10 각각의 transform / idempotency / codifiability 명시
- [x] `ngd-studio/tests/fixtures/parts_normalization/` 디렉토리 생성
- [x] fixture JSON 최소 26개 (각 규칙 basic+edge 20 + idempotency 3 + 복합 3) 생성
- [x] `index.json` — 모든 fixture 파일명 + rule_ids 목록
- [x] 통수식 split fixture 중 **depth-aware** 케이스 포함 (`{` `}` / `LEFT(` `RIGHT)` / `LSUB` `LSUP` 내부 `=`는 split 안 됨)
- [x] fixture JSON schema 명시 (rule-taxonomy.md 마지막 절)

## 영향 범위

- 신규 파일만 추가. 기존 코드 변경 없음.
- Phase 2, 3이 fixture를 read-only로 소비.
- fixture 추가/수정 시 Phase 2, 3 테스트가 자동 검증 (run 시 재발견).

## 검증

```bash
ls ngd-studio/tests/fixtures/parts_normalization/*.json | wc -l
# 26 이상

# JSON 유효성
for f in ngd-studio/tests/fixtures/parts_normalization/*.json; do
  python3 -c "import json; json.load(open('$f'))" || echo "INVALID: $f"
done

# index 정합성
python3 -c "
import json, os
idx = json.load(open('ngd-studio/tests/fixtures/parts_normalization/index.json'))
files = set(os.listdir('ngd-studio/tests/fixtures/parts_normalization')) - {'index.json'}
listed = set(e['file'] for e in idx)
assert listed == files, f'index mismatch: missing={files-listed} extra={listed-files}'
"
```

## 실행 결과

### 1회차 (2026-05-20 오늘 KST) — completed

**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약

R-01~R-10 10개 규칙의 transform/idempotency/codifiability를 `rule-taxonomy.md`에 정리하고, `ngd-studio/tests/fixtures/parts_normalization/`에 fixture 28개(basic+edge 20, idempotency 3, 복합 3, R-01 depth-aware 2 포함)와 `index.json`을 생성했다. 모든 JSON 유효성 검증 및 index 정합성 검증 통과.

#### 변경 파일

- `docs/planning/create-v4-deterministic-codification/rule-taxonomy.md` (신규, +137줄)
- `ngd-studio/tests/fixtures/parts_normalization/` (신규 디렉토리)
  - `R-01-basic.json` (신규)
  - `R-01-nested-braces.json` (신규, depth-aware)
  - `R-01-left-right.json` (신규, depth-aware)
  - `R-01-triple-split.json` (신규)
  - `R-02-basic.json` (신규)
  - `R-02-already-attached.json` (신규)
  - `R-03-basic.json` (신규)
  - `R-03-multiple-bullets.json` (신규)
  - `R-04-basic.json` (신규)
  - `R-04-already-wrapped.json` (신규)
  - `R-05-basic.json` (신규)
  - `R-05-already-tilde.json` (신규)
  - `R-06-basic.json` (신규)
  - `R-06-already-spaced.json` (신규)
  - `R-07-basic.json` (신규)
  - `R-07-internal-subscript-ok.json` (신규)
  - `R-08-basic.json` (신규)
  - `R-08-permutation.json` (신규)
  - `R-09-basic.json` (신규)
  - `R-09-already-rm.json` (신규)
  - `R-10-basic.json` (신규)
  - `R-10-exponent-interior.json` (신규)
  - `IDEMPOTENT-01-already-normalized-eq.json` (신규)
  - `IDEMPOTENT-02-already-split-parts.json` (신규)
  - `IDEMPOTENT-03-combination-normalized.json` (신규)
  - `MULTI-01-deg-and-operator-spacing.json` (신규)
  - `MULTI-02-bullet-and-comma-tilde.json` (신규)
  - `MULTI-03-split-and-left-right.json` (신규)
  - `index.json` (신규, 28개 항목)

#### 검증 결과

- [x] fixture 개수: `ls *.json | wc -l` → 29 (index.json 포함, 실질 fixture 28개) — pass (≥26)
- [x] JSON 유효성: 전 29파일 `python3 -c "json.load(...)"` → 모두 pass
- [x] index 정합성: `listed == files` assert → pass (OK, Total fixtures: 28)

#### 추가 발견사항

- R-07(leading _ → LSUB)은 context-aware 파싱 필요로 `partial`. R-08(순열/조합) 패턴과 겹치는 케이스는 R-08이 우선 처리하므로 R-07 fixture는 패턴 감지(플래그) 목적으로만 설계했음.
- R-01 depth-aware fixture 2개(nested-braces, left-right)가 스펙 요구 `LSUB/LSUP` 케이스도 커버하는 형태로 설계(LSUB/LSUP 내부 `=`는 `{...}` 내부와 동일 규칙 적용).

#### 질문 / 결정 사항

없음

#### Scope Audit (orchestrator)

pass — 30 files in scope (rule-taxonomy.md + 29 fixtures, PHASE_FILE 자체 exempt).

#### Verification Re-run (orchestrator)

exit 0 — 29개 JSON 유효성 통과, index 정합성 OK.

---

### 2회차 (2026-05-20 오늘 KST) — completed

**상태**: completed
**소요 시간**: 약 2분
**진행 모델**: claude-sonnet-4-6

#### 요약

`rule-taxonomy.md`의 Fixture JSON Schema에서 `id.pattern`을 `^R-\\d{2}(-[a-z0-9-]+)?$`에서 `^(R-\\d{2}|MULTI-\\d{2}|IDEMPOTENT-\\d{2})(-[a-z0-9-]+)?$`로 확장. MULTI-01~03, IDEMPOTENT-01~03 fixture id가 스키마와 매칭되도록 수정.

#### 변경 파일

- `docs/planning/create-v4-deterministic-codification/rule-taxonomy.md` (수정, +1/-1줄)

#### 검증 결과

- [x] JSON 유효성 전수: pass (29개 전체)
- [x] index 정합성: pass (OK, Total fixtures: 28)

#### 추가 발견사항

없음

#### 질문 / 결정 사항

없음

#### Simplify (orchestrator)

skipped — markdown spec + JSON fixtures, no executable code to simplify.

#### Review (orchestrator, 1회차)

fix_required — Fixture JSON Schema의 `id.pattern`이 MULTI-/IDEMPOTENT- prefix 거부 → 6개 fixture validation 실패 위험.

#### Review (orchestrator, 2회차)

pass — `id.pattern` 확장 적용 확인. Verification Re-run 재실행 exit 0.
