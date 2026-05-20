---
phase: 1
title: base_hwpx / 후처리 스크립트를 resources/로 이동, BASE 경로 결정
status: completed
depends_on: []
scope:
  - build_hwpx.py
  - resources/hwpx_base/
  - resources/hwpx_scripts/
  - .claude/skills/ngd-exam-create/base_hwpx/
  - .claude/skills/ngd-exam-create/scripts/
  - ngd-studio/server/stages/builder.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 1: base_hwpx / 후처리 스크립트 → resources/, BASE 경로 결정

> **범위**: Both (Python + TS)
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `build_hwpx.py`, `builder.ts`, `.claude/skills/.../base_hwpx/`, `.claude/skills/.../scripts/`

## 배경

현재 build 파이프라인의 정적 자원이 모두 Claude 스킬 폴더 안에 있다:

- `.claude/skills/ngd-exam-create/base_hwpx/` — 양식지에서 추출한 XML 템플릿 + 베이스 자원 (mimetype, META-INF, Preview 등)
- `.claude/skills/ngd-exam-create/scripts/fix_namespaces.py`, `validate.py` — HWPX 후처리

이 위치는 두 가지 문제가 있다:

1. **배포 시 의존 부적합**: `.claude/`는 사용자별 설정 영역이라 배포 패키지에 포함하기 어색하다.
2. **개념적 결합 오해 유발**: build는 LLM과 무관한데 "skill" 폴더 안에 자원이 있어 LLM 의존성을 시사한다.

또한 `build_hwpx.py:18`은 `SCRIPT_DIR` 기반 상대경로지만, 신규 경로로 이동 후에는 env 우선 해석 로직이 필요하다 (배포 환경에서 자원 위치를 override 할 수 있어야 함).

## 설계

### 신규 디렉터리 구조

```
resources/
├── hwpx_base/                   # ← .claude/skills/ngd-exam-create/base_hwpx/ 통째 이동
│   ├── BinData/
│   ├── Contents/
│   ├── META-INF/
│   ├── Preview/
│   ├── bogi_table_3items.xml
│   ├── bogi_table_6items.xml
│   ├── choice_table_*.xml
│   ├── condition_rect_template.xml
│   ├── content_hpf_template.xml
│   ├── empty_box_template.xml
│   ├── header_area_template.xml
│   ├── increase_decrease_template*.xml
│   ├── normal_dist_*rows.xml
│   ├── proof_table_template.xml          # 누락 확인 필요
│   ├── synthetic_division_template.xml   # 누락 확인 필요
│   ├── mimetype
│   ├── settings.xml
│   └── version.xml
└── hwpx_scripts/
    ├── fix_namespaces.py
    └── validate.py
```

### `build_hwpx.py:18` BASE 계산식 변경

```python
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BASE = os.path.join(SCRIPT_DIR, "resources", "hwpx_base")
BASE = os.environ.get("NGD_HWPX_BASE", DEFAULT_BASE)
```

### `builder.ts:140-150` `resolveBuilderScripts` 갱신

```ts
export function resolveBuilderScripts(baseDir: string): {
  buildHwpx: string;
  fixNamespaces: string;
  validateHwpx: string;
} {
  return {
    buildHwpx: path.join(baseDir, "build_hwpx.py"),
    fixNamespaces: path.join(baseDir, "resources", "hwpx_scripts", "fix_namespaces.py"),
    validateHwpx: path.join(baseDir, "resources", "hwpx_scripts", "validate.py"),
  };
}
```

### 이동 방법

`git mv`로 history 보존:
```bash
git mv .claude/skills/ngd-exam-create/base_hwpx resources/hwpx_base
git mv .claude/skills/ngd-exam-create/scripts resources/hwpx_scripts
```

## 체크리스트

- [x] `resources/hwpx_base/` 생성 및 `.claude/skills/ngd-exam-create/base_hwpx/` 내용 전부 이동 (`git mv`로 history 보존)
- [x] `resources/hwpx_scripts/` 생성 및 `fix_namespaces.py`, `validate.py` 이동
- [x] `build_hwpx.py:18` BASE 계산식을 `env(NGD_HWPX_BASE) ?? <script_dir>/resources/hwpx_base` 로 변경
- [x] `ngd-studio/server/stages/builder.ts:140-150` `resolveBuilderScripts` 신규 경로로 갱신
- [x] macOS에서 `python3 build_hwpx.py inputs/시험지\ 제작/.v3cache/exam_data.json outputs` 실행 → 성공 (HWPX 파일 생성)

