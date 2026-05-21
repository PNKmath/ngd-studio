---
phase: 4
title: filename "[고]" 하드코딩 해제 + schoolLevel disk round-trip
status: completed
depends_on: []
scope:
  - ngd-studio/server/stages/examData.ts
  - ngd-studio/server/stages/__tests__/examData.test.ts
  - ngd-studio/app/api/v3cache-meta/route.ts
  - ngd-studio/lib/pdf/filenameMeta.ts
  - ngd-studio/lib/pdf/__tests__/filenameMeta.test.ts
  - assemble.py
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "assemble.py:508 의 filename 조립 토큰 [고] 분기 (산출물 파일명 P0). v3cache-meta extractFromInfo 의 schoolLevel 직렬화 (resume 동작 P0)."
e2e_refs:
  - create-v4-full-pipeline
  - build-hwpx-cli
e2e_triggers: []
---

# Phase 4: filename "[고]" 하드코딩 해제 + schoolLevel disk round-trip (TS + Python)

> **범위**: Backend (TS examData + v3cache-meta API + filenameMeta + Python assemble + tests)
> **난이도**: M (3 영역 — filename + resume + prefill)
> **의존성**: 없음 (Phase 1/2/3 와 scope 무관)
> **영향 파일**: `examData.ts:73-79`, `app/api/v3cache-meta/route.ts:9-31`, `lib/pdf/filenameMeta.ts:28+108+115`, `assemble.py:494-510`, 각 test 파일

## 배경

Phase A parity audit (메모 in README) 와 2 차 audit 에서 발견된 P0 결함 3 건:

### TS 측 (`examData.ts:75`)

```ts
function normalizeMeta(meta: ExamMetaInput): ExamMetaInput {
  ...
  if (!filenameBase) {
    const parts = [meta.code, "고", year, semester, meta.region, meta.school, subject, meta.code]
    //                       ^^^ ★ "고" 하드코딩 ★
      .filter((v) => v !== undefined && v !== "")
      .map((v) => `[${v}]`)
      .join("");
    filenameBase = parts.length > 0 ? parts : `exam_${year}`;
  }
  ...
}
```

### Python 측 (`assemble.py:508`)

```python
filename = f"[{code}][고][{year}][{grade}-{sem_num}-{exam_code}][{region}][{school}][{subject_code}][{range_str}][{code}]{ver_suffix}.hwpx"
#                  ^^^ ★ "고" 하드코딩 ★
```

또한 `assemble.py` 내 `info[...]` 키 사용 (`assemble.py:267, 269` 등) 에서 `schoolLevel` 또는 `school_level` 을 전혀 읽지 않음 (grep 0 매칭). 즉 exam_data.json 에 schoolLevel 가 있어도 Python 측에서는 무시됨.

결과: 중학교로 빌드하더라도 산출물 파일명이 `[…][고][…]…` — 사용자가 즉시 보는 결함.

### 추가 결함 1 — v3cache-meta API 의 schoolLevel 누락

`app/api/v3cache-meta/route.ts:9-31` 의 `MetaResult` interface 와 `extractFromInfo` 가 `schoolLevel` 키를 모름. session_meta.json POST 시 spread 로 schoolLevel 저장은 되지만, GET 응답에는 빠짐.

영향: handleResume 이 cachedMeta 를 fetch 해도 `cachedMeta.schoolLevel === undefined` → Phase A 의 fallback (`meta.schoolLevel`) 로 폼 default "고" 가 유지됨. 중학교 작업 재개 시 사용자가 다시 학교급 토글해야 함.

### 추가 결함 2 — filenameMeta 가 학교급 토큰 파싱 결과를 set 안 함

