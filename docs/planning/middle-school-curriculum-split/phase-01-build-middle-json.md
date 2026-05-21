---
phase: 1
title: CSV → unit_classification_middle.json 빌드
status: completed
depends_on: []
scope:
  - scripts/build_middle_curriculum.mjs
  - .claude/data/unit_classification_middle.json
intervention_likely: false
intervention_reason: ""
executor: sonnet
load_bearing: "scripts/build_middle_curriculum.mjs 의 CSV 파싱 + 중등 N → grade N + 단원 그룹화 — 생성된 JSON 스키마가 Phase 2/3 분류 분기의 입력"
e2e_refs: []
e2e_triggers: []
---

# Phase 1: CSV → unit_classification_middle.json 빌드

> **범위**: Backend (script + data artifact)
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `scripts/build_middle_curriculum.mjs` (신규), `.claude/data/unit_classification_middle.json` (신규)

## 배경

Phase A 에서 `schoolLevel` 필드를 ExamMeta 까지 흘렸지만, extractor/checker 의 단원 매핑은 여전히 `.claude/data/unit_classification.json` (고등 전용) 만 본다. 중학교 분기를 위해 동일 스키마의 중학교 분류표가 필요.

원본 데이터는 사용자가 제공한 `ngd-studio/inputs/시험지 제작/NGD_curriculum_2022.csv` (126행). 첫 줄 columns: `교육과정,대단원코드,대단원명,중단원번호,중단원명`. 교육과정 값에는 중등1/중등2/중등3 외에도 고등(고1/수1/수2/확통/미적/기하) 도 섞여있다.

이 phase 는 **CSV → 중학교 전용 JSON** 으로 결정론적 변환만 수행 (고등 라인은 무시). Phase 2/3 가 이 JSON 을 입력으로 받음.

## 설계

### 1. 스크립트 위치

레포 루트에 `scripts/` 디렉터리가 없으므로 신규 생성 후 `scripts/build_middle_curriculum.mjs` 작성. Node 내장 모듈만 (`node:fs`, `node:path`, `node:url`) 사용 — zero deps.

CSV 파서: 간단한 split (CSV 데이터에 쉼표/따옴표 escape 없음 — 한글 텍스트만). 라인 0 = 헤더 skip.

### 2. 변환 규칙 (결정론적)

| CSV `교육과정` | 출력 grade |
|---------------|-----------|
| 중등1 | 1 |
| 중등2 | 2 |
| 중등3 | 3 |
| 그 외 (고1/수1/수2/확통/미적/기하) | **skip** (고등은 별도 JSON) |

학년별로 `subjects[]` 한 항목 생성 (`code: "중<N>"`, `name: "중학교 <N>학년"`, `grade: N`).

각 학년 내 `units[]` 는 `대단원코드` 로 그룹화. 한 코드 → 한 unit:
```json
{
  "code": "<대단원코드>",
  "name": "<대단원명>",
  "topics": ["<중단원명1>", "<중단원명2>", ...]
}
```

`중단원번호` 오름차순으로 topics 정렬 (결정론적).

### 3. 출력 JSON 스키마 (`unit_classification.json` 과 호환)

```json
{
  "version": "2022 개정교육과정 (중학교)",
  "source": "ngd-studio/inputs/시험지 제작/NGD_curriculum_2022.csv (교육과정=중등1/중등2/중등3)",
  "note": "중단원명은 이 표의 topics 값을 그대로 사용해야 한다. 임의로 변형하지 않는다.",
  "subjects": [
    {
      "code": "중1",
      "name": "중학교 1학년",
      "grade": 1,
      "units": [
        {"code": "A", "name": "소인수분해", "topics": ["소수와 합성수 및 소인수분해", "최대공약수 및 최소공배수"]},
        ...
      ]
    },
    { "code": "중2", "name": "중학교 2학년", "grade": 2, "units": [...] },
    { "code": "중3", "name": "중학교 3학년", "grade": 3, "units": [...] }
  ]
}
```

기존 `unit_classification.json` (고등) 의 `UnitClassification` TypeScript 타입(`server/stages/checker.ts:23~30`) 과 동일 스키마이므로 Phase 3 에서 같은 loader 패턴 재사용 가능.

### 4. 검증 가능성

- 스크립트 실행 후 JSON 의 topics 총 개수 == CSV 의 중등 (중등1+중등2+중등3) 행 수
- subjects[].grade 가 1/2/3 만, 길이 3
- 각 unit.code 가 같은 학년 내 unique

## 체크리스트

- [x] `scripts/` 디렉터리 신규 생성 (없으면 `mkdir -p`), `scripts/build_middle_curriculum.mjs` 작성 (zero-deps Node, ESM)
- [x] CSV 헤더 skip + 중등1/2/3 행만 추출, 대단원코드 단위 그룹화, 중단원번호 오름차순 정렬
- [x] `.claude/data/unit_classification_middle.json` 산출물 생성 (UTF-8, 들여쓰기 2 spaces, 끝에 newline)
- [x] CSV 의 중등 라인 수와 생성 JSON 의 topics 합계 일치 확인 (스크립트 stderr 에 출력)
- [x] 스크립트 재실행 시 동일 byte-for-byte JSON (결정론적 sort)

