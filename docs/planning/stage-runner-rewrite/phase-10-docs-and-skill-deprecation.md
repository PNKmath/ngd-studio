---
phase: 10
title: 문서 / skill 폐기 후보 표시
status: completed
depends_on: [9]
scope:
  - docs/planning/create-v4-merge/phase-05-deepseek-stage-orchestration.md
  - docs/planning/create-v4-merge/checklist.md
  - .claude/skills/ngd-exam-create/SKILL.md
  - .claude/agents/ngd-exam-extractor.md
  - .claude/agents/ngd-exam-solver.md
  - .claude/agents/ngd-exam-verifier.md
  - CLAUDE.md
  - docs/planning/stage-runner-rewrite/README.md
intervention_likely: false
intervention_reason: ""
---

# Phase 10: 문서 / skill 폐기 후보 표시

> **범위**: Docs
> **난이도**: XS
> **의존성**: Phase 9 (통합 검증 완료 후 문서화)
> **영향 파일**: docs/, .claude/skills/, CLAUDE.md

## 배경

코드 기반 orchestrator가 동작 검증되면 legacy skill/agent 자산은 폐기 후보. 즉시 삭제하지는 않고 "폐기 후보 + 사용처 명시" 메모만 추가.

## 설계

### 1. create-v4-merge Phase 5 처리

`docs/planning/create-v4-merge/phase-05-deepseek-stage-orchestration.md`:
- frontmatter `status: draft` → `status: scope-absorbed` (또는 비표준 상태 회피해 `completed` + 노트)
- 본문 상단에 큰 노트:
  > **이 phase는 `stage-runner-rewrite` task로 흡수되었습니다. 본 문서는 초기 설계 기록용 유지.**
- create-v4-merge/checklist.md 테이블에서도 상태/노트 갱신

### 2. SKILL.md 폐기 후보 헤더

`.claude/skills/ngd-exam-create/SKILL.md` 상단:
```markdown
> **⚠ 폐기 후보 (2026-05-17)**
> 이 skill은 legacy `/create` + `auto` provider 경로에서만 사용됩니다.
> 신규 코드 기반 orchestrator(`stage-runner-rewrite`)가 동일 기능을 제공합니다.
> `/create` 페이지 폐기 후 본 skill도 삭제 예정.
```

각 agent MD(`.claude/agents/ngd-exam-{extractor,solver,verifier}.md`)도 동일 헤더 추가 + "TS 이식 위치: `server/stages/prompts/...`" 링크.

### 3. CLAUDE.md 갱신

`## 시험지 제작` 섹션에 코드 기반 흐름 단락 추가:
- 신규 흐름: TS orchestrator (`server/stages/orchestrator.ts`)
- legacy 흐름: Claude CLI + `ngd-exam-create` skill (auto provider)
- 선택 기준: `/settings`에서 stage override 지정 여부

### 4. README 메모

`ngd-studio/README.md` 또는 `docs/planning/stage-runner-rewrite/README.md`에 "완료 보고" 섹션 — Phase 9 검증 결과 요약 + 후속 작업(`/create` 페이지 폐기 candidate) 명시.

## 체크리스트

- [ ] create-v4-merge/phase-05 본문 상단에 흡수 노트 추가 + frontmatter status 갱신
- [ ] .claude/skills/ngd-exam-create/SKILL.md + ngd-exam-{extractor,solver,verifier}.md 폐기 후보 헤더 추가
- [ ] CLAUDE.md에 신규/legacy 흐름 분기 단락 추가
- [ ] stage-runner-rewrite/README.md에 완료 보고 + 후속 작업 메모 추가

## 영향 범위

- docs/CLAUDE.md/.claude/skills 텍스트만. 코드 변경 없음.
- legacy 경로 동작에는 영향 없음.

## 검증

```bash
# 문서 변경만이므로 명령 없이 시각적 확인.
grep -r "폐기 후보" .claude/skills .claude/agents docs/planning
```

## 실행 결과

### 1회차 (2026-05-17 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
create-v4-merge/phase-05 흡수 알림 + status 갱신, SKILL.md + agent 3종에 폐기 후보 헤더 추가, CLAUDE.md에 신규/legacy 분기 단락 추가, stage-runner-rewrite/README.md에 완료 보고 섹션(Phase 1~10 커밋 해시 + 후속 작업 + 폐기 후보 자산) 추가.

#### 변경 파일
- `docs/planning/create-v4-merge/phase-05-deepseek-stage-orchestration.md` (수정, +5줄): frontmatter status → completed, 흡수 노트 블록 추가
- `docs/planning/create-v4-merge/checklist.md` (수정, +1/-1줄): phase-05 행 상태 → completed (stage-runner-rewrite로 흡수)
- `.claude/skills/ngd-exam-create/SKILL.md` (수정, +5줄): 폐기 후보 헤더 추가
- `.claude/agents/ngd-exam-extractor.md` (수정, +4줄): 폐기 후보 헤더 + TS 이식 경로 추가
- `.claude/agents/ngd-exam-solver.md` (수정, +4줄): 폐기 후보 헤더 + TS 이식 경로 추가
- `.claude/agents/ngd-exam-verifier.md` (수정, +4줄): 폐기 후보 헤더 + TS 이식 경로 추가
- `CLAUDE.md` (수정, +10줄): `### 1. 시험지 제작` 섹션에 신규/legacy 분기 단락 추가
- `docs/planning/stage-runner-rewrite/README.md` (수정, +28줄): `## 완료 보고 (2026-05-17)` 섹션 추가 (Phase 1~10 커밋 해시 + 후속 작업 + 폐기 후보 자산)

#### 검증 결과
- [x] grep "폐기 후보" pattern: 4건 매칭 (.claude/skills 1건 + .claude/agents 3건) — 일관성 확인

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음
