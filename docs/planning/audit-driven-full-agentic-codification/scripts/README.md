# 사후 검증 스크립트 (2026-05-20 본 task 직전 수행)

선행 task `create-v4-deterministic-codification` 완료 후, 운영 데이터(`inputs/시험지 제작/.v3cache/`의 19개 cached solved JSON) 기반 동치성 검증을 위해 작성된 스크립트. API 호출 0회, ~30분 작업.

검증 결과 요약은 `docs/planning/create-v4-deterministic-codification/results.md`의 "사후 검증 부록" 절 참조.

## 스크립트 목록

| 파일 | 목적 | 결과 |
|------|------|------|
| `verify_stage1_normalizer_safety.py` | Python `normalize_parts`를 19개 운영 solved JSON에 적용, 변경 종류를 R-NN 룰별로 attribution | PASS — 14 idempotent, 5 정정(R-01/R-10), 0 손상 |
| `verify_stage1_deep_runon_inspect.py` | Stage 1에서 R-01 split이 적용된 q1/q2/q6의 before/after context 자세히 비교 | PASS — split이 텍스트/br 손상 없이 정상 작동 |
| `verify_stage2_cross_language_parity.mjs` | TS `normalizeParts`와 Python `normalize_parts`를 같은 19개 입력에 적용 → byte diff | **FAIL** — R-10 단항 minus 처리 drift 7+ mismatch. 본 task Phase 6에서 fix |
| `verify_stage4_checker_autofix.mjs` | 운영 HWPX section0.xml에서 통수식 검출 + `fixRunOnEquationsInXml` 적용 → 분리 결과 검증 | PASS — 8건 모두 분리, post-fix 통수식 0건 |
| `verify_stage5_r09_text_side_efficacy.py` | 선행 task 사후 fix(C1: R-09 text-side)가 운영 데이터에서 실제 효과가 있는지 측정 | (효과 미측정) — 수2 미적분 sample에 단위 표기 0건. 다른 과목(통계/물리) sample 필요 |

## 실행 방법

스크립트는 절대 경로(`/Users/junhyukpark/ngd/ngd-studio/...`)를 사용한다. 다른 환경에서 실행 시 경로 조정 필요.

```bash
# Stage 1
python3 docs/planning/audit-driven-full-agentic-codification/scripts/verify_stage1_normalizer_safety.py

# Stage 1 deep inspection
python3 docs/planning/audit-driven-full-agentic-codification/scripts/verify_stage1_deep_runon_inspect.py

# Stage 2 (tsx 필요)
cd ngd-studio && npx tsx ../docs/planning/audit-driven-full-agentic-codification/scripts/verify_stage2_cross_language_parity.mjs

# Stage 3은 인라인 bash로 수행 (worktree 생성 + build_hwpx.py 양쪽 실행 + unzip diff)
# 본 작업 시점에는 worktree가 정리됐으나 a380ed3 ref에서 재현 가능

# Stage 4 (tsx 필요, Stage 3가 unzip한 결과 사용)
cd ngd-studio && npx tsx ../docs/planning/audit-driven-full-agentic-codification/scripts/verify_stage4_checker_autofix.mjs

# Stage 5
python3 docs/planning/audit-driven-full-agentic-codification/scripts/verify_stage5_r09_text_side_efficacy.py
```

## 본 task 진행 중 재사용 권고

- **Phase 6 검증**: Stage 2 스크립트를 그대로 재실행해 R-10 단항 minus fix 완료 후 19/19 parity 확보 입증
- **Phase 7 검증**: Stage 4 스크립트 패턴으로 reviewer auto-validators의 운영 HWPX 적용 결과 검증
- **Phase 8 shadow-run**: Stage 3 패턴(worktree + cached input + build diff)을 그대로 사용해 본 task 완료 전후 비교
- **새 운영 sample 추가 시**: Stage 5 스크립트를 다른 과목 cached JSON에 대해 재실행해 R-09 text-side 실효성 측정

## 한계

- 검증은 본 build 경로(Python `equation.py`)의 단방향만 다룸
- solver/verifier feedback loop의 동치성은 LLM 호출이라 결정적 검증 불가 (의도된 agentic 잔존)
- 새 sample이 들어오면 fixture 갱신 필요 — 자동 등록 메커니즘 없음