## 영향 범위

- **소비처**: Phase 2 (extractor prompt 안내 문구), Phase 3 (checker text.vocabulary 분기 + UnitClassification 로더 재사용).
- **롤백**: 두 파일만 추가되므로 phase revert 만 하면 영향 0.
- **데이터 변경 시 재실행**: NGD_curriculum_2022.csv 가 갱신되면 같은 명령 재실행으로 JSON 동기화. `package.json` script 등록은 본 phase 비범위 (필요 시 후속).

## 검증

```bash
node scripts/build_middle_curriculum.mjs
test -f .claude/data/unit_classification_middle.json
node -e "const d=require('./.claude/data/unit_classification_middle.json'); if(d.subjects.length!==3) process.exit(1); for(const s of d.subjects){ if(![1,2,3].includes(s.grade)) process.exit(2); }; console.log('ok',d.subjects.map(s=>s.units.reduce((n,u)=>n+u.topics.length,0)).reduce((a,b)=>a+b,0),'topics');"
# 두 번째 실행 시 동일 SHA (결정론 확인)
sha256sum .claude/data/unit_classification_middle.json
node scripts/build_middle_curriculum.mjs
sha256sum .claude/data/unit_classification_middle.json
```

수동 확인:
1. JSON 의 중1 첫 unit 이 `소인수분해` 인지 (CSV 첫 데이터 행과 일치)
2. JSON 의 중2 첫 unit 이 `수와 식의 계산` 인지

## 실행 결과

### 1회차 (2026-05-21 17:30 KST) — completed
**상태**: completed
**소요 시간**: 약 10분
**진행 모델**: claude-sonnet-4-6

#### 요약
`scripts/build_middle_curriculum.mjs` 를 신규 작성하고 실행하여 `.claude/data/unit_classification_middle.json` 을 생성했다. CSV 48개 중등 행을 파싱해 중1/중2/중3 3개 학년, topics 합계 48개의 JSON 산출물을 만들었다. 스크립트 재실행 시 SHA256 동일 확인(결정론적).

주요 처리 사항:
- CSV에서 중등3 대단원코드가 모두 빈 문자열 → 대단원명을 unit code 및 key로 사용
- 중등2 코드 M이 "삼각형의 성질"과 "사각형의 성질" 두 가지 이름 → 별도 unit으로 처리 (코드 M 두 개)
- CSV 48행에 따옴표로 감싼 쉼표 포함 필드("산포도 (산포도,분산,표준편차)") → RFC4180 파서로 정확히 처리

#### 변경 파일
- `scripts/build_middle_curriculum.mjs` (신규, +115줄)
- `.claude/data/unit_classification_middle.json` (신규, +208줄)

#### 검증 결과
- [x] 스크립트 실행: `env -u NODE_OPTIONS node scripts/build_middle_curriculum.mjs` → CSV 48행, topics 48개 일치 pass
- [x] JSON 구조 검증: subjects.length===3, grades [1,2,3] 모두 pass, topics 총합 48 → `ok 48 topics`
- [x] 결정론적 재실행: SHA256 `955e8e18e60307511d0ff5f51143d69d9ec1d08b94853c97da4b01db7ac1450a` 두 번 동일 → pass
- [x] 수동 확인: 중1 첫 unit = "소인수분해" ✓, 중2 첫 unit = "수와 식의 계산" ✓

#### 추가 발견사항
- 검증 명령어 `node scripts/build_middle_curriculum.mjs` 는 Claude Code 환경의 `NODE_OPTIONS` preload 모듈 이슈로 직접 실행 불가. `env -u NODE_OPTIONS` prefix 필요. 스크립트 자체 로직에는 문제 없음.
- 중등2 코드 M에 "삼각형의 성질" / "사각형의 성질" 두 unit이 중복 코드로 존재함. Phase 2/3 소비처에서 code 유일성 전제 코드가 있다면 주의 필요.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 2 files in scope (`scripts/build_middle_curriculum.mjs` Write, PHASE_FILE Edits). `.claude/data/unit_classification_middle.json` 은 Bash 실행 산출물(fs write)이라 hook 로그 미기록, 별도 검증.

#### Verification Re-run (orchestrator)
exit 0 — node 실행 + JSON 구조 검증 + SHA256 두 번 동일 (`955e8e18...d69d9ec1d08b94853c97da4b01db7ac1450a`). 환경상 `env -u NODE_OPTIONS` prefix 필요.

#### Simplify (orchestrator)
SIMPLIFIED: 1 — gradeOrder 중간 배열 제거(Object.keys 직접 사용), 미사용 header 변수 제거, gradeData 초기화 one-liner. VERIFY: pass.

#### Review (orchestrator)
VERDICT: pass — 스펙 일치, 체크리스트·검증 결과 정합. RFC4180 파서 추가는 데이터 대응상 불가피. 후속 phase가 중3 unit code 중복(M)에 주의.
