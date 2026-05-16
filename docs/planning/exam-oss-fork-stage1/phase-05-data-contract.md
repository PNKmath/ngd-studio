---
phase: 5
title: exam_data.json 데이터 계약 문서화 (future plugin interface)
status: pending
depends_on: [3]
scope:
  - /mnt/c/openexam/docs/schema
  - /mnt/c/openexam/docs/architecture.md
  - /mnt/c/openexam/examples
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 5: exam_data.json 데이터 계약 문서화

> **범위**: 문서화 + 스키마 (코드 변경 없음)
> **난이도**: M
> **의존성**: Phase 3 (rename 이후 에이전트 이름이 안정화)
> **영향 파일**: `docs/schema/exam_data.schema.json`, `docs/schema/types.ts`, `docs/architecture.md`, `examples/exam_data.example.json`

## 배경

이번 1단계의 핵심 자산은 `exam_data.json`이라는 파이프라인 중간 데이터 구조다. extractor가 만들고 → solver가 보강하고 → verifier가 검증하고 → figure가 그림을 추가하고 → builder(HWPX)가 최종 문서로 변환한다.

3단계(builder plugin화)로 갈 때 **이 JSON이 사실상 plugin interface가 된다**. 지금 문서화해두면 3단계 전환이 거의 공짜가 된다. 또한 OSS 사용자가 자기 빌더를 붙이거나 다른 도구와 통합할 때 이 스키마가 첫 번째 참조점이 된다.

현재는 코드와 에이전트 .md에 암묵적으로만 존재 — 명시적 스키마 파일 없음.

## 설계

### 산출물 4개
1. **`docs/schema/exam_data.schema.json`** — JSON Schema (Draft 2020-12)
   - 모든 필드 + 타입 + 필수/선택 + 예시
   - 문제 type별 분기 (choice, short_answer, essay)
   - 수식 객체, 그림 객체, 데이터 테이블, 보기 테이블 구조

2. **`docs/schema/types.ts`** — TypeScript 타입 정의
   - studio에서 import해서 쓸 수 있는 형태
   - JSON Schema와 동일한 구조 — 향후 schema에서 자동 생성 검토

3. **`docs/architecture.md`** — 파이프라인 데이터 흐름도
   - 텍스트 다이어그램으로 extractor → solver → verifier → figure → builder
   - 각 단계가 exam_data.json에 무엇을 추가/변경하는지
   - "포맷 무관 파이프라인 + HWPX 빌더(reference impl)" 구조 명시 — 3단계 전환 의도 사전 공지

4. **`examples/exam_data.example.json`** — 최소 동작 예시
   - 문제 2~3개 (객관식 1, 단답형 1, 서술형 1)
   - 모든 주요 필드를 한 번씩 보여주는 합성 데이터
   - schema validation 통과해야

### 스키마 추출 절차
- `build_hwpx.py`를 읽고 `make_*` 함수들이 기대하는 키들을 역추출 (특히 `problems[].parts`, `problems[].explanation`, `problems[].figure`)
- 에이전트 .md(`exam-extractor.md`, `exam-solver.md`, `exam-verifier.md`)의 출력 형식 명세 비교
- 현재 비공개 레포의 실제 `exam_data.json` 샘플이 있으면 참고 (역추출 검증용)

## 체크리스트

- [ ] `build_hwpx.py` + `exam-{extractor,solver,verifier,figure,builder}.md` 읽고 모든 키 전수 추출 (스프레드시트 형태로 정리)
- [ ] `docs/schema/exam_data.schema.json` 작성 (JSON Schema Draft 2020-12)
- [ ] `docs/schema/types.ts` 작성 (TypeScript 타입)
- [ ] `examples/exam_data.example.json` 합성 데이터로 작성 (최소 동작 예시)
- [ ] `docs/architecture.md` 작성 (파이프라인 다이어그램 + 단계별 입출력 + 3단계 전환 의도)
- [ ] `npx ajv-cli validate -s docs/schema/exam_data.schema.json -d examples/exam_data.example.json` 통과 (또는 동등한 검증)

## 영향 범위

- 코드 변경 없음 (순수 문서화)
- 3단계에서 builder plugin interface 추출 시 이 스키마가 첫 번째 참조점
- studio에서 이 types.ts를 import해서 쓰면 타입 안전성 ↑ (선택 — 이번 phase 범위 아님)

## 검증

```bash
cd /mnt/c/openexam
ls docs/schema/  # exam_data.schema.json, types.ts 존재
cat examples/exam_data.example.json | python -m json.tool > /dev/null  # JSON 유효성
npx -y ajv-cli validate -s docs/schema/exam_data.schema.json -d examples/exam_data.example.json
```

## 실행 결과