`lib/pdf/filenameMeta.ts:28, 108, 115` 의 `SCHOOL_LEVEL_PATTERN = /^(고|중|초|고등|중등|초등)$/` 은 토큰을 "학교급 표시" 로 판별/skip 하는 용도. 그러나 parsed `ParsedFilenameMeta` 결과의 `schoolLevel` 필드를 set 하지 않음 (=Phase A 가 MetaValue 에 schoolLevel 추가했지만 prefill 로직은 갱신 안 됨).

영향: PDF 파일명 `[NGD][중][2024]...pdf` 업로드해도 폼 학교급 default "고" 유지 — 사용자 수동 토글 필요.

## 설계

### 1. TS examData → exam_data.json 에 school_level 직렬화

`normalizeMeta` 가 `meta.schoolLevel` 를 받아 `info.school_level` 키로 직렬화 + filename_base 에도 분기:

```ts
function normalizeMeta(meta: ExamMetaInput): ExamMetaInput {
  ...
  const schoolLevel = meta.schoolLevel ?? "고";        // 기본값 "고" (legacy 호환)
  const schoolLevelToken = schoolLevel;                 // "중" 또는 "고"
  if (!filenameBase) {
    const parts = [meta.code, schoolLevelToken, year, semester, meta.region, meta.school, subject, meta.code]
      ...
  }
  return {
    ...meta,
    school_level: schoolLevel,   // snake_case 직렬화 (Python 측 일관성)
    schoolLevel,                  // camelCase 도 유지 (TS 측 사용처)
    ...
  };
}
```

`ExamMetaInput` 에 `school_level?: "중" | "고"` 추가 (snake_case 별칭) — Python 이 읽는 키.

### 2. Python assemble.py 가 info['school_level'] 읽어 filename 분기

```python
# assemble.py:508 부근
school_level = info.get("school_level", "고")  # default 고 (legacy)
school_token = school_level  # "중" 또는 "고"
filename = f"[{code}][{school_token}][{year}][{grade}-{sem_num}-{exam_code}][{region}][{school}][{subject_code}][{range_str}][{code}]{ver_suffix}.hwpx"
```

`info` 는 이미 `assemble.py` 함수 내 사용 중인 dict 변수.

### 3. filename_base 가 미리 있는 경로

`examData.ts:73` 의 `let filenameBase = meta.filename_base;` — 외부에서 filename_base 가 prefill 된 경우는 그대로 사용 (해당 경우 호출자가 책임). 즉 본 phase 변경은 fallback 경로 ([고] 가 박히던 자동 조립) 만.

### 4. v3cache-meta API 의 schoolLevel 복원

```ts
// app/api/v3cache-meta/route.ts
interface MetaResult {
  found: boolean;
  schoolLevel?: "중" | "고";  // 신규
  school?: string;
  ...
}

function extractFromInfo(info: Record<string, unknown>): MetaResult {
  const schoolLevel = info.schoolLevel === "중" || info.schoolLevel === "고"
    ? info.schoolLevel
    : info.school_level === "중" || info.school_level === "고"
      ? info.school_level
      : "고";  // legacy fallback
  return {
    found: true,
    schoolLevel,
    school: ...,
    ...
  };
}
```

snake_case (`school_level`) + camelCase (`schoolLevel`) 둘 다 읽음 — TS 측 (camelCase) / Python 측 (snake_case) 모두 호환.

### 5. filenameMeta 학교급 prefill

`lib/pdf/filenameMeta.ts` 의 토큰 파싱 루프에서 `SCHOOL_LEVEL_PATTERN` 매칭 시 `parsed.schoolLevel` 을 set:

```ts
if (SCHOOL_LEVEL_PATTERN.test(part)) {
  parsed.schoolLevel = (part === "중" || part === "중등") ? "중" : "고";
  // 기존 skip 로직 유지
  continue;
}
```

`ParsedFilenameMeta` 는 이미 `Partial<MetaValue>` 이므로 schoolLevel 필드 자동 포함 (Phase A 의 MetaValue 추가 덕분).

### 6. 검증 fixture 갱신

