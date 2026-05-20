---
task: create-meta-year-field
created: 2026-05-21
---

# create 페이지 Exam Configuration 에 연도 필드 추가 + HWPX 빌드 자동화 연결

## 배경

`MetaValue` (`ngd-studio/components/upload/MetaForm.tsx:3-10`) 에 `year` 필드가 없어 UI 에서 작업 연도를 입력할 수 없다. 그 결과 `ngd-studio/server/stages/examData.ts:76` 의 `meta.year ?? new Date().getFullYear()` fallback 이 항상 발동되어 **모든 빌드물 머릿말/파일명이 자동으로 현재 연도(2026)로 박힌다**. 작년 기출 작업 시 잘못된 헤더가 인쇄됨.

## HWPX 빌드 자동화 연결점

`year` 가 실제로 빌드 산출물에 박히는 지점:

1. **문서 머릿말 (`Contents/section0.xml`)** — `assemble.py:267` 에서 `f"{info['year']}년 {info['semester']} {info['exam_type']}"` 가 `header_area_template.xml` 의 `{{YEAR_SEMESTER}}` 자리에 치환. 사용자에게 보이는 시험지 상단 헤더.
2. **출력 파일명** — `assemble.py:500-508` fallback 경로 또는 `examData.ts:81` 의 `filename_base` 조립 시 `[년도]` 자리에 채워짐.

## 변경 매트릭스

| 레이어 | 파일 | 변경 |
|---|---|---|
| UI | `ngd-studio/components/upload/MetaForm.tsx` | `MetaValue.year` 필드 추가, 학년 옆 2-column 으로 학년/학년도 select 재배치 (안 A) |
| UI | `ngd-studio/app/create/page.tsx` | `DEFAULT_META.year`, validity check, v3Meta 복원, JSX |
| 데이터 | `ngd-studio/lib/store.ts` | `V3Meta.year?: number` |
| 데이터 | `ngd-studio/lib/pdf/filenameMeta.ts` | `YEAR_PATTERN` 매칭 토큰 → `parsed.year` 캡처 (prefill) |
| AI 컨텍스트 | `ngd-studio/server/stages/prompts/extractorPrompt.ts` | `ExamMeta.year` + prompt 라인 추가 |
| AI 컨텍스트 | `ngd-studio/lib/prompts.ts` | solver/verifier prompt 에 `- 연도: {year}` 라인 |
| 빌드 (무수정, 검증만) | `assemble.py`, `examData.ts`, `header_area_template.xml` | 이미 `info.year` 를 받을 준비 완료 |

## 성공 기준

1. UI 에서 학년도 select 로 비-현재 연도(예: 2024) 선택 가능
2. NGD 명명 규칙 파일명에서 연도 prefill 자동 동작 (`[2025]` 토큰 → `meta.year=2025`)
3. exam_data.json `info.year` 가 UI 입력값 그대로 박힘
4. `python3 build_hwpx.py <fixture> <out>` 실행 시 출력 HWPX 의 `Contents/section0.xml` 머릿말과 출력 파일명에 입력 연도가 정확히 반영
5. solver/verifier 프롬프트에 연도가 포함되어 다른 연도 기출 혼동 방지

## 제약

- `examData.ts:76` 의 `new Date().getFullYear()` fallback 은 **그대로 유지** (안전망). UI 가 항상 보내므로 사실상 작동 안 함.
- `assemble.py` 는 **무수정**. 이미 `info.year` 를 받을 준비 완료.
- `header_area_template.xml` 무수정.

## E2E

- catalog 시나리오: `create-v4-full-pipeline` (full pipeline UI→build), `build-hwpx-cli` (CLI 빌드 단독)
- phase-05 에서 fixture exam_data.json (`info.year=2024`) → `python3 build_hwpx.py` → `section0.xml` 의 "2024년" 문자열 + 출력 파일명 `[2024]` 검증
