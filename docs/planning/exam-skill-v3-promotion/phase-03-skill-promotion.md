---
phase: 3
title: V3 SKILL.md → ngd-exam-create 폴더 승격
status: completed
depends_on: [1, 2]
scope:
  - .claude/skills/ngd-exam-create/SKILL.md
  - .claude/skills/ngd-exam-create-v3/
intervention_likely: false
intervention_reason: ""
executor: haiku
---

# Phase 3: V3 SKILL.md → ngd-exam-create 폴더 승격

> **범위**: SKILL.md 교체 + 내부 자기참조·명령어 일반화 + v3 폴더 삭제
> **난이도**: XS
> **의존성**: Phase 1 (회귀 baseline), Phase 2 (무결성 baseline)
> **영향 파일**: `.claude/skills/ngd-exam-create/SKILL.md` (덮어쓰기), `.claude/skills/ngd-exam-create-v3/` (삭제)

## 배경

`.claude/skills/ngd-exam-create/` 폴더는 V2 SKILL.md + 공유 자산(`scripts/`, `base_hwpx/`)을 담고 있다. V3가 안착됐으므로 V3 SKILL.md를 이 폴더의 SKILL.md로 옮기되, **공유 자산은 그대로 유지**한다 (V3가 절대경로로 참조 중).

## 설계

### 작업 단계

1. **V3 SKILL.md를 ngd-exam-create/SKILL.md로 복사** (덮어쓰기, V2 SKILL.md는 사라짐)
2. **frontmatter 갱신** (`name: ngd-exam-create-v3` → `ngd-exam-create`, description의 V3 표기 정리)
3. **본문 자기참조 일반화** (`ngd-exam-create-v3` → `ngd-exam-create`, line 2와 line 15 총 2곳)
4. **본문 명령어 패턴 일반화**:
   - `V3 resume` → `resume` (약 30회)
   - `V3 작업` → `시험지 제작` 또는 단순 `작업`
   - `V3 시험지 제작` → `시험지 제작`
   - 표제 "NGD V3 시험지 제작 오케스트레이터" → "NGD 시험지 제작 오케스트레이터"
   - 단, V3 내부 phase 명칭(`[Phase 1] extractor`, `[Phase 2] 순차`)은 의미상 V3 흐름의 구조 표기 → 그대로 유지
5. **`.claude/skills/ngd-exam-create-v3/` 폴더 삭제** (SKILL.md 1개만 들어있는 폴더 통째)
6. **Phase 2 무결성 테스트 재실행** — SKILL.md 절대경로 참조가 깨지지 않았는지 확인

### 보존 자산 (건드리지 말 것)

- `.claude/skills/ngd-exam-create/scripts/fix_namespaces.py`
- `.claude/skills/ngd-exam-create/scripts/validate.py`
- `.claude/skills/ngd-exam-create/base_hwpx/` 전체
- `.claude/skills/ngd-exam-create/sample_analysis.md` — V2 잔재이지만 Phase 5에서 삭제 (이번 phase에서는 건드리지 않음)

### 양식지 경로

housekeeping Phase 2에서 확정된 표준 경로 그대로 유지:
- line 193: `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` (변경 없음)

## 체크리스트

- [ ] `.claude/skills/ngd-exam-create-v3/SKILL.md`를 `.claude/skills/ngd-exam-create/SKILL.md`로 덮어쓰기
- [ ] frontmatter `name: ngd-exam-create`, description 갱신 (V3 표기 정리)
- [ ] 본문 `ngd-exam-create-v3` 자기참조 모두 `ngd-exam-create`로 치환 (총 2곳)
- [ ] 본문 명령어 패턴 일반화 (`V3 resume` → `resume`, `V3 작업` → `작업` 등 30+회)
- [ ] `.claude/skills/ngd-exam-create-v3/` 폴더 삭제 (`rm -rf`)
- [ ] `bash .claude/tests/check_integrity.sh` 통과 (Phase 2 baseline 재검증)

## 영향 범위

- `ngd-exam-create/SKILL.md` 내용 교체 → 한컴 Claude Code가 다음 turn에 V3 흐름으로 인식
- V3 폴더 삭제 시 Claude Code의 skill 디스커버리에서 `ngd-exam-create-v3` 사라짐
- **ngd-studio 측은 아직 `"ngd-exam-create-v3"` 스킬명을 호출 중** — Phase 4에서 동기화. 그 사이에 사용자가 studio로 V3 작업을 시도하면 실패. 가능하면 Phase 3와 Phase 4를 같은 세션에 연이어 실행.

## 검증

```bash
# v3 폴더 사라짐
test ! -d /mnt/c/NGD/.claude/skills/ngd-exam-create-v3

# ngd-exam-create SKILL.md가 V3 내용 (frontmatter name 확인)
head -5 /mnt/c/NGD/.claude/skills/ngd-exam-create/SKILL.md | grep -q "name: ngd-exam-create$"

# 자기참조 잔재 0건
! grep -q "ngd-exam-create-v3" /mnt/c/NGD/.claude/skills/ngd-exam-create/SKILL.md

# V3 명령어 패턴 잔재 0건 (V3 단어가 본문에 없어야)
! grep -E "V3 resume|V3 작업|시험지 제작 v3" /mnt/c/NGD/.claude/skills/ngd-exam-create/SKILL.md

# 공유 자산 보존
test -f /mnt/c/NGD/.claude/skills/ngd-exam-create/scripts/fix_namespaces.py
test -f /mnt/c/NGD/.claude/skills/ngd-exam-create/scripts/validate.py
test -d /mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx

# 무결성 테스트 통과
cd /mnt/c/NGD && bash .claude/tests/check_integrity.sh
```

## 실행 결과

### 1회차 (2026-05-12 13:25 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-haiku-4-5

#### 요약
Phase 3 체크리스트 전체 완료. V3 SKILL.md를 ngd-exam-create 폴더로 승격하고 frontmatter, 자기참조, 명령어 패턴을 모두 일반화했다. ngd-exam-create-v3 폴더 삭제 후 Phase 2 무결성 테스트 재실행하여 모든 항목 PASS 확인.

#### 변경 파일
- `.claude/skills/ngd-exam-create/SKILL.md` (수정, 약 700줄 V3→일반화)
- `.claude/skills/ngd-exam-create-v3/` (삭제)

#### 검증 결과
- [x] v3 폴더 삭제: `test ! -d` → pass
- [x] frontmatter name 갱신: `name: ngd-exam-create` → pass
- [x] 자기참조 제거: `grep ngd-exam-create-v3` → 0건 pass
- [x] V3 패턴 제거: `grep "V3 resume\|V3 작업"` → 0건 pass
- [x] 공유 자산 보존: fix_namespaces.py, validate.py, base_hwpx/ → pass
- [x] 무결성 테스트: `bash .claude/tests/check_integrity.sh` → ALL PASS

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 in-scope changes: `ngd-exam-create/SKILL.md` (M), `ngd-exam-create-v3/SKILL.md` (D, 전 폴더 삭제). scripts/, base_hwpx/, sample_analysis.md 모두 보존됨.

#### Verification Re-run (orchestrator)
exit 0 — 6개 test 조건 모두 충족 + `check_integrity.sh` ALL PASS.

#### Simplify (orchestrator)
0 files, 0 edits — SKILL.md 이미 정돈된 상태, 제거할 dead text 없음.

#### Review (orchestrator)
VERDICT: pass — frontmatter/자기참조/V3 패턴 모두 일반화, 6 에이전트 실존. check_integrity.sh의 v3 경로 참조는 fallback 로직으로 무해 (별도 cleanup 권장 — 후속 phase에서 처리).
