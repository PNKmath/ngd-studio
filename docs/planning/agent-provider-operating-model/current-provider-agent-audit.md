---
task: agent-provider-operating-model
phase: 1
title: Current Provider/Agent Audit
created: 2026-05-16
---

# 현행 Provider/Agent 감사

이 문서는 현재 NGD Studio가 AI provider를 어떻게 실행하고, 실제 시험지 제작/크롭/오검 workflow가 어디에 의존하는지 사실 기준으로 고정한다. 결론부터 말하면, 현재 provider adapter는 "전체 job prompt를 실행 가능한 CLI 또는 API에 전달하는 층"이고, 실제 stage orchestration은 아직 서버 코드가 아니라 prompt, `.claude/skills`, `.claude/agents`에 있다.

## `/api/run` 실행 경로

`ngd-studio/server/sse.ts`의 standalone SSE 서버가 `POST /api/run`을 받는다.

1. 요청 body에서 `mode`, `files`, `meta`, `jobId`, `provider`, `stageOverrides`를 읽는다.
2. `normalizeProviderId()`로 기본 provider를 정규화하고, `inferPrimaryStageKey()`가 판단한 primary stage가 있으면 `stageOverrides[primaryStageKey]`를 우선 적용한다.
3. `resolveProviderId()`로 `auto`를 실제 provider로 해석한다. 현재 `auto`는 `claude`로 해석된다.
4. mode에 따라 `buildCropPrompt`, `buildCreatePrompt`, `buildResumePrompt`, `buildReviewPrompt` 중 하나로 전체 job prompt를 만든다.
5. `runAIProvider(prompt, { provider: requestedProvider, cwd: BASE_DIR, maxTurns, mode, jobId, stageKey })`를 호출한다.
6. provider가 내보내는 Claude 형식 event를 `transformToSSE()`로 변환해 브라우저에 전달한다.
7. provider 실패 또는 non-zero exit이면 최대 `MAX_PROVIDER_ATTEMPTS` 3회까지 같은 provider로 재시도하고, attempt별 telemetry를 job JSON에 저장한다.

현재 `/api/run`은 stage runner가 아니다. 서버가 stage input/output schema를 직접 검증하거나 stage별 파일을 생성하지 않고, provider에게 큰 prompt를 맡긴다.

## Prompt Builder가 만드는 skill 호출

`ngd-studio/lib/prompts.ts`는 네 개의 prompt builder를 제공한다.

| 함수 | mode | 핵심 입력 | 호출 지시 |
|---|---|---|---|
| `buildCreatePrompt` | `create` | 양식 HWPX, 문제별 이미지 경로, 시험 메타 | `Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.` |
| `buildResumePrompt` | `resume` | 양식 HWPX, `resumeFrom`, 문제 수, 시험 메타 | `resume --from=<stage>` 형식과 함께 `ngd-exam-create` 호출 지시 |
| `buildCropPrompt` | `crop` | PDF 경로, 크롭 이미지 출력 디렉터리 | `Skill 도구로 "ngd-exam-crop" 스킬을 호출해서 진행해.` |
| `buildReviewPrompt` | `review` | 원본 PDF, 작업 HWPX | `Skill 도구로 "ngd-exam-review" 스킬을 호출해서 진행해.` |

즉 앱이 전달하는 prompt는 stage contract가 아니라 자연어 실행 지시다. Claude CLI와 Codex CLI는 이 지시를 읽고 로컬 tool/skill/agent workflow를 수행할 수 있지만, API-only provider는 같은 의미로 실행할 수 없다.

## Provider Adapter 능력 차이

| provider | 구현 파일 | 실행 방식 | 파일/tool 실행 | `.claude/skills` / `.claude/agents` 실행 | 현재 stage 제한 |
|---|---|---|---|---|---|
| `claude` | `ngd-studio/lib/ai/providers/claudeCli.ts` | `runClaude()`로 Claude CLI 실행 | 가능. `--dangerously-skip-permissions`와 stream JSON event를 사용 | 가능. 기존 prompt가 기대하는 기본 실행자 | mode별 `maxTurns`만 다르고 stage schema 제한 없음 |
| `codex` | `ngd-studio/lib/ai/providers/codexCli.ts` | `codex exec --json --cd <cwd> --sandbox danger-full-access --ask-for-approval never` 실행 | 가능 | 가능하도록 preamble에서 기존 `.claude/skills`와 `.claude/agents` 재사용을 지시 | Claude event로 변환하는 호환층이 있으며 stage schema 제한 없음 |
| `deepseek-v4` | `ngd-studio/lib/ai/providers/deepseekV4.ts` | DeepSeek chat completions API 호출 | 불가. virtual process와 text response만 있음 | 불가 | `create.extractor`, `create.solver`, `create.verifier`, `review.reviewer`만 허용 |

`ngd-studio/lib/ai/types.ts`의 `AIStageKey`도 현재 `create.extractor`, `create.solver`, `create.verifier`, `review.reviewer` 네 개뿐이다. `cropper`, `figure`, `builder`, `checker`는 AI settings stage override 모델에 아직 포함되어 있지 않다.

## Provider 선택, retry, telemetry

`ngd-studio/lib/ai/registry.ts`는 `claude`, `codex`, `deepseek-v4` adapter를 등록한다. `auto`는 `resolveProviderId()`에서 `claude`로 고정된다.

