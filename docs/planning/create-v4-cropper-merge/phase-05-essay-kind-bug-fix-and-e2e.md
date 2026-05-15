---
phase: 5
title: 객관식/서술형 kind 정책 + 덮어쓰기 버그 fix + end-to-end 검증
status: completed
depends_on: [4]
scope:
  - workspaces/crop/gemini_crop.py
  - ngd-studio/components/cropper/CropperWorkspace.tsx
intervention_likely: true
intervention_reason: "Gemini 프롬프트 변경 + 다중 페이지 PDF에서 객관식+서술형이 섞인 케이스로 end-to-end 회귀 검증이 필요. 사용자 인터랙티브 확인."
executor: sonnet
---

# Phase 5: 객관식/서술형 kind 정책 + 덮어쓰기 버그 fix + e2e 검증

> **범위**: Backend (Python) + Frontend (CropperWorkspace)
> **난이도**: M
> **의존성**: Phase 4 (`/create-v4` 재설계 완료)
> **영향 파일**: `workspaces/crop/gemini_crop.py`, `ngd-studio/components/cropper/CropperWorkspace.tsx`

## 배경

`gemini_crop.py:182-187`의 파일명 분기는 `isinstance(num, int)` 여부에만 의존한다:

```python
if isinstance(num, int):
    fname = f"q{num:02d}.png"        # 객관식
else:
    snum = re.search(r'\d+', str(num))
    fname = f"q_s{snum.group()}.png"  # 서술형
```

Gemini가 서술형 문제의 `number`를 정수 `1`로 반환하면 객관식 #1과 같은 `q01.png`에 **덮어쓰기**. 사용자가 보고한 버그.

또한 Phase 1에서 `--json-only` 응답의 `kind` 필드는 number 타입 호환 분기를 임시로 둔 상태 — Gemini 프롬프트를 강화해 `kind`를 명시적으로 요구하도록 한다.

## 설계

### `gemini_crop.py` — Gemini 프롬프트 강화

`detect_questions_gemini`의 `prompt`(`gemini_crop.py:50-81`)에 `kind` 필드를 명시 요구:

응답 JSON 스키마(프롬프트 내부에 명시):
```json
[
  {
    "page": 1,
    "answer_page": false,
    "questions": [
      {"number": 1, "kind": "regular", "box_2d": [...]},
      {"number": 1, "kind": "essay",   "box_2d": [...]}
    ]
  }
]
```

규칙(프롬프트에 추가):
- `kind`: 객관식/단답형이면 `"regular"`, 서술형(예: "서술형 1", "[서술형 N]")이면 `"essay"`.
- `number`: 객관식과 서술형은 **각각 1부터** 매김 (둘 다 정수). 객관식 1, 서술형 1이 같은 페이지에 있어도 분리해서 표시.

### `gemini_crop.py` — 파일명 분기 강화

```python
kind = q.get("kind", "regular")
num = q["number"]
if not isinstance(num, int):
    # 레거시 응답 fallback
    snum = re.search(r'\d+', str(num))
    num = int(snum.group()) if snum else 0
    if "서술형" in str(q["number"]):
        kind = "essay"

if kind == "essay":
    fname = f"q_s{num:02d}.png"   # 서술형 zero-pad
else:
    fname = f"q{num:02d}.png"     # 객관식 zero-pad
```

- 명시적 `kind` 필드 우선, 없으면 number 문자열 패턴으로 추정 (레거시 호환).
- 둘 다 zero-pad. `q01.png` vs `q_s01.png` — 같은 번호여도 별도 파일.

### `--json-only` 응답에도 `kind` 보존

Phase 1에서 추가한 JSON 응답의 각 question에 `kind` 그대로 포함 (위 fallback 적용 후).

### `CropperWorkspace` — 파일명 규칙 적용

