---
phase: 5
title: E2E 검증 + extractor reference 문서 패턴 도입
status: completed
depends_on: [4]
scope:
  - tools/build_template_showcase.py
  - inputs/시험지 제작/.v3cache/
  - outputs/
  - docs/extractor-reference/
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/prompts/
  - ngd-studio/server/stages/__tests__/
intervention_likely: true
intervention_reason: "사용자 시각 검증 + extractor reference doc 패턴 신설. 1회차 후 'syn_div/Pascal 셀이 수식 아닌 텍스트로 들어감' 피드백으로 2회차 확장: extractor가 doc 읽어 처리하는 패턴 도입."
---

# Phase 5: E2E 검증

> **범위**: Integration (빌드 + 시각 검증)
> **난이도**: M
> **의존성**: Phase 4 (전체 정합화 완료)
> **영향 파일**: 없음 (도구 확장 외 검증만)

## 배경

Phase 1~4 의 결과로 fixture 의미 / 데이터 스키마 / builder selector 의 삼각 일치가 확보됐는지, 코드만으로 양식지 본 수준의 HWPX 가 생성되는지 사용자가 한컴오피스에서 최종 확인.

## 설계

### 검증 매트릭스

| 검증 대상 | 비교 기준 | 통과 조건 |
|----------|----------|----------|
| `tools/build_template_showcase.py` 출력 | `_TEMPLATE_SHOWCASE_fixed_origin.hwpx` 의 라벨 섹션 | C 섹션 (FIXTURE × 코드) 의 모든 maker 호출 시 정답 본과 시각 일치 |
| 실 시험지 (`exam_data.json`) 빌드 | 정답 본의 동일 문제 섹션 | 보기 / 조건 박스 / 표 / 수식 / 머릿말 / ENDNOTE 시각 일치 |
| 합성 syn_div / Pascal input 빌드 | 양식지의 syn_div / Pascal 정답 | 새 selector 정확 작동 |

### 작업 흐름

1. showcase 빌드 + 사용자 시각 확인 (모든 fixture maker 노출)
2. 실 시험지 빌드 + 사용자 시각 확인
3. 합성 syn_div / Pascal input 빌드 (또는 사용자 양식지에 해당 문제 있으면 실 빌드)
4. 불일치 발견 시 fix 회차 — 어느 phase 로 회귀할지 분석 (스키마 / extractor / builder / fixture)

### Showcase 확장

`build_template_showcase.py` 에 새 fixture 의 C 섹션 (FIXTURE × 코드) 호출 추가 (이미 일부 있으면 갱신).

### 2회차 — extractor reference doc 패턴

배경: 1회차 빌드에서 syn_div / Pascal 셀이 plain text 로 들어가 사용자 양식지의 수식 렌더링과 시각 차이. 원인은 generator 가 아닌 입력 데이터 형식 (showcase 가 numeric string 만 주입). 근본 해결은 extractor 가 PDF 에서 syn_div / Pascal 감지 시 generator 가 기대하는 형식 (equation 셀) 으로 출력하도록 하는 것.

**설계 (사용자 제안)**:
- 도메인 지식 (binomial 표기, coefficient 분기) 을 **별도 reference 문서** (`docs/extractor-reference/syn_div_pascal.md`) 에 모음. extractor prompt 는 슬림 유지.
- extractor.ts 가 LLM 요청 만들 때 syn_div / Pascal 관련 신호 감지 시 reference doc 을 fs.readFile 로 로드 → prompt 에 inline append.
- LLM 은 doc 의 명세대로 dict 출력 → generator 의 equation 경로 정확히 탐.
- 문서 ↔ generator 양쪽이 single source of truth → 분기 시 한 곳만 갱신.

**런타임 후크 지점**:
- `buildExtractorPrompt(input: ExtractorPromptInput)` 함수 내부에 reference doc 로딩 분기 추가.
- 감지 트리거: 보수적 접근 — 일단 모든 추출 요청에 doc 을 append (extractor 가 syn_div / Pascal 외 type 도 LLM 이 판단). 비용 우려 시 image OCR pre-step 으로 syn_div 키워드 감지 후 조건부 inject (본 phase 범위 밖).

