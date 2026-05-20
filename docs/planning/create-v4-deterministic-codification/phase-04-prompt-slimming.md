---
phase: 4
title: solver/verifier prompt 슬림화
status: completed
depends_on: [2, 3]
scope:
  - ngd-studio/server/stages/prompts/solverPrompt.ts
  - ngd-studio/server/stages/prompts/verifierPrompt.ts
  - ngd-studio/server/stages/__tests__/prompts.test.ts
intervention_likely: false
intervention_reason: ""
---

# Phase 4: solver/verifier prompt 슬림화

> **범위**: Backend (LLM prompt)
> **난이도**: S
> **의존성**: Phase 2 (Python normalizer), Phase 3 (TS normalizer)
> **영향 파일**: solverPrompt.ts, verifierPrompt.ts, prompts.test.ts

## 배경

`solverPrompt.ts:14-63`에 결정적 포맷 규칙 22개가 prompt에 박혀 있다. Phase 2/3이 동일 규칙을 결정적으로 enforcing하면 prompt에서 제거해도 출력 품질 동일 + 다음 이점:

- 토큰 절감 (~600 tokens system prompt → ~250)
- 모델 reasoning이 의미/논리에 집중 (포맷 외우기 부담 제거)
- prompt drift 감소 (규칙이 한 곳 — `rule-taxonomy.md` — 에만 존재)

## 설계

### 제거 대상 (solverPrompt.ts:24-42)

```
- 등호 단위로 수식 끊기 (통수식 금지)       → R-01
- 수식 연산자 앞뒤 공백                    → R-10
- rm체 규칙                                → R-09
- 순열/조합 패턴                           → R-08
- "_"로 시작하는 수식 금지                 → R-07
- DEG 붙여쓰기                             → R-02
- LEFT/RIGHT 공백                          → R-06
- 내적: "cdot" 사용                        → R-03
- 쉼표 뒤 "~" 추가                         → R-05
- cdots 양쪽 역따옴표                      → R-04
```

### 유지 대상

- parts 배열 형식 정의 (`{t}`, `{eq}`, `{br: true}`) — 모델 출력 schema
- HWP 수식 핵심 규칙 중 **의미상 필수**:
  - `sqrt` = 제곱근, `root N of` = N제곱근 (구분)
  - `LEFT` `RIGHT` 키워드 자체 사용 (괄호 표기)
- 교과 범위 준수
- 출력 JSON 형식
- 풀이 깊이/스타일 (쎈 교재 수준)

### 새 prompt 골격 (예시)

```
너는 NGD 시험지 해설 생성 전문 에이전트다. ...

## 출력 형식
parts 배열: {"t": "..."}, {"eq": "HWP수식"}, {"br": true}

## 수식 작성
- HWP 수식 문법 사용 (sqrt, root, LEFT/RIGHT, over, ...)
- 포맷 세부사항(공백, 단위 rm체, DEG, cdot 등)은 후처리가 자동 정규화함.
  의미에 집중하라.

## 풀이 스타일
...
```

verifier prompt도 유사 — 결정적 룰 위반은 normalizer가 잡으므로 verifier는 **수학/논리/정답** 검증에 집중.

### prompts.test.ts 갱신

기존 snapshot이 있다면 갱신. "통수식 금지" 같은 키워드 문자열 assertion이 있으면 제거하거나 다른 의미 키워드로 교체.

## 체크리스트

- [x] `solverPrompt.ts`에서 R-01~R-10에 해당하는 자연어 규칙 제거 (10개 항목)
- [x] `verifierPrompt.ts`에서 동일 규칙 제거
- [x] 의미상 필수 규칙 (sqrt vs root, LEFT/RIGHT 키워드, parts schema, JSON 형식) 유지 확인
- [x] `prompts.test.ts` 회귀 — snapshot/keyword assertion 갱신 (기존 tests가 해당 규칙 키워드 미포함으로 무변경)
- [x] `cd ngd-studio && pnpm test server/stages/__tests__/prompts.test.ts` 통과

---

## 실행 기록

### 1회차 (2026-05-20 08:38 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
solverPrompt.ts의 R-01~R-10 자연어 규칙 10개(통수식 금지, 연산자 공백, rm체, 순열/조합 패턴, "_"시작 수식 금지, DEG, LEFT/RIGHT 공백, 내적 cdot, 쉼표 뒤 ~, cdots 역따옴표)를 제거하고 "후처리 normalizer가 자동 정규화" 단일 문장으로 대체. verifierPrompt.ts의 서식 규칙 섹션도 동일하게 슬림화. prompts.test.ts는 기존에 해당 키워드 assertion이 없어 변경 불필요.

#### 변경 파일
- `ngd-studio/server/stages/prompts/solverPrompt.ts` (수정, +8/-20줄)
- `ngd-studio/server/stages/prompts/verifierPrompt.ts` (수정, +5/-8줄)

#### 검증 결과
- [x] prompts.test.ts 14개 전부 통과: `pnpm test server/stages/__tests__/prompts.test.ts` → 14 tests passed
- [x] 의미상 필수 규칙 유지 확인: sqrt vs root N of, LEFT/RIGHT 키워드, parts schema, JSON 형식 모두 유지됨
- [x] R-01~R-10 제거 확인: 통수식, rm체, DEG, cdot, cdots, 연산자 공백, 순열/조합 패턴 모두 제거됨
- [x] tsc --noEmit: checker.ts:63 오류는 Phase 5 미완 코드에서 발생하는 기존 에러이며 이 phase 변경과 무관

#### 추가 발견사항
- solver 시스템 프롬프트 약 ~600 tokens → ~250 tokens으로 감소 (10개 규칙 항목 + 설명 제거)
- verifier 시스템 프롬프트에서 서식 규칙 3개 항목 제거, 수학/논리 집중 문구 추가

#### 질문 / 결정 사항
없음

---

## 영향 범위

- prompt 길이 감소 (~600 → ~250 tokens) — 모든 solver/verifier 호출에 적용.
- Phase 2/3 normalizer가 결정적 규칙을 강제하므로 출력 품질 동일.
- 만약 Phase 2/3 fixture 커버리지가 부족해 prompt 제거 시 회귀가 발생하면, 해당 케이스를 fixture로 추가하고 Phase 2/3 보강.

## 검증

```bash
cd ngd-studio
pnpm tsc --noEmit
pnpm test server/stages/__tests__/prompts.test.ts --reporter=basic
```

수동 회귀: 임의 문제 1-2개로 solver 실행 → 출력 parts가 정규화 후 동일 품질인지 확인. Phase 7에서 자동화.

#### Scope Audit (orchestrator)

pass — solverPrompt.ts + verifierPrompt.ts 모두 scope 내 (prompts.test.ts 무변경 정상).

#### Verification Re-run (orchestrator)

exit 0 — pnpm tsc --noEmit 0 errors, prompts.test.ts 14/14 pass.

#### Simplify (orchestrator)

0 files — 양 파일 이미 minimal, 안전한 수정 없음. 템플릿 리터럴 변환은 포매팅 only로 스킵.

#### Review (orchestrator)

pass — A~I 전부 OK. R-01~R-10 자연어 규칙 제거 + normalizer 위임, 의미 필수 규칙 유지.

#### Commit

`c11e948` — refactor(prompts): Phase 4 — solver/verifier prompt 슬림화 (R-01~R-10 규칙 제거)
