---
phase: 5
title: inputs/시험지 제작/ 실행
status: completed
depends_on: [1, 2, 3]
scope:
  - inputs/시험지 제작/
  - ngd-studio/inputs/시험지 제작/
  - archive/inputs/시험지 제작/
  - archive/templates/
intervention_likely: true
intervention_reason: "각 PDF가 활성 작업인지 완료된 작업인지 사용자만 안다. 또 구버전 양식지의 git rm --cached 실행 시 mistracking 방지를 위해 사용자 확인 필요."
executor: sonnet
---

# Phase 5: inputs/시험지 제작/ 실행

> **범위**: 파일 이동/삭제 + git rm --cached
> **난이도**: S
> **의존성**: Phase 1 (분류표), Phase 2 (양식지 표준 경로), Phase 3 (archive 구조)
> **영향 파일**: `inputs/시험지 제작/`, `ngd-studio/inputs/시험지 제작/`, `archive/`

## 배경

현재 상태:
```
inputs/시험지 제작/
├── .v3cache/                       # 활성 작업 캐시
├── .v3cache_dasago_20260503/       # stale (완료 작업)
├── .v3cache_prev/                  # stale
├── question_images/                # 활성 작업 종속
├── session_meta.json               # 활성 작업 메타
├── [04039]...경북고[...]답지첨부[...].pdf  # 활성/완료 확인 필요
├── [04039]...소명여고[...]독립사건[...].pdf  # 활성/완료 확인 필요
└── [NGD고등부]기출작업양식지[2022년5월20일].hwpx  # 구버전, git tracked
```

ngd-studio 측:
```
ngd-studio/inputs/시험지 제작/
├── [NGD고등부]기출작업양식지[2022년5월20일].hwpx  # 구버전
└── [NGD고등부]기출작업양식지[2025년08월10일].hwpx  # V3 표준 (Phase 2 확정)
```

## 설계

### 실행 항목

Phase 1 분류표 + Phase 2 양식지 결정 + Phase 3 archive 구조를 종합:

1. **양식지 처리 (Phase 2 결정 반영)**
   - `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`: git tracked → Phase 2 결정에 따라 `git rm --cached` 후 `archive/templates/`로 이동 (또는 폐기)
   - `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`: Phase 2 결정에 따라 동일 처리
   - `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`: 표준 — 그대로 유지

2. **stale 캐시 삭제**
   - `.v3cache_dasago_20260503/`: rm -rf
   - `.v3cache_prev/`: rm -rf
   - `.v3cache/`: 활성 작업이면 유지 — Phase 1 inventory 확인

3. **활성 작업 캐시 처리**
   - `.v3cache/`, `question_images/`, `session_meta.json`: 활성이면 유지, 아니면 삭제 (사용자 확인)

4. **PDF 분류**
   - Phase 1 inventory에서 각 PDF의 active/archive 분류 확인
   - archive 분류 → `archive/inputs/시험지 제작/`로 이동

### git 추적 변경 주의

구버전 양식지는 `git rm --cached`로 untrack 후 물리 이동/삭제. **commit 필수** (작업 끝에 커밋해야 untrack이 영구화됨).

## 체크리스트

- [ ] Phase 1 inventory의 `inputs/시험지 제작/` 섹션 + Phase 2 양식지 결정 재확인
- [ ] stale 캐시 폴더(`.v3cache_dasago_*`, `.v3cache_prev/`) 삭제
- [ ] 비활성 `question_images/`, `session_meta.json` 처리 (사용자 확인 후)
- [ ] 구버전 양식지 처리 (`git rm --cached` 후 archive 이동 또는 폐기)
- [ ] archive 분류 PDF를 `archive/inputs/시험지 제작/`로 이동
- [ ] 표준 양식지 1개만 `ngd-studio/inputs/시험지 제작/`에 존재하는지 확인

## 영향 범위

- `inputs/시험지 제작/`의 구버전 양식지는 git tracked — `git rm --cached` 시 history에는 남고 working tree에서만 사라짐. 안전.
- 활성 작업의 `.v3cache/`를 잘못 삭제하면 진행 중 작업 손실. Phase 1 inventory에서 확정한 active 목록 기준으로만 작업.
- `archive/inputs/`는 Phase 3 정책에 따라 tracked일 수 있음 → 파일 크기 큰 PDF가 누적될 우려.

## 검증

```bash
# 양식지가 표준 위치 1곳에만 있는지
find /mnt/c/NGD -name "*양식지*hwpx" -not -path "*/archive/*" -not -path "*/.next/*"
# 결과: ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx 1개만

# inputs/시험지 제작/이 깨끗한지
ls -la "inputs/시험지 제작/"
# 결과: .v3cache/ (활성만), session_meta.json (활성이면), 활성 PDF만

# git 상태
cd /mnt/c/NGD && git status --short
# 구버전 양식지가 D (deleted from index)로 표시되어야
```

## 실행 결과

### 1회차 (2026-05-12) — completed

**세션**: run-1778587703-45113

**처리 항목**:

| 파일/폴더 | 조치 | 비고 |
|-----------|------|------|
| `inputs/시험지 제작/[04039]...경북고...pdf` | `rm` (untracked) | 완료 작업, 폐기 |
| `inputs/시험지 제작/[04039]...소명여고...pdf` | `rm` (untracked) | 완료 작업, 폐기 |
| `inputs/시험지 제작/session_meta.json` | `rm` (untracked) | stale 메타, 폐기 |
| `inputs/시험지 제작/question_images/` | `rm -rf` (untracked) | 완료 작업 종속, 폐기 |
| `inputs/시험지 제작/.v3cache_dasago_20260503/` | `rm -rf` (untracked) | stale 캐시, 폐기 |
| `inputs/시험지 제작/.v3cache_prev/` | `rm -rf` (untracked) | stale 캐시, 폐기 |
| `inputs/시험지 제작/.v3cache/` | `rm -rf` (untracked) | 완료 작업 캐시, 폐기 |
| `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` | `git rm --cached` + `rm` | tracked → untrack 후 물리 삭제 |
| `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` | `git rm --cached` + `rm` | tracked → untrack 후 물리 삭제 |
| `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` | 유지 | V3 표준 양식지 |

**검증 결과**:
- `inputs/시험지 제작/` → 빈 폴더 (empty)
- `ngd-studio/inputs/시험지 제작/` → V3 양식지(2025) 1개만 존재
- `git ls-files` → 2022 양식지 2곳 모두 인덱스에서 제거됨, V3 양식지만 tracked
- `git status` → 2022 양식지 2곳 `D` (deleted from index) 표시 확인

#### Scope Audit (orchestrator)
pass — inputs/시험지 제작/(scope, 비움), ngd-studio/inputs/시험지 제작/(scope, V3만 유지), phase-05 본인 파일(workflow). archive/inputs/시험지 제작/, archive/templates/은 사용되지 않음 (스펙대로 이동 대상 없음).

#### Verification Re-run (orchestrator)
exit 0 — V3 양식지 단일, inputs/시험지 제작/ empty, 구버전 양식지 2곳 git `D` 확인.

#### Simplify (orchestrator)
스킵 — 마크다운 문서 외 수정 대상 없음.

#### Review (orchestrator)
VERDICT: pass — 모든 spot check 통과. V3 양식지 무손상, scope 이탈 없음.

#### Commit
c6e62cf — `chore(housekeeping): Phase 5 — inputs/시험지 제작/ 정리`
