---
phase: 4
title: assemble.py camelCase 정합 + filename 폴백 삭제 + figure_status join
status: pending
depends_on: [3]
scope:
  - assemble.py
  - build_hwpx.py
  - ngd-studio/server/stages/builder.ts
  - ngd-studio/server/stages/__tests__/builder.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - build-hwpx-cli
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 4: assemble.py camelCase 정합 + filename 폴백 삭제 + figure_status join

> **범위**: Both
> **난이도**: M
> **의존성**: P3
> **영향 파일**: `assemble.py`, `build_hwpx.py`, `server/stages/builder.ts`

## 배경

P2/P3 후 디스크 상태:
- `.v3cache/exam_data.json:info`는 **camelCase only** (P2 결과)
- `figure_info.final_image`는 더 이상 존재하지 않음 (P3 결과)
- `.v3cache/figure_status.json:questions[N].finalImage`가 그림 정본

`assemble.py`가 아직:
1. `info["exam_type"]`, `info["school_level"]`, `info["filename_base"]` 등 **snake_case 읽음** (`assemble.py:267-274`)
2. `info["filename_base"]` 없을 때 **자체 filename 폴백 빌더**(`assemble.py:502-512`) — TS의 `buildFilenameBase`와 분기/구분자가 미묘하게 다름
3. `figure_info["final_image"]` 읽음 (`assemble.py:367-368`) — P3에서 이 키 자체 폐기됨

세 가지를 정합한다.

## 설계

### 1) `assemble.py` — info read를 camelCase로

```python
# Before
YEAR_SEMESTER = f"{info['year']}년 {info['semester']} {info['exam_type']}"
school_level = info.get("school_level", "고")
filename = info["filename_base"] + ver_suffix + ".hwpx"

# After
YEAR_SEMESTER = f"{info['year']}년 {info['semester']} {info['examType']}"
school_level = info["schoolLevel"]  # P2가 required로 만들었으므로 .get 폴백 불요
filename = info["filenameBase"] + ver_suffix + ".hwpx"
```

`info` read 전부 grep → 새 키로 일괄 교체:

| 기존 키 | 새 키 |
|---|---|
| `exam_type` | `examType` |
| `school_level` | `schoolLevel` |
| `filename_base` | `filenameBase` |
| `subject_code` | `subjectCode` |

`info.get("range", "")` 등은 키명 그대로(이미 camelCase).

### 2) filename 폴백 빌더 삭제 (`assemble.py:498-512`)

```python
# Before
ver_suffix = datetime.now().strftime("_ver%Y%m%d-%H%M%S")
if "filename_base" in info:
    filename = info["filename_base"] + ver_suffix + ".hwpx"
else:
    code = info.get("code", "00000")
    year = info.get("year", "?")
    # ... 자체 폴백 ...
    filename = f"[{code}][{school_level}][...]..."

# After
ver_suffix = datetime.now().strftime("_ver%Y%m%d-%H%M%S")
filename = info["filenameBase"] + ver_suffix + ".hwpx"  # required
```

P2의 `assertCompleteMeta`가 `filenameBase`를 채우므로 항상 존재.

### 3) figure_status.json join

`build_hwpx.py` 또는 `assemble.py:main`에서 figure_status를 추가 read:

```python
def _load_final_images(exam_data_path: str) -> dict[int, str]:
    """Read figure_status.json (sibling of exam_data.json) and return {question_number: finalImage}."""
    cache_dir = os.path.dirname(os.path.abspath(exam_data_path))
    fs_path = os.path.join(cache_dir, "figure_status.json")
    if not os.path.exists(fs_path):
        return {}
    with open(fs_path, "r", encoding="utf-8") as f:
        status = json.load(f)
    result = {}
    for key, q in (status.get("questions") or {}).items():
        try:
            n = int(key)
        except ValueError:
            continue
        # 정본 finalImage, 폴백으로 legacy image (P3 호환)
        img = q.get("finalImage") or q.get("image")
        if img:
            result[n] = img
    return result

# main():
final_images = _load_final_images(exam_json)

# figure 박는 부분 (현재 assemble.py:367-368):
# Before
if has_figure and figure_info and figure_info.get("final_image"):
    img_path = figure_info["final_image"]
# After
img_path = final_images.get(num)
if has_figure and img_path:
    pass  # 기존과 동일하게 진행
```

### 4) `build_hwpx.py` / `builder.ts` 변경 거의 없음

`build_hwpx.py`는 `from assemble import main` 그대로 두고, `main(exam_json, output_dir)` 시그니처 유지. `builder.ts:runBuilderStage`도 인자 그대로.

단, `builder.ts`의 `assertFileExists(examDataPath, "exam_data.json")` 후에 figure_status도 정보성 로깅(없으면 그림 없는 빌드라고 안내):

```ts
const figureStatusPath = path.join(path.dirname(examDataPath), "figure_status.json");
const hasFigureStatus = await fileExists(figureStatusPath);
if (!hasFigureStatus) {
  // 정보성 로그 (hard fail 아님 — 그림 없는 시험지일 수도)
}
```

### 5) 테스트

- `builder.test.ts` (또는 신규 fixture):
  - exam_data.json (camelCase info) + figure_status.json (finalImage 키)로 빌드 → HWPX 안에 image bmp 들어있음 확인
  - figure_status.json 없을 때도 build 성공 (그림 없는 시험지)
  - exam_data.json에 `filenameBase` 누락 → KeyError 명확

## 체크리스트
- [ ] `assemble.py:info` read 전부 camelCase 키로 교체 (exam_type/school_level/filename_base/subject_code → camel)
- [ ] `assemble.py:498-512`의 filename 폴백 빌더 삭제 — `info["filenameBase"]` required
- [ ] `assemble.py`에 `_load_final_images(exam_data_path)` 추가하고 figure 박는 부분에서 사용
- [ ] `figure_info["final_image"]` 참조 0건 (grep으로 확인)
- [ ] `builder.test.ts` 신규 fixture로 end-to-end 빌드 검증 통과
- [ ] `npx vitest run server/stages/__tests__/builder.test.ts --reporter=basic` 통과

## 영향 범위

- 이 phase 종료 시점에 **신규/재개 양 흐름의 데이터 경로가 깨끗해진다** (P1-P4 묶음 완성).
- P5/P6는 독립적으로 진행 가능 — 메타 저장 위치 변경은 데이터 형식과 무관.
- `outputs/_fixtures/year-2026-test/exam_data.json`은 stale (snake-only) — P9에서 재생성. 그 전엔 이 fixture를 쓰는 테스트는 갱신 또는 임시 skip.

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio
# fresh build with current cache
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs/
# 출력 HWPX의 BinData/에 이미지 들어있는지 확인 (figure 있는 문제 한정)
unzip -l outputs/*.hwpx | grep -i bin

cd ngd-studio
npx vitest run server/stages/__tests__/builder.test.ts --reporter=basic
grep -rn "final_image\|exam_type\|school_level\|filename_base" /Users/junhyukpark/ngd/ngd-studio/*.py
# 결과 0건 (assemble.py, build_hwpx.py, figure_processor.py 전부 깨끗)
```
