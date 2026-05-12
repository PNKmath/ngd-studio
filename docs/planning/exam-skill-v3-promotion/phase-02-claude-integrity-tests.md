---
phase: 2
title: Claude skill/agent 무결성 테스트
status: completed
depends_on: []
scope:
  - .claude/tests/check_integrity.sh
  - .claude/tests/README.md
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: Claude skill/agent 무결성 테스트

> **범위**: 신규 무결성 점검 스크립트
> **난이도**: S
> **의존성**: 없음 (Phase 1과 병렬 가능)
> **영향 파일**: `.claude/tests/check_integrity.sh` (신규), README (신규)

## 배경

`.claude/skills/ngd-exam-create-v3/SKILL.md`(승격 대상)와 `.claude/agents/*.md`는 서로를 절대경로로 참조하고 있다. Phase 3에서 V3 SKILL.md를 옮기고 Phase 5에서 V2 잔재 파일들을 삭제할 때, 참조가 깨지는지 자동 검증할 수단이 필요하다.

Studio 측에는 Phase 1에서 vitest로 회귀 baseline을 깔지만, `.claude/` 측에는 별도 검증이 없다. 이 phase는 그 공백을 채운다.

## 설계

### 무결성 점검 항목

`.claude/tests/check_integrity.sh` (bash 스크립트, 각 항목 fail 시 non-zero exit):

1. **V3 SKILL.md 참조 agent 6종 실존** (Phase 3 전후 모두 통과해야 함):
   - `.claude/agents/ngd-exam-extractor.md`
   - `.claude/agents/ngd-exam-solver.md`
   - `.claude/agents/ngd-exam-verifier.md`
   - `.claude/agents/ngd-exam-figure.md`
   - `.claude/agents/ngd-exam-builder.md`
   - `.claude/agents/ngd-exam-checker.md`

2. **V3 SKILL.md 참조 scripts 실존** (Phase 3 후에도 깨지면 V3 동작 불가):
   - `.claude/skills/ngd-exam-create/scripts/fix_namespaces.py`
   - `.claude/skills/ngd-exam-create/scripts/validate.py`

3. **base_hwpx 템플릿 실존** (builder가 사용):
   - `.claude/skills/ngd-exam-create/base_hwpx/` 폴더에 `*.xml` 1개 이상
   - 핵심 템플릿 존재 확인: `bogi_table_3items.xml`, `choice_table_5x5.xml`, `header_area_template.xml`

