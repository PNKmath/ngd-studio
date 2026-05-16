---
phase: 3
title: Deterministic code 후보 분리
status: completed
depends_on: [2]
scope:
  - docs/planning/agent-provider-operating-model/
  - build_hwpx.py
  - .claude/skills/ngd-exam-create/scripts/fix_namespaces.py
  - .claude/skills/ngd-exam-create/scripts/validate.py
  - .claude/skills/ngd-exam-review/scripts/add_review_table.py
  - .claude/agents/ngd-exam-builder.md
  - .claude/agents/ngd-exam-checker.md
  - .claude/agents/ngd-exam-reviewer.md
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 3: Deterministic code 후보 분리

> **범위**: Documentation
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `deterministic-code-candidates.md` 신규

## 배경

현재 agent가 담당하는 작업 중 상당수는 모델 reasoning보다 파일 조작, script 실행, XML rule check, retry orchestration에 가깝다. 이 부분은 서버 코드나 Python script로 빼야 provider 선택이 단순해진다.

## 설계

`deterministic-code-candidates.md`를 추가한다. 다음 후보를 우선 분석한다.

- orchestration: resume parsing, cache cleanup, batching, retry loop
- builder: `build_hwpx.py`, `fix_namespaces.py`, `validate.py`
- checker: HWPX XML rule checks
- review table: `add_review_table.py`
- job metadata/telemetry: server-side 기록

각 후보마다 코드화 난이도, 필요한 입력, 성공/실패 판정, agent fallback 필요 여부를 기록한다.

## 체크리스트

- [x] `deterministic-code-candidates.md` 신규 작성
- [x] orchestration/cache/batching/retry를 코드화 후보로 분리
- [x] builder script 실행을 서버 runner로 옮기는 후보 범위를 정리
- [x] checker XML rule 중 코드화 가능한 항목을 목록화
- [x] reviewer의 HWPX 직접 수정과 report draft 생성을 분리
- [x] agent fallback이 필요한 경우와 필요 없는 경우를 구분
- [x] 구현 우선순위 Top 3를 제안

## 영향 범위

문서 phase다. 실제 builder/checker 구현은 후속 task로 분리한다.

## 검증

```bash
test -f docs/planning/agent-provider-operating-model/deterministic-code-candidates.md
grep -n "build_hwpx.py\\|fix_namespaces.py\\|validate.py\\|add_review_table.py\\|checker\\|fallback" docs/planning/agent-provider-operating-model/deterministic-code-candidates.md
```

## 실행 결과

### 2026-05-16

STATUS: completed

SUMMARY: orchestration/cache/retry, builder runner, checker XML rules, reviewer mutation을 deterministic code 후보로 분리하고 구현 우선순위 Top 3를 정리했다.

VERIFICATION: pass

#### Scope Audit (orchestrator)

pass - 문서 phase 범위 내 파일만 변경.

#### Verification Re-run (orchestrator)

pass - phase 검증 명령 exit 0.
