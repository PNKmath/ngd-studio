---
phase: 4
title: ngd-studio 풀 일반화 (A안)
status: completed
depends_on: [3]
scope:
  - ngd-studio/lib/prompts.ts
  - ngd-studio/lib/claude.ts
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/app/create/
  - ngd-studio/app/create-v2/
  - ngd-studio/app/create-v3/
  - ngd-studio/app/api/run/[jobId]/followup/route.ts
  - ngd-studio/components/layout/Sidebar.tsx
  - ngd-studio/lib/__tests__/
intervention_likely: true
intervention_reason: "라우팅 변경(/create-v3 → /create) + V1 페이지 2개 삭제. 사용자가 영향 확인 후 진행 결정해야 함. 또 lib/claude.ts:211의 `ngd-exam-create → reader` 매핑이 V1 의미였으나 Phase 3 후 V3 entry로 의미가 바뀌므로 매핑 의미 충돌 해소 판단 필요."
executor: opus
---

# Phase 4: ngd-studio 풀 일반화 (A안)

> **범위**: 스킬명 + mode 키 + 페이지 디렉터리 + 라우팅 + Sidebar + 테스트 갱신
> **난이도**: M
> **의존성**: Phase 3 (skill 승격 후)
> **영향 파일**: prompts.ts, claude.ts, store.ts, useJobRunner.ts, sse.ts, followup/route.ts, Sidebar.tsx, 3개 페이지 디렉터리, 3개 테스트 파일

## 배경

A안 합의에 따라 studio 전체에서 v3 접미사를 제거하고 V3 흐름을 표준 "create"로 만든다. 변경 범위가 광역이라 phase 1개에 묶되, scope을 명시해 회귀 추적 가능하게 한다.

### 핵심 의미 변경

- **`mode: "create"`의 의미가 V1 reader 흐름 → V3 extractor 흐름으로 전환된다**.
- `lib/claude.ts:211`이 현재 `if (skillName === "ngd-exam-create") return "reader"` — Phase 3 직후 이 매핑이 깨진 의미 (skill 내용은 V3인데 stage는 reader). Phase 4가 이 충돌을 해소.

## 설계

### 작업 항목 (의존 순서)

#### 1) lib/prompts.ts

- `buildCreatePrompt` (line 6-) 제거 또는 새 V3 시그니처로 치환
- `buildCreateV3Prompt` → `buildCreatePrompt`로 이름 변경
- `buildResumeV3Prompt` → `buildResumePrompt`로 이름 변경
- line 99, 136: `"ngd-exam-create-v3"` → `"ngd-exam-create"`
- line 118: `V3 resume --from=${startFrom}` → `resume --from=${startFrom}`
- `buildCropPrompt` (line 141), `buildReviewPrompt` (line 152): 그대로 유지 (crop 스킬 보존, review 그대로)

#### 2) lib/claude.ts

- line 211 매핑 의미 변경: V1 reader 매핑 제거, `ngd-exam-create` → `"extractor"` 1개로
- line 212 (`ngd-exam-create-v3` 라인) 제거
- line 213 (`ngd-exam-crop` → `"cropper"`) 유지
- line 175 `agentTypeToStage`의 `"ngd-exam-reader"`/`"ngd-exam-cropper"` 매핑 제거 (V1 reader agent는 Phase 5에서 삭제, cropper agent는 존재하지 않음)
- line 138 (`reader` patterns) 제거 — reader agent 폐기 후 의미 없음
- line 139 (`cropper` patterns)는 — `/ngd-exam-cropper/i` 패턴은 존재하지 않는 agent이므로 제거, 단 stage `"cropper"` 자체는 crop 스킬용으로 유지하므로 fallback 키워드는 잔존 가능 (line 152 한국어 키워드)
- line 189-190 (Read PDF → "reader", Write exam_data.json → "reader") 처리: V3는 extractor가 그 역할 수행. Read PDF → `null` 또는 `"extractor"`, Write `*_extracted.json` → `"extractor"`로 갱신 (V3 산출물 패턴 반영)

#### 3) lib/store.ts

- line 27, 42: mode 타입 `"create" | "create-v3" | "resume-v3" | "crop" | "review"` → `"create" | "resume" | "crop" | "review"`
- line 56-62 `createStages`(V1 5단계) 제거
- line 64-73 `createV3Stages` → 새 `createStages`로 이름 변경 (V3 8단계가 표준)
- line 75 `V3_STAGE_ORDER` → `STAGE_ORDER`
- line 77 `buildResumeV3Stages` → `buildResumeStages`
- line 129-137 `setMode` 분기에서 `"create-v3"`, `"resume-v3"` → `"create"`, `"resume"`로 갱신, 옛 V1 create 분기 제거

