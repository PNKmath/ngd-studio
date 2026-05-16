---
phase: 7
title: DeepSeek V4 후속 로드맵
status: pending
depends_on: []
scope:
  - docs/planning/ai-provider-adapters/
  - ngd-studio/.env.example
intervention_likely: true
intervention_reason: "DeepSeek/Gemini 같은 외부 API provider는 원본 PDF/HWPX/문제 이미지 전송 정책 확정 전 구현하면 안 됨."
executor: haiku
---

# Phase 7: DeepSeek V4 후속 로드맵

> **범위**: Documentation
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: planning docs, optional `.env.example`

## 배경

사용자는 2차/3차 진행을 위해 DeepSeek V4, 자동 추천, 단계별 엔진 선택도 기록해두길 원했다. 하지만 DeepSeek V4는 CLI agent가 아니라 외부 API provider이므로 전체 HWPX 생성 agent를 바로 대체하기보다 단계별 판단 엔진으로 설계해야 한다.

## 설계

후속 로드맵 문서를 추가한다.

- 2차: DeepSeek V4 API provider
  - 먼저 검토 리포트 JSON 생성, 추출 JSON 보정 같은 제한된 단계부터 적용
  - API key/env 설정 기록
  - 외부 API 전송 정책 확정 전 구현 금지
- 3차: 자동 추천 + 단계별 엔진 선택
  - 작업 전체 기본 provider와 stage override 구조 분리
  - `create.extractor`, `create.solver`, `review.reviewer` 같은 stage key 설계
  - 비용/속도/품질 로그 수집 후 자동 추천

## 체크리스트

- [ ] `roadmap.md`에 2차 DeepSeek V4 API provider 범위 기록
- [ ] `roadmap.md`에 3차 자동 추천 + 단계별 엔진 선택 범위 기록
- [ ] 외부 API 전송 정책 결정 항목을 명시
- [ ] 필요 시 `.env.example`에 DeepSeek 관련 placeholder만 추가하고 실제 구현은 하지 않음
- [ ] checklist 관련 문서 링크 갱신

## 영향 범위

문서 phase이다. 구현은 하지 않는다. DeepSeek V4가 UI에 노출되거나 실행 가능한 상태가 되면 scope 위반이다.

## 검증

```bash
test -f docs/planning/ai-provider-adapters/roadmap.md
grep -n "DeepSeek V4\\|외부 API\\|단계별" docs/planning/ai-provider-adapters/roadmap.md
```

## 실행 결과

