---
phase: 7
title: LICENSE(MIT) + README + CONTRIBUTING + Code of Conduct
status: pending
depends_on: [5]
scope:
  - /mnt/c/openexam/LICENSE
  - /mnt/c/openexam/README.md
  - /mnt/c/openexam/CONTRIBUTING.md
  - /mnt/c/openexam/CODE_OF_CONDUCT.md
  - /mnt/c/openexam/.github
intervention_likely: true
intervention_reason: "Copyright holder 이름 결정 — GitHub username 또는 본명/조직명"
executor: sonnet
---

# Phase 7: LICENSE + README + CONTRIBUTING

> **범위**: OSS 문서화 (라이선스 + 첫인상)
> **난이도**: M
> **의존성**: Phase 5 (아키텍처 다이어그램 인용)
> **영향 파일**: 루트의 OSS 표준 문서들

## 배경

OSS 레포의 첫 인상은 README + LICENSE다. GitHub UI에서도 이 둘이 자동으로 보인다. 또한 외부 기여를 받으려면 CONTRIBUTING과 Code of Conduct가 있어야 한다.

라이선스는 사용자가 **MIT**로 확정.

## 설계

### LICENSE (MIT)
```
MIT License

Copyright (c) 2026 [HOLDER]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
...
```
`[HOLDER]` 자리 — 사용자에게 GitHub username 또는 본명/조직명 확인 필요.

### README.md 구조
1. **프로젝트 로고/이름** + 한 줄 설명 + 배지(라이선스, 빌드 상태)
2. **무엇을 하나** — "PDF 시험지를 받아서 구조화 JSON + 해설 + 깔끔한 그림 + HWPX 시험지를 자동 생성하는 OSS 파이프라인"
3. **아키텍처** — Phase 5의 다이어그램 인용 (포맷 무관 파이프라인 + HWPX 빌더)
4. **빠른시작** — 5단계 (clone, env 설정, API 키, 자기 PDF 넣기, 실행)
5. **샘플 데이터 없음 공지** — 저작권 이슈로 PDF 미포함, 사용자가 자기 PDF 사용
6. **양식지 커스터마이즈** — `HWPX_TEMPLATE_PATH` 안내, `templates/default.hwpx` 위치
7. **환경변수** — Phase 8 산출 표 인용
8. **로드맵** — 3단계 (plugin interface 추상화, DOCX/LaTeX 빌더)
9. **기여** — CONTRIBUTING.md 링크
10. **라이선스** — MIT

### CONTRIBUTING.md
- 개발 환경 (Python 버전, Node 버전, 권장 IDE)
- 코드 스타일 (ruff for Python, ESLint for studio)
- 커밋 메시지 컨벤션 (conventional commits 선택)
- PR 가이드 (브랜치명, 리뷰 절차)
- 새 빌더 추가 가이드 (3단계 안내 — 현재는 hwpx만)

### CODE_OF_CONDUCT.md
- Contributor Covenant 2.1 표준 텍스트 그대로
- 신고 이메일 자리 (사용자 확인 필요 — 일단 placeholder)

### .github/ 템플릿
- `ISSUE_TEMPLATE/bug_report.md`
- `ISSUE_TEMPLATE/feature_request.md`
- `PULL_REQUEST_TEMPLATE.md`

## 체크리스트

- [ ] `LICENSE` 작성 (MIT, Copyright holder 확정 필요)
- [ ] `README.md` 작성 (10개 섹션, 아키텍처 다이어그램 포함)
- [ ] `CONTRIBUTING.md` 작성
- [ ] `CODE_OF_CONDUCT.md` 작성 (Contributor Covenant 2.1)
- [ ] `.github/ISSUE_TEMPLATE/` + `PULL_REQUEST_TEMPLATE.md`
- [ ] README의 빠른시작 절차로 실제 실행 가능한지 점검

## 영향 범위

- 향후 README는 사용자 첫 진입점이라 빠른시작 절차가 실제로 동작해야 — Phase 6 builder 분리 + Phase 4 templates/default.hwpx 완료 후 동작 검증

## 검증

```bash
cd /mnt/c/openexam
ls LICENSE README.md CONTRIBUTING.md CODE_OF_CONDUCT.md
ls .github/ISSUE_TEMPLATE/ .github/PULL_REQUEST_TEMPLATE.md

# Markdown lint (선택)
npx -y markdownlint-cli README.md CONTRIBUTING.md CODE_OF_CONDUCT.md
```

## 실행 결과
