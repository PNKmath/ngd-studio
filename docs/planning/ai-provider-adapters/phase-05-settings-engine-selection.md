---
phase: 5
title: 설정 페이지 엔진 선택
status: completed
depends_on: [3, 4]
scope:
  - ngd-studio/app/settings/
  - ngd-studio/components/layout/Sidebar.tsx
  - ngd-studio/components/layout/Header.tsx
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/store.ts
  - ngd-studio/lib/ai/
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 5: 설정 페이지 엔진 선택

> **범위**: Frontend + client runner
> **난이도**: M
> **의존성**: Phase 3, Phase 4
> **영향 파일**: `app/settings/`, `lib/useJobRunner.ts`, layout navigation

## 배경

엔진 선택 UI는 작업 버튼 옆이 아니라 별도 설정 페이지에서 관리한다. 사용자는 기본 엔진을 `자동`, `Claude`, `Codex` 중 선택한다. 1차 구현에서 `자동`은 Claude로 해석하되, 후속 phase에서 자동 추천으로 확장할 수 있게 데이터 구조를 잡는다.

## 설계

`/settings` 페이지를 추가하고 localStorage 기반 설정을 둔다. 서버 저장은 1차 범위에서 제외한다.

설정 데이터 초안:

- `defaultProvider`: `auto | claude | codex`
- 미래 확장 필드 placeholder: stage-level provider 선택은 문서화만 하고 UI에는 노출하지 않음

`useJobRunner`는 start 시 localStorage 설정을 읽어 `/api/run` body의 provider로 전달한다. hydration 문제를 피하기 위해 client hook 내부에서만 읽는다.

## 체크리스트

- [x] `app/settings/page.tsx` 신규 추가
- [x] `defaultProvider` localStorage read/write helper 추가
- [x] Sidebar 또는 Header navigation에 설정 페이지 링크 추가
- [x] `useJobRunner`가 설정된 provider를 `/api/run`에 포함
- [x] 기본값 `auto`에서 기존 Claude 흐름이 유지됨
- [x] 설정 UI가 `자동/Claude/Codex`만 노출하고 DeepSeek는 1차에서 숨김
- [x] 관련 테스트 또는 최소 typecheck 통과

## 영향 범위

작업 페이지 UI에는 엔진 선택 컨트롤을 추가하지 않는다. 설정 페이지가 없는 상태에서도 default `auto`로 동작해야 한다.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
pnpm test
```

## 실행 결과

### 2026-05-16 — Phase 5

#### Summary
- `/settings` 페이지를 추가해 기본 실행 엔진을 `자동`, `Claude`, `Codex` 중 선택할 수 있게 했다.
- `lib/ai/settings.ts`에 localStorage 기반 `defaultProvider` read/write helper를 추가하고 DeepSeek는 selectable provider에서 제외했다.
- Sidebar/Header navigation에 설정 페이지를 연결했다.
- `useJobRunner`가 명시 provider가 없으면 localStorage 기본 provider를 읽어 `/api/run` body에 포함하도록 했다.
- `providerSettings.test.ts`로 기본값, invalid/hidden provider fallback, 저장 동작을 고정했다.

#### Scope Audit (orchestrator)
- pass — changed files are within Phase 5 scope: `ngd-studio/app/settings/`, `ngd-studio/components/layout/Sidebar.tsx`, `ngd-studio/components/layout/Header.tsx`, `ngd-studio/lib/useJobRunner.ts`, `ngd-studio/lib/ai/`, `ngd-studio/lib/__tests__/providerSettings.test.ts`

#### Verification Re-run (orchestrator)
- pass — `npx tsc --noEmit`
- pass — `pnpm test` (81 tests)

#### Review (orchestrator)
- pass — settings are client-only and default to `auto`, preserving existing Claude flow.

#### Commit
- pending — commit will be recorded in `checklist.md` after local commit creation.
