---
phase: 2
title: resume parsing / cleanup / cache state — orchestration foundation
status: pending
depends_on: [1]
scope:
  - ngd-studio/server/stages/resumeCommand.ts
  - ngd-studio/server/stages/cleanup.ts
  - ngd-studio/server/stages/resumeState.ts
  - ngd-studio/server/stages/__tests__/resumeCommand.test.ts
  - ngd-studio/server/stages/__tests__/cleanup.test.ts
  - ngd-studio/server/stages/__tests__/fixtures/resume-commands.json
  - .claude/skills/ngd-exam-create/SKILL.md
intervention_likely: true
intervention_reason: "ngd-exam-create skill 텍스트의 13개 resume 명령 표를 제거하고 코드 경로 인용으로 대체. legacy Claude CLI 사용자 워크플로우 호환성 확인 필요."
---

# Phase 2: resume parsing / cleanup / cache state — orchestration foundation

> **범위**: Backend (TS) + skill 문서
> **난이도**: L
> **의존성**: Phase 1 (coverage-matrix 참조)
> **영향 파일**: `resumeCommand.ts` (신규), `cleanup.ts` (신규), `SKILL.md` 일부

## 배경

audit doc Group A1, A2 + Group B1, B2, B3.

`.claude/skills/ngd-exam-create/SKILL.md:43-63`에 13개의 resume 명령(`resume --q=3,7 --from=solver` 등)이 자연어 표로만 존재. skill을 따르는 legacy Claude CLI 경로는 이 표를 읽고 inline Python으로 cleanup을 수행하는데, 두 가지 문제:
1. 자연어 → Python 변환을 agent가 매번 수행 → 비결정적
2. `detectQuestionStates`가 orchestrator(`server/stages/resumeState.ts`)와 skill에 중복

본 phase는:
- 13개 명령을 단일 `parseResumeCommand` TS 함수로 codify
- `cleanupFromStage` TS 함수로 파일 삭제 deterministic하게
- 기존 `resumeState.ts`의 cache scan 로직을 `detectQuestionStates`로 명시적 export하고 skill에서 중복 제거

## 설계

### 1. `ngd-studio/server/stages/resumeCommand.ts` (신규)

```typescript
export type ResumeStage =
  | "extractor" | "review_extract" | "solver" | "verifier"
  | "figure" | "confirm" | "builder" | "cleaned" | "image_replace";

export interface ResumeCommand {
  type: "create" | "resume";
  /** undefined = 전체, [N,...] = 지정 문제 번호 */
  questions?: number[];
  /** undefined = 자동 detect, 명시되면 해당 stage부터 */
  fromStage?: ResumeStage;
}

/**
 * SKILL.md:43-63 의 13개 resume 명령 + 신규 케이스를 파싱.
 * 입력은 사용자 프롬프트 (자연어) 또는 구조화 메타.
 * @throws `ResumeCommandParseError` 모호한 경우.
 */
export function parseResumeCommand(input: string | object): ResumeCommand;
```

스킬 표의 13개 row를 그대로 fixture로 만들어 unit test에서 round-trip 검증.

### 2. `ngd-studio/server/stages/cleanup.ts` (신규)

```typescript
import type { ResumeStage } from "./resumeCommand";
import type { StageCache } from "./cache";

export interface CleanupResult {
  deleted: string[];       // 실제 삭제된 파일 경로
  skipped: string[];       // 이미 없어서 skip
}

/**
 * 지정 stage 이후의 cache 파일을 삭제.
 * 예: fromStage=solver → 각 질문의 _solved, _verified, figure outputs 등 삭제. _extracted는 유지.
 * Idempotent.
 */
export async function cleanupFromStage(
  cache: StageCache,
  questionNums: number[],
  fromStage: ResumeStage,
): Promise<CleanupResult>;
```

각 stage별 "삭제 대상 카테고리"를 명시 표로 spec body에 박을 것:

| fromStage | 삭제 대상 |
|-----------|----------|
| `extractor` | `_extracted`, `_solved`, `_verified`, figure outputs, `figure_status.json`, exam_data.json |
| `solver` | `_solved`, `_verified`, figure outputs, `figure_status.json`, exam_data.json |
| `verifier` | `_verified`, exam_data.json |
| `figure` | figure outputs, `figure_status.json` |
| `confirm` | 없음 (단순 통과) |
| `builder` | hwpx outputs |
| `cleaned` | `_extracted`, downstream all (이미지 보존) |
| `image_replace` | 원본 이미지 + downstream all |

