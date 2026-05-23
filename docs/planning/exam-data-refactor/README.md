# exam-data-refactor

`exam_data.json` 데이터 파이프라인 + 양 흐름(신규 PDF→HWPX / 작업 재개) 전면 리팩토링.

## 목적

audit 결과 다음 3종 문제가 확인됨:

### 코드 스파게티
- TS/Python 둘이 같은 `.v3cache/exam_data.json`을 mutate (`figure_processor.py:312,328`)
- `info`에 snake_case + camelCase **dual emit** 영속화 (`examData.ts:105-128`)
- filename 생성 2벌 (`examData.ts:111-118` vs `assemble.py:502-512`)
- Dead code (`aggregateVerifiedProblems`, figure_processor 213-219 shim, `.v3cache_prev` orphan, stripChoicePrefix 밴드에이드)

### 로직 결함
- **F1**: `buildExamDataJson` rebuild가 `figure_info.final_image` 소실 (`orchestrator.ts:882-900`)
- **F2**: cleanup matrix 비대칭 — `--from=builder` 시 exam_data 보존하지만 orchestrator는 rebuild
- **F3**: orchestrator가 figure_processor `--question N` 인자 미전달 (`orchestrator.ts:921-929`)
- **F5**: `extraction_review` SSE 핸들러가 메인 run/followup 두 곳에서 다름
- **F8**: stage counter가 cache hit을 카운트 안 함 → UI stale 상태

### 이전→현재 작업 누수
- **L1**: `session_meta.json`이 `.v3cache` **밖**에 있음 → `v3cache-reset` 무영향
- **L2**: `reset → image POST` 사이 윈도우에 이전 시험지 이미지 잔존
- **L3**: `.v3cache_prev` orphan (정의만 있고 read 0건, 전 시험지 전체 데이터 1세대 보존)
- **L4**: `outputs/images/prob{N}_final.png` 시험지 간 잔존

## 새 컨트랙트

1. **camelCase 단일화** — 디스크/네트워크/메모리 모두 camelCase. Python은 read-only + read-time adapter 1줄.
2. **`exam_data.json` = TS write-only artifact** — figure_processor.py도 read-only로 전환. `figure_info.final_image` 키는 `figure_status.json`으로 이전, assemble.py가 둘을 join.
3. **`session_meta.json` 위치 = `.v3cache/session_meta.json`** — truth source 1개. `v3cache-reset`이 자동 폐기.
4. **handleExtract 원자화** — 클라이언트 단일 fetch → 서버 `/api/create/start`에서 reset + image 저장 + meta 저장을 트랜잭션으로 수행. 어느 중간단계에서도 일관되지 않은 디스크 상태를 노출하지 않음.
5. **cleanup `--from=builder` 시 exam_data 새 rebuild** — orchestrator의 rebuild를 의도된 동작으로 명세 (final_image가 다른 파일로 빠지므로 rebuild가 안전).

## 흐름 (refactor 후)

```
신규:
  page.tsx handleExtract
   → POST /api/create/start { meta, images[] }
        ├─ rm -rf .v3cache && mkdir
        ├─ rm -rf question_images && mkdir, write qNN.png
        └─ write .v3cache/session_meta.json
   → startJob("create")
        → orchestrator → cleaning → per-Q → buildExamDataJson → figure → builder → checker

재개 (B-α idle):
  GET /api/question-images (numbers + cacheState)
  → handleResume
       → GET /api/v3cache-meta  [.v3cache/session_meta.json만, 폴백 없음]
       → preload /v3cache-data
  → startJob("resume", resumeFrom: "auto")
       → orchestrator → resume cleanup → 누락 stage만 → buildExamDataJson rebuild
         (rebuild가 안전 — final_image는 figure_status.json에 살아있음)

재개 (B-γ followup):
  sendResumeAction("resume --from=X [--q=N]")
  → POST /api/run/{jobId}/followup
       → cleanupFromStage (수정된 matrix)
       → orchestrator → buildExamDataJson rebuild (안전)
                     → figure (필요시 --question N forward)
                     → builder가 exam_data + figure_status join
```

## Phase 개요

| # | 제목 | 의존 | 시간 | 핵심 |
|---|---|---|---|---|
| 1 | ExamMeta 단일 타입 (camelCase 컨트랙트) | — | 30분 | 11곳 dedup |
| 2 | examData.ts dual emit 제거 + stripChoicePrefix 이전 | 1 | 30분 | dead code 정리 |
| 3 | `figure_info.final_image` → `figure_status.json` 이전 | 2 | 40분 | **F1 load-bearing** |
| 4 | assemble.py camelCase + filename 폴백 삭제 + figure_status join | 3 | 30분 | Python read-only 완성 |
| 5 | session_meta.json을 .v3cache/로 이동 | 1 | 20분 | **L1 load-bearing** |
| 6 | `/api/create/start` 단일 엔드포인트 + handleExtract 원자화 | 5 | 40분 | **L2 load-bearing** |
| 7 | orchestrator resume 안전성 (cleanup matrix + per-Q figure + SSE 핸들러 단일화 + stage counter race) | 1,2,3,4 | 60분 | F2/F3/F5/F8 |
| 8 | `.v3cache_prev` orphan + `outputs/images/` 누적 정리 | 6 | 20분 | L3/L4 |
| 9 | Fixture/test 재생성 + 회귀 vitest | 1-8 | 40분 | — |
| 10 | 실제 PDF 수동 smoke (B-α/β/γ + 신규-실패-재개) | 9 | 30분 (수동) | **intervention** |

## 게이트

- 모든 phase 종료 시 `npx tsc --noEmit` + 관련 vitest pass
- 마지막 P10에서만 실제 PDF + 브라우저 수동 확인

## 관련 e2e 카탈로그

`docs/e2e/`:
- `create-v4-full-pipeline` (P0) — 신규/재개 양 흐름
- `build-hwpx-cli` (P0) — assemble.py / figure_processor.py / build_hwpx.py

`v3cache-reset` / 신규 `/api/create/start` entry point는 P6 시점에 catalog mutation 검토 (현재 misc 도메인 `_pending`).
