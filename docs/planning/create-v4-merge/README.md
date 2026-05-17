# create-v4 ↔ create 통합

## 배경

현재 `/create-v4`는 PDF crop + 문제 이미지 추출까지만 담당하고, "추출" 버튼을 누르면 `router.push("/create")`로 페이지를 옮겨 백엔드 작업을 시작한다. 결과 확인도 `/create`에서 이루어진다.

두 페이지를 하나로 합쳐 **한 페이지 안에서 PDF 업로드 → crop → 추출 → 백엔드 작업(extractor~checker) → 결과 확인**까지 끊김 없이 진행할 수 있도록 한다.

## 목표

- `/create-v4` 페이지가 idle / running / done 세 상태를 모두 책임지는 단일 페이지가 된다.
- idle: 좌측 사이드바(시험정보 + 파이프라인 미리보기 + 이전 작업 재개) + 우측 CropperWorkspace.
- running/done: 좌측 사이드바(시험정보 요약 + 상태/제어 + 라이브 파이프라인) + 우측 결과(QuestionResultPanel + LogStream) + 하단 조건부 패널(figure 확인 / build 상태 / followup chat).
- `router.push("/create")` 제거 — 추출 즉시 같은 페이지에서 상태 전환.
- `/create` 페이지 자체는 호환성을 위해 당분간 유지. 통합본 검증 후 폐기.

## 합의된 결정사항

1. Running/Done 상태에서 CropperWorkspace는 **완전히 숨김**.
2. 이전 작업 재개 카드 **포함**.
3. figure confirm / build status / followup chat 패널 **포함**.
4. `/create` 페이지 당분간 유지, 검증 후 폐기.
5. 레이아웃은 v4의 `flex-col h-screen overflow-hidden` full-height + 내부 스크롤 패턴 유지.

## 비범위

- `/create` 페이지 삭제 (별도 작업)
- PipelineView stage 정의 변경 (현재 6단계 유지)
- 백엔드 API 변경
- crop 단계를 PipelineView에 추가

## 참고 코드 위치

- 통합 대상: `ngd-studio/app/create-v4/page.tsx`
- 참고(수정 안 함): `ngd-studio/app/create/page.tsx`
  - idle: line 250-332
  - running/done: line 334-486
- 컴포넌트: `components/pipeline/PipelineView.tsx`, `components/results/QuestionResultPanel.tsx`, `components/log/LogStream.tsx`, `components/shared/DownloadButton.tsx`, `components/shared/FollowupChat.tsx`
- 상태: `lib/store.ts` (`useJobStore`), `lib/useJobRunner.ts` (`useJobRunner`)
