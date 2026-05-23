---
phase: 1
title: ExamMeta 단일 타입 (camelCase 컨트랙트)
status: in_progress
depends_on: []
scope:
  - ngd-studio/lib/exam/meta.ts
  - ngd-studio/server/stages/examData.ts
  - ngd-studio/server/stages/orchestrator.ts
  - ngd-studio/server/sse.ts
  - ngd-studio/lib/useJobRunner.ts
  - ngd-studio/lib/store.ts
  - ngd-studio/components/upload/MetaForm.tsx
  - ngd-studio/server/stages/prompts/extractorPrompt.ts
  - ngd-studio/server/stages/prompts/solverPrompt.ts
  - ngd-studio/server/stages/prompts/verifierPrompt.ts
  - ngd-studio/app/api/v3cache-meta/route.ts
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: ""
e2e_refs:
  - create-v4-full-pipeline
e2e_triggers: []
---

# Phase 1: ExamMeta 단일 타입 (camelCase 컨트랙트)

> **범위**: Both
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `ngd-studio/lib/exam/meta.ts` (신설) + 10개 consumer

## 배경

현재 `ExamMeta` 형식이 **inline으로 11곳에 중복 선언**되어 있다:
- `server/stages/examData.ts:35-53` (ExamMetaInput — snake+camel dual alias)
- `server/sse.ts:291` (body.meta inline 타입)
- `lib/useJobRunner.ts:49` (startJob 시그니처)
- `lib/store.ts:26-32` (V3Meta)
- `components/upload/MetaForm.tsx:9-15` (MetaValue)
- `server/stages/prompts/{extractorPrompt,solverPrompt,verifierPrompt}.ts` (각자 examMeta inline)
- `app/api/v3cache-meta/route.ts:11-18` (MetaResult)
- `server/stages/checker.ts:124` (schoolLevel만 부분)
- `lib/pdf/filenameMeta.ts:78-80` (filename parser 결과)

같은 개념인데 필드 alias / optional 여부 / fallback 기본값이 미묘하게 다름. 새 컨트랙트(camelCase 통일)를 적용하려면 단일 타입부터 만들어야 한다.

## 설계

### 1) `ngd-studio/lib/exam/meta.ts` 신설

```ts
export type SchoolLevel = "중" | "고";

/** 시험지 메타데이터 — 디스크/네트워크/메모리 단일 표준 (camelCase only). */
export interface ExamMeta {
  schoolLevel: SchoolLevel;
  school: string;
  grade: number;
  year: number;
  subject: string;
  semester: string;
  examType: string;
  range: string;
  /** subject 코드(파일명용). 미지정 시 buildFilenameBase가 subject로 폴백. */
  subjectCode?: string;
  /** 지역 코드(파일명용). 빈 문자열 허용. */
  region?: string;
  /** 작업자 코드(파일명용). */
  code?: string;
  /** 교과서명(선택). */
  textbook?: string;
  /** 총 페이지수(선택). */
  totalPages?: number;
  /** 빌더가 생성한 파일명 prefix. buildFilenameBase의 결정적 출력. */
  filenameBase?: string;
}

/** 부분 입력 — POST body / 폼 상태 등에서 점진적으로 채워질 때 사용. */
export type ExamMetaInput = Partial<ExamMeta>;

/** 필수 필드 7개가 채워졌는지 검사. UI submit gating용. */
export function isExamMetaComplete(m: ExamMetaInput): m is ExamMeta {
  return Boolean(
    m.schoolLevel && m.school && m.grade && m.year &&
    m.subject && m.semester && m.examType && m.range != null
  );
}

/**
 * 결정적 파일명 prefix 생성 — `[코드][학교급][년도][학년-학기-시험][지역][학교][과목][범위][코드]`.
 * 비어있는 토큰은 빈 brackets `[]` 로 둔다 (assemble.py 폴백과 동일 규칙).
 */
export function buildFilenameBase(meta: ExamMeta): string {
  const semNum = meta.semester.includes("1학기") ? "1" : "2";
  const examCode = meta.examType.includes("중간") ? "a" : meta.examType.includes("기말") ? "b" : "c";
  const range = meta.range.replace(/\s*~\s*/g, "~");
  const subjectCode = meta.subjectCode ?? meta.subject;
  const code = meta.code ?? "";
  const region = meta.region ?? "";
  return `[${code}][${meta.schoolLevel}][${meta.year}][${meta.grade}-${semNum}-${examCode}][${region}][${meta.school}][${subjectCode}][${range}][${code}]`;
}

/** 기본 메타 — UI 폼 초기값으로 재사용. */
export const DEFAULT_EXAM_META: ExamMeta = {
  schoolLevel: "고",
  school: "",
  grade: 2,
  year: new Date().getFullYear(),
  subject: "수학 I",
  semester: "1학기",
  examType: "중간",
  range: "",
};
```

