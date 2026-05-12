---
phase: 1
title: Studio 회귀 테스트 인프라 + 핵심 테스트
status: completed
depends_on: []
scope:
  - ngd-studio/package.json
  - ngd-studio/vitest.config.ts
  - ngd-studio/lib/__tests__/prompts.test.ts
  - ngd-studio/lib/__tests__/claude.test.ts
  - ngd-studio/lib/__tests__/store.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 1: Studio 회귀 테스트 인프라 + 핵심 테스트

> **범위**: 신규 테스트 인프라 + 3개 테스트 파일
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `ngd-studio/package.json`, `vitest.config.ts`, 3개 테스트 파일 (모두 신규)

## 배경

ngd-studio에는 현재 테스트 인프라가 **전혀 없다** (`package.json`에 vitest/jest 없음, 테스트 파일 0개). Phase 4의 풀 일반화(skill 이름, mode 키, 페이지 rename)는 변경 범위가 크고 라우팅까지 건드리므로, **현재 동작을 잠그는 회귀 테스트 baseline**을 먼저 확보해야 한다. 그래야 Phase 4에서 의미 보존 여부를 객관적으로 검증할 수 있다.

## 설계

### 테스트 러너

- **vitest** 선택 — Next.js 16 + React 19 + Vite 친화적, 설정 부담 적음
- `npm test` 스크립트 추가, `vitest.config.ts`로 기본 설정

### 잠글 대상 (3개 테스트 파일)

#### lib/__tests__/prompts.test.ts

`lib/prompts.ts`의 build* 함수 5종이 emit하는 **스킬명·필수 필드**를 잠근다:

| 함수 | 잠글 항목 (현재 값) |
|------|---------------------|
| `buildCreatePrompt` (line 6) | `Skill 도구로 "ngd-exam-create" 스킬을 호출` (line 56) |
| `buildCreateV3Prompt` (line 61) | `Skill 도구로 "ngd-exam-create-v3" 스킬을 호출` (line 99) |
| `buildResumeV3Prompt` (line 104) | 첫 줄 `V3 resume --from=${startFrom}` (line 118), `Skill 도구로 "ngd-exam-create-v3"` (line 136) |
| `buildCropPrompt` (line 141) | `Skill 도구로 "ngd-exam-crop"` (line 148) |
| `buildReviewPrompt` (line 152) | `Skill 도구로 "ngd-exam-review"` |

#### lib/__tests__/claude.test.ts

`lib/claude.ts`의 `detectStageFromTool`이 잠금 대상:

| 입력 (tool, input) | 현재 출력 |
|---------------------|-----------|
| `Skill`, `{skill: "ngd-exam-create"}` | `"reader"` (line 211, V1 의미) |
| `Skill`, `{skill: "ngd-exam-create-v3"}` | `"extractor"` (line 212) |
| `Skill`, `{skill: "ngd-exam-crop"}` | `"cropper"` (line 213) |
| `Skill`, `{skill: "nano-banana"}` | `"figure"` (line 214) |
| `Agent`, `{subagent_type: "ngd-exam-extractor"}` | `"extractor"` |
| `Agent`, `{subagent_type: "ngd-exam-solver"}` | `"solver"` |
| `Agent`, `{subagent_type: "ngd-exam-builder"}` | `"builder"` |
| `Read`, `{file_path: "x.pdf"}` | `"reader"` |
| `Write`, `{file_path: "section0.xml"}` | `"builder"` |

#### lib/__tests__/store.test.ts

`lib/store.ts`의 `setMode`가 잠금 대상:

| mode | 잠글 항목 |
|------|-----------|
| `"create"` | `createStages` 배열 5개 (line 56-62): reader, solver, figure, builder, checker |
| `"create-v3"` | `createV3Stages` 배열 8개 (line 64-73): cleaned, extractor, review_extract, solver, verifier, figure, builder, checker |
| `"resume-v3"` | `buildResumeV3Stages` 동작 (resumeFrom 별 done/pending 구분) |
| `"crop"` | `cropStages` 1개 (line 87-89): cropper |
| `"review"` | `reviewStages` 1개 (line 91-93): reviewer |

