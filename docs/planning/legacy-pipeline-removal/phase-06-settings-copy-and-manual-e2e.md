---
phase: 6
title: /settings UI 카피 미세 조정 + 수동 E2E 6 흐름 검증
status: blocked
depends_on: [5, 7]
scope:
  - ngd-studio/app/settings/page.tsx
intervention_likely: true
intervention_reason: "수동 E2E 검증 6 흐름 (create / create resume / create followup / review / review followup / crop). 사용자가 직접 실행."
executor: haiku
load_bearing: ""
e2e_refs: []
e2e_triggers: []
---

# Phase 6: /settings UI 카피 + 수동 E2E 검증

> **범위**: Frontend (UI copy) + 수동 검증
> **난이도**: S
> **의존성**: Phase 5 (dead code cleanup)
> **영향 파일**: `app/settings/page.tsx`

## 배경

본 task 의 코드 변경은 phase 05 에서 마무리. 본 phase 는:
1. `/settings` 페이지의 `auto` provider 옵션 카피를 legacy 분기 제거 후의 의미 ("기본 (Claude Code CLI) 로 자동 resolve") 에 맞게 미세 조정
2. 6 흐름의 수동 E2E 검증

## 설계

### 1. UI 카피 변경 (app/settings/page.tsx:39-50)

기존:

```ts
{
  id: "auto",
  label: "자동",
  detail: "현재는 Claude CLI로 실행하고, 이후 작업 특성 기반 추천으로 확장합니다.",
  resolved: "Claude CLI (기본)",
  // ...
}
```

변경 후 (예시):

```ts
{
  id: "auto",
  label: "기본 (Claude Code CLI)",
  detail: "Stage override 미지정 시 모든 stage 를 Claude Code CLI 로 실행합니다.",
  resolved: "Claude CLI",
  // ...
}
```

`id: "auto"` 자체는 변경하지 않음 (저장된 stageOverrides 값과 호환 유지).

### 2. 수동 E2E 검증

6 흐름 모두 정상 동작 확인:

