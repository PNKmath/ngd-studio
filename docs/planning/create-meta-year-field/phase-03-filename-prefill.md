---
phase: 3
title: filenameMeta 에서 year prefill
status: completed
depends_on: [1]
scope:
  - ngd-studio/lib/pdf/filenameMeta.ts
  - ngd-studio/lib/pdf/__tests__/filenameMeta.test.ts
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs: [create-v4-full-pipeline]
e2e_triggers: []
---

# Phase 3: filenameMeta 에서 year prefill

> **범위**: Frontend (parser)
> **난이도**: XS
> **의존성**: Phase 1 (`MetaValue.year` 타입 존재)
> **영향 파일**: `lib/pdf/filenameMeta.ts` + 테스트

## 배경

NGD 명명 규칙 `[코드][고][년도][학기-차수]...` 의 `[년도]` 토큰은 이미 `YEAR_PATTERN = /^(19|20)\d{2}$/` 으로 인식되지만 (`lib/pdf/filenameMeta.ts:29, :108`), `parseExamMetaFromFilename` 이 이를 `parsed.year` 로 캡처하지 않는다. 결과적으로 PDF 드롭 시 학교/학년/과목/학기/시험/범위 만 prefill 되고 학년도는 사용자가 매번 직접 골라야 한다.

## 설계

### `parseExamMetaFromFilename` 에 year 캡처 추가

`lib/pdf/filenameMeta.ts:34-72` 사이, `gradeTokenIndex` 캡처 직후나 직전에:

```ts
const yearTokenIndex = parts.findIndex((part, index) => YEAR_PATTERN.test(part) && !used.has(index));
if (yearTokenIndex >= 0) {
  parsed.year = Number(parts[yearTokenIndex]);
  used.add(yearTokenIndex);
}
```

- **첫 매칭만 사용** (filename 에 연도 토큰이 여러개여도 첫 번째).
- `used` set 에 등록해 `findRangeTokenIndex` 가 year 토큰을 range 로 오인하지 않도록 (`isStructuralToken` 에서 `YEAR_PATTERN.test` 가 이미 거르고 있어 안전망 정도).

### 테스트 갱신

`lib/pdf/__tests__/filenameMeta.test.ts` 의 4개 케이스 모두 `[2025]` 토큰 포함 → 각 expect / toMatchObject 에 `year: 2025` 추가.

```ts
expect(...).toEqual({
  school: "강북고",
  grade: 2,
  year: 2025,                  // ← 추가
  subject: "수학 II",
  ...
});
```

`toMatchObject` 사용 케이스 (`:20`, `:32`, `:44`) 는 그대로 둬도 통과하지만 명시적으로 `year: 2025` 추가.

### 추가 테스트 (선택)

연도 없는 파일명 케이스:
```ts
it("returns undefined year when filename has no year token", () => {
  expect(parseExamMetaFromFilename("[강북고][수2][지수-삼각함수].pdf"))
    .toMatchObject({ school: "강북고", subject: "수학 II" });
  // year 는 undefined 로 남음
});
```

## 체크리스트

- [x] `parseExamMetaFromFilename` 에 `parsed.year = Number(part)` 캡처 로직 추가 (첫 매칭만)
- [x] `used` set 에 yearTokenIndex 등록
- [x] 4개 기존 테스트 (`:7`, `:19`, `:32`, `:44`) 의 expect 에 `year: 2025` 추가
- [x] 연도 없는 파일명 fallback 테스트 1개 추가 (선택)
- [x] `npx vitest run ngd-studio/lib/pdf/__tests__/filenameMeta.test.ts --reporter=basic` 통과

## 영향 범위

- `app/create/page.tsx:151` `parsed = parseExamMetaFromFilename(fileName)` 사용처에서 `parsed.year` 가 자동으로 폼 prefill 되어야 함 → phase-02 의 폼 prefill 로직이 spread 패턴이면 별도 변경 불필요. spread 가 아니라 명시적 필드 매핑이면 phase-02 에서 처리해야 함 (양쪽 phase 가 독립적으로 진행되어도 phase-02 가 spread 면 자동 동작).
- 다른 호출처 없음 (`parseExamMetaFromFilename` 은 create page 한 곳).

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio/ngd-studio
npx vitest run lib/pdf/__tests__/filenameMeta.test.ts --reporter=basic
```

→ 모든 케이스 통과 + 새로 추가한 케이스 통과.

## 실행 결과

### 1회차 (2026-05-21 02:44 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-haiku-4-5

#### 요약
`parseExamMetaFromFilename` 함수에서 year 토큰을 캡처하는 로직을 추가했습니다. YEAR_PATTERN을 이용해 첫 매칭되는 연도만 사용하고 used set에 등록해 다른 파싱과 중복을 방지합니다. 4개 기존 테스트에 year: 2025를 추가하고 연도 없는 파일명 케이스를 추가로 검증했습니다.

#### 변경 파일
- `ngd-studio/lib/pdf/filenameMeta.ts` (수정, +4/-0줄) — year 캡처 로직 추가
- `ngd-studio/lib/pdf/__tests__/filenameMeta.test.ts` (수정, +10/-4줄) — 4개 테스트 + 연도 없는 파일명 테스트

#### 검증 결과
- [x] vitest 테스트: `npx vitest run lib/pdf/__tests__/filenameMeta.test.ts --reporter=basic` → pass (5 tests passed)
  - 기존 4개 케이스 (with year: 2025)
  - 신규 1개 케이스 (연도 없는 파일명)

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 scope files edited (filenameMeta.ts, filenameMeta.test.ts) + PHASE_FILE self-edits. No out-of-scope writes.

#### Verification Re-run (orchestrator)
exit 0 — vitest 5 tests passed (filenameMeta.test.ts).
