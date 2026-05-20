---
phase: 6
title: E2E 시험지 1건 빌드 검증
status: pending
depends_on: [2, 3, 4, 5]
scope:
  - inputs/시험지 제작/.v3cache/
  - outputs/
  - ngd-studio/app/create-v4/
intervention_likely: true
intervention_reason: "사용자가 시험지 실제 빌드 결과를 한컴오피스에서 열어 시각 확인 필요. 캐시 빌드 결과가 불충분하면 새 시험지로 재시도 결정."
---

# Phase 6: E2E 시험지 1건 빌드 검증

> **범위**: Integration (실제 빌드)
> **난이도**: M
> **의존성**: Phase 2 (모듈 분리), 3 (SKILL.md), 4 (LLM 제거), 5 (테스트)
> **영향 파일**: 없음 (검증만)

## 배경

모든 코드/문서 변경 후, 실제 시험지 1건이 end-to-end로 정상 빌드되는지 검증한다. 단위 테스트로는 잡히지 않는 다음을 확인:

- 모듈 분리 후 실제 HWPX 출력 정합성
- 신규 `resources/` 경로 resolution
- legacy 경로(useCodeOrchestrator=false) 종료 후 호스트 자동 build 합성
- deterministic builder 실패 시 즉시 종료 (LLM fallback 없음 확인 — 실패 케이스는 강제하기 어렵지만 fallback 코드 부재로 보장)

## 설계

### 1차: 캐시 재빌드 (기존 .v3cache 사용)

`inputs/시험지 제작/.v3cache/exam_data.json` 이 이미 존재. 이걸로 build_hwpx.py 단독 실행 + create-v4 페이지에서 `resume --from=builder`로 재빌드.

```bash
cd /Users/junhyukpark/ngd/ngd-studio

# (A) 단독 실행 — Phase 1/2 검증
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/fix_namespaces.py outputs/*.hwpx
python3 resources/hwpx_scripts/validate.py --fix outputs/*.hwpx

# (B) 호스트 경로 — Phase 4 검증
pnpm --filter ngd-studio dev  # 또는 pnpm dev
# 브라우저: create-v4 → resume --from=builder 또는 --from=confirm
```

### 2차: 신규 시험지 (캐시 불충분 시)

캐시가 다양한 케이스(condition_box/data_table/choice 변형 등)를 충분히 커버하지 못하면, 새 시험지 PDF 1건으로 처음부터 (extractor → solver → verifier → figure → builder → checker) 실행.

신규 시험지 선정 기준: `inputs/시험지 제작/` 에 미작업 PDF가 있다면 사용, 없으면 사용자가 별도 PDF 제공.

### 검증 항목

| 항목 | 확인 방법 |
|------|-----------|
| HWPX 파일 생성 | `ls outputs/*.hwpx` |
| `validate.py --fix` 통과 | 명령 exit code 0 |
| 한컴오피스에서 열림 | **사용자 시각 확인** |
| 문제 누락 없음 | 한컴오피스에서 문제 수 확인 |
| 수식/표/그림 깨짐 없음 | 한컴오피스 시각 확인 |
| legacy 경로 합성 정상 (useCodeOrchestrator=false) | sse SSE 로그에 "skill 완료 후 deterministic builder 자동 실행" 메시지 확인 |
| deterministic builder 실패 시 즉시 failed (LLM fallback 없음) | 의도적 실패 케이스 발생 시 LLM 호출 로그 없음 확인 (강제 어려우면 코드 부재로 갈음) |

## 체크리스트

- [ ] 1차 캐시 재빌드: `python3 build_hwpx.py inputs/시험지\ 제작/.v3cache/exam_data.json outputs` 성공 + `validate.py --fix` 통과
- [ ] 호스트 경로: create-v4 페이지에서 `resume --from=builder` 실행 → builder 완료 이벤트 + HWPX 파일 생성
- [ ] 사용자 시각 확인: 한컴오피스에서 결과 HWPX 열기 → 문제 누락/수식 깨짐/표 정렬 등 정상 (사용자 OK 후 체크)
- [ ] 캐시 검증이 불충분하다고 판단되면 신규 시험지 1건 end-to-end 빌드 (extractor → builder → checker) → 동일하게 검증

## 영향 범위

- 본 phase는 검증만 수행. 코드 변경 없음.
- 실패 발견 시 해당 phase로 회귀 (Phase 1/2/4)하여 수정 후 재실행.

## 검증

```bash
# 자동 검증
cd /Users/junhyukpark/ngd/ngd-studio
python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs
python3 resources/hwpx_scripts/validate.py --fix outputs/*.hwpx
ls -la outputs/*.hwpx

# 호스트 경로 검증 (별도 터미널)
cd ngd-studio
pnpm dev
# 브라우저에서 create-v4 페이지 접속, resume 흐름 트리거

# 사용자 시각 확인
open outputs/*.hwpx  # macOS — 한컴오피스 또는 한컴오피스 뷰어
```

## 실행 결과

(worker가 완료 시 작성. 사용자 시각 확인 결과 포함)
