---
task: create-v4-meta-form-and-autostart
phase_count: 4
created: 2026-05-15
---

# /create-v4 메타 폼 통합 + 자동 시작 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.

## 배경 요약

`/create-v4`에서 PDF 자동 분할 + 박스 조정까지 마치고 "시험지 제작 시작"을 눌러도, 실제로는 이미지만 디스크에 저장하고 `/create`로 페이지만 이동한다. 거기서 사용자가 다시 학교/학년/과목/학기/시험구분/단원범위를 입력하고 "이어 작업"을 클릭해야 비로소 extractor 파이프라인이 시작된다. 사용자의 기대(원스톱)와 다름.

본 task는 `/create-v4`에 메타 입력 폼을 통합하고, 한 번의 "시험지 제작 시작" 클릭으로 [이미지 업로드 + 메타 저장 + extractor 자동 시작 + 진행 화면 이동]을 모두 처리한다.

## 핵심 결정

- **필수 메타 6개**: 학교/학년/과목/학기/시험/범위 전부 non-empty 필수 (default 값 허용 — 사용자가 명시적으로 의도하지 않는 한 오염 위험이 큰 `subject`/`grade`도 포함).
- **실패 시 정책 통일 (b)**: POST 단계 실패 시 자동 롤백 안 함. 이미지/메타가 일부 저장됐어도 그대로 두고 사용자에게 "/create로 이동해 이어 작업하시면 진행됩니다" 안내. 사용자 작업 보존 + 기존 `/create` Resume 흐름과 자연 통합.
- **메타 폼 sessionStorage 영속**: 사용자가 입력한 필드를 sessionStorage에 자동 저장 → 실패 후 `/create`로 이동 시 폼 자동 채움.
- **`/pdf-cropper` 회귀 금지**: `CropperWorkspace`는 `onExtract` prop 그대로. 메타 폼은 `/create-v4`에서만 렌더.
- **`CropperWorkspace` 자체 수정 금지** (이번 task scope 외 — Phase 4에서 fix가 필요하면 scope 확장 승인 받음).

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-meta-form-extract.md](./phase-01-meta-form-extract.md) | 4 | 4 | 100% | completed | 74a86b2 |
| 2 | [phase-02-create-v4-meta-and-autostart.md](./phase-02-create-v4-meta-and-autostart.md) | 6 | 6 | 100% | completed | 9b66934 |
| 3 | [phase-03-create-page-store-hydration.md](./phase-03-create-page-store-hydration.md) | 4 | 4 | 100% | completed | eaf0ff1 |
| 4 | [phase-04-e2e-and-error-cases.md](./phase-04-e2e-and-error-cases.md) | 5 | 4 | 80% | needs_user | - |
| **Total** | | **19** | **18** | **95%** | | |

## Phase 의존성

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
(MetaForm) (/create-v4) (/create)  (e2e)
```

- Phase 1, 2, 3, 4 모두 순차 (다음 phase가 직전 결과 위에 빌드).
- 병렬 가능한 phase 없음.

## 우선순위 / 권장 실행 순서

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | MetaForm 컴포넌트 추출 | 15분 |
| P0 | Phase 2 | /create-v4 메타 폼 + 자동 시작 wiring | 40분 |
| P0 | Phase 3 | /create mount 자동 진행 화면 분기 | 20분 |
| P0 | Phase 4 | e2e 수동 검증 + 에러 케이스 | 30분 |

## 공통 검증

- [ ] `pnpm --filter ngd-studio build` 통과
- [ ] `pnpm --filter ngd-studio test` 통과 (기존 46건 회귀 없음)
- [ ] `/create-v4`에서 메타 입력 + 박스 조정 + "시험지 제작 시작" 한 번 → `/create`에서 진행 화면 즉시 표시 (수동)
- [ ] `/create` 직접 진입: 기존 폼/Resume 흐름 정상 (수동)
- [ ] `/pdf-cropper` ZIP 다운로드 동작 그대로 (수동, 회귀)
- [ ] 메타 필드 일부 비움 → "시험지 제작 시작" 버튼 비활성 + 안내 (수동)
- [ ] POST 1단계 실패 → 배너 + 재시도 (수동)
- [ ] POST 2/3단계 실패 → "/create로 이동" 링크 + sessionStorage 폼 채움 (수동)

## 관련 메모

- `useJobRunner.startJob(mode, files, meta?)` — `mode="create"` + `meta` 전달 시 store에 v3Meta 저장됨 (`useJobRunner.ts:29-46`).
- `/create` 페이지는 이미 `hasJob = isRunning || isDone`이면 진행 화면을 표시함 (`app/create/page.tsx:147,363`). Phase 3는 mount 시 store 상태 hydration의 갭만 메움.
- `useJobStore`는 zustand in-memory store — Next.js client-side router.push 간에 보존됨.