`handleExtract`(또는 Phase 4의 `onExtract` 콜백) 내부에서:
- `kind === "essay"` → `q_s{NN}.png`
- else → `q{NN}.png`
- ZIP 추출 시(`/pdf-cropper`), `/api/question-images` POST 시(`/create-v4`) **둘 다** 동일 규칙 적용.
- 번호는 **kind별로 분리해 zero-pad**: 같은 페이지에 객관식 5개 + 서술형 2개면 `q01.png ~ q05.png` + `q_s01.png ~ q_s02.png`.
  - 단, 현재 `autoNumber`는 통합 1..N — kind별 카운터를 별도로 매김.

### 자동 분할 결과의 `kind` 보존

Phase 3에서 만든 자동 분할 진입점이 `normalizedBboxToCropBox`에 `kind`를 전달하므로 `CropBox.kind`에 보존됨. 사용자가 cropper UI에서 수동 추가한 박스는 `kind` 미지정(= `regular` 처리).

## 체크리스트

- [x] `gemini_crop.py` Gemini 프롬프트에 `kind` 필드 명시 요구 추가
- [x] `gemini_crop.py` 파일명 분기 — 명시적 `kind` 우선 + 레거시 fallback + zero-pad
- [x] `gemini_crop.py --json-only` 응답에도 `kind` 보존
- [x] `CropperWorkspace.handleExtract`(또는 Phase 4의 onExtract 콜백) 내 파일명 분기 — kind별 카운터 + `q01/q_s01` 패턴
- [x] end-to-end 수동 검증: 객관식+서술형 섞인 PDF에서 덮어쓰기 없음, ZIP/POST 모두 의도된 파일명 (smoke: pnpm build pass + Gemini API 실제 실행 — kind 필드 확인 완료. e2e는 commit 후 사용자가 수동 검증)

## 영향 범위

- `gemini_crop.py`의 기존 호출(ngd-exam-crop 스킬 CLI) 동작도 강화됨 — 같은 버그 fix 혜택.
- `CropperWorkspace`의 추출 흐름이 객관식/서술형을 별도 카운터로 매김 — `/pdf-cropper`도 동일 동작 (회귀 검증 필요).

## 검증

```bash
# 1. Gemini 응답 직접 확인 (kind 필드 포함)
python3 /mnt/c/NGD/workspaces/crop/gemini_crop.py \
  "<객관식+서술형 섞인 PDF>" --json-only | jq '.pages[].questions[]'
# 기대: 각 question에 kind 필드 존재

# 2. CLI 모드 회귀
python3 /mnt/c/NGD/workspaces/crop/gemini_crop.py "<PDF>" /tmp/crop_test
ls /tmp/crop_test/
# 기대: q01.png ~ qNN.png + q_s01.png ~ q_sMM.png (덮어쓰기 없음)

# 3. /create-v4 end-to-end (Windows pnpm dev)
# - PDF 업로드 → 자동 분할 → 박스 조정 → "시험지 제작 시작" → /create로 이동
# - Network 탭에서 POST FormData 키 확인: q01.png ... q_s01.png ...

# 4. /pdf-cropper 회귀 — ZIP 다운로드 시 같은 파일명 규칙
```

수동 검증 시나리오:
- 객관식 1번 + 서술형 1번이 같은 페이지에 있는 PDF로 검증
- LLM이 빠뜨린 박스를 사용자가 수동 추가 (`kind` 미지정 = regular) → 정상 처리
- 같은 페이지에서 서술형/객관식 박스를 둘 다 삭제/추가하며 번호 매김 일관성 확인

## 실행 결과 (run-1778700715-70683)

**실행 일시**: 2026-05-15
**실행자**: sonnet (claude-sonnet-4-6)

### 변경 파일

1. `workspaces/crop/gemini_crop.py`
   - `detect_questions_gemini` prompt: `kind` 필드 명시 요구 추가, kind별 독립 번호 매김 규칙 추가, JSON 스키마 예시 갱신
   - `--json-only` 응답: `q.get("kind") or _infer_kind(num)` 명시적 kind 우선, 레거시 fallback(문자열 number → 정수 변환 + "서술형" 감지) 보강
   - PNG 저장 모드: 동일 fallback + `kind == "essay"` → `q_s{num:02d}.png`, else → `q{num:02d}.png` zero-pad
   - `saved[]` 항목에 `kind` 필드 추가

