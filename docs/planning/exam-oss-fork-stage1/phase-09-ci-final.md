---
phase: 9
title: CI(GitHub Actions) + 최종 검수 + push 준비
status: pending
depends_on: [3, 6, 7, 8]
scope:
  - /mnt/c/openexam/.github/workflows
  - /mnt/c/openexam
intervention_likely: true
intervention_reason: "GitHub 새 레포 생성 + 첫 push는 사용자 수동. push 시점/방식 확인 필요"
executor: sonnet
---

# Phase 9: CI + 최종 검수 + push 준비

> **범위**: CI 설정 + 잔재 검수 + push 직전 보고서
> **난이도**: M
> **의존성**: Phase 3, 6, 7, 8 (전체 구조 안정화 후)
> **영향 파일**: `.github/workflows/ci.yml`, 최종 검수 보고서

## 배경

퍼블릭으로 push하기 전 마지막 단계. CI 워크플로를 깔고, 잔존 NGD 흔적/저작권 위험을 최종 점검하고, GitHub 새 레포 생성과 push를 사용자가 안전하게 할 수 있도록 가이드한다.

## 설계

### `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install ruff
      - run: ruff check builders/ pipeline/
      # pytest는 테스트 파일 추가 시점에 (이번 단계 아님)

  studio:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: studio } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

### 최종 검수 항목
1. `grep -rli "NGD\|ngd-exam\|ngd-studio" --exclude-dir=.git --exclude-dir=node_modules` 결과 검토
2. `find . -name "*.pdf" -o -name "*.bak*" -o -name "*.backup-*"` 비어있는지
3. `git log --all -p | grep -iE "ANTHROPIC_API_KEY=sk|GEMINI_API_KEY=AI"` — history에 실제 키 노출 없는지
4. LICENSE Copyright holder 확정됐는지
5. README 빠른시작 절차로 실제 빌드 성공하는지 (샘플 데이터로)
6. 모든 phase 1-8 `completed` 상태인지

### Push 준비 (사용자 수동)
- GitHub UI에서 새 레포 생성 (`openexam`, public)
- `git remote add origin git@github.com:<user>/openexam.git`
- `git branch -M main`
- `git push -u origin main`
- 위 절차는 README에 명시 + 사용자에게 안내

## 체크리스트

- [ ] `.github/workflows/ci.yml` 작성 (Python ruff + studio lint/build)
- [ ] 첫 push 전 로컬에서 동일 명령으로 dry run (`ruff check`, `npm run lint`, `npm run build`)
- [ ] `grep -rli "NGD\|ngd-"` 최종 검수 + 의도되지 않은 잔존은 모두 제거
- [ ] `find . -size +1M -not -path "./.git/*"` 큰 파일 최종 점검 (의도된 자산만)
- [ ] `git log --all -p` 시크릿 노출 없는지 점검
- [ ] 최종 검수 보고서 작성 (`docs/planning/exam-oss-fork-stage1/final-report.md`) — 잔존 항목, 알려진 한계, 3단계 권장 작업
- [ ] GitHub 새 레포 생성 + push 가이드 README에 명시 (실제 push는 사용자 수동)

## 영향 범위

- CI workflow가 실패하면 첫 push 후 README 배지 빨강 — 로컬 dry run 필수
- Push 자체는 사용자 권한 (gh CLI 또는 GitHub UI)

## 검증

```bash
cd /mnt/c/openexam

# 잔재 검수
grep -rli "NGD\|ngd-exam\|ngd-studio" --exclude-dir=.git --exclude-dir=node_modules
find . \( -name "*.pdf" -o -name "*.bak*" -o -name "*.backup-*" \) -not -path "./.git/*"

# 시크릿 검수
git log --all -p 2>/dev/null | grep -iE "sk-ant-|api[_-]?key.*=.*['\"][a-zA-Z0-9]{20,}" | head

# 로컬 CI dry run
ruff check builders/ pipeline/
cd studio && npm ci && npm run lint && npm run build
```

## 실행 결과
