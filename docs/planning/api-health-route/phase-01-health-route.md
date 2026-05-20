---
phase: 1
title: /api/health GET route 신규
status: complete
depends_on: []
scope:
  - ngd-studio/app/api/health/route.ts
intervention_likely: false
intervention_reason: ""
executor: haiku
load_bearing: ""
e2e_refs: []
e2e_triggers: []
---

# Phase 1: /api/health GET route 신규

> **범위**: Backend (Next.js App Router API)
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `ngd-studio/app/api/health/route.ts` (신규)

## 배경

외부 모니터링 / docker healthcheck / k8s readiness probe 가 사용할 수 있는 단순 health check 엔드포인트가 ngd-studio 에 없음. 신규 추가.

## 심볼 인벤토리

- `NextResponse.json`
    - 근거: ngd-studio/app/api/status/route.ts (기존 패턴 동일)
- `health route handler`
    - [NEW]

## 설계

- `ngd-studio/app/api/health/route.ts` 신규 생성
- 패턴은 기존 `app/api/status/route.ts` 참고:
  - `import { NextResponse } from "next/server";`
  - `export async function GET() { ... }`
  - return `NextResponse.json({ status: "ok", timestamp: new Date().toISOString() })`
- 외부 의존성 / DB / queue 등 호출 없음 (의도적 — health 는 가벼워야 함)

## 체크리스트

- [ ] `ngd-studio/app/api/health/route.ts` 생성
- [ ] `GET` 핸들러 export
- [ ] 응답 본문: `{ status: "ok", timestamp: <ISO> }`
- [ ] `curl localhost:3000/api/health` → HTTP 200 + JSON 형식

## 영향 범위

- 신규 라우트만 추가. 기존 코드 수정 없음.
- 빌드 영향: Next.js 가 자동으로 route 디스커버.

## 검증

```bash
cd ngd-studio
pnpm build 2>&1 | tail -5
# 또는 dev server 띄우고
# pnpm dev &
# sleep 5
# curl -s -o /tmp/health.json -w "%{http_code}\n" http://localhost:3000/api/health
# cat /tmp/health.json | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status']=='ok' and 'timestamp' in d; print('OK')"
```
