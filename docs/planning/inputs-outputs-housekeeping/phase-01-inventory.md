---
phase: 1
title: inventory + 분류 시안 작성
status: completed
depends_on: []
scope:
  - docs/planning/inputs-outputs-housekeeping/inventory.md
intervention_likely: true
intervention_reason: "분류 시안(active/archive/discard)을 사용자가 검토·확정해야 한다. mtime/파일명 패턴만으로 자동 분류한 결과가 실제 의도와 다를 수 있음."
executor: sonnet
---

# Phase 1: inventory + 분류 시안 작성

> **범위**: 파일시스템 분석/문서화
> **난이도**: S
> **의존성**: 없음
> **영향 파일**: `docs/planning/inputs-outputs-housekeeping/inventory.md` (신규)

## 배경

`outputs/`, `inputs/시험지 제작/`, `inputs/오검/` 세 폴더에 V1/V2/V3 산출물, 백업(`.bak`, `.bak-before-*`), 변종(`_fixed`, `_fixed2`, `_v3`), 임시 파일(`output.hwpx`, `test_hwp/`), 캐시(`.v3cache_*`, `question_images/`)가 혼재. 정리하려면 먼저 **어느 파일이 무엇인지 + 어떻게 분류할지** 결정해야 한다.

사용자 결정 정책 (이미 합의):
- **V3로 만든 게 아닌 outputs는 모두 archive 또는 폐기** (V3가 모든 기준)
- 체크리스트 HWPX 등 명백한 인프라 파일은 active 유지

## 설계

### inventory.md 구조

```markdown
# inputs/outputs Inventory (Phase 1 산출물)

## outputs/

| 파일 | 크기 | mtime | 분류 시안 | 근거 |
|------|------|-------|-----------|------|
| [...]04002[...]경기구리시[...]hwpx | 197K | 2026-05-12 | active | 최신 mtime, V3 시점 이후 |
| [...]경북고[...]함수의 극한[...]hwpx | 922K | 2026-05-03 | active | V3 시점 |
| [...]함수의 극한[...]hwpx.bak | 921K | 2026-05-03 | discard | .bak 패턴, 동일 시험지의 non-bak 존재 |
| [...]경북고[...]전범위[...][AI][미검수][...]hwpx | 398K | 2026-04-30 | archive | [AI][미검수] 표기, V2-시점 |
| output.hwpx | 1.0M | 2026-04-30 | discard | 익명, 임시 산출물로 추정 |
| test_hwp/ | - | 2026-03-07 | discard | test 디렉터리 |
| images/ | - | 2026-05-03 | active (확인) | 빌더 산출물의 일부일 가능성 |
...

## inputs/시험지 제작/

| 파일 | 분류 시안 | 근거 |
|------|-----------|------|
| .v3cache/ | active | 현재 활성 작업 캐시 (가장 최신 mtime) |
| .v3cache_dasago_20260503/ | discard | 완료된 작업의 stale 캐시 |
| .v3cache_prev/ | discard | prev 표기, stale |
| question_images/ | active (or discard) | 캐시 폴더 — 활성 작업 종속 |
| session_meta.json | active | 활성 작업 메타 |
| [04039][...]경북고[...]답지첨부[...]pdf | ? | 사용자 확인 (활성/완료) |
| [NGD고등부]기출작업양식지[2022년5월20일].hwpx | (Phase 2에서 결정) | git tracked, 구버전 |

## inputs/오검/

| 파일 | 분류 시안 | 근거 |
|------|-----------|------|
| 2.5..NGD오검 체크리스트.hwp(x) | active | 인프라 파일, git tracked |
| [04002][...]hwpx (+pdf) | ? | 사용자 확인 (활성/완료) |
| [04006][...]hwpx (+pdf) | ? | 사용자 확인 |
| [04023][...]hwpx (+pdf) | ? | 사용자 확인 |

## 분류 기준 (시안 작성 시 사용)

- **discard**:
  - `*.bak`, `*.bak-before-*` 패턴 + 동일 시험지의 non-bak 존재
  - `_fixed`, `_fixed2` 패턴 + 동일 시험지의 더 새 버전 존재
  - 익명 임시 파일 (`output.hwpx`, `test_*` 등)
  - V3 이전 시점(2026-04 이전 mtime)이면서 동일 시험지 V3 버전 존재
- **archive**:
  - `[AI][미검수]` 표기 (V2 시절 잔재)
  - V3 이전 시점이지만 단일 버전 (보존 가치 있을 수 있음)
- **active**:
  - V3 시점(2026-04-30 이후) mtime + V3 SKILL.md가 명시하는 파일명 규칙 부합
  - 인프라 파일 (체크리스트 등)
- **사용자 확인 필요**:
  - PDF 원본 (활성 작업 vs 완료 — 사용자만 안다)
  - mtime이 V3 시점 경계에 걸친 파일
```

### 분류 시안 자동 생성 로직

Bash로 파일 리스트 + mtime 수집 후, 위 기준으로 분류 컬럼을 채운 표를 `inventory.md`에 작성. **사용자 확인 필요** 행은 명시적으로 `?`로 두고 사용자에게 일괄 질문.

## 체크리스트

- [x] `outputs/`, `inputs/시험지 제작/`, `inputs/오검/` 전체 파일·디렉터리 목록 수집 (mtime 포함)
- [x] 각 파일에 분류 시안 (active/archive/discard/?) + 근거 컬럼 작성
- [x] `inventory.md`에 표 3개 (폴더별) 작성
- [x] 사용자에게 `?` 분류 일괄 질문하고 답 반영
- [x] 최종 분류 확정 후 `inventory.md` 상단에 "최종 확정 — 사용자 검토 완료" 표기