`ngd-studio/lib/ai/settings.ts`는 기본 provider로 `auto`, `claude`, `codex`만 선택 가능하게 하고, stage override에서는 `deepseek-v4`도 허용한다. 이 구조는 DeepSeek를 전체 job provider가 아니라 stage별 후보로 넣으려는 방향과 맞지만, 실제 `/api/run`은 아직 primary stage 하나만 추론해 전체 prompt에 적용한다.

`ngd-studio/lib/ai/retry.ts`의 retry 정책은 provider 실패, non-zero exit, spawn error에 대해 최대 3회 같은 provider를 재시도한다. 다른 provider로 fallback하지 않는다. `server/sse.ts`는 attempt 결과를 `providerTelemetry`로 job JSON에 저장한다.

## Skill / Agent 책임 분해

### `ngd-exam-create`

`.claude/skills/ngd-exam-create/SKILL.md`는 시험지 제작의 실제 orchestrator다. 서버가 하지 않는 일을 이 skill이 수행한다.

- 신규 실행과 resume 모드 판별
- cache cleanup과 resume 이후 파일 삭제
- extractor 전체 배치 실행
- 프론트엔드 추출 검토 지점 생성
- solver/verifier 병렬 실행 및 verifier feedback 반영
- figure, builder, checker 순차 실행
- 중간 산출물 경로와 `.v3cache` 파일 규약 관리

### Stage별 agent 책임

| stage | agent / skill | 주요 입력 | 주요 출력/부작용 | 성격 |
|---|---|---|---|---|
| `cropper` | `ngd-exam-crop` skill | PDF 경로, 출력 디렉터리 | `q01.png` 등 문제 이미지와 `crop_results.json` | Gemini Vision과 Python crop script 실행 |
| `create.extractor` | `ngd-exam-extractor` | 문제 이미지 1장, 단원/가이드라인 문서 | `qN_extracted.json` 형식의 구조화 문제 JSON | 이미지 이해 + HWP 수식 변환 |
| `create.solver` | `ngd-exam-solver` | 추출 JSON, 교과 컨텍스트 | `qN_solved.json` 또는 `exam_data.json` 해설 보강 | 수학 풀이 생성 |
| `create.verifier` | `ngd-exam-verifier` | 원본 이미지, extractor/solver JSON, 교과 컨텍스트 | pass/fail JSON과 solver feedback | 독립 검증 |
| `figure` | `ngd-exam-figure` | `exam_data.json`, 문제 이미지 또는 PDF crop source | `outputs/images/probN_final.png`, figure status | 이미지 crop, Gemini image generation, trim/watermark |
| `builder` | `ngd-exam-builder` | `exam_data.json`, HWPX template, builder scripts | 최종 HWPX, `build_status.json` | `build_hwpx.py`, namespace fix, validation, retry/fallback |
| `checker` | `ngd-exam-checker` | 생성 HWPX, 가이드라인/단원 문서 | 품질 검수 리포트, 필요 시 수정 지시 | HWPX XML rule check |
| `review.reviewer` | `ngd-exam-reviewer` / `ngd-exam-review` | 원본 PDF, 작업 HWPX, review checklist | HWPX 직접 수정, 편집오검 내역표 | ZIP-level 문자열 치환과 검수 리포트 |

현재 stage의 실제 파일 입출력 규약은 TypeScript 타입이 아니라 skill/agent 문서와 Python script에 분산되어 있다.

## DeepSeek가 기존 prompt workflow를 바로 대체할 수 없는 지점

DeepSeek V4 adapter는 API model provider다. 현재 구현상 다음을 할 수 없다.

- 로컬 파일을 직접 읽거나 쓸 수 없다.
- Bash, Read, Write, Edit, Agent, Skill 같은 tool 실행이 없다.
- `.claude/skills/ngd-exam-create/SKILL.md`의 orchestration 절차를 수행할 수 없다.
- `.claude/agents/*.md`를 subagent로 호출하거나 병렬 batch/retry loop를 돌릴 수 없다.
- HWPX ZIP/XML을 직접 수정하거나 `build_hwpx.py`, `fix_namespaces.py`, `validate.py`, `add_review_table.py`를 실행할 수 없다.
- SSE stage/file event를 생성하는 로컬 CLI event stream이 없다. 현재는 assistant text와 result event만 반환한다.

따라서 DeepSeek를 `create` 전체 job provider로 선택하면 기존 "skill 호출해서 시험지 제작" prompt의 의미가 깨진다. DeepSeek가 담당할 수 있는 영역은 서버가 stage input을 명확한 schema로 제공하고, 모델 출력도 schema로 검증할 수 있는 작은 model call이어야 한다. 예를 들면 extractor 초안, solver 초안, verifier 판정, review report draft 같은 영역이다.

## 다음 phase에 넘길 사실

- Stage override는 현재 전체 provider 선택 UI에 얹혀 있지만, 실제 서버 실행은 primary stage 하나를 추론해 전체 job prompt에 적용한다.
- `auto`는 provider recommendation이 아니라 `claude` alias다.
- deterministic orchestration, cache cleanup, retry, HWPX build/check/review table 삽입은 모델 provider가 아니라 서버 또는 script runner 책임으로 옮겨야 한다.
- DeepSeek V4는 repo edit agent가 아니다. schema-bound stage model call 후보로만 다뤄야 한다.
