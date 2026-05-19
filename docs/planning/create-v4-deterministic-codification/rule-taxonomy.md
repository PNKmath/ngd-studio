# Parts 정규화 규칙 Taxonomy

> 이 문서는 `solverPrompt.ts` 및 CLAUDE.md의 결정적 포맷 규칙을 체계적으로 정리한 명세다.
> Phase 2 (Python normalizer), Phase 3 (TS normalizer)가 이 문서를 구현 기준으로 삼는다.

## 규칙 목록

---

### R-01: 통수식 split (top-level `=` 기반 분리)

- **카테고리**: structure
- **적용 대상**: parts[].eq
- **transform**: 하나의 `eq` 에 `=` 가 최상위(braces/LEFT-RIGHT 바깥) 기준으로 2개 이상 → 각 `=` 단위로 끊어 별도 `{eq}` 로 분리, 이어붙이는 `=` 는 `{t: " "}` + `{eq: "= ..."}` 형태로 삽입
- **idempotent**: yes (이미 split된 입력은 변화 없음)
- **출처**: solverPrompt.ts:27
- **codifiable**: yes
- **예시**: `{"eq": "f(x) = x^2 + 2x = (x+1)^2 - 1"}` → `[{"eq": "f(x) = x^2 + 2x"}, {"t": " "}, {"eq": "= (x+1)^2 - 1"}]`

**depth-aware 규칙**:
- `{...}` 내부 `=` 는 split 대상 아님
- `LEFT(` ... `RIGHT)` 내부 `=` 는 split 대상 아님
- `LSUB`, `LSUP` 뒤 `{...}` 내부 `=` 는 split 대상 아님
- top-level `=` 수가 1이면 split 안 함 (하나의 등호는 정상 수식)

---

### R-02: DEG 붙여쓰기

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: `(\d+)\s+DEG` → `$1DEG` (숫자와 DEG 사이 공백 제거)
- **idempotent**: yes
- **출처**: solverPrompt.ts:36
- **codifiable**: yes
- **예시**: `"60 DEG"` → `"60DEG"`, `"90 DEG"` → `"90DEG"`

---

### R-03: bullet 기호 → cdot 치환

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: `·` (U+00B7), `•` (U+2022), `⋅` (U+22C5) → `cdot`
- **idempotent**: yes (cdot은 더 이상 치환 대상이 아님)
- **출처**: hwp-equation reference
- **codifiable**: yes
- **예시**: `"a · b"` → `"a cdot b"`, `"vec a • vec b"` → `"vec a cdot vec b"`

---

### R-04: cdots 역따옴표 감싸기

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: `` cdots `` (역따옴표 없는) → `` `cdots` `` (양쪽 역따옴표)
- **idempotent**: yes (이미 `` `cdots` `` 이면 변화 없음)
- **출처**: solverPrompt.ts:41
- **codifiable**: yes
- **예시**: `"a_1 + cdots + a_n"` → `` "a_1 + `cdots` + a_n" ``

**주의**: `` `cdots` `` 이미 감싸진 경우 이중 감싸기 금지.

---

### R-05: 쉼표 뒤 `~` 자동 삽입 (수식 내)

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: `,` 바로 뒤에 공백 또는 `~` 가 없으면 `,~` 로 대체. 이미 `, ` 이나 `,~` 이면 그대로.
- **idempotent**: yes
- **출처**: solverPrompt.ts:41
- **codifiable**: partial (한국어 텍스트 내 쉼표와 혼동 가능 — eq 필드에만 적용)
- **예시**: `"(a, b, c)"` → `"(a,~ b,~ c)"`, `"(a,~ b)"` → `"(a,~ b)"` (불변)

---

### R-06: LEFT/RIGHT 공백 보강

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: `LEFT(` → `LEFT (`, `RIGHT)` → `RIGHT )` (소문자 포함: `left(`, `right)`)
- **idempotent**: yes
- **출처**: solverPrompt.ts:37
- **codifiable**: yes
- **예시**: `"LEFT(x + y RIGHT)"` → `"LEFT (x + y RIGHT )"`, `"LEFT (x RIGHT )"` → `"LEFT (x RIGHT )"` (불변)

---

### R-07: leading `_` → LSUB 변환

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: 수식이 `_` 로 시작하거나, 연산자 패턴 없이 순수 `_{token}` 이 맨 앞에 오는 경우 → `{prev} LSUB {token}` 형태로 재구성
- **idempotent**: yes
- **출처**: solverPrompt.ts:31
- **codifiable**: partial (context-aware parsing 필요 — leading `_` 만 처리. 내부 `_` 는 정상)
- **예시**: `"_n C _r"` → 이 패턴 자체는 R-08로 처리; 독립 leading: `"_{n} P_{r}"` → 이미 올바름; `eq: "_n"` 단독 → 주의 필요 (blank base + LSUB)

---