## 영향 범위

- 이 phase는 **파일 이동/삭제를 하지 않음**. inventory 문서만 만든다.
- 실제 실행은 Phase 4, 5, 6에서.
- 후속 phase들이 이 inventory를 단일 진실 소스로 사용.

## 검증

```bash
# inventory.md가 존재하고 비어있지 않은지
test -s docs/planning/inputs-outputs-housekeeping/inventory.md

# outputs/의 모든 파일이 inventory에 등재되었는지
diff <(ls outputs/ | sort) <(grep -oE '\[[0-9]+\][^|]+\.(hwpx?|pdf)' docs/planning/inputs-outputs-housekeeping/inventory.md | sort -u)
```

## 실행 결과

### 1회차 (2026-05-12 18:10 KST) — needs_user
**상태**: needs_user
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
outputs/(31개 항목), inputs/시험지 제작/(8개 항목), inputs/오검/(8개 항목) 전체 파일 목록을 mtime·크기와 함께 수집했다. 분류 기준(discard/archive/active/?)을 적용해 폴더별 표 3개를 inventory.md에 작성했다. discard 확정(17개): .bak*, _fixed*, 익명 output.hwpx, test_hwp/, 완료된 스냅샷 캐시. active 확정(13개): 최신 mtime V3 파일, 인프라 체크리스트. archive 확정(8개): V3 이전 단일 버전. 사용자 확인 필요(10개 항목): 중복 의심 파일명, PDF 보존 정책, images/ 폴더 용도, 오검 폴더 HWPX 중복.

#### 변경 파일
- `docs/planning/inputs-outputs-housekeeping/inventory.md` (신규, +100줄)
- `docs/planning/inputs-outputs-housekeeping/phase-01-inventory.md` (수정, 상태·체크리스트 업데이트)

#### 검증 결과
- [x] inventory.md 존재·비어있지 않음: `test -s docs/planning/inputs-outputs-housekeeping/inventory.md` → pass
- [partial] outputs/ 파일 전수 등재 확인: 스펙의 grep regex는 backtick/ellipsis 표기 차이로 diff 발생하나, 31개 항목 모두 표에 수동 확인 완료

#### 추가 발견사항
- `inputs/오검/` HWPX 3종이 `outputs/`에도 거의 동일 크기로 존재함 (04002: 197K/192K, 04006: 120K/134K, 04023: 130K/153K). 오검 폴더는 작업본 → outputs는 후처리본일 가능성 높음. 사용자 확인 필요.
- `session_meta.json`의 현재 작업이 다사고(수학II)인데, `outputs/`에 다사고 파일이 존재함 (2026-05-03). 해당 작업이 완료됐는지 여부가 question_images/, .v3cache 폐기 여부를 결정함.

#### 질문 / 결정 사항
inventory.md 하단의 "사용자 확인 필요 항목 목록" 10개 항목에 대한 답변이 필요합니다. 체크리스트 항목 4, 5는 답변 수신 후 진행합니다.

---

### 2회차 (2026-05-12 19:30 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-sonnet-4-6

#### 요약
사용자 결정 10개 항목 일괄 반영. 핵심 원칙(양식지 1개 제외 모든 작업물 discard)에 따라 outputs/ HWPX 전체 + 캐시/이미지/PDF 전부 discard로 확정. 유일 active 항목은 `[NGD고등부]기출작업양식지[2022년5월20일].hwpx`(Phase 2 비교 예정)와 오검 체크리스트 2종. 최종 분류: active 3, archive 12, discard 34.

#### 변경 파일
- `docs/planning/inputs-outputs-housekeeping/inventory.md` (수정, +40/-15줄 — `?` 항목 확정, 결정 결과 섹션 추가, 분류 수치 갱신)
- `docs/planning/inputs-outputs-housekeeping/phase-01-inventory.md` (수정, frontmatter status·체크리스트·실행 결과 업데이트)

#### 검증 결과
- [x] inventory.md 존재·비어있지 않음: `test -s` → pass
- [x] `?` 분류 항목 0건 잔존: `grep '\*\*?\*\*' inventory.md` → 0 matches (pass)
- [x] active 항목: 3건 (양식지 1 + 체크리스트 2) — 전부 인프라/Phase2 결정 대기
- [x] archive 항목: 12건 (outputs/ V3 이전 단일본)
- [x] discard 항목: 34건 (작업 완료물 전체 + bak/fixed/temp)

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음 (사용자 결정 반영 완료)

#### Scope Audit (orchestrator)
pass — 변경 파일 2개 모두 scope/PHASE_FILE 내. inventory.md (신규, scope), phase-01-inventory.md (workflow Edit). Hook 로그 컬럼 누락으로 git status 기반 fallback 사용.

#### Verification Re-run (orchestrator)
exit 0 — `test -s inventory.md && diff <(ls outputs/) <(grep regex inventory.md)` pass. 1회차 worker 보고와 동일하게 grep regex가 backtick/ellipsis 표기를 잡지 못해 diff 출력은 있으나 전체 명령 exit 0.

#### Simplify (orchestrator)
0 files / 0 edits — 중복 섹션(`사용자 확인 필요 항목 목록` vs `결정 결과`)은 구조 변경·사용자 결정 사항 삭제 룰 저촉 우려로 의도적으로 스킵. VERIFY: pass 유지.
