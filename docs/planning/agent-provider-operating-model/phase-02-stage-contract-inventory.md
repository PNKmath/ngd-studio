---
phase: 2
title: Stage contract 인벤토리
status: completed
depends_on: [1]
scope:
  - docs/planning/agent-provider-operating-model/
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/prompts.ts
  - .claude/skills/ngd-exam-create/SKILL.md
  - .claude/agents/ngd-exam-extractor.md
  - .claude/agents/ngd-exam-solver.md
  - .claude/agents/ngd-exam-verifier.md
  - .claude/agents/ngd-exam-builder.md
  - .claude/agents/ngd-exam-checker.md
  - .claude/agents/ngd-exam-reviewer.md
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 2: Stage contract 인벤토리

> **범위**: Documentation
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `stage-contract-inventory.md` 신규

## 배경

Stage override가 실제로 의미 있으려면 “전체 provider를 바꾸는 것”이 아니라 stage별 입력/출력 contract를 바꾸지 않는 선에서 model provider를 선택하는 구조가 필요하다.

현재 stage는 `store.ts`의 UI stage, `.claude/skills`의 작업 단계, `.claude/agents`의 파일 입출력이 섞여 있다. 이를 typed contract 후보로 정리한다.

## 설계

`stage-contract-inventory.md`를 추가한다. 초기 stage key는 다음을 기준으로 하되, 현행 stage와의 차이를 명시한다.

- `cropper`
- `create.extractor`
- `create.solver`
- `create.verifier`
- `figure`
- `builder`
- `checker`
- `review.reviewer`

각 stage마다 다음을 작성한다.

- 현행 owner: skill/agent/script/server
- 입력 파일/데이터
- 출력 파일/데이터
- side effect
- deterministic validator 후보
- model provider 사용 가능성
- DeepSeek/Codex/Claude 후보 여부

## 체크리스트

- [x] `stage-contract-inventory.md` 신규 작성
- [x] UI stage 이름과 operating model stage key 차이를 기록
- [x] `create.extractor`, `create.solver`, `create.verifier`의 JSON 입출력 후보를 정리
- [x] `builder`, `checker`, `review.reviewer`의 side effect와 파일 수정 책임을 분리
- [x] 각 stage별 provider 후보를 표로 정리
- [x] DeepSeek가 사용할 수 있는 bounded stage와 사용할 수 없는 stage를 구분
- [x] 후속 `StageRunner` 설계에 필요한 최소 schema 목록을 도출

## 영향 범위

문서 phase다. 구현 코드를 추가하지 않는다.

## 검증

```bash
test -f docs/planning/agent-provider-operating-model/stage-contract-inventory.md
grep -n "create.extractor\\|create.solver\\|create.verifier\\|builder\\|checker\\|review.reviewer\\|DeepSeek" docs/planning/agent-provider-operating-model/stage-contract-inventory.md
```

## 실행 결과

### 2026-05-16

STATUS: completed

SUMMARY: UI/SSE/provider override stage 이름 차이를 분리하고, stage별 input/output/side effect/provider 가능성을 `stage-contract-inventory.md`에 정리했다.

VERIFICATION: pass

#### Scope Audit (orchestrator)

pass - 문서 phase 범위 내 파일만 변경.

#### Verification Re-run (orchestrator)

pass - phase 검증 명령 exit 0.
