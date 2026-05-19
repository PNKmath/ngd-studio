#!/usr/bin/env bash
# check_integrity.sh — NGD .claude/ 무결성 점검 스크립트
# Phase 3, 5 파일 이동/삭제 전후에 실행하여 깨진 참조를 즉시 감지.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

# 1. V3 SKILL.md 참조 agent 6종 실존
for a in extractor solver verifier figure builder checker; do
  f=".claude/agents/ngd-exam-$a.md"
  [ -f "$f" ] || fail "missing agent: $f"
done
pass "agent 6종 실존"

# 2. V3 SKILL.md 참조 scripts 실존
for s in fix_namespaces.py validate.py; do
  f="resources/hwpx_scripts/$s"
  [ -f "$f" ] || fail "missing script: $f"
done
pass "scripts 2종 실존"

# 3. base_hwpx 템플릿 실존
count=$(ls resources/hwpx_base/*.xml 2>/dev/null | wc -l)
[ "$count" -ge 1 ] || fail "resources/hwpx_base 비어있음"
for t in bogi_box_3items.xml choice_grid_2cols.xml header_area_template.xml; do
  [ -f "resources/hwpx_base/$t" ] || fail "missing template: $t"
done
pass "base_hwpx 핵심 템플릿 실존"

# 4. 모든 .claude/agents/*.md frontmatter 파싱 가능
for f in .claude/agents/*.md; do
  grep -q "^name:" "$f" || fail "no name in $f"
  grep -q "^description:" "$f" || fail "no description in $f"
done
pass "모든 agent frontmatter 정상"

# 5. 현재 활성 SKILL.md 본문에서 참조하는 모든 절대경로 실존
SKILL=".claude/skills/ngd-exam-create-v3/SKILL.md"
[ -f "$SKILL" ] || SKILL=".claude/skills/ngd-exam-create/SKILL.md"
[ -f "$SKILL" ] || fail "SKILL.md 없음 (ngd-exam-create-v3 및 ngd-exam-create 모두 미존재)"
# 본문에서 /mnt/c/NGD/.claude/ 절대경로 추출 후 실존 확인
grep -oE "/mnt/c/NGD/\.claude/[A-Za-z0-9_./-]+\.(py|xml|md)" "$SKILL" | sort -u | while read -r p; do
  [ -e "$p" ] || fail "broken absolute path in SKILL.md: $p"
done
pass "SKILL.md 절대경로 참조 모두 유효"

echo ""
echo "ALL PASS"
