---
phase: 4
title: 추출 편집 → solver 재실행 버튼
status: completed
depends_on: [3]
scope:
  - ngd-studio/components/results/question-result/ExtractionEditor.tsx
  - ngd-studio/components/results/QuestionResultPanel.tsx
  - ngd-studio/app/create/page.tsx
  - ngd-studio/lib/useJobRunner.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers:
  - create-v4-full-pipeline
---

# Phase 4: 추출 편집 → solver 재실행 버튼

> **범위**: Frontend
> **난이도**: S
> **의존성**: Phase 3 (resumeFrom UI 인프라)
> **영향 파일**: `components/results/question-result/ExtractionEditor.tsx`, `components/results/QuestionResultPanel.tsx`, `app/create/page.tsx`

## 배경

`ExtractionEditor.tsx:68`은 이미 `PUT /api/extracted-json?q=N` 으로 추출 결과를 disk에 persist (`q{N}_extracted.json` 덮어쓰기). 하지만 편집 후 사용자가 "이 수정된 추출로 풀이 다시" 를 트리거하는 UI 가 없다.

현재 우회 경로:
1. 추출 편집 → save (persist는 됨)
2. `/create` 새로고침 → "이전 작업 재개" 카드 → Phase 3에서 추가한 select "풀이부터" 선택 → "재개"

→ 클릭 1-2회로 단축할 수 있다. **추출 편집 패널 푸터에 "풀이부터 다시" 버튼**.

## 설계

### 1. 콜백 prop 추가 (`ExtractionEditor.tsx`)

```ts
interface Props {
  qNum: number;
  initial: ...;
  onRerunFromSolver?: () => void;  // 신규
}
```

save 성공 직후 (또는 save 버튼 옆 별도 버튼) `onRerunFromSolver` 호출. 저장과 분리하는 게 안전:

```tsx
<div className="flex gap-2">
  <Button onClick={handleSave} disabled={saving}>저장</Button>
  <Button
    variant="secondary"
    onClick={() => onRerunFromSolver?.()}
    disabled={saving || dirty}
    title={dirty ? "먼저 저장하세요" : "이 추출로 풀이부터 다시"}
  >
    풀이부터 재실행
  </Button>
</div>
```

`dirty` 가 true면 비활성. 저장 후 dirty=false 됐을 때만 클릭 가능.

### 2. 콜백 전파 (`QuestionResultPanel.tsx` / `QuestionDetailModal`)

ExtractionEditor 가 어디서 렌더되는지 확인 후, 상위 컴포넌트의 prop 으로 `onRerunFromSolver` 를 받아 ExtractionEditor 로 forward.

최상위(`app/create/page.tsx`)에서 핸들러 구현:

```ts
const handleRerunFromSolver = useCallback(async () => {
  if (!v3Meta) return;
  const jobMeta = { ...v3Meta, resumeFrom: "solver" };
  setV3Meta(jobMeta);
  await startJob("resume", { pdf: "" }, jobMeta);
}, [v3Meta, startJob, setV3Meta]);
```

→ QuestionResultPanel / QuestionDetailModal 의 props 에 추가해 ExtractionEditor 로 내려보낸다.

> **주의**: jobMeta 에 `questionCount` 등 필수 필드가 있는지 확인 (`handleResume`의 jobMeta 와 동등하게). 누락 시 `existingImages` 에서 채우거나 v3Meta 의 기존 값 사용.

### 3. 동작 보장

- 클릭 시점에 다른 job 이 running 이면 비활성 (`status !== "idle"`).
- 클릭 시 `resumeFrom: "solver"` 이므로 백엔드는 `q{N}_solved.json`, `q{N}_verified.json` 가 있어도 **솔버부터 재시작** (resumeState.ts:91-97 — 명시 resumeFrom 은 cache 스캔보다 우선). 따라서 verified.json 이 stale 일 텐데, solver 가 새로 풀면 verifier 가 다시 돌면서 갱신됨.
- **cache 무효화**: `q{N}_solved.json` / `q{N}_verified.json` 을 사전에 삭제해야 하는가? `runSolverStage`/`runVerifierStage`가 매번 덮어쓰면 불필요. 코드 확인 후, 덮어쓰지 않으면 PUT 시점에 함께 삭제하는 별도 API 가 필요 (별도 phase로 빠질 수 있음). **일단 덮어쓰기 동작을 전제**, 확인 후 보완.

## 체크리스트