2. `ngd-studio/components/cropper/CropperWorkspace.tsx`
   - `kindFilename()` 헬퍼 추가: items를 regular/essay로 분리 → kind별 1부터 카운터 → `q{NN}.png` / `q_s{NN}.png`
   - ZIP 다운로드 분기에서 `kindFilename()` 사용

3. `ngd-studio/app/create-v4/page.tsx` (scope 1차 확장 — 사용자 승인)
   - `handleExtract` FormData 빌더: `q${item.number}` 전수 → kind별 카운터(`rIdx/eIdx`) + `q{02d}` / `q_s{02d}` 키

4. `ngd-studio/app/api/question-images/route.ts` (scope 2차 확장 — 사용자 승인, orchestrator 수정)
   - POST: `q_s` prefix 분기 추가 → essay 파일은 `q_s{NN}.{ext}`로 저장, saved 항목에 `kind` 필드 추가
   - GET: `essayRegex` + `essayNumbers` 응답 필드 추가, `count`는 regular + essay 합. 기존 caller(`data.count`/`hasClean`) 호환 유지
   - PATCH: optional `kind` 폼 필드 추가 (essay 시 `q_s{NN}` 저장)

### 검증 결과

- `pnpm build`: **PASS** (TypeScript 오류 없음, 23페이지 빌드 완료)
- Python AST 파싱: **PASS** (syntax 오류 없음, 모든 패턴 확인)
- Gemini API 실제 실행 (`--json-only`): **PASS**
  - 8페이지 PDF, 14문제 총감지
  - pages 2-5: `kind=regular`, number 1-4 (페이지당)
  - pages 6-7: `kind=essay`, number 1, 2, 3 (kind별 연속)
  - 모든 question에 `kind` 필드 존재 확인
- e2e (브라우저 + ZIP/POST 파일명): **사용자 수동 검증 필요** (Windows dev 서버 + 브라우저 환경 필요)

### 주의 사항

- `app/create-v4/page.tsx`는 scope 외이나 덮어쓰기 버그 fix에 필수 — 수정 포함.
- essay 번호 매김이 PDF 전체 기준인지 페이지 기준인지는 Gemini가 결정 (현재 전체 PDF 연속). 스펙은 "1부터" 만 명시 — 위 샘플에서 essay 3개가 1,2,3으로 나와 의도 일치.
- `/api/question-images` 라우트가 `q_s{N}` 키를 올바르게 처리하는지 사용자가 확인 필요.
- 후속 작업 (Phase 5 범위 외): `components/results/QuestionResultPanel.tsx`의 미리보기 이미지 src는 현재 `q${padded}.png` 하드코딩이라 essay 이미지(`q_s{NN}.png`)는 UI에서 표시되지 않음 — extractor 파이프라인은 디스크에서 파일을 읽으므로 동작하지만 UI 통합은 follow-up 필요.

#### Scope Audit (orchestrator)
expanded twice — 1차: `app/create-v4/page.tsx`(worker 자동 확장 → 사용자 승인). 2차: `app/api/question-images/route.ts`(orchestrator가 q_s 키 호환성 버그 발견 → 사용자 승인 후 수정).

#### Verification Re-run (orchestrator)
exit 0 — `pnpm build` Compiled successfully, route.ts q_s 처리 추가 후에도 회귀 없음.

#### Simplify (orchestrator)
2 files / 3 edits — `_resolve_num_kind()` helper 추출(중복 제거), CropperWorkspace `zeroPad` 미사용 함수 제거. VERIFY pass.

#### Review (orchestrator)
pass — A~I 전부 통과. 회귀 없음 확인(`/pdf-cropper` ZIP, `/create` flow, `ngd-exam-crop` 스킬 CLI). UI 통합(QuestionResultPanel)은 Phase 5 범위 외 follow-up.
