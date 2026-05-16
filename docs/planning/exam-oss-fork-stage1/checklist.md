---
task: exam-oss-fork-stage1
phase_count: 9
created: 2026-05-12
---

# 일반 시험지 제작 OSS 포크 1단계 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-bootstrap.md](./phase-01-bootstrap.md) | 6 | 0 | 0% | pending | - |
| 2 | [phase-02-purge-copyrighted.md](./phase-02-purge-copyrighted.md) | 8 | 0 | 0% | pending | - |
| 3 | [phase-03-rebrand.md](./phase-03-rebrand.md) | 10 | 0 | 0% | pending | - |
| 4 | [phase-04-templates.md](./phase-04-templates.md) | 7 | 0 | 0% | pending | - |
| 5 | [phase-05-data-contract.md](./phase-05-data-contract.md) | 6 | 0 | 0% | pending | - |
| 6 | [phase-06-builder-dir.md](./phase-06-builder-dir.md) | 6 | 0 | 0% | pending | - |
| 7 | [phase-07-license-readme.md](./phase-07-license-readme.md) | 6 | 0 | 0% | pending | - |
| 8 | [phase-08-env-secrets.md](./phase-08-env-secrets.md) | 6 | 0 | 0% | pending | - |
| 9 | [phase-09-ci-final.md](./phase-09-ci-final.md) | 7 | 0 | 0% | pending | - |
| **Total** | | **62** | **0** | **0%** | | |

## Phase 의존성

```
1 ──┬──▶ 2 ──▶ 3 ──┬──▶ 6 ───────────────┐
    │              └──▶ (5, 8 병렬 가능)  │
    ├──▶ 4 ────────────────────────────┐ │
    ├──▶ 5 ────▶ 7 ──────────────────┐ │ │
    └──▶ 8 ──────────────────────────┴─┴─┴─▶ 9
```

- **순차 필수**: 1 → 2 → 3 → 6 (브랜딩 정리 후 빌더 위치 이동)
- **병렬 가능**: 4(양식지), 5(스키마), 8(env)은 Phase 1 끝나면 동시 진행 가능. 단 3과 4는 scope(양식지 파일명·텍스트)가 겹쳐 순차 권장
- **최종 합류**: 9는 3·6·7·8 모두 완료 필요

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | 새 레포 부트스트랩 (모든 후속 phase의 전제) | 10분 |
| P0 | Phase 2 | 저작권 위험 자료 제거 (퍼블릭 전 필수) | 15분 |
| P0 | Phase 3 | NGD 브랜딩 일반화 (식별성 제거) | 30분 |
| P1 | Phase 4 | 양식지 일반화 (Anonymized 자작 + env var) | 30분 |
| P1 | Phase 5 | 데이터 계약 문서화 (3단계 전환의 기반) | 30분 |
| P1 | Phase 6 | builder 디렉터리 분리 | 20분 |
| P1 | Phase 7 | LICENSE + README + CONTRIBUTING | 30분 |
| P2 | Phase 8 | env.example + 시크릿 점검 | 10분 |
| P2 | Phase 9 | CI + 최종 검수 + push 준비 | 20분 |

## 권장 실행 순서

1. **Phase 1** (부트스트랩, 인터벤션 1회)
2. **Phase 2** (저작권 자료 제거, 인터벤션 1회 — 화이트리스트 확인)
3. **Phase 3** (NGD 브랜딩 일반화, 인터벤션 1회 — rename 규칙 확정)
4. **Phase 4, 5, 8 병렬** (양식지·스키마·env)
5. **Phase 6** (builder 분리)
6. **Phase 7** (LICENSE·README, 인터벤션 1회 — Copyright holder 이름)
7. **Phase 9** (CI + 최종 검수 + push 준비, 인터벤션 1회 — push 시점)

## 검증 체크리스트

### 공통 검증
- [ ] `grep -rli "NGD\|ngd-" --exclude-dir=.git --exclude-dir=node_modules` 결과가 의도된 잔존만 (변경 로그 등)
- [ ] `find . -name "*.pdf" -not -path "./.git/*"` 결과 비어있음
- [ ] `find . -name "*.bak*" -o -name "*.backup-*"` 결과 비어있음
- [ ] LICENSE 존재, Copyright holder 명시
- [ ] README 빠른시작 절차로 샘플 빌드 가능
- [ ] CI 워크플로 통과
- [ ] `studio/` `npm run build` 통과

## 사전 결정사항 (인터벤션 대비)

| 항목 | 결정값 |
|------|--------|
| 새 레포 디렉터리 | `/mnt/c/openexam` |
| 레포 이름 | `openexam` |
| rename prefix (agents/skills) | `ngd-exam-*` → `exam-*` |
| studio 디렉터리 rename | `ngd-studio/` → `studio/` |
| studio npm 패키지명 | `openexam-studio` |
| 양식지 처리 | anonymized `templates/default.hwpx` + `HWPX_TEMPLATE_PATH` env (둘 다) |
| 라이선스 | MIT |
| 샘플 PDF | 미포함 (사용자가 자기 PDF 사용) |
| Copyright holder | 미정 → Phase 7에서 확인 |

## 관련 문서
- 원본 작업 폴더: `/mnt/c/NGD/` (NGD 비공개 레포)
- 향후 3단계 계획 (별도 task로): builder plugin interface 추상화 + DOCX/LaTeX 빌더
