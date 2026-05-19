---
task: ngd-create-v4-followup
phase_count: 3
created: 2026-05-19
---

# NGD create v4 후속 작업 — 진행 체크리스트

> **AI 개발 가이드**: `/phase-run`이 이 파일을 읽어 다음 phase를 선정합니다.
> 사용자가 수동 진행 시에도 같은 테이블을 갱신해 주세요.

## 배경

`ngd-create-v4-coherence` (방금 종료) 후속으로 식별된 작업을 통합한 task. 본 task 의 산출물:
1. **extractor reference doc 5종 + provider supportsTools flag** — agentic 전환의 선행 작업 (ref doc 준비 + provider abstraction 확장).
2. **extractor agentic 전환 + loader 폐기** — host inject pattern 자체를 폐기, LLM 이 tool use 로 ref doc 직접 fetch. Phase 1 산출물 사용.
3. **builder generator 셀 라우팅 명시화** — `_inject_cell_value` heuristic 의존 제거, generator 차원에서 force 결정.
4. **pre-existing dead reference 정리** — 옛 fixture 이름 잔존 (`.claude/tests/`, `archive/`) 청소.

Phase 2 만 Phase 1 의존. Phase 3, 4 는 독립. 사용자 우선순위는 1 > 2 > 3 > 4.

## 진행 상태 요약

| Phase | 파일 | 항목 | 완료 | 진행률 | 상태 | 커밋 |
|-------|------|------|------|--------|------|------|
| 1 | [phase-01-extractor-reference-doc-expansion.md](./phase-01-extractor-reference-doc-expansion.md) | 6 | 6 | 100% | completed | `155e696` |
| 2 | [phase-02-extractor-agentic-conversion.md](./phase-02-extractor-agentic-conversion.md) | 4 | 0 | 0% | pending | - |
| 3 | [phase-03-builder-cell-routing-explicit.md](./phase-03-builder-cell-routing-explicit.md) | 5 | 0 | 0% | pending | - |
| 4 | [phase-04-dead-reference-cleanup.md](./phase-04-dead-reference-cleanup.md) | 4 | 0 | 0% | pending | - |
| **Total** | | **19** | **6** | **32%** | | |

## Phase 의존성

```
Phase 1 (독립) ← Phase 2 (depends_on [1])
Phase 3 (독립)
Phase 4 (독립)
```

Phase 1, 3, 4 는 scope 겹치지 않음 → 병렬 가능. Phase 2 는 Phase 1 의 ref doc + flag 사용.

## 우선순위

| 등급 | Phase | 설명 | 예상 시간 |
|------|-------|------|-----------|
| P0 | Phase 1 | ref doc 5종 작성 + provider supportsTools flag | 45분 |
| P0 | Phase 2 | extractor agentic 전환 + loader 폐기 | 60분 |
| P1 | Phase 3 | builder generator 라우팅 명시화 | 45분 |
| P2 | Phase 4 | pre-existing dead reference 정리 | 30분 |

## 권장 실행 순서

1. Phase 1 — ref doc + flag (사용자 결정 완료)
2. Phase 2 — extractor agentic 전환 (Phase 1 의존)
3. Phase 3 — builder routing 명시화
4. Phase 4 — dead ref 정리 (사용자 archive 결정 필요)

## 검증 체크리스트

### 공통 검증

- [ ] `python3 build_hwpx.py "inputs/시험지 제작/.v3cache/exam_data.json" outputs` 빌드 + validate exit 0
- [ ] `python3 tools/build_template_showcase.py` 빌드 + validate exit 0
- [ ] `npx tsc --noEmit` 통과 (ngd-studio)
- [ ] `npx vitest run` 전체 (ngd-studio) — 기존 31 + 신규 테스트 포함 통과

### 회귀 검증

- [ ] ngd-create-v4-coherence 산출물 (CHOICE_TABLE_MAP, make_syn_div_table, make_pascal_table 등) 동작 유지
- [ ] reference doc 추가가 기존 syn_div/Pascal doc 로딩 깨뜨리지 않음
- [ ] check_integrity.sh 갱신이 다른 검수 흐름 깨뜨리지 않음

### 크로스 플랫폼

- [ ] TS 측 path.join 사용, fs 호출 OS 분기 (extractor.ts doc loader)
- [ ] LF 줄바꿈 / encoding utf-8 명시

## 범위 밖 (touch 금지)

- ngd-create-v4-coherence 의 5 phase 산출물 본질적 동작 (이미 통과 + 사용자 시각 검증 OK)
- ngd-exam-* 에이전트 프롬프트 (extractor 의 reference doc 명세 외)
- `inputs/`, `outputs/` 의 사용자 데이터

## 관련 문서

- `docs/planning/ngd-create-v4-coherence/` — 선행 task (5 phase 모두 completed)
- `docs/planning/ngd-create-v4-coherence/schema.md` — fixture type 별 스키마 (Phase 1 의 입력)
- `docs/planning/ngd-create-v4-coherence/fixture_audit.md` — fixture 의미 audit (Phase 1, 2 참조)
- `docs/extractor-reference/syn_div_pascal.md` — Phase 1 의 확장 패턴 원형
- `tables.py` `_inject_cell_value` (line 22~) — Phase 2 의 대상 함수