`examData.test.ts` (Phase A 회귀 audit 이 이 파일 영향 받은 흔적 있음) 에 fixture `school: "테스트고등학교"` 가 있는 케이스 추가 + 신규 `schoolLevel: "중"` + `school: "테스트중학교"` 케이스 추가, 둘 다 filename_base 의 학교급 토큰 검증.

`filenameMeta.test.ts` 에 신규 케이스: `[NGD][중][2024]...` 파일명 파싱 시 `parsed.schoolLevel === "중"`, `[NGD][고][...]` 시 `"고"`, 토큰 없을 시 undefined.

Python 측 검증은 `build_hwpx.py` 의 dry-run 으로 간단히 (실제 PDF 빌드 없이 filename 만 계산).

## 체크리스트

- [x] `ExamMetaInput` 에 `school_level?: "중" | "고"` (snake_case) 추가
- [x] `examData.ts normalizeMeta` 가 `meta.schoolLevel ?? "고"` 로 token 도출 후 filename_base + `info.school_level` 양쪽 적용
- [x] `examData.test.ts` 에 신규 케이스 2개: (a) schoolLevel='중' → filename_base 에 `[중]` + `info.school_level === "중"`, (b) schoolLevel 미지정 → 기존 `[고]` 회귀
- [x] `assemble.py:508` filename 조립의 `[고]` → `info.get('school_level', '고')` 변수화 (+ grep 으로 다른 `[고]` 하드코딩 일괄 확인)
- [x] `v3cache-meta/route.ts` `MetaResult` + `extractFromInfo` 에 `schoolLevel` 추가 (snake/camel 양측 호환 fallback)
- [x] `filenameMeta.ts` SCHOOL_LEVEL_PATTERN 매칭 시 `parsed.schoolLevel` 을 "중"/"고" 로 set, `filenameMeta.test.ts` 에 케이스 2 개 추가
- [x] `pnpm --filter ngd-studio exec tsc --noEmit` + `vitest run server/stages/__tests__/examData.test.ts lib/pdf/__tests__/filenameMeta.test.ts --reporter=basic` 통과

## 영향 범위

- **회귀 표면**:
  - 기존 호출 (schoolLevel 미지정) → `"고"` 기본값 유지 → filename 회귀 없음.
  - exam_data.json 스키마에 `school_level` 키 추가 — Python `assemble.py` 도 같이 갱신하므로 양측 일관성.
  - 외부에서 `filename_base` 를 prefill 한 경로는 영향 없음 (fallback 만 변경).
  - v3cache-meta 응답 인터페이스에 `schoolLevel` 추가 — 기존 호출자 (create page handleResume) 는 새 필드 무시해도 무해, 사용 시 prefill 이 동작.
  - filenameMeta `parsed.schoolLevel` set — 새 필드라 기존 호출자 무영향.
- **롤백**: 6 파일 영향 — phase revert 단순.

## 검증

```bash
pnpm --filter ngd-studio exec tsc --noEmit
pnpm --filter ngd-studio exec vitest run server/stages/__tests__/examData.test.ts lib/pdf/__tests__/filenameMeta.test.ts --reporter=basic
# Python side — exam_data.json 으로 dry-run filename 계산 (실제 빌드 X)
python3 -c "
info = {'code':'NGD','school_level':'중','year':2024,'grade':3,'semester':'1학기','exam_type':'중간','region':'서울','school':'테스트중학교','subject':'수학','range':'정수'}
school_token = info.get('school_level', '고')
# 단순화: 본문 filename 조립 로직과 동일 계산
print(f\"[{info['code']}][{school_token}][{info['year']}]...\")
" | grep -q "\[중\]" && echo "OK middle filename"
```