### 의미 보존 원칙

Phase 4에서 mode 키와 스킬 이름이 바뀌면 테스트도 함께 갱신하되, **잠그는 값의 의미는 동일**해야 한다. 예: `setMode("create-v3")` → `setMode("create")`로 바뀌어도 결과 stages가 8개 V3 흐름인 것은 유지.

## 체크리스트

- [x] `ngd-studio/package.json`에 vitest devDependency 추가 + `"test": "vitest run"` 스크립트
- [x] `ngd-studio/vitest.config.ts` 기본 설정 (Node 환경, ts 지원)
- [x] `lib/__tests__/prompts.test.ts` 작성 (5 함수 × 핵심 assertion)
- [x] `lib/__tests__/claude.test.ts` 작성 (detectStageFromTool 9 케이스)
- [x] `lib/__tests__/store.test.ts` 작성 (5 mode × stages 잠금)
- [x] `cd ngd-studio && npm install && npm test` 통과 (모든 테스트 green)

## 영향 범위

- 이 phase는 **신규 파일만 추가**, 기존 코드 변경 0. 회귀 위험 없음.
- Phase 4의 안전망 — 여기서 잠근 동작이 Phase 4 후에도 동일해야 함 (의미 보존).
- vitest 설치로 `package.json`/`package-lock.json` 변경 → 커밋 시 함께.

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
npm install 2>&1 | tail -5
npm test 2>&1 | tail -20
# 모든 테스트 PASS, exit 0
```

## 실행 결과

### 1회차 (2026-05-12 23:52 KST) — 완료
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
vitest 2.1.9를 devDependency로 추가하고 `vitest.config.ts`를 생성했다. 3개 테스트 파일(prompts/claude/store)에 총 29개 케이스를 작성했다. pnpm 환경에서 PATH 문제로 `vitest run` → `./node_modules/.bin/vitest run`으로 스크립트를 수정했고, 전 케이스 green 통과.

#### 변경 파일
- `ngd-studio/package.json` (수정, +3/-1줄): vitest devDependency + test 스크립트
- `ngd-studio/vitest.config.ts` (신규, +12줄): Node 환경, @/* alias 설정
- `ngd-studio/lib/__tests__/prompts.test.ts` (신규, +60줄): 5 함수 × 10케이스
- `ngd-studio/lib/__tests__/claude.test.ts` (신규, +43줄): detectStageFromTool 9케이스
- `ngd-studio/lib/__tests__/store.test.ts` (신규, +85줄): 5 mode × stages 잠금

#### 검증 결과
- [x] vitest 설치: `pnpm install` → pass
- [x] 전체 테스트: `pnpm test` → 3 test files, 29 tests, all passed, exit 0

#### 추가 발견사항
- pnpm이 `node_modules/.bin`을 PATH에 넣지 않는 WSL 환경 이슈 → test 스크립트를 `./node_modules/.bin/vitest run`으로 명시 처리

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 5 in-scope files edited + `ngd-studio/pnpm-lock.yaml` (package.json 변경 자연 부산물, exempt). hook edits.log가 필드 미기록 상태라 git status 폴백으로 검사.

#### Verification Re-run (orchestrator)
exit 0 — `npm test` (vitest run): 3 files, 29 tests passed.

#### Simplify (orchestrator)
0 files, 0 edits — package.json/vitest.config.ts 이미 최소. 테스트 파일은 의도적 추가물이라 simplify 대상 외.

#### Review (orchestrator)
VERDICT: pass — 스펙 설계와 실제 diff 완전 부합, 29개 케이스가 스펙 심볼·값 잠금.

#### Commit
95c8b53 — `test(ngd-studio): Phase 1 — vitest 회귀 테스트 인프라 + prompts/claude/store 테스트 추가`
