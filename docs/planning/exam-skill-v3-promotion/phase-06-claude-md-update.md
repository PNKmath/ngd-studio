---
phase: 6
title: CLAUDE.md V3 흐름 반영
status: completed
depends_on: [4]
scope:
  - CLAUDE.md
intervention_likely: false
intervention_reason: ""
executor: haiku
---

# Phase 6: CLAUDE.md V3 흐름 반영

> **범위**: 단일 파일 (CLAUDE.md)
> **난이도**: XS
> **의존성**: Phase 4 (studio 일반화 완료 후 — V3 흐름이 표준 "시험지 제작"임을 문서에 박을 수 있게 됨)
> **영향 파일**: `CLAUDE.md`

## 배경

`CLAUDE.md`의 "핵심 작업 2가지" 섹션과 폴더 구조 다이어그램이 V1 reader 흐름(reader → solver → figure → builder → checker)을 명시하고 있다. V3 안착 + skill 승격이 완료된 시점에 맞춰 V3 흐름(extractor 병렬 + verifier)으로 갱신한다.

## 설계

### 갱신 항목

#### 1) 폴더 구조 다이어그램

현재 (`CLAUDE.md` 내):
```
.claude/
  agents/          작업 에이전트 7개
    ngd-exam-reader.md    PDF → JSON 추출
    ngd-exam-solver.md    해설 생성 (부실 해설 보완)
    ngd-exam-figure.md    그림 처리 (nano-banana)
    ngd-exam-builder.md   JSON → HWPX 조립
    ngd-exam-checker.md   AI 생성 HWPX 품질 검수
    ngd-exam-reviewer.md  오검 에이전트
```

갱신:
```
.claude/
  agents/          작업 에이전트 7개
    ngd-exam-extractor.md PDF 이미지 1장 → 문제 JSON
    ngd-exam-solver.md    해설 생성
    ngd-exam-verifier.md  해설 독립 검증 (↔ solver 최대 3회)
    ngd-exam-figure.md    그림 처리 (nano-banana)
    ngd-exam-builder.md   JSON → HWPX 조립
    ngd-exam-checker.md   AI 생성 HWPX 품질 검수
    ngd-exam-reviewer.md  오검 에이전트
```

#### 2) "핵심 작업 2가지" — 1. 시험지 제작 섹션

현재 흐름 (5단계 reader → solver → figure → builder → checker):
```
[1] ngd-exam-reader  : PDF → JPG → 문제/수식/해설 추출 → /tmp/exam_data.json
[2] ngd-exam-solver  : 부실 해설 보완 → JSON 업데이트
[3] ngd-exam-figure  : JSON의 그림 → crop → nano-banana 재생성 → 트리밍+워터마크
[4] ngd-exam-builder : JSON + 이미지 → HWPX XML 조립 → 후처리 → 검증
[5] ngd-exam-checker : AI 생성 HWPX 품질 검수 → 피드백 루프 (최대 2회)
```

갱신 (V3 흐름):
```
[Phase 1-A] ngd-exam-extractor (병렬, 8문제 배치): 이미지 1장 → 문제 JSON (.v3cache/q{N}_extracted.json)
[추출 편집]                  : 사용자가 프론트엔드에서 추출 결과 직접 수정
[Phase 1-B] ngd-exam-solver + ngd-exam-verifier (병렬): 해설 생성 + 독립 검증 (최대 3회)
[Phase 2] 순차 처리:
  [4] ngd-exam-figure  : 그림 처리 (nano-banana)
  [5] ngd-exam-builder : JSON + 이미지 → HWPX 조립 + 후처리(fix_namespaces.py) + 검증(validate.py)
  [6] ngd-exam-checker : HWPX 품질 검수 → 피드백 루프
```

#### 3) 오케스트레이터 스킬 이름

현재: `ngd-exam-create` (V1 reader 흐름)
갱신: `ngd-exam-create` (V3 흐름, 의미만 V3로 전환)

→ 이름은 동일하므로 텍스트 자체 변경 없음. 단 "5개 서브 에이전트 순차"라는 표현은 "extractor 병렬 + solver/verifier 병렬 + figure/builder/checker 순차"로 갱신.

#### 4) 검증

```bash
! grep -E "ngd-exam-create-v3|ngd-exam-reader|시험지 제작 v3" CLAUDE.md
```

→ 0건이어야 함.

## 체크리스트

- [x] CLAUDE.md "폴더 구조" 다이어그램의 agent 7종 갱신 (reader → extractor + verifier 추가)
- [x] CLAUDE.md "핵심 작업 2가지 — 1. 시험지 제작" 흐름 다이어그램을 V3 8단계로 갱신
- [x] CLAUDE.md 본문 "5개 서브 에이전트" 표현 일반화 (extractor 병렬 + 순차 단계 명시)
- [x] `grep -E "ngd-exam-create-v3|ngd-exam-reader|시험지 제작 v3" CLAUDE.md` → 0건

## 영향 범위

- CLAUDE.md는 `/mnt/c/NGD/CLAUDE.md` 단일 파일. 다른 파일 영향 없음.
- 이 파일은 Claude Code가 매 세션 자동 로드 → 다음 작업부터 V3 흐름을 표준으로 인식.

## 검증

```bash
test -s /mnt/c/NGD/CLAUDE.md
grep -q "extractor" /mnt/c/NGD/CLAUDE.md   # V3 흐름 명시 확인
grep -q "verifier" /mnt/c/NGD/CLAUDE.md
! grep -E "ngd-exam-create-v3|ngd-exam-reader|시험지 제작 v3" /mnt/c/NGD/CLAUDE.md
```

## 실행 결과

### 1회차 (2026-05-13 10:45 KST) — completed
**상태**: completed
**소요 시간**: 약 5분
**진행 모델**: claude-haiku-4-5-20251001

#### 요약
CLAUDE.md의 폴더 구조 다이어그램과 "핵심 작업 2가지" 섹션을 V3 흐름(extractor 병렬 + verifier 추가)으로 갱신 완료. 모든 검증(extractor, verifier 명시 + 금지된 표현 0건)을 통과했습니다.

#### 변경 파일
- `/mnt/c/NGD/CLAUDE.md` (수정, +7/-6줄)

#### 검증 결과
- [x] File exists and is not empty: `test -s /mnt/c/NGD/CLAUDE.md` → pass
- [x] V3 흐름 'extractor' 명시: `grep -q "extractor" /mnt/c/NGD/CLAUDE.md` → pass
- [x] V3 흐름 'verifier' 명시: `grep -q "verifier" /mnt/c/NGD/CLAUDE.md` → pass
- [x] 금지된 표현 0건: `! grep -E "ngd-exam-create-v3|ngd-exam-reader|시험지 제작 v3"` → pass

#### 추가 발견사항
없음

#### 질문 / 결정 사항
없음

#### Scope Audit (orchestrator)
pass — 1 file in scope (CLAUDE.md)

#### Verification Re-run (orchestrator)
exit 0 — `test -s`, `grep -q extractor/verifier`, 금지표현 grep 모두 통과

#### Simplify (orchestrator)
SIMPLIFIED: 0 / CHANGES: 0 / VERIFY: pass / NOTES: 문서 파일 — 중복/불필요 패턴 없음

#### Review (orchestrator)
VERDICT: pass / ISSUES: 0 / SUMMARY: CLAUDE.md V3 흐름 반영이 설계 스펙과 완전 일치, 모든 검증 통과

#### Commit
(예정 — Step 7.5 ⑤에서 기록)
