---
phase: 4
title: 타입 체크 + 회귀 시나리오 수동 검증
status: pending
depends_on: [3]
scope:
  - ngd-studio/app/create-v4/page.tsx
intervention_likely: true
intervention_reason: "실제 작업 데이터/이미지로 수동 동작 확인이 필요하며, 결과를 보고 /create 폐기 시점을 판단해야 함"
---

# Phase 4: 타입 체크 + 회귀 시나리오 수동 검증

> **범위**: Verification only
> **난이도**: S
> **의존성**: Phase 3
> **영향 파일**: `ngd-studio/app/create-v4/page.tsx` (읽기만)

## 배경

Phase 1-3을 거치면 `/create-v4`가 `/create`의 모든 기능을 흡수한다. 이 phase는 통합본이 회귀 없이 동작하는지 확인하고, 추후 `/create` 폐기 결정에 쓸 체크리스트를 남기는 검증 단계다.

`/create` 페이지는 이 phase에서 **삭제하지 않는다** — 통합본이 실 사용에서 안정적으로 검증된 뒤 별도 작업으로 폐기한다.

## 설계

### 1. 정적 검증

```bash
cd ngd-studio
npx tsc --noEmit
```

### 2. dev 서버 + 회귀 시나리오

Mac에서 `pnpm dev` 띄우고 다음 시나리오를 순서대로 확인:

**시나리오 A — 신규 작업**
1. `/create-v4` 접속, idle 상태 확인
2. 시험정보 Card + 파이프라인 미리보기(6단계 pending) + (있다면) 이전 작업 재개 카드 표시 확인
3. PDF 업로드 → 자동/수동 crop → 추출 버튼 클릭
4. URL 그대로(`/create-v4`)이면서 좌/우 분할 뷰가 결과 뷰로 전환되는지 확인
5. 좌측: 시험정보 요약 + 상태 카드(진행 중...) + 라이브 PipelineView
6. 우측: QuestionResultPanel + LogStream 표시
7. 작업 완료 시 다운로드 버튼 활성화

**시나리오 B — 재개 (extractor부터)**
1. `.v3cache`에 이미지 + 정리본이 있는 상태에서 `/create-v4` 접속
2. 좌측 이전 작업 재개 카드 표시
3. 펼치기 → 재개 시작 단계 select에서 extractor 선택
4. 재개 클릭 → running 뷰 전환 확인

**시나리오 C — figure 확인 패널**
1. resumeFrom=figure로 재개 후 작업 완료
2. figure 확인 패널이 표시되고 figure_status가 폴링되는지 확인
3. 이미지 그리드 표시 + "확인 — HWPX 조립 시작" 버튼 클릭 → builder로 진행

**시나리오 D — build 상태 / followup**
1. HWPX 조립 단계에서 build status 패널이 진행 상태/완료/실패를 정확히 표시하는지
2. 작업 완료 후 FollowupChat 표시

**시나리오 E — `/create` 호환성**
1. `/create` URL 직접 접속 → 기존대로 동작하는지 (이 phase에서는 미제거)
2. store(`useJobStore`)가 두 페이지에서 일관되게 작동하는지

### 3. 회귀 체크리스트 기록

이 phase 완료 시 `## 실행 결과` 섹션에 시나리오별 PASS/FAIL/스킵 기록. FAIL 항목은 후속 phase 또는 별도 작업으로 분리.

### 4. `/create` 폐기 판단

수동 검증 모두 PASS면 README/CLAUDE.md에 "`/create` 폐기 후보" 메모를 남기는 것까지만 진행 (실제 삭제는 별도 작업).

## 체크리스트

- [ ] `npx tsc --noEmit` 통과
- [ ] 시나리오 A (신규 작업) PASS 확인
- [ ] 시나리오 B (재개) PASS 확인
- [ ] 시나리오 C (figure 확인) 실데이터로 PASS 또는 스킵 사유 기록
- [ ] 시나리오 D (build / followup) PASS 확인
- [ ] 시나리오 E (`/create` 호환성) PASS 확인
- [ ] 결과를 `## 실행 결과`에 기록
- [ ] `/create` 폐기 후보 메모를 README나 별도 작업으로 남김

## 영향 범위

- 검증만 수행, 코드 변경 없음
- 다만 시나리오 진행 중 발견된 버그는 즉시 수정하거나 별도 phase로 추가

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
pnpm dev
# 브라우저에서 위 5개 시나리오 진행
```
