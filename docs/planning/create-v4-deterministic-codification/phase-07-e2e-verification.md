---
phase: 7
title: e2e 검증 + metrics
status: pending
depends_on: [2, 3, 4, 5]
scope:
  - ngd-studio/server/stages/__tests__/orchestrator.integration.test.ts
  - docs/planning/create-v4-deterministic-codification/results.md
intervention_likely: false
intervention_reason: ""
---

# Phase 7: e2e 검증 + metrics

> **범위**: 회귀 + 측정
> **난이도**: M
> **의존성**: Phase 2, 3, 4, 5
> **영향 파일**: orchestrator.integration.test.ts, results.md (신규)

## 배경

Phase 2~5가 끝나면:

- TS / Python normalizer 양쪽 동작 (Phase 2, 3)
- prompt 슬림화로 토큰 절감 (Phase 4)
- checker auto-fix로 LLM fallback 감소 (Phase 5)

이 변경들이 **실제 시험지 1개를 처음부터 끝까지** 돌렸을 때 회귀 없이 동작하는지 + 의도한 metrics 개선이 측정되는지 확인.

## 설계

### 1. 회귀 시나리오

기존 fixture (e.g. `outputs/<known-good>/`) 또는 새로 만든 mock fixture로:

1. cache 비운 상태에서 `runStageOrchestrator` 전체 실행
2. 결과 HWPX가 `validate.py --fix` exit 0
3. checker 결정적 룰 통과 (`equation.run_on` 등 0개)
4. 기존 baseline (changeset 이전 출력)과 비교 — normalize 차이 외 의미 차이 없음

### 2. Metrics 측정

- **prompt token**: 변경 전/후 system+user prompt 길이 비교 (Phase 4 효과)
- **verifier 재시도 횟수**: 같은 cache로 변경 전/후 verifier 호출 시 retry 평균 (Phase 3 효과)
- **checker fallback 발동율**: `fallbackRequired: true` 발생률 (Phase 5 효과)

수치는 `docs/planning/create-v4-deterministic-codification/results.md`에 기록.

### 3. 동치성 cross-check

같은 fixture를 Python normalizer / TS normalizer 양쪽에 통과시켜 출력 byte-level equal 확인 (스크립트):

```bash
node -e "
const { normalizeParts } = require('./ngd-studio/lib/parts/normalize');
const fs = require('fs');
const fx = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
console.log(JSON.stringify(normalizeParts(fx.input.parts)));
" <fixture.json> > /tmp/ts_out.json

python3 -c "
import json, sys
from equation import normalize_parts
fx = json.load(open(sys.argv[1]))
print(json.dumps(normalize_parts(fx['input']['parts'])))
" <fixture.json> > /tmp/py_out.json

diff /tmp/ts_out.json /tmp/py_out.json  # empty
```

모든 fixture에 대해 동치 확인.

## 체크리스트

- [ ] `orchestrator.integration.test.ts` — 전체 파이프라인 1회 회귀 시나리오 추가
- [ ] 동치성 cross-check 스크립트 (`scripts/check_normalizer_parity.sh` 또는 inline) — 모든 fixture에서 TS == Python
- [ ] `results.md` — prompt token before/after, verifier retry rate, checker fallback rate 기록
- [ ] 회귀 baseline HWPX와 byte 비교 — normalize 적용 차이 외 의미 차이 없음 확인
- [ ] `cd ngd-studio && pnpm test server/stages/__tests__/orchestrator.integration.test.ts` 통과

## 영향 범위

- 검증 only. 코드 변경 없음.
- `results.md`는 향후 reference로 남음.
- 회귀 발견 시 해당 phase로 되돌아가 fixture 추가 / 구현 보강.

## 검증

```bash
cd ngd-studio
pnpm test server/stages/__tests__/orchestrator.integration.test.ts --reporter=basic

# 동치성
bash scripts/check_normalizer_parity.sh

# 회귀 baseline 비교
diff -r outputs/<baseline>/ outputs/<rerun>/
```
