---
phase: 4
title: Checker XML rule runner
status: completed
depends_on: [1]
scope:
  - ngd-studio/server/stages/checker.ts
  - ngd-studio/server/stages/types.ts
  - ngd-studio/lib/__tests__/stageFoundation.test.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: Checker XML rule runner

> **범위**: Backend
> **난이도**: M
> **의존성**: Phase 1
> **영향 파일**: `server/stages/checker.ts` 신규

## 배경

`ngd-exam-checker`의 일부 규칙은 XML/string rule로 deterministic하게 검출할 수 있다. 모델은 의미 판단이 필요한 항목에 남기고, 기계적 품질 회귀는 서버 runner가 먼저 잡아야 한다.

## 설계

`server/stages/checker.ts`에 checker issue 타입과 rule runner를 추가한다. 초기 rule subset은 XML well-formedness, raw escape, 통수식 문자열, 난이도 vocabulary, 순열/조합 금지 패턴처럼 deterministic한 항목으로 제한한다.

## 체크리스트

- [x] checker issue/result 타입 정의
- [x] deterministic XML/string rule subset 구현
- [x] HWPX 또는 section XML 입력 path 처리
- [x] ambiguous semantic check는 agent fallback 대상으로 분리
- [x] issue list가 JSON 직렬화 가능한 구조
- [x] focused test 또는 TypeScript 검증 통과

## 영향 범위

checker agent를 대체하지 않고, deterministic pre-check 결과를 생성하는 단계다.

## 검증

```bash
pnpm exec tsc --noEmit
```

## 실행 결과

### 2026-05-16

STATUS: completed
PHASE: 4
SUMMARY: `server/stages/checker.ts`에 deterministic checker `StageRunner`와 XML/string rule subset을 추가했습니다. HWPX ZIP의 `Contents/section0.xml`, XML 파일, inline XML 입력을 처리하며 issue/result는 JSON 직렬화 가능한 구조입니다.
CHECKLIST: 6/6
VERIFICATION: pass
NEXT: Phase 5 진행 가능. Phase 3도 Phase 2 의존성이 충족되어 진행 가능.
COMMIT: pending

#### Scope Audit (orchestrator)

pass — 2 files in scope

#### Verification Re-run (orchestrator)

exit 0 — `pnpm exec tsc --noEmit` 통과
