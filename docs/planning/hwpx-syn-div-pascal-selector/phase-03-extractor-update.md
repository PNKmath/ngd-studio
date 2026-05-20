---
phase: 3
title: extractor (ngd-studio) syn_div / Pascal 메타데이터 추출 로직 추가
status: pending
depends_on: [1]
scope:
  - ngd-studio/server/stages/extractor.ts
  - ngd-studio/server/stages/__tests__/
intervention_likely: false
intervention_reason: ""
---

# Phase 3: extractor 갱신 — syn_div / Pascal 메타데이터 추출

> **범위**: Backend (TypeScript / ngd-studio)
> **난이도**: M
> **의존성**: Phase 1 (schema.md)
> **영향 파일**: `ngd-studio/server/stages/extractor.ts` (수정), 관련 테스트

## 배경

Phase 1 schema.md 에서 정의한 syn_div / Pascal 메타데이터 필드 (`degree`, `nesting_count`, `display_form`, `cells` 등) 를 extractor 출력에 추가한다.

현재 extractor 가 어떤 필드를 출력하는지 확인 후 (worker 가 ngd-studio/server/stages/extractor.ts Read), 필요한 추가/수정 결정.

## 설계

### 작업 흐름

1. `ngd-studio/server/stages/extractor.ts` 의 현재 출력 스키마 확인.
2. 문제 type 가 syn_div / pascal 인 경우의 분기 식별 (없으면 신설).
3. Phase 1 schema.md 의 필드를 추가 — 단, **LLM 호출 프롬프트** 도 함께 갱신해 추출 정확도 확보.
4. 단위 테스트 — 합성 입력 (예: "3차 다항식 조립제법" 문제) 으로 출력 필드 확인.

### 크로스 플랫폼 (TypeScript)

- 경로 조합 `path.join` 사용 (ngd-studio 는 Windows + macOS 동작 필수).
- 외부 명령 호출 시 `process.platform === "win32"` 분기.

## 체크리스트

- [ ] extractor.ts 의 현재 syn_div / pascal 처리 분기 확인 (또는 신설)
- [ ] Phase 1 schema.md 의 필드를 출력 스키마에 추가 (degree, nesting_count, display_form 등)
- [ ] LLM 프롬프트 갱신 — 새 필드를 정확히 추출하도록 instruction 추가
- [ ] 단위 테스트 — 합성 syn_div / Pascal 입력 1건씩 처리 후 출력 필드 확인

## 영향 범위

- ngd-studio 의 extractor 출력 스키마 변경. downstream (solver / verifier / builder 입력) 이 새 필드를 무시하는지 / 활용하는지 확인.
- 기존 시험지 데이터 (syn_div / Pascal 이 아닌 문제) 처리 회귀 없어야 함.
- `npx tsc --noEmit` 통과 필수.

## 검증

```bash
# TypeScript 컴파일
cd ngd-studio
npx tsc --noEmit
echo "tsc exit=$?"

# 단위 테스트 (vitest 사용 가정)
npx vitest run server/stages/__tests__/extractor.test.ts --reporter=basic
```

검증 통과 조건: tsc 통과 + 신규 단위 테스트 통과.
