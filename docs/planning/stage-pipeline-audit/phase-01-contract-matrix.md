---
phase: 1
title: Stage contract 4-way 매트릭스 문서화 (audit, 코드 변경 없음)
status: completed
depends_on: []
scope:
  - docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md
intervention_likely: false
intervention_reason: ""
---

# Phase 1: Stage contract 4-way 매트릭스 문서화

> **범위**: Docs only
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md` (신규)

## 배경

extractor/solver/verifier 각 stage마다 4개 소스(프롬프트 schema · validator · TypeScript output 타입 · 테스트 fixture)가 일관되어야 하는데, 직전 작업에서 `answer`/`question` 필드가 프롬프트엔 없는데 validator는 required였던 모순이 두 번 연속 발견됐다. solver/verifier에는 prompt builder가 두 개씩 공존(legacy 영문 + NGD Korean)하고 한쪽이 dead code 상태.

후속 Phase들이 모두 같은 진실 소스에서 출발하도록, **현재 상태를 매트릭스 한 장으로 문서화**한다. 코드 변경은 없음 — 차이를 모두 enumerate.

## 설계

### 산출물 형식

`docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md` 한 파일. 다음 섹션:

#### 1. Extractor

| 필드 | 프롬프트 schema | validator | TS 타입 | 테스트 fixture | 일치? |
|------|----------------|-----------|---------|----------------|-------|
| answer | "추출하지 않음" 명시 | optional (현재) | `answer?` | 포함 (테스트는 명시) | ✅ (fix됨) |
| question | 없음 (parts 배열) | optional (현재) | `question?` | 포함 | ✅ (fix됨) |
| parts | `[{t}\|{eq}]` 필수 | 없음 | `[key: string]: unknown` 통과 | 포함 | ⚠️ validator 부재 |
| condition_box | 정의됨 | 없음 | unknown | 포함 (null) | ⚠️ validator 부재 |
| data_table | 정의됨 | 없음 | unknown | 포함 (null) | ⚠️ validator 부재 |
| choices | `[[{t}\|{eq}]\|null]` | length 3-5 | `string[]` ⚠ | 객체 배열 | ⚠️ TS 타입 wrong |
| has_figure | required boolean | required boolean | required | 포함 | ✅ |
| figure_info | object/null | object when has_figure | required | 포함 | ✅ |

#### 2. Solver

- **두 개의 prompt builder 공존**:
  - `solver.ts:102-111` `buildSolverPrompt` (legacy 영문, 실제 사용) — schema `{answer:string, explanation:[{kind,content}], verifierContext?}`
  - `prompts/solverPrompt.ts:69-94` `buildSolverPrompt` (NGD Korean, **import만 가능하지 호출자 없음**) — schema `{number, answer, explanation_parts:[{t}\|{eq}\|{br}]}`
- validator 매트릭스 (현재 legacy 기준):

| 필드 | legacy prompt | NGD prompt | validator | TS 타입 |
|------|--------------|-----------|-----------|---------|
| answer | required string | required string | required non-empty string | `string` |
| explanation | required array of `{kind,content}` | **이름 다름**: `explanation_parts` of `{t\|eq\|br}` | array of `{kind,content}` | `SolverExplanationSegment[]` |
| verifierContext | optional object | 정의 없음 | optional object | `Record<string,unknown>?` |
| number | 없음 | required int | 없음 | 없음 |

#### 3. Verifier

- 같은 패턴: legacy `{status, issues:[{message,severity?,path?}], feedback?}` vs NGD `{number, status, issues:[{category,description,location}], feedback}`.
- 매트릭스 동일 포맷.

#### 4. 결론

각 stage별로 **어느 prompt를 진실로 채택할지** + **각 필드별 fix 결정**을 명시:
- extractor: NGD-rich 유지 (이미 사용 중). 남은 sweep은 Phase 3.
- solver: NGD-rich로 통합 (사용자 confirm 완료). legacy 제거. Phase 2.
- verifier: NGD-rich로 통합. legacy 제거. Phase 2.

## 체크리스트

- [x] `CONTRACT_MATRIX.md` 생성 — 위 4개 섹션 포함
- [x] 각 stage별 매트릭스에 현재 코드 라인 번호 인용 (검증 가능성 확보)
- [x] 각 매트릭스에 "⚠️ 불일치 N건" 카운트와 어느 Phase에서 처리할지 표기
- [x] Phase 2/3가 참조할 "결론" 섹션 작성 — 채택할 schema 명시

## 영향 범위

- 코드 변경 없음.
- Phase 2/3가 이 문서를 진실 소스로 참조.
- 사용자도 이 한 장으로 전체 상태 파악 가능.

## 검증

```bash
ls docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md
test -s docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md  # non-empty
```

문서 내용은 code reference (파일:라인) 가 실존하는지 grep으로 spot-check.

## 실행 결과

### 1회차 (2026-05-18 15:30 KST) — 완료

**상태**: completed
**소요 시간**: 약 8분
**진행 모델**: claude-sonnet-4-6

#### 요약

`CONTRACT_MATRIX.md` 신규 생성. extractor/solver/verifier 3 stage의 프롬프트 schema · validator · TS 타입 · 테스트 fixture를 4-way 대조하여 총 15건의 불일치를 식별했다. solver와 verifier는 NGD 한국어 prompt builder가 `prompts/` 폴더에 있으나 `solver.ts`/`verifier.ts` 양쪽 모두 import하지 않아 dead code 상태임을 확인. Phase 2/3가 참조할 채택 schema와 작업 범위를 결론 섹션에 명시했다.

#### 변경 파일

- `docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md` (신규, +169줄)
- `docs/planning/stage-pipeline-audit/phase-01-contract-matrix.md` (수정, status 전이 + 체크리스트)

#### 검증 결과

- [x] 파일 존재: `ls docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md` → pass
- [x] 비어있지 않음: `test -s docs/planning/stage-pipeline-audit/CONTRACT_MATRIX.md` → pass
- [x] 코드 참조 spot-check: `solver.ts:102`, `extractor.ts:121`, `verifier.ts:104`, `solverPrompt.ts:69,100` 모두 실존 확인

#### 추가 발견사항

- `solver.ts` 내부 `buildSolverPrompt`와 `prompts/solverPrompt.ts`의 `buildSolverPromptString`이 동일한 내용을 가짐 (Phase 2에서 둘 다 제거 대상)
- 테스트 fixture `extracted/q0{1,2,3}.json`이 프롬프트 schema의 `parts` 필드 없이 `question`만 가짐 — Phase 3에서 업데이트 필요
- `verifier.ts`의 `VerifierIssue.feedback`이 fixture에서 `null`로 오는데 TS 타입은 `string | undefined` — NGD schema 채택 시 `null` 허용으로 통일 검토 필요

#### 질문 / 결정 사항

없음

#### Scope Audit (orchestrator)

pass — 1 file in scope (CONTRACT_MATRIX.md); phase-01 자체는 exempt.

#### Verification Re-run (orchestrator)

exit 0 — `ls && test -s CONTRACT_MATRIX.md` 양쪽 통과.

#### Simplify (orchestrator)

SIMPLIFIED: 0 — docs-only, 모든 행이 다른 필드/artifact 참조로 중복 없음.

#### Review (orchestrator)

VERDICT: pass — CONTRACT_MATRIX.md가 스펙 4개 섹션을 모두 충족하며 인용 라인(solver.ts:102, extractor.ts:121, verifier.ts:104, solverPrompt.ts:69,100) 모두 실존 확인.