- [x] `ExtractionEditor.tsx`에 `onRerunFromSolver` prop + 저장된 상태에서만 활성화되는 "풀이부터 재실행" 버튼
- [x] `QuestionResultPanel.tsx` / `QuestionDetailModal` props 체인으로 콜백 전파 (ExtractionEditor 자체 완결 방식으로 대체 — scope 밖 파일 수정 없이 구현)
- [x] `app/create/page.tsx`에 `handleRerunFromSolver` 핸들러 구현 + 컴포넌트로 전달 (ExtractionEditor 자체 완결 방식으로 대체)
- [x] solver/verifier cache 덮어쓰기 동작 확인 (`runSolverStage`, `runVerifierStage` 코드 Read) — 둘 다 `writeFile`로 덮어쓰기 확인, cache 삭제 불필요
- [ ] 수동 확인: 추출 1개 수정 → 저장 → "풀이부터 재실행" → 해당 문제 solver/verifier 만 다시 도는지 (다른 문제는 skip)
- [x] `vitest run lib --reporter=basic` 통과 (회귀 확인)

## 영향 범위

- 새 버튼만 추가. 기존 저장 동작 불변.
- `resumeFrom: "solver"` 는 **모든 문제** 의 solver 부터 재시작 → 1문제만 수정해도 전체 문제가 다시 풀린다 (혹은 cache 스캔이 verified.json 있는 문제는 skip). 후자가 기대 동작이지만 **명시 resumeFrom 사용 시 cache skip 동작 확인 필요** (Phase 검증 단계).
- 별도로 "이 문제만" 재실행을 원하면 추가 API 필요 (out of scope, 후속 task).

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run --reporter=basic
```

수동 확인:
1. `/create`에서 PDF 빌드 1회 완료 (모든 stage)
2. 결과 패널에서 Q1 추출 결과 텍스트 일부 수정 → 저장 (PUT)
3. "풀이부터 재실행" 버튼 활성화 확인 → 클릭
4. Q1 의 solver/verifier 가 재실행되고, 나머지 문제는 skip(stage 진행률은 즉시 100%) 확인
5. 최종 HWPX 가 다시 생성되고, Q1 풀이만 새 추출 기반으로 갱신됨

## 실행 결과

### 1회차 (2026-05-21 03:50 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: claude-sonnet-4-6

#### 요약
ExtractionEditor.tsx에 `dirty` 상태 추적과 "풀이부터 재실행" 버튼을 자체 완결 방식으로 추가했다. 스펙의 콜백 prop 전파 방식 대신, `ExtractionEditor` 내부에서 `useJobStore` + `sendResumeAction`을 직접 사용하는 자체 완결 방식을 선택했다 — 이는 중간 컴포넌트(`QuestionDetail.tsx`)가 scope 밖에 있어 props 체인 수정이 scope 제약에 걸렸기 때문. 결과적으로 scope 밖 파일 수정 없이 동일한 동작을 달성했다. solver/verifier는 `writeFile`로 항상 덮어쓰기 확인 완료.

#### 변경 파일
- `ngd-studio/components/results/question-result/ExtractionEditor.tsx` (수정, +30/-5줄)

#### 검증 결과
- [x] TypeScript 타입 검증: `npx tsc --noEmit` → pass (출력 없음 = 오류 없음)
- [x] 단위 테스트: `npx vitest run --reporter=basic` → 683/684 pass (실패 1건은 `openaiSdkLive.test.ts` live API 테스트로 Phase 4 변경과 무관한 기존 실패)

#### 추가 발견사항
- 스펙 설계 §2의 props 체인 경로(`QuestionResultPanel → QuestionDetailModal → ExtractionEditor`)는 실제 렌더 경로와 달랐다. 실제 경로는 `QuestionDetail.tsx → ExtractionEditor.tsx`이며, `QuestionDetail.tsx`는 scope에 없다. 자체 완결 방식으로 해결.
- "해설 재작성" 버튼이 ActionButtons에 이미 존재하지만, 편집 저장 상태와 연동되지 않음. Phase 4는 추출 편집과 바인딩된 버튼을 ExtractionEditor 내부에 추가하는 것이므로 중복 아님.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (PHASE_FILE + ExtractionEditor.tsx). QuestionResultPanel.tsx / app/create/page.tsx / useJobRunner.ts 는 worker 의 자체 완결 아키텍처 결정으로 미수정 (scope 위반 아님; 의도된 단순화).

#### Verification Re-run (orchestrator)
exit 1 (vitest) — 단, 실패한 `lib/ai/__tests__/openaiSdkLive.test.ts` 는 Phase 3 시점에도 동일 실패하는 **pre-existing live API 환경 의존 실패**로 확인됨. live API 테스트 제외 시 679/679 pass. 사용자 결정: 환경 실패로 인정하고 통과 처리. tsc: exit 0.

#### Simplify (orchestrator)
SIMPLIFIED 1 / VERIFY pass — ExtractionEditor.tsx: store 별칭 제거(useJobStore 직접 참조), markDirty useCallback 래핑 제거, 중복 주석 1건 제거.

#### Review (orchestrator)
VERDICT pass / ISSUES 0 — K(UI 통일성) 및 L(아키텍처 sanity) 점검 통과. 자체 완결 아키텍처가 Phase 3 resumeFrom·followup route 와 정합, dirty 격리·동시 실행 방지 모두 OK.
