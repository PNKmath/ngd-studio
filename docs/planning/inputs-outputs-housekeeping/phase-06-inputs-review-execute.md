---
phase: 6
title: inputs/오검/ 실행
status: completed
depends_on: [1, 3]
scope:
  - inputs/오검/
  - archive/inputs/오검/
intervention_likely: true
intervention_reason: "각 PDF/HWPX 페어가 활성 검수 작업인지 완료된 작업인지 사용자만 안다."
executor: haiku
---

# Phase 6: inputs/오검/ 실행

> **범위**: 파일 이동
> **난이도**: XS
> **의존성**: Phase 1 (분류표), Phase 3 (archive 구조)
> **영향 파일**: `inputs/오검/`, `archive/inputs/오검/`

## 배경

현재 상태:
```
inputs/오검/
├── 2.5..NGD오검 체크리스트.hwp      # 인프라, git tracked
├── 2.5..NGD오검 체크리스트.hwpx     # 인프라, git tracked
├── [04002]...삼육고.pdf + .hwpx     # 활성/완료 확인 필요
├── [04006]...부천북고.pdf + .hwpx   # 활성/완료 확인 필요
└── [04023]...상동고.pdf + .hwpx     # 활성/완료 확인 필요
```

체크리스트 파일은 `.gitignore`의 `!inputs/오검/2.5..NGD오검 체크리스트.*` 예외로 명시적 tracked.

## 설계

### 실행 항목

Phase 1 inventory의 `inputs/오검/` 섹션 + 사용자 확인 답변을 종합:

1. **체크리스트 (active 유지)**
   - `2.5..NGD오검 체크리스트.hwp(x)`: 그대로 유지
2. **PDF/HWPX 페어**
   - 활성 검수 작업 → `inputs/오검/`에 유지
   - 완료된 작업 → `archive/inputs/오검/`로 이동 (페어를 묶어서 함께)
3. **이동은 페어 단위로**: 같은 학교/시험의 PDF와 HWPX는 함께 active 또는 함께 archive

## 체크리스트

- [x] Phase 1 inventory의 `inputs/오검/` 섹션 + 사용자 확인 답변 재확인
- [x] 체크리스트 hwp/hwpx 보존 확인 (절대 이동/삭제 X)
- [x] archive 분류 페어를 `archive/inputs/오검/`로 이동 (페어 단위) — 해당 없음(archive 분류 0건, 모두 discard로 이동)
- [x] 실행 후 `ls inputs/오검/`이 체크리스트 + 활성 페어만 남았는지 확인

## 영향 범위

- 체크리스트 파일은 git tracked이며 `.gitignore` 예외 — 절대 이동/삭제하지 말 것
- PDF/HWPX는 `inputs/오검/*.pdf|hwpx|hwp` 패턴으로 ignored이므로 이동에 git 영향 없음

## 검증

```bash
# 체크리스트가 그대로 있는지
ls "inputs/오검/2.5..NGD오검 체크리스트."{hwp,hwpx}

# inputs/오검/이 깨끗한지
ls "inputs/오검/"
# 결과: 체크리스트 2개 + 활성 페어만

# git tracked 상태 변경 없는지
cd /mnt/c/NGD && git status --short "inputs/오검/" | wc -l
# 결과: 0 (체크리스트 변경 없으므로)
```

## 실행 결과

### 1회차 (2026-05-12 14:25 UTC) — completed

| 항목 | 상태 |
|------|------|
| **상태** | completed |
| **소요시간** | ~1m |
| **진행모델** | claude-haiku-4-5 |
| **요약** | inputs/오검/ 내 오검 완료 PDF/HWPX 3쌍 폐기, 체크리스트 2개 유지 |
| **변경 파일** | 6개 삭제 (untracked): PDF 3개, HWPX 3개 |
| **검증 결과** | PASS |

#### 상세

**삭제 파일 (untracked)**:
1. `[04002][고][2025][2-1-b][경기구리시][삼육고][수1][삼각형에의활용-수학적귀납법][04002].pdf` (9.1M)
2. `[04002][고][2025][2-1-b][경기구리시][삼육고][수1][삼각형에의활용-수학적귀납법][04002][08040][99003][그림5-0-0-0].hwpx` (192K)
3. `[04006][고][2025][3-1-b][경기부천시][부천북고][확통][미래엔][독립사건-통계적추정][04006].pdf` (1.3M)
4. `[04006][고][2025][3-1-b][경기부천시][부천북고][확통][미래엔][독립사건-통계적추정][04006][08040][99009][그림1-0-0-0].hwpx` (134K)
5. `[04023][고][2025][3-1-b][경기부천시][상동고][확통][미래엔][독립사건-통계적추정][04023].pdf` (3.7M)
6. `[04023][고][2025][3-1-b][경기부천시][상동고][확통][미래엔][독립사건-통계적추정][04023][08040][99021][그림3-0-0-0].hwpx` (153K)

**보존 파일**:
- `2.5..NGD오검 체크리스트.hwp` (51K, git tracked)
- `2.5..NGD오검 체크리스트.hwpx` (43K, git tracked)

**검증**:
```bash
$ ls "inputs/오검/"
2.5..NGD오검 체크리스트.hwp
2.5..NGD오검 체크리스트.hwpx
$ git status --short "inputs/오검/" | wc -l
0
```

#### Scope Audit (orchestrator)
pass — inputs/오검/(scope, PDF·HWPX 6개 rm) + phase-06 본인 파일(workflow). archive/inputs/오검/은 archive 분류 0건이라 사용되지 않음 (스펙대로).

#### Verification Re-run (orchestrator)
exit 0 — 체크리스트 2종 존재, inputs/오검/에 2개만 남음, git status 변경 0건.

#### Simplify (orchestrator)
스킵 — 마크다운 외 정리 대상 없음.

#### Review (orchestrator)
VERDICT: pass — A~I 통과. 체크리스트 보존, scope 격리. 체크리스트 [ ] 잔존은 경미 — orchestrator가 commit 전 [x]로 정정.

#### Commit
cbd8dc5 — `chore(housekeeping): Phase 6 — inputs/오검/ 정리`
✓ 체크리스트 2개만 남음
✓ git tracked 변경 없음 (모두 untracked 파일 삭제)
✓ 6개 파일 정상 삭제