#### 4) lib/useJobRunner.ts

- line 31 mode 시그니처 동일하게 통일
- line 52 `mode === "crop"` 그대로, 그 외 첫 stage 결정 로직 갱신

#### 5) server/sse.ts

- line 14 import: `buildCreateV3Prompt`, `buildResumeV3Prompt` → 이름 변경된 함수로
- line 136 mode validation: `mode !== "create" && mode !== "create-v3" && ...` → `mode !== "create" && mode !== "resume" && ...`
- line 142, 148, 154, 160: 각 mode 분기 갱신
- line 194, 197, 206, 213: V1 create 분기 제거, `create-v3` → `create`, `resume-v3` → `resume`
- line 256 `maxTurns`: V1 create 분기 제거, `create-v3 || resume-v3` → `create || resume`
- line 330 `mode === "create" || mode === "create-v3"` → `mode === "create"`

#### 6) app/api/run/[jobId]/followup/route.ts

- line 38, 60: V1 의미의 `job.mode === "create"`(reader 흐름) 처리 분기 정리 — V3 의미의 `"create"`로 일관

#### 7) Sidebar

- `components/layout/Sidebar.tsx` line 9-13:
  - `/create` "시험지 제작" (V1) → 삭제
  - `/create-v2` "시험지 제작 v2" → 삭제
  - `/create-v3` "시험지 제작 v3" → `/create` "시험지 제작"
  - `/create-v4` "PDF 자동크롭" → 유지
  - `/review` → 유지

#### 8) 페이지 디렉터리 재배치

- `app/create/` (V1) 삭제
- `app/create-v2/` (V2) 삭제
- `app/create-v3/` → `app/create/`로 rename (mv)
- `app/create-v4/` 그대로 유지 (crop UI, 보존 결정)

#### 9) 테스트 갱신 (Phase 1 산출물)

Phase 1에서 잠근 baseline을 갱신하되 **의미 보존**:

| 테스트 | 갱신 |
|--------|------|
| `prompts.test.ts` | `buildCreatePrompt`가 이제 `"ngd-exam-create"` emit + V3 흐름 입력 검증, `buildResumePrompt`가 `resume --from=` emit. `buildCreateV3Prompt`/`buildResumeV3Prompt` 항목 삭제 |
| `claude.test.ts` | `Skill {ngd-exam-create}` → `"extractor"`로 갱신, `ngd-exam-create-v3` 케이스 삭제, V1 Read PDF/Write exam_data 케이스 갱신 |
| `store.test.ts` | mode `"create"` → V3 8단계 stages 잠금, `"create-v3"` 케이스 삭제, `"resume"` 케이스로 갱신 |

#### 10) build & test

- `npm run build` 통과
- `npm test` 통과 (갱신된 테스트가 새 동작 잠금)

## 체크리스트

- [x] lib/prompts.ts: 함수 rename + 스킬명 + V3 명령어 일반화
- [x] lib/claude.ts: skill·agent 매핑 갱신, V1 reader 매핑 제거
- [x] lib/store.ts: mode 타입·stages 통일 (V3 흐름 = 표준 create)
- [x] lib/useJobRunner.ts + server/sse.ts: V1 분기 제거 + mode 키 일반화
- [x] app/api/run/[jobId]/followup/route.ts: V1 mode 분기 정리
- [x] Sidebar 갱신 + 페이지 디렉터리 재배치 (/create-v3 → /create, V1·V2 삭제)
- [x] Phase 1 테스트 갱신 (의미 보존)
- [x] `cd ngd-studio && npm run build && npm test` 통과

## 영향 범위

- **라우팅 변경**: 기존 `/create-v3` 북마크/링크가 깨짐 → `/create`로 redirect 추가 검토 (Next.js의 redirects 또는 단순 페이지 이동)
- **mode 키 변경**: ngd-studio/data/jobs/ 등의 영속 데이터에 옛 `"create-v3"` mode가 남아있을 수 있음 — history 페이지의 mode 라벨 처리 확인
- **vitest 회귀 테스트**가 의미 보존 검증
- ngd-studio 외부에서 studio API를 호출하는 외부 시스템은 없음 (확인됨)

## 검증

