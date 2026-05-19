---
task: hwpx-fixture-ref-resolution
phase_count: 5
created: 2026-05-18
---

# HWPX fixture ref 정정 + selector 코드 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경 요약

HWPX build 파이프라인의 LLM 의존성은 직전 작업(`hwpx-build-llm-removal`)에서 제거됐으나, 실제 빌드 결과가 사용자가 직접 작성한 정답 reference `outputs/_TEMPLATE_SHOWCASE_fixed.hwpx`와 시각적으로 매칭되지 않는 문제가 발견됐다. 원인 분석:

1. **fixture 일부 누락 / 잘못 추출** — 11개 신규 fixture (bogi_table_4items, ganada_table, increase_decrease 3x/4x, synthetic_division 1~4, Pascal_triangle 1~3)는 직전 commit `813f736`에서 추가했으나 selector 분기 미연결로 실사용 안 됨.
2. **ref 인덱스 mismatch** — 사용자 fixture의 paraPrIDRef/charPrIDRef/borderFillIDRef 인덱스가 사용자 header.xml(82KB, 한컴 GC 후) 기준이고 우리 header.xml(147KB) 정의와 인덱스가 어긋남. 단순 fixture 교체는 잘못된 paragraph 스타일/font/border를 가리킴.
3. **header.xml 교체는 회귀 위험** — 시험지 머릿말 깨짐, ENDNOTE 폰트 변질 등.

본 작업은 (a) HWPX/OWPML 포맷의 ref 시스템을 정확히 이해하고, (b) 사용자 fixture의 ref 인덱스를 우리 header.xml 정의 기준으로 재매핑한 뒤, (c) 11개 신규 fixture에 대한 selector 분기를 추가해, 최종적으로 코드만으로 `_TEMPLATE_SHOWCASE_fixed.hwpx` 수준의 HWPX를 결정론적으로 생성하는 것을 목표로 한다.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-owpml-research.md](./phase-01-owpml-research.md) | 5 | 5 | 100% | completed | 7421914 |
| 2 | [phase-02-header-def-mapping.md](./phase-02-header-def-mapping.md) | 5 | 5 | 100% | completed | 442a84e |
| 3 | [phase-03-fixture-ref-remap.md](./phase-03-fixture-ref-remap.md) | 7 | 7 | 100% | completed | 1742aaf |
| 4 | [phase-04-selector-code.md](./phase-04-selector-code.md) | 4 | 4 | 100% | completed | 6f87102 |
| 5 | [phase-05-e2e-verification.md](./phase-05-e2e-verification.md) | 5 | 5 | 100% | completed | 03b9eea |
| **Total** | | **26** | **26** | **100%** | | |

## Phase 의존성

```
1 → 2 → 3 → 4 → 5
```

모두 직렬 — 각 단계의 산출물이 다음 단계의 정답 기반이 된다. 병렬 가능 phase 없음.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | OWPML ref 시스템 이해 (모든 후속 분석의 토대) | 45분 |
| P0 | Phase 2 | header 정의 매핑 도구 + 매핑 표 | 60분 |
| P0 | Phase 3 | fixture ref 일괄 재매핑 + 적용 | 60분 |
| P0 | Phase 4 | selector 분기 추가 | 45분 |
| P1 | Phase 5 | E2E 검증 + 사용자 시각 확인 | 30분 |

## 권장 실행 순서

1. Phase 1 (단독, 리서치 노트 산출)
2. Phase 2 (Phase 1 노트 기반 매핑 도구)
3. Phase 3 (사용자 확인 후 fixture 일괄 교체)
4. Phase 4 (사용자 확인 후 selector 분기 코딩)
5. Phase 5 (사용자 시각 확인)

## 검증 체크리스트

### 공통 검증

- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` 정상 빌드 + 검증 통과
- [ ] `python3 resources/hwpx_scripts/validate.py outputs/*.hwpx --fix` exit 0
- [ ] 빌드 결과 한컴오피스 열림 + 머릿말/ENDNOTE/보기/조건박스/표/수식 모두 정답 reference 대비 시각 일치 (Phase 5)
- [ ] showcase 도구로 28개 라벨 섹션 모두 빌드 시 정답 본과 시각 일치

### 회귀 검증

- [ ] 시험지 머릿말 (학교명/제작일/중단원/난이도 색상 등) 정상
- [ ] ENDNOTE 번호 폰트/크기/굵기 정상
- [ ] 기존 11개 신규 fixture (`813f736`) 가 selector 를 통해 실제로 사용됨

### 크로스 플랫폼

- [ ] Python 모듈 import 가능 (`python3 -c "import build_hwpx, equation, tables, shapes, assemble, ids"`)
- [ ] 신규 도구 (`tools/header_def_mapper.py`)가 pathlib + encoding 명시
- [ ] Windows 환경에서도 동일 build 결과 (사용자가 별도 확인 시)

## 범위 밖 (touch 금지)

- LLM provider / stage 라우팅 (직전 작업에서 해결)
- checker / extractor / solver / verifier / figure stage
- ngd-studio TS 코드 (sse.ts, orchestrator.ts 등)
- 양식지 PDF 자체 (사용자가 별도로 관리)

## 관련 문서

- `outputs/_TEMPLATE_SHOWCASE_fixed.hwpx` — 사용자 authoritative 정답 reference (93KB, 28개 라벨 섹션)
- `outputs/[고][2026][1학기][강북고][수학 II]_fix_ver2.hwpx` — 현재 빌드 결과 (비교 대상)
- `tools/build_template_showcase.py` — 디버그 showcase 도구 (Phase 5에서 확장)
- `docs/planning/hwpx-build-llm-removal/` — 직전 작업 (LLM 의존성 제거 완료)
- HWPX/HWP 포맷 레퍼런스 (Phase 1 리서치 대상):
  - https://github.com/PNKmath/PNKLMS/tree/main/docs/hancom_official
  - https://github.com/hancom-io/dvc
  - https://github.com/hancom-io/metatag-ex