### 3. `ngd-studio/server/stages/resumeState.ts` 수정

기존 `detectFromCache(...)`를 `detectQuestionStates(...)`로 rename + export:

```typescript
export type QuestionState = "none" | "extracted" | "solved" | "verified";

export async function detectQuestionStates(
  cache: StageCache,
  questionNums: number[],
): Promise<Map<number, QuestionState>>;
```

`determineStartStage(...)`는 내부에서 `detectQuestionStates` 사용하도록 리팩터(동작 동일성 유지).

### 4. `.claude/skills/ngd-exam-create/SKILL.md` 수정

`## 작업 절차`의 resume 관련 절을 다음으로 대체:

```markdown
### Resume 명령 파싱

resume 입력 처리는 코드(`ngd-studio/server/stages/resumeCommand.ts`)가 담당한다.
지원 명령은 코드의 unit test fixture (`__tests__/fixtures/resume-commands.json`)에 정의되어 있다.
agent는 prompt를 그대로 코드로 전달하면 된다.
```

기존 자연어 표(13행)는 fixture JSON으로 이동 → 단일 source of truth.

## 영향 범위

- 기존 `determineStartStage` 호출부(orchestrator.ts)는 시그니처 동일하므로 변경 없음
- 신규 함수는 orchestrator에서 직접 사용되지는 않음 (Phase 3에서 통합)
- legacy Claude CLI 경로가 SKILL.md 자연어를 따르던 사용자는 코드 경로로 자동 이전됨
- 신규 fixture가 향후 명령 추가의 single source

## 체크리스트

- [ ] coverage-matrix.md의 A1, A2, B1, B2, B3 행에서 본 phase 인용 확인 (Phase 1 산출물 검증)
- [ ] `resumeCommand.ts` 신규 — `parseResumeCommand` + `ResumeCommand` + `ResumeStage` + `ResumeCommandParseError`
- [ ] `__tests__/fixtures/resume-commands.json` — SKILL.md:43-63 의 13개 명령 모두 fixture화
- [ ] `resumeCommand.test.ts` — fixture 전수 round-trip + 에러 케이스(모호 입력)
- [ ] `cleanup.ts` 신규 — `cleanupFromStage` + stage별 삭제 카테고리 표 spec과 일치하는 구현
- [ ] `cleanup.test.ts` — stage별 삭제 대상 검증 (mock cache 사용, .env.local 의존성 없음 — 선행 task 회귀 학습)
- [ ] `resumeState.ts` — `detectQuestionStates` export 추가 + 기존 호출부 회귀 없음
- [ ] `SKILL.md` — 자연어 13행 표 제거, 코드 경로 + fixture 인용으로 대체
- [ ] **agentic→code 동치성 검증**: skill 표 13개 명령을 `parseResumeCommand`로 돌린 결과가 fixture와 byte-level 일치 (test fail이 곧 회귀)

## 검증

```bash
# 1. 타입 + 단위 테스트
cd ngd-studio && pnpm tsc --noEmit
cd ngd-studio && pnpm test server/stages/__tests__/resumeCommand.test.ts server/stages/__tests__/cleanup.test.ts --reporter=basic

# 2. SKILL.md 자연어 잔존 0건
grep -nE "resume --q=|--from=" .claude/skills/ngd-exam-create/SKILL.md
# expected: 0 match in legacy resume table format; 코드 경로 인용 1줄만

# 3. fixture 13개 충족
test "$(jq 'length' ngd-studio/server/stages/__tests__/fixtures/resume-commands.json)" = "13"

# 4. 기존 회귀 — orchestrator.test.ts 영향 없음
cd ngd-studio && pnpm test server/stages/__tests__/orchestrator.test.ts --reporter=basic
# expected: 17/17 pass (선행 task `3efa2a0` 수정 유지)

# 5. agentic→code 동치성 — fixture round-trip
# resumeCommand.test.ts 안에서 fixture 13개에 대해 parseResumeCommand(cmd.input) → cmd.expected toEqual 검증.
```
