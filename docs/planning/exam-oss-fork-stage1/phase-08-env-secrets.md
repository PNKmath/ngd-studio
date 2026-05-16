---
phase: 8
title: .env.example + 시크릿 점검 + .gitignore 보강
status: pending
depends_on: [1]
scope:
  - /mnt/c/openexam/.env.example
  - /mnt/c/openexam/studio/.env.example
  - /mnt/c/openexam/.gitignore
intervention_likely: false
intervention_reason: ""
executor: haiku
---

# Phase 8: .env.example + 시크릿 점검

> **범위**: 환경변수/시크릿 정비
> **난이도**: S
> **의존성**: Phase 1
> **영향 파일**: `.env.example`, `studio/.env.example`, `.gitignore`

## 배경

현재 루트에 `.env.example`이 없고, `studio/.env.example`만 있다. OSS 사용자가 어떤 환경변수를 설정해야 하는지 한눈에 보이도록 정비한다. 또한 `.env.local` 같은 실제 키 파일이 git에 추적되지 않도록 .gitignore를 보강한다.

## 설계

### 루트 `.env.example`
```bash
# Anthropic API (해설 생성, 검증)
ANTHROPIC_API_KEY=sk-ant-...

# Gemini API (그림 재생성 - nano-banana)
GEMINI_API_KEY=...

# 워터마크 텍스트 (빈 값이면 워터마크 그리지 않음)
WATERMARK_TEXT=

# HWPX 양식지 경로 (지정 안 하면 templates/default.hwpx 사용)
HWPX_TEMPLATE_PATH=
```

### studio `.env.example`
- 기존 항목 유지 + NGD 잔재 제거 (Phase 3 결과)
- `HWPX_TEMPLATE_PATH` 기본값 갱신 (Phase 4와 일관)
- SSE 서버 URL 등 studio 전용 항목

### `.gitignore` 보강 확인
이미 존재하는 패턴:
- `.env.local`, `.env.*.local`?

추가 필요:
- `.env` (혹시 루트에 .env 만드는 경우)
- `.env.local`
- `.env.*.local`

## 체크리스트

- [ ] 루트 `.env.example` 신규 작성 (위 설계 기준)
- [ ] `studio/.env.example`에서 NGD 잔재 제거 + HWPX_TEMPLATE_PATH 기본값 점검 (Phase 3 결과 검증 겸)
- [ ] `.gitignore`에 `.env`, `.env.local`, `.env.*.local` 패턴 확인 + 누락 시 추가
- [ ] `git log --all --full-history -- "*.env*" "studio/.env.local"` — 실제 키가 한 번이라도 커밋된 적 있는지 확인. 있으면 Phase 9에서 git filter 또는 신고
- [ ] README "환경변수" 섹션 초안 작성 (Phase 7과 동기화)
- [ ] Python 측에서 환경변수 로딩 일관성 점검 — `os.environ.get(...)` 사용. dotenv 의존성은 OSS 기본 가벼움을 위해 추가하지 않음 (사용자가 shell로 export)

## 영향 범위

- studio의 `.env.local`(실제 키 파일)이 git에 들어가 있으면 보안 사고 — 반드시 검증
- Phase 1에서 .git/ 제외하고 복사했으므로 history는 깨끗하지만, 새 디렉터리에 .env.local 실수로 복사됐는지 확인

## 검증

```bash
cd /mnt/c/openexam
ls .env.example studio/.env.example
cat .env.example                              # 모든 키 placeholder
test ! -f .env.local && echo "no real .env.local"
test ! -f studio/.env.local && echo "no real studio/.env.local"
git ls-files | grep -E "\.env\.local|\.env$"  # 빈 결과여야
```

## 실행 결과
