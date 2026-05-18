---
phase: 3
title: SKILL.md Step 6/8 정리 + 하드코딩 경로 제거
status: completed
depends_on: [1]
scope:
  - .claude/skills/ngd-exam-create/SKILL.md
  - docs/hwpx-templates.md
  - docs/builder-upgrade-todo.md
intervention_likely: false
intervention_reason: ""
---

# Phase 3: SKILL.md Step 6/8 정리 + 하드코딩 경로 제거

> **범위**: Documentation (.claude + docs)
> **난이도**: S
> **의존성**: Phase 1 (신규 경로 확정 후 안내 문구 갱신)
> **영향 파일**: `SKILL.md`, `docs/hwpx-templates.md`, `docs/builder-upgrade-todo.md`

## 배경

`SKILL.md`는 ngd-exam-create skill의 행동 매뉴얼. Step 6/7/8에서 Claude가 `python3 build_hwpx.py ...`를 직접 호출하도록 지시한다 (`SKILL.md:620-635`). 이는:

1. **LLM이 build를 트리거하는 잔재 경로** — 본 작업의 제거 대상
2. **경로 하드코딩 `/mnt/c/NGD/...`** — WSL 전용, 크로스플랫폼 위반

또한 `docs/hwpx-templates.md:167`에 `BASE = ".claude/skills/ngd-exam-create/base_hwpx"` 안내가 있어 Phase 1 이동 후 stale 상태가 된다. `docs/builder-upgrade-todo.md:56`도 같은 위치 안내.

`.claude/agents/ngd-exam-builder.md`도 같은 하드코딩 경로를 포함하나, **이 agent의 archive 여부 결정은 이번 task 종료 후 사용자 판단**이므로 본 phase에서는 경로 문구만 신규 경로로 갱신하고 archive는 보류.

## 설계

### SKILL.md 변경

**Step 6 (line 618-639) — "HWPX 조립" 섹션**:

기존:
```python
Bash(f"python3 /mnt/c/NGD/build_hwpx.py {JSON_PATH} {OUTPUT_DIR}")
Bash(f"python3 /mnt/c/NGD/.claude/skills/ngd-exam-create/scripts/fix_namespaces.py <hwpx_path>")
Bash(f"python3 /mnt/c/NGD/.claude/skills/ngd-exam-create/scripts/validate.py --fix <hwpx_path>")
```

변경:
```
### Step 6: Phase 2 — HWPX 조립

이 단계는 **호스트 시스템(sse.ts)이 deterministic builder runner를 자동 실행**한다. Claude는 직접 build/fix/validate를 호출하지 않는다. exam_data.json 작성 완료 후 종료하면, 호스트가 다음을 순차 실행한다:

1. `python3 build_hwpx.py <exam_data.json> outputs/`
2. `python3 resources/hwpx_scripts/fix_namespaces.py <hwpx>`
3. `python3 resources/hwpx_scripts/validate.py --fix <hwpx>`

실패 시 호스트가 status=failed를 보고하고 작업을 중단한다. Claude가 재시도하지 않는다.
```

**Step 8 (line 653-658) — checker 피드백 루프**:

기존: "내용 누락 / 순서 오류 → exam_data.json 수정 후 Step 6 재실행"

변경: "내용 누락 / 순서 오류 → exam_data.json 수정 후 종료. 호스트가 deterministic builder를 자동 재실행한다."

### `/mnt/c/NGD/...` 하드코딩 제거

`SKILL.md` 전체에서 `/mnt/c/NGD/...` 경로를 검색해 모두 상대경로(`build_hwpx.py`, `resources/hwpx_scripts/...`)로 갱신.

### `docs/hwpx-templates.md:167` 갱신

```
BASE = ".claude/skills/ngd-exam-create/base_hwpx"
```
→
```
BASE = "resources/hwpx_base"  # 또는 env(NGD_HWPX_BASE) override
```

### `docs/builder-upgrade-todo.md:56` 갱신

`.claude/skills/ngd-exam-create/base_hwpx/` → `resources/hwpx_base/`

## 체크리스트

- [x] `SKILL.md` Step 6 (line 618-639) — build 3-Bash 호출 제거, "호스트가 자동 실행" 안내로 교체
- [x] `SKILL.md` Step 8 (line 653-658) — checker 피드백 루프에서 "Step 6 재실행" → "exam_data.json 수정 후 종료" 갱신
- [x] `SKILL.md` 전체에서 `/mnt/c/NGD/...` 하드코딩 경로 제거 (grep으로 확인)
- [x] `docs/hwpx-templates.md`, `docs/builder-upgrade-todo.md` 의 base_hwpx 위치 안내를 `resources/hwpx_base/`로 갱신