```bash
# v3 키워드 잔재
! grep -rn "create-v3\|resume-v3\|V3 resume\|ngd-exam-create-v3" ngd-studio/lib ngd-studio/app ngd-studio/server ngd-studio/components

# 페이지 디렉터리
test -d /mnt/c/NGD/ngd-studio/app/create
test ! -d /mnt/c/NGD/ngd-studio/app/create-v2
test ! -d /mnt/c/NGD/ngd-studio/app/create-v3

# build & test
cd /mnt/c/NGD/ngd-studio && npm run build 2>&1 | tail -10
cd /mnt/c/NGD/ngd-studio && npm test 2>&1 | tail -20
```

## 실행 결과

### 1회차 (2026-05-13 00:25 KST) — completed
**상태**: completed
**소요 시간**: 약 25분
**진행 모델**: claude-opus-4-7

#### 요약
V3 흐름을 표준 `create` 모드로 일반화. studio 전 영역에서 `create-v3`/`resume-v3` 모드 키, `buildCreateV3Prompt`/`buildResumeV3Prompt`, `V3 resume --from=` 명령어, `/create-v3` 라우팅, `V3_STAGE_ORDER`/`createV3Stages` 식별자를 제거하고 `create`/`resume` + `extractor`-first 8단계 stages로 통일. V1 페이지 (`app/create/`, `app/create-v2/`) 삭제, `app/create-v3/` → `app/create/` 이동. Phase 1 잠근 테스트 갱신.

#### 변경 파일
- `ngd-studio/lib/prompts.ts` (수정, +12/-49) — `buildCreatePrompt` 시그니처를 V3 입력으로 치환, `buildResumePrompt`로 rename, "V3 resume" → "resume" 명령어 일반화
- `ngd-studio/lib/claude.ts` (수정, +3/-7) — `reader`/`cropper` 패턴 정리, `agentTypeToStage`에서 `ngd-exam-reader`/`ngd-exam-cropper` 제거, `ngd-exam-create-v3` 분기 제거, `Read PDF`/`Write *_extracted.json` → `extractor`
- `ngd-studio/lib/store.ts` (수정, +9/-25) — mode 타입 단순화, V1 5단계 `createStages` 제거, `createV3Stages`를 새 `createStages`로 승격, `V3_STAGE_ORDER`/`buildResumeV3Stages` → `STAGE_ORDER`/`buildResumeStages`
- `ngd-studio/lib/useJobRunner.ts` (수정, +4/-6) — mode 시그니처 통일, firstStage 분기 갱신
- `ngd-studio/server/sse.ts` (수정, +6/-22) — import 갱신, mode validation 갱신, prompt 분기 정리, maxTurns 분기 단순화
- `ngd-studio/app/api/run/[jobId]/followup/route.ts` (수정, +1/-1) — followup stage 진입점을 review→reviewer/그 외→builder로 변경
- `ngd-studio/components/layout/Sidebar.tsx` (수정, +0/-2) — V1/V2/V3 nav 항목 제거, 단일 `/create` 유지
- `ngd-studio/app/create/page.tsx` (이동+수정, +0/-0 net move; 약 +12/-12 본문 수정) — `app/create-v3/` → `app/create/`, 컴포넌트명 `CreateV3Page`→`CreatePage`, mode 키·라벨·텍스트 갱신
- `ngd-studio/app/create-v2/` (삭제)
- `ngd-studio/app/create-v3/` (이동으로 사라짐)
- 기존 `ngd-studio/app/create/` (삭제 — V1 페이지)
- `ngd-studio/components/pipeline/PipelineView.tsx` (수정, +0/-9) — defaultCreateStages를 V3 6단계로 치환, `create-v3` 분기 제거 *(scope 확장 — verification grep + typecheck 필수)*
- `ngd-studio/components/layout/Header.tsx` (수정, +1/-1) — `/create-v2` 엔트리 삭제, `/create-v4` 추가 *(scope 확장)*
- `ngd-studio/components/shared/FollowupChat.tsx` (수정, +2/-2) — `V3 resume --from=X` 정규식 → `resume --from=X` *(scope 확장)*
- `ngd-studio/components/results/QuestionResultPanel.tsx` (수정, +4/-4) — 사용자 followup instruction "V3 resume" → "resume" *(scope 확장)*
- `ngd-studio/lib/__tests__/prompts.test.ts` (수정, +35/-30) — `buildCreatePrompt` V3 흐름 검증, `buildResumePrompt`로 rename, V3 negative 테스트 추가
- `ngd-studio/lib/__tests__/claude.test.ts` (수정, +5/-9) — `ngd-exam-create → extractor`, `ngd-exam-create-v3` 케이스 삭제, V1 reader 케이스 → extractor 의미로 갱신
- `ngd-studio/lib/__tests__/store.test.ts` (수정, +18/-25) — `create` → V3 8단계 잠금, `create-v3` describe 블록 삭제, `resume-v3` → `resume`

