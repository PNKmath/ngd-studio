---
phase: 4
title: outputs/ 실행 (이동/삭제)
status: completed
depends_on: [1, 3]
scope:
  - outputs/
  - archive/outputs/
intervention_likely: false
intervention_reason: ""
executor: haiku
---

# Phase 4: outputs/ 실행 (이동/삭제)

> **범위**: 파일 이동/삭제 (기계적)
> **난이도**: S
> **의존성**: Phase 1 (분류표), Phase 3 (archive 구조)
> **영향 파일**: `outputs/`, `archive/outputs/`

## 배경

Phase 1의 `inventory.md`에 outputs/ 모든 파일이 `active` / `archive` / `discard`로 분류 확정되어 있다. Phase 3에서 `archive/outputs/` 폴더 정책이 정해져 있다. 이 phase는 그 결정을 **기계적으로 실행**한다.

## 설계

### 실행 순서

1. **백업 안전망**: 실행 전 `outputs/`의 현재 상태를 `git status --ignored outputs/`로 확인 (outputs는 ignored이지만 추적 차원)
2. **discard**: 삭제 (`rm`)
   - 대상 예시: `*.bak`, `*.bak-before-*`, `_fixed.hwpx`, `_fixed2.hwpx` (더 새 버전이 active로 있을 때), `output.hwpx`, `test_hwp/`
3. **archive**: `archive/outputs/`로 이동 (`mv`)
   - 대상 예시: `[AI][미검수]` 표기 파일, V3 시점 이전 단일 버전
4. **active**: outputs/ 루트에 그대로 유지

### outputs/images/ 처리

- images/ 폴더는 V3 builder의 그림 산출물 — active일 가능성 높음
- 단, 이전 시점 파일은 archive 대상일 수도
- Phase 1 inventory에서 결정된 분류대로 처리

## 체크리스트

- [ ] Phase 1 inventory.md의 outputs/ 섹션 재확인 (분류 확정 상태인지)
- [ ] `discard` 분류 파일 삭제 (`rm`)
- [ ] `archive` 분류 파일 `archive/outputs/`로 이동 (`mv`)
- [ ] `active` 분류 파일은 `outputs/` 루트에 유지
- [ ] 실행 후 `ls outputs/`가 active 파일만 남았는지 확인 (inventory와 일치)

## 영향 범위

- **outputs는 git ignored** → git history 영향 없음
- 단, `archive/outputs/`로 이동한 파일은 `archive/` 정책에 따라 tracked될 수 있음 → Phase 3 정책 확인 필수
- 잘못 삭제한 경우 복구 불가 (git ignored라 history 없음) — Phase 1 분류 확정이 정확해야 한다

## 검증

```bash
# outputs/ 빈 폴더 여부 (Phase 1에서 active=0)
test -z "$(find /mnt/c/NGD/outputs/ -mindepth 1 -maxdepth 1 ! -name '.*' -print -quit)" \
  && echo "outputs/ empty (expected, active=0)"

# archive/outputs/에 12개 파일 이동 확인
test "$(find /mnt/c/NGD/archive/outputs/ -maxdepth 1 -type f | wc -l)" -eq 12 \
  && echo "archive/outputs/ has 12 files (expected)"
```

## 실행 결과

### 1회차 (2026-05-12 19:35 KST) — completed

**상태**: ✅ completed  
**소요시간**: ~3분  
**진행모델**: claude-haiku-4-5  
**요약**: outputs/ 내 파일 33개(폴더 포함) 처리 완료 — discard 21개 삭제, archive 12개 이동

**변경 내역**:
- **deleted**: 
  - 폴더: `images/`, `test_hwp/`
  - 파일: `.bak*` 3개, `_fixed*` 2개, 완료된 시험지 11개, `output.hwpx` 1개, `[04050][AI][미검수]` 1개 = 총 21개
- **moved to archive/outputs/**: 12개 파일
  - `[04039]…[명일여자고]…[AI][미검수]…` (1-1)
  - `[04039]…[][치동고등학교]…` (2-1-a)
  - `[04039]…[운유고]…[그림1-0-0-0]`, `[그림1-0-1-0]` (2-1-a, 2개)
  - `[04039]…[소명여고]…[여러가지순열-통계적추정]…` (2-1-a)
  - `[04039]…[경북고]…[미분법~적분법]…[AI]`, `[AI][미검수]`, `(no AI .hwp)`, `[전범위][AI][미검수]` (2-1-b, 4개)
  - `[04039]…[소명여고]…[독립사건-통계적추정]…` (3-1-b)
  - `[04048]…[판곡고]…` (2-1-a)
  - `[04050]…[삼육고]…(no AI)` (2-1-a)

**검증 결과**:
- ✅ `outputs/` → 빈 폴더 (active 0개로 분류되었으므로 정상)
- ✅ `archive/outputs/` → 12개 파일 존재
- ✅ git status: git ignored 폴더이므로 추적 변경 없음
- ✅ 분류 기준(inventory.md) 100% 준수 확인

**추가 발견사항**:
- 처음에 `[04002]…` 파일이 outputs/에 없어서 inventory 검증 필요했으나, 실제로 확인 결과 outputs/에 없는 것이 정상 (이미 삭제되었거나 최초에 있지 않았을 가능성)
- 폴더 삭제는 `rm -rf` 사용 (images/ 33개 파일, test_hwp/ 4개 파일)
- 파일 삭제는 `rm -- ` (수동 이스케이프) / 이동은 `mv` 사용

**결정 사항**: 
- outputs/는 git ignored이므로 discard된 파일 복구 불가 → Phase 1의 inventory.md 분류가 정확했음을 전제로 진행
- archive/outputs/도 .gitignore로 ignore되므로 git history 영향 없음

### 2회차 (2026-05-12 검증 재실행) — completed

**상태**: ✅ completed  
**소요시간**: ~1분  
**진행모델**: claude-haiku-4-5  
**요약**: 검증 블록 의미 정정 — grep regex 제거 후 find 기반으로 교체

**변경 내역**:
- 검증 섹션: `grep -E "^\|.*\| active \|"` (마크다운 **bold** 미지원) → `find` 기반 직접 검증
- 명령 1: `test -z "$(find /mnt/c/NGD/outputs/ -mindepth 1 -maxdepth 1 ! -name '.*' -print -quit)"` → outputs/ 빈 폴더 확인
- 명령 2: `test "$(find /mnt/c/NGD/archive/outputs/ -maxdepth 1 -type f | wc -l)" -eq 12"` → archive/outputs/ 12개 파일 확인

**검증 결과**:
- ✅ outputs/ empty (expected, active=0)
- ✅ archive/outputs/ has 12 files (expected)
- ✅ exit 0 (성공)

**추가 발견사항**: 없음

**질문**: 없음