## 영향 범위

- SKILL.md는 legacy 경로(`useCodeOrchestrator=false`)에서만 Claude가 읽음. 본 변경은 Phase 4의 sse.ts 합성(skill 종료 후 호스트가 build)과 정합해야 함.
- `.claude/agents/ngd-exam-builder.md`는 본 phase 범위 밖. Phase 7(없음) 또는 사용자 판단으로 보류.

## 검증

```bash
# 하드코딩 경로 제거 확인
grep -n "/mnt/c/NGD" .claude/skills/ngd-exam-create/SKILL.md
# (출력 없어야 통과)

# base_hwpx 안내 갱신 확인
grep -n "base_hwpx" docs/hwpx-templates.md docs/builder-upgrade-todo.md
# (모두 resources/hwpx_base 가리키는지 확인)

# Step 6 build Bash 호출 제거 확인
grep -n "Bash.*build_hwpx" .claude/skills/ngd-exam-create/SKILL.md
# (출력 없어야 통과)
```

## 실행 결과

### 1회차 (2026-05-18) — completed

**상태**: completed
**소요 시간**: 약 3분
**진행 모델**: claude-sonnet-4-6

#### 요약
SKILL.md Step 6의 python3 build_hwpx.py / fix_namespaces.py / validate.py 직접 Bash 호출 3개를 제거하고 "호스트가 자동 실행" 안내 텍스트로 교체했다. Step 8 checker 피드백 루프에서 "Step 6 재실행" 문구를 "exam_data.json 수정 후 종료. 호스트가 자동 재실행"으로 갱신했다. docs 2곳의 BASE 경로 안내를 `resources/hwpx_base/`로 갱신했다.

#### 변경 파일
- `.claude/skills/ngd-exam-create/SKILL.md` (수정, Step 6 대체 +7/-13줄, Step 8 +1/-1줄)
- `docs/hwpx-templates.md` (수정, line 167 BASE 경로 +1/-1줄)
- `docs/builder-upgrade-todo.md` (수정, line 56 경로 +1/-1줄)

#### 검증 결과
- [x] `grep -n "/mnt/c/NGD" SKILL.md` → 출력 없음 (pass)
- [x] `grep -n "Bash.*build_hwpx" SKILL.md` → 출력 없음 (pass)
- [x] `grep -n "resources/hwpx_base" docs/*.md` → 두 파일 모두 신규 경로 확인 (pass)

#### 추가 발견사항
`docs/hwpx-templates.md:102,104`와 `docs/builder-upgrade-todo.md:38`에 `base_hwpx/` 파일명 언급이 남아 있으나, 이는 디렉터리 위치 안내가 아닌 XML 파일명 참조이므로 변경 불필요.

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator, 1회차)
pass — SKILL.md + docs/hwpx-templates.md + docs/builder-upgrade-todo.md 모두 scope 내.

#### Verification Re-run (orchestrator, 1회차)
grep 3건 exit code 통과. 단, `base_hwpx` 잔여 3건 발견.

#### Review (orchestrator, 1회차)
VERDICT: fix_required. docs 내 stale `base_hwpx/` 3건 미갱신.

### 2회차 (2026-05-18) — completed

**상태**: completed
**진행 모델**: claude-sonnet-4-6

#### 요약
1회차에서 누락된 `docs/hwpx-templates.md:102,104`의 섹션 헤더 + 설명문 `base_hwpx/` → `resources/hwpx_base/` (2건), `docs/builder-upgrade-todo.md:38`의 `base_hwpx/bogi_table_3items.xml` → `resources/hwpx_base/bogi_table_3items.xml` (1건), 총 3건 갱신.

#### 변경 파일
- `docs/hwpx-templates.md` (수정, line 102 헤더 + line 104 설명문 `base_hwpx/` → `resources/hwpx_base/`)
- `docs/builder-upgrade-todo.md` (수정, line 38 `base_hwpx/bogi_table_3items.xml` → `resources/hwpx_base/bogi_table_3items.xml`)

#### 검증 결과
- [x] `grep -n "base_hwpx" docs/hwpx-templates.md docs/builder-upgrade-todo.md` → 출력 없음 (pass)
- [x] `grep -n "resources/hwpx_base" docs/hwpx-templates.md docs/builder-upgrade-todo.md` → 5건 모두 신규 경로 확인 (pass)

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Review (orchestrator, 2회차)
fix-required 3건 모두 해소. 재검증 pass. 사실상 pass.