## 영향 범위

- `docs/hwpx-templates.md:167` "BASE = .claude/..." 안내 문구도 갱신 필요 (실제 사용엔 영향 없으나 stale 문서)
- `.claude/agents/ngd-exam-builder.md`의 `/mnt/c/NGD/build_hwpx.py ...` 안내는 Phase 3에서 정리
- 이동 후 `.claude/skills/ngd-exam-create/`에는 `SKILL.md`만 남음

## 검증

```bash
# macOS
cd /Users/junhyukpark/ngd/ngd-studio
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix

# 신규 경로 확인
ls resources/hwpx_base/ | head
ls resources/hwpx_scripts/
test -d .claude/skills/ngd-exam-create/base_hwpx && echo "FAIL: old path still exists" || echo "OK: moved"
```

## 실행 결과

### 1회차 (2026-05-18 18:15 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`git mv`로 `base_hwpx` 전체를 `resources/hwpx_base/`로 이동했다. 이전 세션에서 `resources/hwpx_base/base_hwpx/`(한 단계 더 중첩)로 잘못 이동된 상태였기 때문에, `git mv`로 재조정해 올바른 flat 구조로 정착시켰다. `scripts/`는 `resources/hwpx_scripts/`로 이동. `build_hwpx.py` BASE 로직과 `builder.ts` `resolveBuilderScripts` 모두 신규 경로로 갱신했다. 빌드 실행 결과 HWPX 생성 및 validate 검증 통과.

#### 변경 파일
- `build_hwpx.py` (수정, +2/-1줄) — BASE 계산식 env override 지원
- `ngd-studio/server/stages/builder.ts` (수정, +2/-2줄) — resolveBuilderScripts 신규 경로
- `resources/hwpx_base/` (신규, git mv from .claude/skills/ngd-exam-create/base_hwpx/)
- `resources/hwpx_scripts/` (신규, git mv from .claude/skills/ngd-exam-create/scripts/)

#### 검증 결과
- [x] 빌드 실행: `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` → pass (HWPX written)
- [x] validate 실행: `python3 resources/hwpx_scripts/validate.py <hwpx>` → pass (검증 통과)
- [x] 신규 경로 확인: `ls resources/hwpx_base/ | head` → BinData 등 파일 확인
- [x] `ls resources/hwpx_scripts/` → fix_namespaces.py, validate.py
- [x] 구 경로 제거 확인: `test -d .claude/skills/ngd-exam-create/base_hwpx` → OK: moved

#### 추가 발견사항
이전 세션에서 `base_hwpx`를 `resources/hwpx_base/base_hwpx/`(중첩)로 잘못 이동한 staged 변경이 있었다. 이를 `git mv`로 재조정해 `resources/hwpx_base/`(flat)으로 수정했다.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 귀속 파일 2개 모두 scope 내 (build_hwpx.py, ngd-studio/server/stages/builder.ts). git mv로 옮긴 resources/ 트리는 Bash 작업이라 hook 로그엔 안 잡힘.

#### Verification Re-run (orchestrator)
spec 내 `validate.py --fix outputs/*.hwpx` 순서 오류 → exit 1. 정정 순서(`validate.py outputs/*.hwpx --fix`) 재실행 exit 0 pass. 빌드 + 검증 모두 통과. 스펙 한 줄 수정해 둠.

#### Simplify (orchestrator)
build_hwpx.py 3곳(lineseg_params_for_eq 분기 통합 / _inject_cell_value arrow_map 인라인 / make_bogi_table에서 기존 _replace_table_ids 재사용) 정리됨. 그러나 Phase 1 scope는 경로 이동 한정이며 Phase 2가 build_hwpx.py 자체를 모듈 분리할 예정 → 충돌 회피 위해 simplify 변경 **revert**, BASE env override 한 줄만 유지. builder.ts 변경 없음.

#### Review (orchestrator)
VERDICT: fix_required (scope 외 로직 변경 3건 — simplify 결과물). 처리: simplify 변경 revert해 build_hwpx.py 변경을 BASE env override 1개 hunk로 축소. 재검증(빌드+validate) pass. fix 후 사실상 pass.

#### Commit
00bc41c