4. **모든 .claude/agents/*.md frontmatter 파싱 가능**:
   - `name:`, `description:` 필드 존재 (단순 grep 또는 yaml parse)

5. **현재 활성 SKILL.md 본문에서 참조하는 모든 절대경로 실존**:
   - Phase 3 전: `.claude/skills/ngd-exam-create-v3/SKILL.md`의 `/mnt/c/NGD/.claude/...` 경로
   - Phase 3 후: `.claude/skills/ngd-exam-create/SKILL.md`의 동일 경로 (의미 동일하므로 같은 스크립트로 검증)

### 스크립트 구조

```bash
#!/usr/bin/env bash
set -e
fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

# 1. agent 6종
for a in extractor solver verifier figure builder checker; do
  f=".claude/agents/ngd-exam-$a.md"
  [ -f "$f" ] || fail "missing agent: $f"
done
pass "agent 6종 실존"

# 2. scripts
for s in fix_namespaces.py validate.py; do
  f=".claude/skills/ngd-exam-create/scripts/$s"
  [ -f "$f" ] || fail "missing script: $f"
done
pass "scripts 2종 실존"

# 3. base_hwpx
count=$(ls .claude/skills/ngd-exam-create/base_hwpx/*.xml 2>/dev/null | wc -l)
[ "$count" -ge 1 ] || fail "base_hwpx 비어있음"
for t in bogi_table_3items.xml choice_table_5x5.xml header_area_template.xml; do
  [ -f ".claude/skills/ngd-exam-create/base_hwpx/$t" ] || fail "missing template: $t"
done
pass "base_hwpx 핵심 템플릿 실존"

# 4. agent frontmatter
for f in .claude/agents/*.md; do
  grep -q "^name:" "$f" || fail "no name in $f"
  grep -q "^description:" "$f" || fail "no description in $f"
done
pass "모든 agent frontmatter 정상"

# 5. SKILL.md 절대경로 참조 검증
SKILL=".claude/skills/ngd-exam-create-v3/SKILL.md"
[ -f "$SKILL" ] || SKILL=".claude/skills/ngd-exam-create/SKILL.md"
# 본문에서 /mnt/c/NGD/.claude/ 절대경로 추출 후 실존 확인
grep -oE "/mnt/c/NGD/\.claude/[A-Za-z0-9_./-]+\.(py|xml|md)" "$SKILL" | sort -u | while read -r p; do
  [ -e "$p" ] || fail "broken absolute path in SKILL.md: $p"
done
pass "SKILL.md 절대경로 참조 모두 유효"

echo "ALL PASS"
```

### README

`.claude/tests/README.md` 단순 사용법 (실행 방법, 무엇을 검증하는지). 1페이지 이내.

## 체크리스트

- [x] `.claude/tests/` 디렉터리 생성
- [x] `.claude/tests/check_integrity.sh` 작성 (위 5개 점검 항목)
- [x] `.claude/tests/README.md` 작성 (사용법, 검증 범위)
- [x] `chmod +x .claude/tests/check_integrity.sh` (실행 권한)
- [x] `bash .claude/tests/check_integrity.sh` 통과 (현재 상태에서 ALL PASS)

## 영향 범위

- 이 phase는 **신규 파일만 추가**. 기존 코드 변경 0. 회귀 위험 없음.
- Phase 3, 5의 안전망 — 파일 이동/삭제 후 재실행해 깨진 참조 즉시 감지.
- 향후 V3 SKILL.md 본문 수정 시에도 검증 가능 (절대경로 참조 자동 추출).

## 검증

```bash
cd /mnt/c/NGD
bash .claude/tests/check_integrity.sh
echo "exit: $?"
# ALL PASS, exit 0
```

## 실행 결과

### 1회차 (2026-05-12 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`.claude/tests/` 디렉터리를 신규 생성하고, 5개 무결성 점검 항목을 포함한 `check_integrity.sh` 스크립트와 `README.md`를 작성했다. 현재 저장소 상태에서 스크립트를 실행한 결과 ALL PASS (exit 0) 확인.

#### 변경 파일
- `.claude/tests/check_integrity.sh` (신규, +52줄)
- `.claude/tests/README.md` (신규, +36줄)

#### 검증 결과
- [x] `bash .claude/tests/check_integrity.sh` → ALL PASS (exit 0)
  - PASS: agent 6종 실존
  - PASS: scripts 2종 실존
  - PASS: base_hwpx 핵심 템플릿 실존
  - PASS: 모든 agent frontmatter 정상
  - PASS: SKILL.md 절대경로 참조 모두 유효

#### 추가 발견사항
- agents/ 디렉터리에는 설계 명세의 6종 외에 `ngd-exam-reader.md`, `ngd-exam-reviewer.md` 2종도 존재. 이 추가 파일들은 frontmatter(name/description) 정상이므로 항목 4 검사 통과.
- base_hwpx/에 XML 파일 23개 확인 (핵심 3종 포함).

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 in-scope files (.claude/tests/check_integrity.sh, .claude/tests/README.md) 신규 생성, scope 이탈 없음.

#### Verification Re-run (orchestrator)
exit 0 — `bash .claude/tests/check_integrity.sh`: ALL PASS (5 checks).

#### Simplify (orchestrator)
1 file, 1 edit — check_integrity.sh 헤더 중복 사용법 주석 1줄 제거 (README.md 중복). VERIFY pass.

#### Review (orchestrator)
VERDICT: pass — 스펙 5항목 그대로 구현, ALL PASS exit 0, scope 이탈 없음.

#### Commit
6c6432f — `test(.claude): Phase 2 — .claude 무결성 점검 스크립트 추가`
