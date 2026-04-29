# 양식지 교체 후속작업 — 통합 체크리스트

> 5개 페이즈의 진행 상태를 추적한다. 각 항목 완료 시 `[x]`로 표기.
> 페이즈별 상세 명세는 각 문서 참조.

상위 문서: [00-overview.md](./00-overview.md)

---

## Phase 1: 경로 참조 일괄 교체 → [01-path-references.md](./01-path-references.md)

### 사전 검증
- [x] 신규 양식지 파일 존재 확인 (`ngd-studio/inputs/시험지 제작/[…2025년08월10일].hwpx`)
- [x] 옛 양식지 파일 보존 확인 (`inputs/시험지 제작/[…2022년5월20일].hwpx`)
- [x] 변경 대상 8건 grep 일치

### 경로 갱신 (8건)
- [x] `.claude/skills/ngd-exam-create/SKILL.md:28`
- [x] `.claude/skills/ngd-exam-create/SKILL.md:81`
- [x] `.claude/skills/ngd-exam-create-v3/skill.md:137`
- [x] `.claude/skills/ngd-exam-create-v3/skill.md:512`
- [x] `docs/builder-upgrade-todo.md:57`
- [x] `docs/hwpx-templates.md:3`
- [x] `ngd-studio/scripts/test-sse.sh:13` (HWPX_TEMPLATE_PATH)
- [x] `.claude/data/unit_classification.json:3` (source 필드)

### 사후 검증
- [x] 옛 경로 잔여 grep 0건 (ngd-studio/data/jobs 제외)
- [x] 신규 경로 grep 8건 이상
- [x] `unit_classification.json` valid JSON
- [x] `git diff`로 의도하지 않은 변경 없음 확인

---

## Phase 2: 신규 양식지 진단 → [02-template-diagnosis.md](./02-template-diagnosis.md)

### 비교/추출
- [x] ZIP 구조 변화 표 작성
- [x] `content.hpf` 비교 (item 추가/삭제/변경)
- [x] `header.xml` charPr/paraPr/borderFill/style ID 매핑 표
- [x] `header.xml` 기준 builder 영향 분석 (`build_hwpx.py` charPrIDRef 사용처)
- [x] `masterpage0.xml` 머릿말/꼬릿말 변경 요약
- [x] `section0.xml` secPr 변경 요약
- [x] 단원분류표(8p) raw 텍스트 추출 (Phase 4 입력)
- [x] 18개 base_hwpx 템플릿 매핑 표 (UNCHANGED/CHANGED/MISSING)
- [x] NEW 템플릿 후보 식별

### 산출물
- [x] `docs/planning/template-upgrade/diagnosis-report.md` 생성 (9개 섹션 모두)
- [x] §6 18개 행 모두 분류 완료
- [x] §3.5 builder 영향 분석 결론 명시
- [x] §8/§9 다음 페이즈 권고 작성

---

## Phase 3: base_hwpx 재추출 → [03-base-hwpx-extraction.md](./03-base-hwpx-extraction.md)

### 백업
- [ ] `.backup-2022-05-20/` 디렉토리 생성
- [ ] 기존 18개 XML + 보조 파일 모두 백업됨
- [ ] 백업 위치 확인 (cp -a 보존 모드)

### 재추출 (CHANGED만)
- [ ] `bogi_table_3items.xml`
- [ ] `bogi_table_6items.xml`
- [ ] `choice_table_5x5.xml`
- [ ] `choice_table_6x3.xml`
- [ ] `choice_table_6x4.xml`
- [ ] `choice_table_9x4.xml`
- [ ] `condition_rect_template.xml`
- [ ] `empty_box_template.xml`
- [ ] `header_area_template.xml`
- [ ] `normal_dist_3rows.xml`
- [ ] `normal_dist_4rows.xml`
- [ ] `normal_dist_5rows.xml`
- [ ] `prob_dist_5cols.xml`
- [ ] `prob_dist_6cols.xml`
- [ ] `prob_dist_7cols.xml`
- [ ] `proof_table_template.xml`
- [ ] `content_hpf_template.xml`
- [ ] `(보조 파일들)`

(UNCHANGED 표시된 항목은 “미변경 확인 완료”로 체크)

### 부산물 폴더 처리
- [ ] `BinData/` 사용처 확인
- [ ] `Contents/` 사용처 확인
- [ ] `META-INF/` 사용처 확인
- [ ] `Preview/` 사용처 확인
- [ ] 사용처 기준 갱신/보존 결정

### ID 매핑 분석
- [ ] builder의 charPrIDRef/paraPrIDRef/borderFillIDRef 사용처 grep
- [ ] 신규 양식지 매핑과 일치 여부 판정
- [ ] 충돌 시 별도 이슈 분리