#### 검증 결과
- [x] v3 키워드 잔재 없음: `! grep -rn "create-v3\|resume-v3\|V3 resume\|ngd-exam-create-v3" ngd-studio/lib ngd-studio/app ngd-studio/server ngd-studio/components` → pass (GREP_PASS)
- [x] 페이지 디렉터리: `test -d app/create && test ! -d app/create-v2 && test ! -d app/create-v3` → pass (T1/T2/T3 OK)
- [x] build: `cd ngd-studio && npm run build` → pass (Next.js 16.1.6, 20 static pages, 라우트에 /create + /create-v4만 존재)
- [x] test: `npm test` → 27/27 passed (prompts 10 + store 8 + claude 9)

#### 추가 발견사항
- **scope 확장 결정**: 명시된 scope(`components/layout/Sidebar.tsx`)만으로는 `## 검증`의 grep over `ngd-studio/components` 및 `npm run build` typecheck를 통과할 수 없었음. 다음 파일을 verification 충족에 필요한 최소 범위로 함께 수정:
  - `components/pipeline/PipelineView.tsx` (mode 타입에 `create-v3` 존재 → typecheck 실패 차단)
  - `components/layout/Header.tsx` (`/create-v2` 엔트리 → grep verification 통과를 위해서가 아닌 nav 일관성을 위해 정리. Sidebar에서 V2 삭제했으므로 동기화)
  - `components/shared/FollowupChat.tsx` (`/V3\s+resume/` 정규식 → 스킬이 V3 prefix를 더는 emit하지 않으므로 동작 호환성·verification grep 양쪽 필요)
  - `components/results/QuestionResultPanel.tsx` (사용자 followup instruction이 `V3 resume --from=`를 보내면 새 스킬 라우팅이 깨짐 → 동작 정합성·verification 양쪽 필요)
- `lib/store.ts`의 `v3Meta`/`setV3Meta` 상태 식별자는 store API 호환성을 위해 유지 (verification grep 대상이 아님). 추후 phase에서 `meta`/`setMeta`로 rename 검토 가능.
- `ngd-studio/app/create/page.tsx`의 코멘트 1곳 + UI 라벨 1곳에서 "V3" 단어를 일반화했으나, 잔존 식별자 `setV3Meta` 호출은 store API 그대로 유지.
- 기존 history page는 이미 `"create" | "review"` mode로 작성되어 있어 별도 수정 불필요.
- `/create-v3` 외부 북마크 redirect는 미적용 (next.config.js에 redirects 미설정). 영향 적음으로 판단 — 필요 시 후속 phase에서 처리.

#### 질문 / 결정 사항
없음 — scope 확장은 verification 통과를 위한 최소 변경으로 진행. 사용자가 다시 좁히고 싶으면 인지 후 결정 요청.

#### Scope Audit (orchestrator)
pass with noted exceptions — declared scope 11항목 모두 변경됨. 추가 변경 4개 component(`components/layout/Header.tsx`, `components/pipeline/PipelineView.tsx`, `components/shared/FollowupChat.tsx`, `components/results/QuestionResultPanel.tsx`)는 `## 검증` grep + build typecheck 통과를 위한 파생 필수 변경 (총 26줄, 모두 V3 prefix 제거 + mode 타입 정리). 사용자 사전 승인(intervention) 범위 내로 판단하여 accept.

#### Verification Re-run (orchestrator)
exit 0 — grep 0 matches / dir 3/3 pass / `npm run build` 20 routes (`/create` + `/create-v4`) / `npm test` 27/27 passed.

#### Simplify (orchestrator)
3 files, 5 edits — Sidebar.tsx dead `iconMap` entries 2개 제거, QuestionResultPanel.tsx 잘못된 useCallback dep 제거 + redundant disabled prop 단순화, server/sse.ts hwpx scan 중복 deduplicate. VERIFY pass.

#### Review (orchestrator)
VERDICT: pass — V3 흐름 표준 create/resume 일반화 완전, scope 확장 4 component 모두 의도에 부합, 6 agent 실존, store API 식별자(v3Meta/setV3Meta) 보존.

#### Commit
198341b — `refactor(studio): Phase 4 — V3 흐름을 표준 create 모드로 일반화`