1. **create 처음~끝**: 새 시험지 1 회분 (PDF + 양식지 + 문제 이미지) → 전체 파이프라인 → outputs/*.hwpx
2. **create resume**: `.v3cache` 보존 상태에서 `/create` 페이지 진입 → navigator action "재추출" / "해설 재작성" / "검증 재실행" / "이미지 재정리" / "이미지 교체" 5 종 각각 클릭 → 해당 stage 만 다시 돌고 SSE 이벤트 발생
3. **create followup (FollowupChat)**: create 완료 후 결과 페이지에서 자유 텍스트 입력 → orchestrator resume 경로로 진입 (자유 텍스트는 SSE log 로만 emit)
4. **review 처음~끝**: PDF + 작업 HWPX → reviewer agent → mutation → 수정된 HWPX + 리포트
5. **review followup (FollowupChat)**: review 완료 후 자유 텍스트 입력 → reviewer 가 `additionalInstruction` 받아 re-run → 수정 HWPX 갱신
6. **crop**: PDF 1개 → 문제 이미지 N개 생성 → inputs/시험지 제작/question_images/

각 흐름에서 확인할 것:
- SSE 이벤트가 `log` / `stage` / `question` / `result` 흐름으로 발생 (legacy 분기 시절과 동등)
- 최종 파일이 정상 경로에 생성/수정됨
- 에러 발생 시 `error` SSE 이벤트 + UI 상 명확한 표시

## 체크리스트

- [ ] `app/settings/page.tsx:39-50` 의 auto provider 옵션 label/detail 카피 미세 조정
- [ ] **수동**: create 처음~끝 1회 실행 → outputs/*.hwpx 생성 확인
- [ ] **수동**: create resume — navigator action 5종 각각 1회 실행 → 대응 stage SSE 이벤트 발생 + .v3cache 갱신 확인
- [ ] **수동**: create followup (FollowupChat) 자유 텍스트 1회 → orchestrator 진입 + SSE log emit
- [ ] **수동**: review 처음~끝 1회 실행 → 수정된 HWPX + 리포트 생성 확인
- [ ] **수동**: review followup (FollowupChat) 자유 텍스트 1회 → reviewer additionalInstruction 반영 확인
- [ ] **수동**: crop 1회 실행 → inputs/시험지 제작/question_images/ 에 N개 png 생성 확인
- [ ] `cd ngd-studio && npx tsc --noEmit` 통과

## 영향 범위

- **UI 카피**: 사용자에게 보이는 텍스트만 변경. provider id (`auto`) 는 그대로 유지하므로 저장된 stageOverrides 값 호환.
- **수동 검증**: 본 task 의 최종 게이트. legacy 분기 제거가 6 흐름 모두에서 회귀 없이 동작하는지 확인.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

수동 검증 체크리스트 (위 6 흐름) — 사용자가 직접 ngd-studio 실행 후 각 흐름을 한 번씩 돌려 확인.

## 실행 결과

### Run 1 (2026-05-22 14:47:37)

**코드 변경:**
- `app/settings/page.tsx:40-50` auto provider 옵션 UI 카피 업데이트 완료
  - label: "자동" → "기본 (Claude Code CLI)"
  - detail: legacy 분기 제거 후 의미 반영 ("Stage override 미지정 시 모든 stage를 Claude Code CLI로 실행합니다.")
  - resolved: "Claude CLI (기본)" → "Claude CLI" (간결화)
  - provider id `"auto"` 유지 — 기존 저장 값과 호환

**검증:**
- ✅ `npx tsc --noEmit` 통과 (컴파일 에러 없음)

**수동 E2E 검증:**
- [ ] **수동**: create 처음~끝 1회 실행 → outputs/*.hwpx 생성 확인
- [ ] **수동**: create resume — navigator action 5종 각각 1회 실행 → 대응 stage SSE 이벤트 발생 + .v3cache 갱신 확인
- [ ] **수동**: create followup (FollowupChat) 자유 텍스트 1회 → orchestrator 진입 + SSE log emit
- [ ] **수동**: review 처음~끝 1회 실행 → 수정된 HWPX + 리포트 생성 확인
- [ ] **수동**: review followup (FollowupChat) 자유 텍스트 1회 → reviewer additionalInstruction 반영 확인
- [ ] **수동**: crop 1회 실행 → inputs/시험지 제작/question_images/ 에 N개 png 생성 확인

### Run 2 (2026-05-22 — provider routing 회귀 발견으로 manual E2E 보류)

사용자가 manual E2E 시도 중 create 흐름에서 solver hang(9분) 증상 보고. 진단 결과 **회귀 확인**:
- 사용자가 default provider로 `codex-cli` 선택 + stageOverrides 비어있음
- `runStageOrchestrator` 호출 시 `defaultProvider` 옵션 미전달 → `getProviderForStage`의 hardcoded fallback `"auto"` 적용 → 모든 stage가 silently `claude-cli`로 fallback
- 결과: 사용자 의도(codex-cli, 빠른 응답) 무시되고 claude-cli 100~120초 실행 → 사용자 hang 인식

**회귀 원인**: Phase 4 sse.ts 통합 시 `body.provider`(=requestedProvider) → orchestrator default 라우팅 누락. legacy 경로(`runLegacyPromptJob`)에선 자동 적용되던 default provider가 orchestrator 경로에선 명시 전달 필요. job 4cbea6a1.json telemetry에서 모든 stage가 `claude-cli`로 기록된 것이 증거.

→ **Phase 7 (orchestrator defaultProvider routing 복구) 신규 추가**. 본 Phase 6의 manual E2E 6 흐름 검증은 Phase 7 commit 후 재시도.

본 phase의 settings UI 카피 변경은 회귀와 무관하므로 별도 chore commit으로 선반영. frontmatter status는 `blocked` + `depends_on: [5, 7]`로 갱신.
