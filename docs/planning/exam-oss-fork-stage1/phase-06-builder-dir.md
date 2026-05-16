---
phase: 6
title: builder 디렉터리 분리 (future plugin 자리 마련)
status: pending
depends_on: [3]
scope:
  - /mnt/c/openexam/build_hwpx.py
  - /mnt/c/openexam/figure_processor.py
  - /mnt/c/openexam/builders
  - /mnt/c/openexam/pipeline
  - /mnt/c/openexam/.claude/skills/exam-create/base_hwpx
  - /mnt/c/openexam/studio/server
  - /mnt/c/openexam/studio/scripts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 6: builder 디렉터리 분리

> **범위**: 코드 재배치 + import 경로 수정
> **난이도**: S
> **의존성**: Phase 3 (rename 이후 진행)
> **영향 파일**: `build_hwpx.py` → `builders/hwpx/build.py`, `figure_processor.py` → `pipeline/figure.py`

## 배경

현재는 `build_hwpx.py`(50KB)와 `figure_processor.py`(6KB)가 레포 루트에 있다. 3단계(plugin interface 추상화)로 갈 때 다른 포맷(DOCX, LaTeX) 빌더가 추가될 자리를 미리 마련해두면, 그때 코드 이동 없이 인터페이스만 추출하면 된다. 또한 OSS 첫 인상에 "어떤 게 포맷 무관 파이프라인이고 어떤 게 HWPX 종속인지" 디렉터리 구조만 봐도 드러나야 한다.

**3단계 plugin 인터페이스 추출은 이번 phase에서 안 함**. 디렉터리만 미리 분리.

## 설계

### 새 디렉터리 구조
```
/mnt/c/openexam/
├── pipeline/                 # 포맷 무관 (extractor, solver, verifier, figure)
│   ├── __init__.py
│   └── figure.py             # ← figure_processor.py 이동
├── builders/                 # 포맷 종속 (현재 hwpx만, 향후 docx/latex 추가)
│   └── hwpx/
│       ├── __init__.py
│       ├── build.py          # ← build_hwpx.py 이동
│       └── templates/        # ← .claude/skills/exam-create/base_hwpx/ 이동
│           ├── bogi_table_3items.xml
│           ├── normal_dist_*.xml
│           └── ... (전부)
└── templates/                # Phase 4 산출물 — 사용자가 쓰는 양식지 (BinData 포함된 HWPX 자체)
    └── default.hwpx
```

### 두 종류 "template" 차이 명확화
- `builders/hwpx/templates/*.xml` — 빌더 내부에서 쓰는 XML 조각 (보기 테이블, 정규분포 테이블 등). 사용자가 건드릴 일 거의 없음
- `templates/default.hwpx` — 사용자 양식지 HWPX 전체 (머릿말·서체 등 포함). `HWPX_TEMPLATE_PATH` env로 사용자가 자기 것 지정 가능

### Import 경로 변경 영향
- `build_hwpx.py`가 `figure_processor`를 import하면 → `from pipeline.figure import ...`
- `build_hwpx.py`가 `BASE = "...base_hwpx"` 같은 경로 상수 가지면 → 새 위치로 갱신
- studio에서 `python build_hwpx.py ...`로 호출하는 부분 → `python -m builders.hwpx.build ...` 또는 `python builders/hwpx/build.py ...`
- 에이전트 .md (`exam-builder.md`, `exam-figure.md`)의 호출 경로 안내

## 체크리스트

- [ ] `builders/hwpx/`, `pipeline/` 디렉터리 + `__init__.py` 생성
- [ ] `build_hwpx.py` → `builders/hwpx/build.py` 이동, 내부 경로 상수(`BASE`, 템플릿 경로 등) 갱신
- [ ] `figure_processor.py` → `pipeline/figure.py` 이동
- [ ] `.claude/skills/exam-create/base_hwpx/*.xml` → `builders/hwpx/templates/` 이동
- [ ] studio의 호출부 (`server/`, `scripts/`, `app/api/*/route.ts` 등)에서 build_hwpx 경로 갱신 — `grep -r "build_hwpx" studio/`
- [ ] 에이전트 `.claude/agents/exam-builder.md`, `exam-figure.md`의 호출 경로 안내 갱신
- [ ] 샘플 빌드로 동작 검증 (Phase 5의 `examples/exam_data.example.json` 이용 가능)

## 영향 범위

- 모든 호출 경로 갱신 — 누락 시 studio가 빌드 실패
- `.claude/skills/exam-create/SKILL.md` 안의 BASE 경로 안내도 갱신 필요

## 검증

```bash
cd /mnt/c/openexam
ls builders/hwpx/build.py builders/hwpx/templates/bogi_table_3items.xml
ls pipeline/figure.py
test ! -f build_hwpx.py && echo "removed OK"
test ! -f figure_processor.py && echo "removed OK"

grep -r "build_hwpx\|figure_processor" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.md" --exclude-dir=.git --exclude-dir=node_modules
# 위 grep 결과는 모두 새 경로(builders/hwpx/build.py 등)를 가리켜야

# 동작 검증 (Phase 5의 example.json 있으면)
python -c "from builders.hwpx import build; print('import OK')"
```

## 실행 결과