### 검증
- [ ] 18개 XML 파싱 OK
- [ ] 행/열 수 검증 OK
- [ ] 폰트 ID 존재성 검증 OK
- [ ] `extraction-report.md` 생성 (5개 섹션)

---

## Phase 4: 단원분류표 재검증 → [04-unit-classification.md](./04-unit-classification.md)

### 비교
- [ ] 신규 양식지 8p 단원분류표 텍스트 (Phase 2 §5.2 재활용)
- [ ] 기존 JSON 파싱
- [ ] 1:1 비교 — UNCHANGED/REORDERED/RENAMED/ADDED/REMOVED 분류

### 갱신
- [ ] `source` 필드 갱신 (Phase 1과 일치)
- [ ] (필요 시) `version` 필드 갱신
- [ ] subjects/units/topics 배열 동기화

### 검증
- [ ] valid JSON
- [ ] 신규 양식지와 1:1 일치
- [ ] 카운트 표 (subjects/units/topics) 보고서에 기재
- [ ] EOL = LF
- [ ] `unit-classification-report.md` 생성 (6개 섹션)

---

## Phase 5: 통합 검증 → [05-integration-test.md](./05-integration-test.md)

### 사전
- [ ] Phase 1~4 완료 확인
- [ ] `.backup-2022-05-20/` 보존 확인 (롤백 대비)
- [ ] 옛 경로 잔여 grep 0건 (ngd-studio/data/jobs, .backup 제외)

### 1차 빌드 (간단 시험지)
- [ ] 빌드 완주 (에러 없음)
- [ ] ZIP 무결성 OK
- [ ] 4개 핵심 XML 파싱 OK
- [ ] 단원 태그 일치 OK
- [ ] 한컴오피스 열기 OK (수동 / SKIP)
- [ ] 머릿말 정상
- [ ] 본문 글꼴 OK
- [ ] 페이지 레이아웃 OK

### 2차 빌드 (특수 테이블 포함)
- [ ] 빌드 완주
- [ ] hp:tbl 카운트 예상치 일치
- [ ] 셀 텍스트 reader 결과와 일치
- [ ] borderFill 정상 (수동 / SKIP)

### 회귀 비교
- [ ] 이력 (옛 양식지 빌드 결과)와 비교 (가능 시)
- [ ] 회귀 후보 분류 (의도된 변경 / 회귀)

### 산출물
- [ ] `integration-report.md` 생성 (6개 섹션)
- [ ] PASS/FAIL 결론
- [ ] (FAIL인 경우) 회귀 이슈 분리 + 양식지 사용 일시 중지 결정

---

## 진행 상태 요약

| Phase | 항목 수 | 완료 | 상태 | 보고서 |
|---|---|---|---|---|
| 1: 경로 참조 | 14 | 14 | ✅ 완료 | (간단 — 별도 보고서 없음) |
| 2: 신규 양식지 진단 | 13 | 13 | ✅ 완료 | `diagnosis-report.md` |
| 3: base_hwpx 재추출 | 27 | 0 | ⬜ 대기 | `extraction-report.md` |
| 4: 단원분류표 재검증 | 11 | 0 | ⬜ 대기 | `unit-classification-report.md` |
| 5: 통합 검증 | 18 | 0 | ⬜ 대기 | `integration-report.md` |
| **합계** | **83** | **27** | 🟡 진행중 | — |

상태 표기: ⬜ 대기 / 🟡 진행중 / ✅ 완료 / ❌ FAIL (회귀)

## 의존관계

```
Phase 1 ─────┐
             │
Phase 2 ──┬──┼──► Phase 3 ──┐
          │  │              │
          └──┼──► Phase 4 ──┼──► Phase 5
             │              │
        Phase 1 결과 ───────┘
```

- Phase 1, 2는 병렬 가능.
- Phase 3, 4는 Phase 2 완료 후 병렬 가능.
- Phase 5는 1~4 모두 완료 후.

## 위험 표시

각 페이즈에서 다음 신호가 보이면 즉시 중단하고 사용자에게 보고:

- Phase 2: charPrIDRef 매핑이 *완전히* 다르거나 (예: 모든 ID 의미 변경), 양식지가 새 교과과정으로 전환됨.
- Phase 3: 18개 중 5개 이상이 MISSING (양식지가 본질적으로 다른 양식).
- Phase 4: 과목 코드 자체가 변경됨 (수상→수I 같은).
- Phase 5: 자동 검증에서 ZIP 무결성 또는 4개 핵심 XML 파싱이 실패.