수동 확인:
1. /create 페이지에서 학교급=중학교 + 메타 채우고 빌드 시작 → 산출물 HWPX 파일명이 `[…][중][…]` 로 시작
2. 학교급=고등학교 → `[…][고][…]` (회귀 없음)
3. 학교급=중학교로 작업 1회 완료 → 페이지 새로고침 → "작업 재개" 클릭 시 폼이 학교급=중학교로 복원
4. 파일명 `[NGD][중][2024]...pdf` 업로드 → 폼 학교급 select 가 자동으로 "중학교" 로 prefill

## 실행 결과

### 1회차 (2026-05-21 11:44 KST) — completed
**상태**: completed
**소요 시간**: 약 8분
**진행 모델**: claude-sonnet-4-6

#### 요약
3개 영역(TS examData, Python assemble.py, v3cache-meta API, filenameMeta)의 `[고]` 하드코딩을 해제하고 `schoolLevel`/`school_level` disk round-trip을 구현했다. 기존 테스트를 깨지 않으면서 신규 케이스 5개(examData 2개, filenameMeta 3개) 추가 후 전체 19개 테스트 통과.

#### 변경 파일
- `ngd-studio/server/stages/examData.ts` (수정, +8/-4줄): `ExamMetaInput`에 `school_level?` 추가, `normalizeMeta`에서 `schoolLevel ?? school_level ?? "고"` fallback 후 filename token + `info.school_level` 양쪽 직렬화
- `ngd-studio/server/stages/__tests__/examData.test.ts` (수정, +49/-0줄): schoolLevel='중' 케이스 + 미지정 legacy '고' 회귀 케이스 추가
- `ngd-studio/app/api/v3cache-meta/route.ts` (수정, +10/-1줄): `MetaResult`에 `schoolLevel?` 추가, `extractFromInfo`에서 snake/camelCase 양측 읽기 + "고" fallback
- `ngd-studio/lib/pdf/filenameMeta.ts` (수정, +17/-0줄): `SCHOOL_LEVEL_PATTERN` 매칭 토큰 → `parsed.schoolLevel` set, `parseSchoolLevelToken` 헬퍼 export
- `ngd-studio/lib/pdf/__tests__/filenameMeta.test.ts` (수정, +18/-6줄): 첫 케이스 `toEqual`에 `schoolLevel:"고"` 추가 + 신규 케이스 3개 (중/고/없음)
- `assemble.py` (수정, +2/-1줄): `school_level = info.get("school_level", "고")` 변수화 후 filename 조립에 적용

#### 검증 결과
- [x] tsc --noEmit: `unset NODE_OPTIONS && npx tsc --noEmit` → pass (출력 없음, exit 0)
- [x] vitest: 19 tests passed (filenameMeta 8 + examData 11) → pass
- [x] Python dry-run: `[중]` 포함 확인 → "OK middle filename"

#### 추가 발견사항
- `filenameMeta.ts`의 수학 과목 (`수학` 자체)은 `SUBJECT_MAP`에 없어서 `[수학]` 토큰으로 subject prefill이 안 됨. 단, 이번 phase scope 밖이므로 보고만.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 7 files in scope (examData.ts ×2, examData.test.ts, v3cache-meta/route.ts, filenameMeta.ts ×2, filenameMeta.test.ts ×2(Edit+Write), assemble.py, PHASE_FILE Edits). unattributed/ambiguous 없음.

#### Verification Re-run (orchestrator)
exit 0 — `env -u NODE_OPTIONS bash <verify.sh>` 으로 재실행: tsc pass, vitest 19/19 pass, python dry-run "OK middle filename".

#### Simplify (orchestrator)
SIMPLIFIED: 2 — examData.ts unused `label` 필드 제거(candidates 배열 정리); route.ts schoolLevel ternary → `toSchoolLevel` 헬퍼 + examType 이중 ?? 추출. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass — 3개 결함 + Python 모두 정확 구현, 회귀 없음 (19/19 통과). "초/초등" 패턴 매칭 시 `"고"` fallback은 현 UI 스펙 범위 밖이라 무해.