## 체크리스트

- [x] `build_template_showcase.py` 확장 — 새 maker (proposition, choice_image, syn_div, pascal 등) 의 C 섹션 호출 추가 (1회차)
- [x] showcase 빌드 + validate exit 0 → 사용자 한컴 시각 확인 (1회차)
- [x] 실 시험지 빌드 + validate exit 0 → 사용자 한컴 시각 확인 (1회차)
- [x] (가능하면) syn_div / Pascal 포함 합성 input 빌드 + 사용자 시각 확인 (1회차)
- [x] 불일치 발견 시 → 어느 phase 로 회귀해 fix 할지 결정 후 회차 진행 → **2회차 확장: extractor reference doc 패턴 도입**

### 2회차 추가 (extractor reference doc 패턴)

- [x] `docs/extractor-reference/syn_div_pascal.md` 신설 — syn_div / Pascal 의 (1) 입력 dict 스키마 (cell 단위 `{type:'text'|'equation', value/script}`) (2) 변환 규칙 (Pascal 항상 binomial → equation, syn_div coefficient 분기) (3) generator 가 기대하는 형식
- [x] `ngd-studio/server/stages/prompts/extractorPrompt.ts` 슬림화 — syn_div / Pascal 인라인 필드 명세 제거 + "이 타입을 만나면 reference doc 명세에 따라 추출하라" 지시로 교체. 런타임에 doc 내용을 prompt 에 동적 inject.
- [x] `ngd-studio/server/stages/extractor.ts` 런타임 메커니즘 — `loadExtractorReferenceDoc()` 추가, `runExtractorStage` 에서 await 후 `buildExtractorPrompt` 에 전달
- [x] `extractor.test.ts` 단위 테스트 — reference doc 가 prompt 에 inject 되는지 확인 (4건 추가, 총 31/31 통과)
- [x] showcase 의 Pascal/syn_div 입력 데이터를 reference doc 명세 형식 (equation 셀 포함) 으로 교체 후 빌드 재실행 + **사용자 시각 재확인 통과** (3회차 fix 적용 후)

## 영향 범위

- `build_template_showcase.py` 확장 시 코드 변경. 외에는 검증만.
- 통과 시 본 task (`ngd-create-v4-coherence`) 종료. ngd-exam-create V4 단계로 격상.

## 검증

```bash
# Showcase 빌드
python3 tools/build_template_showcase.py
LATEST_SC=$(ls -t outputs/_TEMPLATE_SHOWCASE_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST_SC" --fix
echo "showcase_exit=$?"

# 실 시험지 빌드
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
LATEST_EX=$(ls -t "outputs/[고]"*_ver*.hwpx | head -1)
python3 resources/hwpx_scripts/validate.py "$LATEST_EX" --fix
echo "exam_exit=$?"

# 사용자 시각 확인용 파일 안내
echo "Compare files:"
echo "  $LATEST_SC vs outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx"
echo "  $LATEST_EX vs (사용자 양식지 정답)"
```

검증 통과 조건: 빌드 모두 exit 0 + 사용자 시각 검증 통과.

## 실행 결과

### 1회차 (2026-05-19) — needs_user

**빌드 결과**:
- showcase_exit=0 → `outputs/_TEMPLATE_SHOWCASE_ver20260519-154542.hwpx`
- exam_exit=0 → `outputs/[고][2026][1학기][강북고][수학 II]_ver20260519-154553.hwpx`
- 합성 syn_div (deg=3,4,5,6) / pascal (n=5,7,9) 직접 호출 모두 OK