### 2) 모든 consumer에서 inline 타입 제거 → `ExamMeta` import

- `examData.ts`: `ExamMetaInput` 삭제, 새 `ExamMeta` 사용. `normalizeMeta`는 P2에서 정리하므로 이 phase에선 시그니처만 `ExamMeta` 받도록 좁힘.
- `orchestrator.ts:OrchestratorInput.meta`: `ExamMetaInput` 타입 사용 (mode=create 진입 전엔 일부 필드 비어있을 수 있음).
- `sse.ts:body.meta`: `ExamMetaInput`.
- `useJobRunner.ts:startJob`: `ExamMetaInput`.
- `store.ts:v3Meta`: `ExamMetaInput`.
- `MetaForm.tsx:MetaValue`: `ExamMeta` (UI는 isExamMetaComplete 통과 시점에 사용).
- `prompts/*.ts:examMeta`: `Partial<Pick<ExamMeta, "schoolLevel" | "school" | "grade" | ...>>`.
- `app/api/v3cache-meta/route.ts:MetaResult`: `ExamMetaInput & { found: boolean }`.

### 3) `DEFAULT_META` 통합

- `app/create/page.tsx:DEFAULT_META` 상수를 `DEFAULT_EXAM_META`로 교체.
- `loadStoredMeta()`가 sessionStorage에서 읽을 때도 `ExamMeta` shape으로 정규화.

### 4) snake_case 키 제거는 P2에서

이 phase에선 **타입만 일원화**. `examData.ts:normalizeMeta`의 dual emit / `school_level`/`exam_type` write는 P2에서 제거. 그 동안 디스크 키는 변경 없음.

## 체크리스트
- [x] `ngd-studio/lib/exam/meta.ts` 신설 — `ExamMeta`, `ExamMetaInput`, `isExamMetaComplete`, `buildFilenameBase`, `DEFAULT_EXAM_META`, `SchoolLevel` 모두 export
- [ ] 10개 consumer 파일에서 inline meta 타입 선언 제거하고 `@/lib/exam/meta` import로 교체 (scope 목록 전체)
- [ ] `app/create/page.tsx:DEFAULT_META`를 `DEFAULT_EXAM_META`로 대체, `MetaValue` 타입 import 정합
- [ ] `examData.ts:normalizeMeta` 시그니처를 `ExamMeta`로 좁히되 본문(dual emit)은 P2에서 정리하므로 이 phase에선 보존
- [ ] `npx tsc --noEmit` 통과 (ngd-studio 디렉터리)
- [ ] `npx vitest run ngd-studio/lib/__tests__/ ngd-studio/server/stages/__tests__/ --reporter=basic` 전체 통과
- [ ] `grep -rn "schoolLevel?:\|examType?:\|school_level?:\|exam_type?:" ngd-studio --include="*.ts" --include="*.tsx"` 결과가 `lib/exam/meta.ts` 외에 0건

## 영향 범위

- 동작 변경 없음 — **타입 누수만 정리**.
- 디스크에 쓰는 키는 P2까지 dual alias 유지 (snake+camel 둘 다).
- 호출처가 많아 변경 면적은 크지만 시그니처는 호환되므로 컴파일러가 누락을 잡아준다.

## 검증

```bash
cd ngd-studio
npx tsc --noEmit
npx vitest run --reporter=basic
```

manual:
```bash
# inline meta 타입 잔존 검색
grep -rn "schoolLevel?:\s*\"중\"" ngd-studio --include="*.ts" --include="*.tsx" | grep -v "lib/exam/meta.ts"
# 결과 0건이어야 함
```
