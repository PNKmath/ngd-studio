---
phase: 3
title: extractor 메타데이터 스키마 정의 + extractor.ts + builder 정합화
status: pending
depends_on: [2]
scope:
  - docs/planning/ngd-create-v4-coherence/schema.md
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/
  - tables.py
  - shapes.py
  - assemble.py
intervention_likely: false
intervention_reason: ""
---

# Phase 3: 메타데이터 스키마 정의 + extractor + builder 정합화

> **범위**: Backend (TS + Python)
> **난이도**: L
> **의존성**: Phase 2 (rename 완료, 새 fixture 이름 확정)
> **영향 파일**: `docs/.../schema.md` (신규), `extractor.ts` (수정), builder 3 모듈 (수정)

## 배경

각 fixture 가 어떤 데이터 형식으로 호출되어야 하는지 명세가 부재. extractor 출력 ↔ builder 입력 사이 합의를 문서로 못 박고, 양측 코드를 그 명세에 정렬한다.

## 설계

### schema.md 산출물

각 fixture 별 입력 dict 명세:

```markdown
## bogi_box_3items (이전 bogi_table_3items)
- type tag: "bogi"
- 필수 필드: `items: list[{parts: list[{t?: str, eq?: str}]}]`
- selector 조건: n_items <= 3

## proposition_5rows (이전 choice_table_5x5)
- type tag: "proposition"
- 필수 필드: `rows: list[{hypothesis: str, conclusion: str}]` (5개)
- placeholder 위치: col=2 (가정) + col=4 (결론). col=0/1/3 fixture 박힘 보존.

## choice_image_5options (이전 choice_table_9x4)
- type tag: "choice_image"
- 필수 필드: `images: list[str]` (5개, BinData/ 이미지 ref 또는 텍스트 placeholder)
- placeholder 위치: col=1 rowSpan=3 (row=0,3,6) + col=3 rowSpan=3 (row=0,3). col=0/2 ①~⑤ 보존.

## syn_div_{변형} (Phase 4 에서 결정)
- type tag: "synthetic_division"
- 필수 필드: `degree: int`, `nesting_count: int`, `rows: list[list[str]]`

## pascal_triangle_{변형}
- type tag: "pascal"
- 필수 필드: `n_rows: int`, `cells: list[list[str]]`

...(전체 fixture 종류)
```

### extractor.ts 갱신

`ngd-studio/server/stages/extractor.ts` 의 출력 스키마 갱신:
- 새 type tag (`proposition`, `choice_image` 등) 등록
- LLM 프롬프트 instruction 추가 — 각 type 에 어떤 필드를 어떤 형식으로 추출할지
- 출력 dict 의 placeholder 매핑이 schema.md 명세를 따르도록

단위 테스트 (`__tests__/`) — 합성 입력으로 각 type 별 출력 필드 검증.

### builder 정합화

`tables.py` / `shapes.py` / `assemble.py` 의 maker 함수가 schema.md 명세의 입력 dict 그대로 받아 fixture 호출:
- `make_bogi_table(condition_box, base_path)` — 기존 유지
- `make_proposition_table` 신설 — `rows: list[{hypothesis, conclusion}]` 입력
- `make_choice_image_table` 신설 — `images: list[str]`
- assemble.py 의 dispatch — type tag → maker 함수 매핑 명확화

## 체크리스트

- [ ] `schema.md` 신규 — fixture 종류별 입력 dict 명세
- [ ] `extractor.ts` 의 출력 type tag + 필드 추가 (LLM 프롬프트 갱신 포함)
- [ ] `extractor.test.ts` 단위 테스트 추가 — 각 type 별 합성 입력 출력 검증
- [ ] builder maker 함수 정합화 — schema.md 명세대로 입력 받기
- [ ] assemble.py dispatch — type tag → maker 매핑 명확화
- [ ] 빌드 + validate 통과 (회귀 없음 확인)

## 영향 범위

- `extractor.ts` 의 출력 dict 구조 변경 — downstream (solver / verifier) 에 영향 가능. 영향 검토 필수.
- builder maker 함수 시그니처 일부 변경 — Phase 2 호출부 동기화 후 그래도 안 깨지는지 재확인.
- 기존 시험지 데이터 (`inputs/시험지 제작/.v3cache/exam_data.json`) 의 type 키도 새 명세에 맞춰야 — 또는 builder 가 옛/새 키 둘 다 호환되도록 (deprecation 기간).

## 검증

```bash
# TypeScript 컴파일
cd ngd-studio && npx tsc --noEmit && cd ..
echo "tsc_exit=$?"

# 단위 테스트
cd ngd-studio && npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic && cd ..

# Python 빌드 (회귀)
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
LATEST=$(ls -t "outputs/[고]"*_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST" --fix
echo "exam_exit=$?"

# 새 type tag 가 빌드에서 실제 작동 (합성 input)
python3 -c "
from tables import make_proposition_table  # 신설 가정
data = {'type': 'proposition', 'rows': [{'hypothesis':'h1','conclusion':'c1'} for _ in range(5)]}
xml = make_proposition_table(data, 'resources/hwpx_base')
assert '<hp:tbl' in xml
print('proposition OK')
"
```

검증 통과 조건: tsc + Python 빌드 + 단위 테스트 모두 통과 + 새 maker 함수 호출 가능.
