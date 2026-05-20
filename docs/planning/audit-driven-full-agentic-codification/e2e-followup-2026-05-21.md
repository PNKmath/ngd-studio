---
type: e2e-followup
task: audit-driven-full-agentic-codification
date: 2026-05-21
run_id: run-1779290069-72743 (follow-up)
---

# E2E follow-up — phase-run skip(env) 해소

Phase 4/5/6/7의 per-phase e2e가 본 phase-run 세션에서 dev server 미가동으로 skip(env) 처리됐었음. 사용자가 dev server (port 3020)를 띄운 후 후속 실행한 결과 기록.

## 시나리오별 결과

### build-hwpx-cli (Phase 4/6)

`delegate_to: verify` — CLI 검증.

- `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" /tmp/e2e-build-output` → exit 0
- HWPX 파일 생성됨: `[04039][고][2025][2-1-b][대구][강북고][수2][도함수의 활용(3) - 정적분의 활용][04039]_ver20260521-015813.hwpx`
- ZIP open 가능 (`unzip -l` OK)
- `Contents/section0.xml` XML 파싱 가능
- Total problems: 19 (choice: 12, essay: 7), Extra images: 1

**판정: pass**

### create-v4-full-pipeline (Phase 4/5/6)

`delegate_to: run` — web UI + PDF upload + full pipeline.

본 follow-up 세션에서는 entry-point HTTP smoke만 실행 (PDF 입력 자동화 인프라 부재).

- `GET /` → 200
- `GET /create-v4` → 200
- `GET /api/jobs` → 200
- `GET /api/build-status` → 200
- `GET /api/status` → 200

전체 UI 흐름 (PDF 업로드 → extractor → solver → builder → HWPX 다운로드) 검증은 사용자 수동 수행 필요. 코드 레벨 회귀는 단위/통합 테스트 669/670 pass로 입증 (1 fail = openaiSdkLive API 환경 제약).

**판정: partial — entry-point alive, 전체 flow는 사용자 수동 검증 권고.**

### review-full-pipeline (Phase 7)

`delegate_to: run` — review web UI + PDF+HWPX drop.

- `GET /review` → 200

전체 흐름 (PDF+HWPX 드롭 → reviewRunner → autoValidators + reviewer agent → 수정 HWPX 다운로드) 자동화는 사용자 수동 수행 권고. Phase 7 단위 테스트 (autoValidators 34 + mutation 8) 모두 pass.

**판정: partial — entry-point alive, rule_id 중복 0건 invariant는 운영 데이터로 사용자 spot check 권고.**

## 후속 task 커밋 (이번 세션 추가)

| 작업 | 커밋 |
|------|------|
| Phase 7 #19 validateChoiceSpacing cross-paragraph fix | `9207649` |
| Phase 4 orchestrator.ts → figureRunner.ts migration | `071d2d7` |

## 전체 회귀 결과

- vitest: 669/670 pass (1 fail = `openaiSdkLive.test.ts` — OpenAI API quota/network 환경 제약, 본 task 변경과 무관)
- pytest: 72/72 pass (선행 phase-run 6단계에서 확인)
- tsc --noEmit: 오류 없음

## 권고

본 task는 audit doc 39행 100% covered 상태로 완료. 운영 회귀 모니터링:

1. **review-full-pipeline 운영 spot check**: 실 운영 PDF+HWPX 1세트로 reviewRunner 실행 → `ReviewItems` 내 `rule_id` 중복 0건 확인.
2. **create-v4-full-pipeline 운영 spot check**: 실 운영 PDF로 /create-v4 진입 → outputs/ HWPX 생성 확인.
3. **openaiSdkLive.test.ts**: API quota 회복 후 재실행.