**showcase.py 확장 내용**:
- imports에 `make_syn_div_table`, `make_pascal_table` 추가
- C 섹션에 신규 type tag 기반 항목 추가:
  - `proposition` → pq_proposition_table_5x5.xml
  - `choice_image` → choice_image_5options.xml
  - `choice_grid_2cols` → choice_grid_2cols.xml
  - `choice_grid_3cols` → choice_grid_3cols.xml
  - `make_syn_div_table` — deg=3,4,5,6 각 1회
  - `make_pascal_table` — n_rows=5,7,9 각 1회

**exam_data.json 내 syn_div/pascal**: 없음 → 합성 input 직접 호출로 대체 검증

**사용자 시각 비교 필요 파일**:
1. showcase:
   - 신규: `outputs/_TEMPLATE_SHOWCASE_ver20260519-154542.hwpx`
   - 기준본: `outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx`
2. 실 시험지:
   - 신규: `outputs/[고][2026][1학기][강북고][수학 II]_ver20260519-154553.hwpx`
   - 기준본: 사용자 양식지 정답

**비교 포인트 (한컴오피스에서 확인)**:
- 보기 박스: ㄱ. ㄴ. ㄷ. 라벨 정렬 + 박스 border
- 명제 표 (proposition): 가정 열 / 결론 열 위치 + p: q: 라벨 보존
- 그림 5선지 (choice_image): ① ~ ⑤ 라벨 + 이미지 placeholder 위치
- 2열 그리드 (choice_grid_2cols): 헤더행 라벨 + 데이터 셀 정렬
- 3열 그리드 (choice_grid_3cols): 헤더행 라벨 + 데이터 셀 정렬
- syn_div: 셀 border + 가운데 정렬 + 숫자 폰트 크기 (deg별 행/열 수 확인)
- pascal: 중앙 정렬 + 셀 padding + n_rows별 형태 확인

