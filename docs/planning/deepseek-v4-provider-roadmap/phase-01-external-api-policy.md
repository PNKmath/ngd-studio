---
phase: 1
title: 외부 API 전송 정책 확정
status: completed
depends_on: []
scope:
  - docs/planning/deepseek-v4-provider-roadmap/
  - docs/planning/ai-provider-adapters/roadmap.md
intervention_likely: true
intervention_reason: "PDF/HWPX/문제 이미지/메타데이터를 외부 API로 보낼 수 있는지 사용자 정책 결정이 필요함."
executor: sonnet
---

# Phase 1: 외부 API 전송 정책 확정

> **범위**: Documentation
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `docs/planning/deepseek-v4-provider-roadmap/`

## 배경

`roadmap.md`는 DeepSeek V4, Gemini 같은 외부 API provider 구현 전 전송 정책을 먼저 확정하라고 명시한다. 현재 DeepSeek V4는 `.env.example` placeholder와 provider id 타입만 존재하며, 실행 adapter로 등록되어 있지 않다.

## 설계

`external-api-policy.md`를 추가해 외부 API로 보낼 수 있는 데이터와 금지 데이터를 분리한다. 정책 문서는 최소한 파일 유형, 민감 정보 판단, 사용자 opt-in, 로그 보관 범위, 재시도 허용 여부, 로컬 checker 재검증 여부를 포함한다.

정책이 미확정인 항목은 `TBD`로 남기지 말고 `blocked` 또는 `needs_user` 상태로 정리한다. Phase 2 이후 구현은 이 문서를 기준으로 허용 stage와 payload를 제한한다.

## 체크리스트

- [x] `external-api-policy.md`에 외부 전송 허용 파일 유형과 금지 파일 유형을 명시
- [x] 문제 이미지, 학교명, 시험 메타데이터의 민감 정보 취급 여부를 명시
- [x] 사용자별 opt-in과 작업별 override 필요 여부를 명시
- [x] 외부 API 요청/응답 로그 보관 범위와 기간을 명시
- [x] 외부 provider 실패 재시도와 로컬 checker 재검증 정책을 명시
- [x] 정책 미확정 시 DeepSeek adapter 구현을 중단하도록 후속 phase 전제 조건을 기록

## 영향 범위

문서 phase다. 실행 코드와 `.env.example`은 변경하지 않는다. 정책이 확정되지 않으면 Phase 2는 시작하지 않는다.

## 검증

```bash
test -f docs/planning/deepseek-v4-provider-roadmap/external-api-policy.md
grep -n "PDF\\|HWPX\\|문제 이미지\\|opt-in\\|로그\\|재시도\\|재검증" docs/planning/deepseek-v4-provider-roadmap/external-api-policy.md
```

## 실행 결과

### 1회차 (2026-05-16 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: codex

#### 요약
사용자 결정에 따라 외부 API 전송은 전체 파일 유형을 허용하는 정책으로 확정했다. 단, 자동 fallback은 금지하고 사용자 opt-in/stage override, 로그 최소화, 로컬 재검증 조건을 명시했다.

#### 변경 파일
- `docs/planning/deepseek-v4-provider-roadmap/external-api-policy.md` (신규)
- `docs/planning/ai-provider-adapters/roadmap.md` (수정)
- `docs/planning/deepseek-v4-provider-roadmap/phase-01-external-api-policy.md` (수정)

#### 검증 결과
- [x] 정책 문서 존재 및 키워드 확인: `test -f ... && grep -n ...` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
외부 API 전송은 전체 허용으로 확정됨.

## 실행 결과
