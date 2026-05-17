# stage-runner-rewrite

NGD studio 시험지 제작 파이프라인을 **skill 기반** (Claude CLI가 `ngd-exam-create` Skill을 호출해 sub-agent들을 orchestrate)에서 **코드 기반** (TS orchestrator가 1-shot AI 호출 + Python subprocess로 stage들을 직접 실행)으로 마이그레이션.

## 왜 바꾸는가

기존 흐름의 문제:
- 단일 Claude CLI 세션이 모든 stage 관리 → 부분 실패가 전체 crash
- stage별 provider 라우팅 불가 (DeepSeek 등 활용 봉쇄)
- 병렬도 모델 행동에 의존, 결정론적 보장 불가
- followup이 빈 입력에 "사용자에게 묻기"로 분기하는 버그
- skill MD 파싱·Python 코드 블록 등 fragile한 의존

코드 기반의 이득:
- TS orchestrator가 결정론적 흐름 제어
- stage별 provider 자유 (Claude SDK/CLI, OpenAI SDK, Codex CLI, DeepSeek HTTP)
- `Promise.all`로 명시적 병렬
- 부분 실패 격리 (Q5 실패가 Q1-4·Q6-N에 영향 없음)
- API key only 사용자도 사용 가능 (CLI 미설치 환경)
- 구독자는 CLI 경로 선택해 토큰 추가 과금 없이 사용

## 신규 아키텍처

```
SSE 서버 (sse.ts)
  └─ mode=create/resume + create.* override 있음
       └─ runStageOrchestrator()  ← 신규
            ├─ Promise.all(qs.map(runExtractor))   // image + 1-shot
            ├─ buildExamDataJson()                 // 순수 TS
            ├─ Promise.all(qs.map(runSolver))      // 기존 runSolverStage
            ├─ verifier feedback loop (3회)        // 기존 runVerifierStage
            ├─ spawn(figure_processor.py)          // 기존 Python 그대로
            ├─ runBuilderStage()                   // 기존 deterministic
            └─ runCheckerStage()                   // 기존 deterministic

  └─ 그 외 (legacy auto provider)
       └─ runLegacyPromptJob()  ← 기존 그대로 유지 (호환)
```

## Provider 목록 (5종 + auto)

| ID | 인증 | 과금 | 비고 |
|---|---|---|---|
| `claude-sdk` | `ANTHROPIC_API_KEY` | 토큰 | 신규 (Anthropic SDK) |
| `claude-cli` | claude auth login (구독) 또는 키 | 구독 또는 토큰 | 기존, vision 가능 |
| `openai-sdk` | `OPENAI_API_KEY` | 토큰 | 신규 (OpenAI SDK), gpt-4o vision |
| `codex-cli` | codex auth (구독) 또는 키 | 구독 또는 토큰 | 기존, --image flag 부착 |
| `deepseek-v4` | `DEEPSEEK_API_KEY` | 토큰 | 기존, vision 미지원 |
| `auto` | 위 중 자동 | - | 기본=`claude-cli` (legacy 호환) |

Stage별 가용성:
- extractor: vision 필요 → claude-sdk, claude-cli, openai-sdk, codex-cli
- solver/verifier/reviewer: 텍스트만 필요 → 5개 전부

## 비범위

- `/create` 페이지 폐기 (별도 작업, create-v4-merge 후속)
- HWPX 포맷 변경, PipelineView stage 정의 변경
- DeepSeek-OCR 등 신규 provider 추가 (vision 출시 후 별도)
- 양식지 HWPX 변경

## 관련 자산

- 기존 코드: `ngd-studio/server/stages/{solver,verifier,builder,checker,cache,jobStore,events,model,modelHarness,types,telemetry}.ts`
- 기존 provider: `ngd-studio/lib/ai/providers/{claudeCli,codexCli,deepseekV4}.ts`
- Skill / agent: `.claude/skills/ngd-exam-create/SKILL.md`, `.claude/agents/ngd-exam-*.md`
- Python: `figure_processor.py`, `build_hwpx.py`
- 이관 출처: `docs/planning/create-v4-merge/phase-05-deepseek-stage-orchestration.md` (이 task로 흡수, obsolete 처리)

## 크로스 플랫폼 규칙 (CLAUDE.md 준수)

- Python 실행: `process.platform === "win32" ? "python" : "python3"`
- 경로: `path.join` / `path.resolve`, `"/"` 하드코딩 금지
- `child_process.spawn`: `shell: true` 회피, 인자 배열
- 임시 파일: `os.tmpdir()`
- Python 스크립트: pathlib, `encoding="utf-8"`
