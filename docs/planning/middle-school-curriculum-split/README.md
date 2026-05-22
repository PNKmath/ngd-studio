---
task: middle-school-curriculum-split
created: 2026-05-21
---

# 학교급(중/고) 분기 기반 중학교 커리큘럼 통합 (Phase B)

## 배경

[create-pipeline-stage-split → middle-school-curriculum-split 후속 작업, Phase A = 커밋 `ff3d46e`]

Phase A 에서 schoolLevel 필드(`"중" | "고"`) 를 다음 layer 에 추가하고 UI 노출까지 완료:
- `MetaValue` (`ngd-studio/components/upload/MetaForm.tsx`)
- `V3Meta` (`ngd-studio/lib/store.ts`)
- `ExamMetaInput` (`ngd-studio/server/stages/examData.ts`)
- `ExamMeta` (`ngd-studio/server/stages/prompts/extractorPrompt.ts`)
- create 페이지 4+4 인라인 레이아웃, 학교급 select, 중학교 선택 시 과목 자동 "수학" + disabled

또한 `orchestrator.runExtractorStage` 호출에서 누락됐던 `examMeta: input.meta` 를 채워, 부가 효과로 year/school/grade/schoolLevel 모두 extractor 프롬프트의 "시험 정보" 블록에 도달하게 됨.

**남은 문제**: extractor/checker 의 단원 매핑 로직은 여전히 `.claude/data/unit_classification.json` (고등 전용: 수상/수1/수2/확통/미적/기하 6과목, 단원코드 A~O) 만 참조. `schoolLevel="중"` 으로 와도 중학교 단원은 매핑되지 않는다.

**입력 자료**: `ngd-studio/inputs/시험지 제작/NGD_curriculum_2022.csv` (126행, columns: 교육과정,대단원코드,대단원명,중단원번호,중단원명. 교육과정 = 중등1/중등2/중등3/고1/수1/수2/확통/미적/기하).

## 작업 범위 (parity audit 후 5 phase 로 확장)

| Phase | 한 줄 | 의존성 |
|-------|-------|--------|
| 1 | CSV → `.claude/data/unit_classification_middle.json` 빌드 스크립트 + 산출물 | 없음 |
| 2 | **extractor + solver + verifier** prompt 학교급 분기 (3 모델 일관) | 1 |
| 3 | checker.ts loader + `checkTextVocabulary` schoolLevel 분기 + orchestrator chain | 1 |
| 4 | **filename "[고]" 하드코딩 해제** (TS `examData.ts` + Python `assemble.py`) | 없음 |
| 5 | HWPX 헤더 학교급 표기 정책 + 회귀 + 통합 (e2e_triggers 발화 지점) | 1, 2, 3, 4 |

### Parity audit 발견 사항 (2026-05-21)

초기 4-phase 계획은 **데이터 분류표 + extractor + checker** 만 분기했으나 다음 gap 발견:

| Gap | 위치 | 영향 | 해결 phase |
|-----|------|------|-----------|
| solver/verifier prompt 가 `examMeta` 자체를 안 받음 | `prompts/solverPrompt.ts`, `verifierPrompt.ts` | 모델이 "중학교 수준" 모름 → 풀이 톤·기법 어긋남 | Phase 2 (확장) |
| TS filename_base 의 "[고]" 하드코딩 | `examData.ts:75` | 중학교 빌드물도 `[고]` 토큰 | Phase 4 |
| Python filename 의 "[고]" 하드코딩 | `assemble.py:508` | 동일 — 산출물 파일명 직접 결함 | Phase 4 |
| `v3cache-meta` API 응답에 schoolLevel 누락 | `app/api/v3cache-meta/route.ts:9-31` | 작업 재개 시 폼 학교급 default "고" 로 reset | Phase 4 |
| `filenameMeta.ts` 가 학교급 토큰 parse 결과 set 안 함 | `lib/pdf/filenameMeta.ts:28+108+115` | PDF 파일명 `[중]` 토큰 prefill 안 됨 | Phase 4 |
| HWPX 머릿말 학교급 표기 부재 | `assemble.py:269` GRADE_SUBJECT | "3학년 수학" 만 — 중3/고3 시각 구분 X | Phase 5 (디자인 결정) |

## 성공 기준

- `schoolLevel="중"` 으로 빌드 실행 시 extractor 가 중학교 단원표 안내를 받고, checker `text.vocabulary` 가 중학교 vocabulary 를 pass 처리.
- `schoolLevel="고"` (기존) 동작 회귀 없음 (vitest 전체 pass).
- `.claude/data/unit_classification_middle.json` 이 결정론적으로 재현 가능 (스크립트 재실행 시 동일 산출물).

## 비범위 (Out of scope)

- 중학교 fixture 기반 실제 PDF 빌드 (Phase 4 선택 항목; 외부 API 비용 발생).
- checker 외 다른 단원 vocabulary 사용처 (있다면 후속 task).
- unit_classification.json 과 unit_classification_middle.json 의 단일 통합 (현 단계에선 2 파일 분리 유지).

## 관련

- 부모 작업: `docs/planning/create-pipeline-stage-split/` (Phase A 종료 시점)
- E2E 카탈로그: `docs/e2e/scenarios/create/create-v4-full-pipeline.md`
