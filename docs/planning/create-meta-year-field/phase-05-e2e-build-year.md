---
phase: 5
title: e2e — fixture 빌드로 비-현재 연도 머릿말/파일명 검증
status: completed
depends_on: [2, 3, 4]
scope:
  - ngd-studio/server/stages/examData.ts
  - assemble.py
  - resources/hwpx_base/header_area_template.xml
intervention_likely: true
intervention_reason: "build_hwpx.py 실제 실행 + 출력 ZIP 검증, fixture exam_data.json 준비"
executor: sonnet
load_bearing: "fixture exam_data.json (info.year=2024) 빌드 후 section0.xml 의 '2024년' 문자열 + 출력 파일명 [2024] 토큰 확인이 핵심 — 이 두 검증이 통과해야 hwpx 빌드 자동화 연결이 검증됨"
e2e_refs: [create-v4-full-pipeline, build-hwpx-cli]
e2e_triggers: [create-v4-full-pipeline, build-hwpx-cli]
---

# Phase 5: e2e — fixture 빌드로 비-현재 연도 머릿말/파일명 검증

> **범위**: Build chain (검증 only, 코드 변경 없음)
> **난이도**: M
> **의존성**: Phase 2, 3, 4
> **영향 파일**: 없음 (검증 목적)

## 배경

phase-01 ~ phase-04 가 UI/parser/prompts 까지 year 를 흘려보내지만, **빌드 산출물에 실제로 박히는지는 별도 검증** 필요. `assemble.py:267` 의 머릿말 치환과 `examData.ts:81` / `assemble.py:500-508` 의 파일명 조립이 정확하게 동작하는지 fixture 로 확인.

## 설계

### Step 1: fixture exam_data.json 준비

기존 outputs/ 디렉터리에서 작은 완성본 1개를 골라 복사 후 `info.year = 2024` 로 수정하거나, 최소 fixture 직접 작성:

```json
{
  "info": {
    "school": "테스트고",
    "grade": 2,
    "year": 2024,
    "subject": "수학 II",
    "semester": "1학기",
    "exam_type": "중간",
    "range": "수열의 극한",
    "code": "99999",
    "region": "서울",
    "subject_code": "수2"
  },
  "problems": [
    {
      "number": 1,
      "type": "selection",
      "stem": "테스트 문제",
      "choices": ["1", "2", "3", "4", "5"],
      "answer": 1,
      "endnote": "테스트 미주",
      "topic": "테스트 단원",
      "difficulty": "중"
    }
  ]
}
```

`outputs/_fixtures/year-2024-test/exam_data.json` (또는 임시 `/tmp` 경로) 에 저장.

### Step 2: 빌드 실행

```bash
cd /Users/junhyukpark/ngd/ngd-studio
python3 build_hwpx.py outputs/_fixtures/year-2024-test/exam_data.json outputs/_fixtures/year-2024-test
```

### Step 3: 검증

```bash
# 출력 파일 식별
cd outputs/_fixtures/year-2024-test
HWPX=$(ls *.hwpx | head -1)
echo "Output: $HWPX"

# 파일명에 [2024] 토큰 포함 확인
[[ "$HWPX" == *"[2024]"* ]] && echo "✓ filename has [2024]" || echo "✗ filename missing [2024]"

# section0.xml 추출 후 머릿말 확인
unzip -p "$HWPX" Contents/section0.xml | grep -o "2024년" | head -1
# → "2024년" 출력되면 OK
```

### Step 4: 현재 연도(2026) 회귀 검증

같은 fixture 에서 `info.year` 만 2026 으로 바꿔 재빌드 → 출력 파일명 `[2026]`, section0.xml `"2026년"` 확인.

### Step 5: cleanup

fixture 디렉터리 삭제 또는 `.gitignore` 처리. 영구 회귀 fixture 가 필요하면 commit, 일회성 검증이면 삭제.

## 체크리스트

- [x] fixture `exam_data.json` 작성 (info.year=2024, 최소 problem 1개)
- [x] `python3 build_hwpx.py <fixture> <out>` exit 0
- [x] 출력 hwpx 파일명에 `[2024]` 토큰 포함 확인
- [x] `unzip -p <hwpx> Contents/section0.xml | grep "2024년"` 매칭 1개 이상
- [x] info.year=2026 으로 재빌드 → 파일명 `[2026]` + section0.xml `"2026년"` 확인 (회귀 검증)
- [x] fix_namespaces.py 후처리 통과 (`zipfile.ZipFile(...).testzip()` 통과)
- [x] fixture 정리 (삭제 또는 `outputs/_fixtures/` 를 `.gitignore` 에 추가)

