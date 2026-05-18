---
phase: 5
title: 단위 테스트 갱신
status: completed
depends_on: [2, 4]
scope:
  - ngd-studio/lib/__tests__/stageFoundation.test.ts
  - ngd-studio/server/__tests__/sse.branch.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
  - ngd-studio/server/stages/__tests__/orchestrator.pipeline.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 5: 단위 테스트 갱신

> **범위**: Tests (TS)
> **난이도**: S
> **의존성**: Phase 2 (모듈 분리 — Python 빌드 결과 안정화 후), Phase 4 (sse/orchestrator 변경 — 테스트 기댓값 갱신 필요)
> **영향 파일**: `stageFoundation.test.ts`, `sse.branch.test.ts`, `orchestrator.*.test.ts`

## 배경

Phase 1, 4의 변경으로 다음 테스트가 stale:

1. **`stageFoundation.test.ts:265-274`** — `resolveBuilderScripts` 가 옛 `.claude/skills/.../scripts/...` 경로를 기대. Phase 1에서 `resources/hwpx_scripts/...`로 이동했으므로 갱신 필요.
2. **`stageFoundation.test.ts:236`** — `build_hwpx.py` 인자 처리 mock 검증. 경로만 갱신, 인자 시그니처는 동일.
3. **`sse.branch.test.ts`** — `shouldUseCodeOrchestrator` 분기 자체는 Phase 4에서 손대지 않지만, 신규 합성(skill 후 deterministic builder)에 대한 테스트가 필요한지 검토.
4. **`orchestrator.test.ts` 등** — `runLegacyBuilderFallback` 호출/결과를 검증하는 테스트가 있다면 제거 또는 "failed로 종료" 검증으로 변경.

## 설계

### `stageFoundation.test.ts:265-274` 갱신

기존:
```ts
expect(resolveBuilderScripts("/repo")).toEqual({
  buildHwpx: path.join("/repo", "build_hwpx.py"),
  fixNamespaces: path.join("/repo", ".claude", "skills", "ngd-exam-create", "scripts", "fix_namespaces.py"),
  validateHwpx: path.join("/repo", ".claude", "skills", "ngd-exam-create", "scripts", "validate.py"),
});
```

변경:
```ts
expect(resolveBuilderScripts("/repo")).toEqual({
  buildHwpx: path.join("/repo", "build_hwpx.py"),
  fixNamespaces: path.join("/repo", "resources", "hwpx_scripts", "fix_namespaces.py"),
  validateHwpx: path.join("/repo", "resources", "hwpx_scripts", "validate.py"),
});
```

### `orchestrator.test.ts` — runLegacyBuilderFallback 관련 테스트 제거/변경

`runLegacyBuilderFallback` 호출이나 outputs/ scan을 검증하는 케이스가 있다면:
- **제거** (deterministic 실패 = 즉시 failed가 새 계약)
- 또는 **failed 검증으로 변경**: `expect(result.status).toBe("failed")`

`grep -n "runLegacyBuilderFallback\|legacy builder fallback" ngd-studio/server/stages/__tests__/` 로 확인 후 결정.

### `sse.branch.test.ts` — 합성 검증 추가 (선택)

새 합성(legacy 경로 종료 후 deterministic builder 자동 호출)은 sse.ts 내부 로직이므로 branchHelper 테스트엔 영향 없음. 별도 통합 테스트(orchestrator.integration.test.ts 류)가 있다면 그쪽에 추가 검토.

본 phase에서는 **최소한 컴파일/기존 테스트 통과만 보장**하고, 신규 통합 테스트는 Phase 6 E2E에서 실제 빌드로 대체.

## 체크리스트

- [ ] `stageFoundation.test.ts:265-274` `resolveBuilderScripts` 신규 경로(`resources/hwpx_scripts/...`)로 갱신
- [ ] `orchestrator.*.test.ts` 에서 `runLegacyBuilderFallback` / legacy fallback 관련 케이스 제거 또는 failed 검증으로 변경 (grep으로 식별 후 처리)
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx vitest run` 전체 통과 (특히 `sse.branch.test.ts`, `stageFoundation.test.ts`, `orchestrator.*.test.ts`)

## 영향 범위

- 본 phase는 테스트만 손댐. 프로덕션 코드 변경 없음.
- 테스트가 실패한다면 Phase 4의 합성 로직이 기존 기댓값과 어긋난 것 → Phase 4로 돌아가 검토.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic

# 관련 테스트만 격리 실행
npx vitest run server/__tests__/sse.branch.test.ts --reporter=basic
npx vitest run lib/__tests__/stageFoundation.test.ts --reporter=basic
npx vitest run server/stages/__tests__/ --reporter=basic
```

## 실행 결과

### 1회차

**수행 내용:**

1. **`stageFoundation.test.ts:273-278` 갱신** — `resolveBuilderScripts` 테스트의 기댓값을 `.claude/skills/ngd-exam-create/scripts/...` → `resources/hwpx_scripts/...`로 변경. Phase 1에서 이동된 경로와 일치.

2. **`runLegacyBuilderFallback` grep 결과** — 테스트 파일과 프로덕션 코드 모두에서 `runLegacyBuilderFallback` / `legacy builder fallback` 참조 없음. 제거할 케이스 없음.

3. **`orchestrator.integration.test.ts` / `orchestrator.pipeline.test.ts` 빌더 mock 갱신** — `runStageCommand` mock이 `stdout: ""`를 반환해 `extractHwpxPath` → `findExpectedHwpxPath` → 예외 → `status: "failed"` 체인이 발생. 두 테스트 파일의 mock을 개선:
   - `args[0].endsWith("build_hwpx.py")` 분기에서 fake HWPX 파일을 `outputDir`에 기록
   - `stdout: "HWPX written: <path>"` 반환 → builder가 경로 파싱 성공
   - 나머지 명령(fix_namespaces, validate, figure_processor)은 `stdout: ""`로 pass-through

**결과:** 전체 25 테스트 파일 / 264 tests passed (1 skipped) — `npx tsc --noEmit` 0 errors.

#### Scope Audit (orchestrator)
pass — stageFoundation.test.ts + orchestrator.integration.test.ts + orchestrator.pipeline.test.ts 모두 scope 내.

#### Verification Re-run (orchestrator)
tsc exit 0, vitest 25 files / 264 passed (1 skipped). pass.

#### Simplify (orchestrator)
skipped — 테스트 파일 한정, mock 외 변경 거의 없음. 단순화 여지 무.

#### Review (orchestrator)
VERDICT: pass. 스펙 3개 체크리스트 충족, mock 설계가 빌더 실제 계약(args[2]=outputDir, "HWPX written:" 파싱)을 정확히 반영.