**상태**: 사용자 한컴오피스 시각 비교 대기 중 (체크리스트 #5 미완)

---

### 2회차 (2026-05-19) — needs_user (사용자 시각 재검증 대기)

**배경**: 1회차 사용자 피드백 "syn_div / Pascal 셀이 수식이 아닌 텍스트". 원인은 showcase 입력이 단순 문자열이라 `_inject_cell_value` 의 equation 경로를 안 탐. 근본 해결 방향: extractor reference doc 패턴 도입 — extractor 가 doc 명세대로 셀을 equation dict 로 출력 → generator equation 경로 정확히 탐.

**변경 파일**:
- `docs/extractor-reference/syn_div_pascal.md` 신설 — syn_div / Pascal 의 셀 dict 스키마 + 분기 규칙 + 예시
- `ngd-studio/server/stages/prompts/extractorPrompt.ts`:
  - `ExtractorPromptInput` 에 `referenceDoc?: string` 추가
  - `EXTRACTOR_SYSTEM` 의 explanation_table 인라인 명세 슬림화 + `[REF_DOC_SECTION]` 플레이스홀더 삽입
  - `buildExtractorPrompt` 에서 `referenceDoc` 내용을 플레이스홀더에 주입 (없으면 fallback 텍스트)
- `ngd-studio/server/stages/extractor.ts`:
  - `loadExtractorReferenceDoc()` 함수 추가 — CWD 기준 `../docs/extractor-reference/syn_div_pascal.md` 로드 (없으면 빈 문자열)
  - `runExtractorStage` 에서 `loadExtractorReferenceDoc()` await 후 `buildExtractorPrompt` 에 전달
- `ngd-studio/server/stages/__tests__/extractor.test.ts`:
  - `buildExtractorPrompt` reference doc injection 테스트 4건 추가 (총 31건)
- `tools/build_template_showcase.py`:
  - `_resolve_cell(cell)` 헬퍼 추가 — reference doc 명세 형식 셀 dict → generator 문자열 변환
  - syn_div deg=3,4,5,6: equation dict 형식 입력으로 교체 (deg=3: 순수 정수, deg=4: `k+1` 등 equation 혼합)
  - pascal n_rows=5,7,9: `{} _{r} rm C _{c}` binomial 표기 equation dict 입력으로 교체

**검증 결과**:
- `tsc --noEmit`: exit 0
- `vitest run extractor.test.ts`: 31/31 통과 (기존 27 + 신규 4)
- `build_template_showcase.py`: exit 0 → `outputs/_TEMPLATE_SHOWCASE_ver20260519-172004.hwpx`
- `validate.py --fix`: "HWPX 검증 통과" exit 0
- `build_hwpx.py exam_data.json`: exit 0 → `outputs/[고][2026][1학기][강북고][수학 II]_ver20260519-172013.hwpx`

**핵심 포인트**:
- generator (`tables.py`) 는 변경 없음 — `_inject_cell_value` 의 regex 분기(`[a-zA-Z_{}^\\`]`)가 equation 스크립트를 자동 감지
- `_resolve_cell` 헬퍼가 showcase 에서 dict → 스크립트 문자열 변환. Pascal 셀은 `{} _{r} rm C _{c}` 로 equation 경로 탐
- extractor 가 실제로 reference doc 명세대로 dict 출력하면, 향후 assemble 단계에서 동일 `_resolve_cell` 패턴으로 처리 가능 (Phase 연계)

**사용자 시각 확인 필요**:
- 신규 showcase: `outputs/_TEMPLATE_SHOWCASE_ver20260519-172004.hwpx`
- 기준본: `outputs/_TEMPLATE_SHOWCASE_fixed_origin.hwpx`
- 확인 포인트: **syn_div / Pascal 셀이 수식(`<hp:equation>`)으로 렌더링되는지** (= 이전 회차 텍스트 렌더링 문제 해결 여부)

---

### 3회차 (2026-05-19) — completed

**배경**: 2회차 사용자 시각 확인 결과 Pascal 은 수식 OK 였으나 syn_div 는 여전히 plain text 렌더링. 원인: `_inject_cell_value` 의 heuristic 이 `[a-zA-Z_{}^\\`]` 부재 시 자동으로 text 경로 → 단순 정수 `1`, `-3` 등이 text 로 떨어짐. 사용자 결정: **syn_div 는 모든 셀이 항상 equation** (이중 경로 불필요).

**오케스트레이터 직접 fix** (workflow 편집, phase=0 세션):
- `tables.py` `_inject_cell_value`: `force_equation: bool = False` 파라미터 추가. True 면 영문/특수문자 부재해도 항상 equation 경로.
- `tables.py` `make_syn_div_table`: 셀 주입 시 `_inject_cell_value(cell, str(val), force_equation=True)` 호출.
- `docs/extractor-reference/syn_div_pascal.md` syn_div 섹션 갱신: "모든 셀은 항상 equation" 명시 + 스키마 예시도 equation 통일.

**검증 결과**:
- `showcase_exit=0` → `outputs/_TEMPLATE_SHOWCASE_ver20260519-174756.hwpx`
- `validate_exit=0`
- `exam_exit=0` → 실 시험지 회귀 정상
- 빠른 sanity: `make_syn_div_table(rows with 9 non-empty 정수 cells)` → 9 equation, 0 plain text ✓
- vitest 31/31 통과 (영향 없음)

**사용자 시각 재확인**: 통과 — syn_div 셀 모두 수식 렌더링 확인.

**상태**: completed. Phase 5 + task `ngd-create-v4-coherence` 종료.

#### Scope Audit (orchestrator)
1회차/2회차/3회차 모두 scope 내 (orchestrator 가 prompts/, __tests__/, docs/extractor-reference/, tables.py 를 워크플로 fix 로 다룸; phase=0 세션 exempt).

#### Verification Re-run (orchestrator)
3회차 exit 0 — showcase + validate + exam build + vitest 31/31 통과. syn_div equation 라우팅 sanity 확인.

#### Review (orchestrator)
3회차 fix 는 단일 함수 추가 파라미터 + 호출부 1곳 갱신 + doc 정합 — VERDICT pass (orchestrator self-review). 사용자 시각 검증으로 최종 통과 확인.