## 영향 범위

- 코드 변경 없음. 빌드 chain 의 read-only 검증.
- 검증 실패 시 (가능성):
  - 머릿말 누락: `header_area_template.xml` 의 `{{YEAR_SEMESTER}}` placeholder 가 사라졌거나 `assemble.py:267` 의 치환 로직 변경 → phase-01 audit 필요
  - 파일명 누락: `examData.ts:79-86` 의 `filename_base` 조립이 `meta.year` 를 누락 → phase-01 audit 필요
- 실패 시 e2e-audit-<ts>.md 자동 생성 (phase-e2e 가 처리).

## 검증

```bash
cd /Users/junhyukpark/ngd/ngd-studio
mkdir -p outputs/_fixtures/year-2024-test
# fixture exam_data.json 작성 후
python3 build_hwpx.py outputs/_fixtures/year-2024-test/exam_data.json outputs/_fixtures/year-2024-test
HWPX=$(ls outputs/_fixtures/year-2024-test/*.hwpx | head -1)
echo "Output: $HWPX"
[[ "$HWPX" == *"[2024]"* ]] && echo "✓ filename has [2024]" || echo "✗ filename missing [2024]"
unzip -p "$HWPX" Contents/section0.xml | grep -c "2024년"
# expect ≥ 1
```

## 실행 결과

### 1회차 (2026-05-21 02:59 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
`outputs/_fixtures/year-2024-test/exam_data.json` (info.year=2024) fixture를 작성 후 `python3 build_hwpx.py` 실행. 출력 HWPX 파일명에 `[2024]` 토큰이 포함되고 `Contents/section0.xml` 내 "2024년" 문자열이 1개 존재함을 확인. info.year=2026 회귀 검증도 통과. ZIP 무결성(`testzip()`) 양쪽 모두 PASS. `.gitignore`에 이미 `outputs/`가 등록되어 fixture가 자동으로 git 제외됨.

#### 변경 파일
- `outputs/_fixtures/year-2024-test/exam_data.json` (신규, fixture — git 추적 제외)
- `outputs/_fixtures/year-2026-test/exam_data.json` (신규, fixture — git 추적 제외)

#### 검증 결과
- [x] fixture 작성 (info.year=2024): `outputs/_fixtures/year-2024-test/exam_data.json` 생성 → pass
- [x] 빌드 exit 0: `python3 build_hwpx.py outputs/_fixtures/year-2024-test/exam_data.json outputs/_fixtures/year-2024-test` → pass
- [x] 파일명 `[2024]` 토큰: `[[ "$HWPX" == *"[2024]"* ]]` → ✓ filename has [2024]
- [x] section0.xml "2024년" 매칭: `unzip -p ... | grep -c "2024년"` → 1 (≥1 pass)
- [x] 회귀 검증 (year=2026): 파일명 `[2026]` + section0.xml "2026년" count=1 → pass
- [x] ZIP 무결성: `zipfile.ZipFile(...).testzip()` → PASS (2024/2026 양쪽)
- [x] fixture 정리: `.gitignore`에 `outputs/` 기등록 → 별도 추가 불필요

#### 추가 발견사항
- 최소 fixture 작성 시 `score`, `parts` 필드가 필수임을 확인 (phase 스펙 fixture 예시에는 미포함). 빌드 실패 시 에러메시지가 명확해 즉시 수정 가능.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — scope 파일(examData.ts, assemble.py, header_area_template.xml) **무수정** 확인 (검증 only phase 의도와 일치). 워커는 spec Step 1 지시대로 `outputs/_fixtures/year-{2024,2026}-test/exam_data.json` 만 생성 — outputs/ 는 `.gitignore` 처리되어 커밋 오염 없음. PHASE_FILE self-edit 외 source 변경 0건.

#### Verification Re-run (orchestrator)
exit 0 — 출력 HWPX 파일명 `[2024]` 토큰 확인, section0.xml `grep -c "2024년"` = 1. 회귀 검증 (2026) 도 워커 보고와 일치.