### R-08: 순열/조합 패턴 정규화

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**:
  - `_nC_r` / `_{n}C_{r}` → `` {it`_n`}{rm C}_{it r} `` (nCr 조합)
  - `_nP_r` / `_{n}P_{r}` → `` {it`_n`}{rm P}_{it r} `` (nPr 순열)
  - `_nH_r` / `_{n}H_{r}` → `` {it`_n`}{rm H}_{it r} `` (nHr 중복조합)
- **idempotent**: yes (이미 `{rm C}` 패턴이면 재처리 안 함)
- **출처**: solverPrompt.ts:32
- **codifiable**: yes
- **예시**: `"_5C_3"` → `"{it`_5`}{rm C}_{it 3}"`, `"_{10}P_{4}"` → `` "{it`_{10}`}{rm P}_{it 4}" ``

---

### R-09: rm체 단위 enforcement

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: 수식 내 단독 단위 문자열 (`kg`, `m`, `cm`, `km`, `s`, `A`, `N`, `J`, `W`, `V`, `Hz`, `Pa`, `K`, `mol`, `cd`, `rad` 등) → `rm kg`, `rm m`, `rm cm` 등으로 감싸기
- **idempotent**: yes (이미 `rm` 접두어가 있으면 재적용 안 함)
- **출처**: CLAUDE.md
- **codifiable**: partial (변수명과 단위의 문맥 구분이 휴리스틱. 분수 분자/분모 내 단위 처리는 제한적)
- **예시**: `"150 kg"` → `"150 rm kg"`, `"v = 30 m / s"` → `"v = 30 rm m / rm s"`, `"rm kg"` → `"rm kg"` (불변)

---

### R-10: 수식 연산자 앞뒤 공백

- **카테고리**: equation-syntax
- **적용 대상**: parts[].eq
- **transform**: binary 연산자 `+`, `-`, `=`, `<`, `>`, `≤`, `≥`, `≠` 앞뒤에 공백 보장. 단, 지수/첨자 내부(`^{...}`, `_{...}`) 및 unary 맥락은 제외.
- **idempotent**: yes
- **출처**: solverPrompt.ts:28
- **codifiable**: partial (unary minus 구분이 어려움. top-level binary operator만 처리)
- **예시**: `"x+y=3"` → `"x + y = 3"`, `"x^{n+1}"` → `"x^{n+1}"` (지수 내부는 불변), `"-1 + 2"` → `"-1 + 2"` (unary minus 불변)

---

## Fixture JSON Schema

각 fixture 파일은 다음 JSON Schema를 따른다:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PartsNormalizationFixture",
  "type": "object",
  "required": ["id", "rule_ids", "description", "input", "expected"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^(R-\\d{2}|MULTI-\\d{2}|IDEMPOTENT-\\d{2})(-[a-z0-9-]+)?$",
      "description": "Fixture 식별자. 예: R-01-basic, R-01-nested-braces, MULTI-01, IDEMPOTENT-01"
    },
    "rule_ids": {
      "type": "array",
      "items": {"type": "string", "pattern": "^R-\\d{2}$"},
      "description": "이 fixture가 검증하는 규칙 ID 목록"
    },
    "description": {
      "type": "string",
      "description": "이 케이스가 테스트하는 내용 한 줄 설명"
    },
    "input": {
      "type": "object",
      "required": ["parts"],
      "properties": {
        "parts": {
          "type": "array",
          "items": {
            "oneOf": [
              {"type": "object", "required": ["t"], "properties": {"t": {"type": "string"}}},
              {"type": "object", "required": ["eq"], "properties": {"eq": {"type": "string"}}},
              {"type": "object", "required": ["br"], "properties": {"br": {"type": "boolean", "const": true}}}
            ]
          }
        }
      }
    },
    "expected": {
      "type": "object",
      "required": ["parts"],
      "properties": {
        "parts": {
          "type": "array",
          "items": {
            "oneOf": [
              {"type": "object", "required": ["t"], "properties": {"t": {"type": "string"}}},
              {"type": "object", "required": ["eq"], "properties": {"eq": {"type": "string"}}},
              {"type": "object", "required": ["br"], "properties": {"br": {"type": "boolean", "const": true}}}
            ]
          }
        }
      }
    },
    "notes": {
      "type": "string",
      "description": "추가 설명 또는 edge case 이유 (선택)"
    }
  }
}
```

### 규칙 codifiability 요약

| ID | 규칙 | codifiable |
|----|------|-----------|
| R-01 | 통수식 split | yes |
| R-02 | DEG 붙여쓰기 | yes |
| R-03 | bullet → cdot | yes |
| R-04 | cdots 역따옴표 | yes |
| R-05 | 쉼표 뒤 ~ | partial |
| R-06 | LEFT/RIGHT 공백 | yes |
| R-07 | leading _ → LSUB | partial |
| R-08 | 순열/조합 정규화 | yes |
| R-09 | rm체 단위 | partial |
| R-10 | 연산자 공백 | partial |
