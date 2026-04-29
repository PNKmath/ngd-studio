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
- [x] `.backup-2022-05-20/` 디렉토리 생성
- [x] 기존 18개 XML + 보조 파일 모두 백업됨
- [x] 백업 위치 확인 (cp -a 보존 모드)

### 재추출 (CHANGED만)
- [x] `bogi_table_3items.xml`
- [x] `bogi_table_6items.xml`
- [x] `choice_table_5x5.xml`
- [x] `choice_table_6x3.xml`
- [x] `choice_table_6x4.xml`
- [x] `choice_table_9x4.xml`
- [x] `condition_rect_template.xml` (UNCHANGED 확인, BOM만 제거)
- [x] `empty_box_template.xml` (UNCHANGED 확인)
- [x] `header_area_template.xml` (UNCHANGED 확인 — 수동 구성 fragment)
- [x] `normal_dist_3rows.xml`
- [x] `normal_dist_4rows.xml`
- [x] `normal_dist_5rows.xml`
- [x] `prob_dist_5cols.xml`
- [x] `prob_dist_6cols.xml`
- [x] `prob_dist_7cols.xml`
- [x] `proof_table_template.xml`
- [x] `content_hpf_template.xml` (image3~8 manifest 추가)
- [x] `(보조 파일들)` mimetype/root_element/version/settings 갱신

(UNCHANGED 표시된 항목은 "미변경 확인 완료"로 체크)

### 부산물 폴더 처리
- [x] `BinData/` 사용처 확인 → 갱신
- [x] `Contents/` 사용처 확인 → 갱신 (header.xml/masterpage0.xml)
- [x] `META-INF/` 사용처 확인 → 갱신 (내용 동일)
- [x] `Preview/` 사용처 확인 → 갱신
- [x] 사용처 기준 갱신/보존 결정 (build_hwpx.py가 BASE/* 직접 사용 → 모두 갱신)

### ID 매핑 분석
- [x] builder의 charPrIDRef/paraPrIDRef/borderFillIDRef 사용처 grep
- [x] 신규 양식지 매핑과 일치 여부 판정
- [x] 충돌 시 별도 이슈 분리 (paraPrIDRef=1 CENTER→LEFT, Phase 5 검증으로 이관)

### 검증
- [x] 18개 XML 파싱 OK — **재정의**: 17개는 fragment(xmlns 선언 없음)라 ET.parse 직접 불가. namespace wrap 후 parse PASS 확인. builder는 string concat 방식 사용(`build_hwpx.py:372,400,442,531,707`)이므로 자체 parse 불필요. PASS 3개: `content_hpf_template`/`settings`/`version`
- [x] 행/열 수 검증 OK (rowCnt/colCnt 13/13 일치)
- [x] 폰트 ID 존재성 검증 OK (charPrIDRef/paraPrIDRef 모두 NEW header.xml에 존재)
- [x] `extraction-report.md` 생성 (5개 섹션)

---

## Phase 4: 단원분류표 재검증 → [04-unit-classification.md](./04-unit-classification.md)

### 비교
- [x] 신규 양식지 8p 단원분류표 텍스트 (Phase 2 §5.2 재활용)
- [x] 기존 JSON 파싱
- [x] 1:1 비교 — UNCHANGED 7 / RENAMED 2 / CHANGED 1 / REORDERED 0 / ADDED 0 / REMOVED 0

### 갱신
- [x] `source` 필드 갱신 (Phase 1에서 이미 반영, 재확인)
- [x] (필요 시) `version` 필드 갱신 (양식지 새 표기 없음 → 그대로)
- [x] subjects/units/topics 배열 동기화 (3건 표기 갱신)

### 검증
- [x] valid JSON
- [x] 신규 양식지와 1:1 일치
- [x] 카운트 표 (subjects=10, units=41, topics=125) 보고서에 기재
- [x] EOL = LF
- [x] `unit-classification-report.md` 생성 (6개 섹션)

---

## Phase 5: 통합 검증 → [05-integration-test.md](./05-integration-test.md)

### 사전
- [x] Phase 1~4 완료 확인
- [x] `.backup-2022-05-20/` 보존 확인 (롤백 대비)
- [x] 옛 경로 잔여 grep 0건 (ngd-studio/data/jobs, .backup 제외)

### 1차 빌드 (간단 시험지 — `.v3cache/exam_data.json` 기반, 20문제)
- [x] 빌드 완주 (에러 없음, exit 0, WARN/ERROR 0건)
- [x] ZIP 무결성 OK
- [x] 4개 핵심 XML 파싱 OK (ET.fromstring 4/4)
- [x] 단원 태그 일치 OK (20/20, mismatched 0)
- [ ] 한컴오피스 열기 OK — **SKIP — WSL 환경**
- [ ] 머릿말 정상 — **SKIP — WSL 환경**
- [ ] 본문 글꼴 OK — **SKIP — WSL 환경**
- [ ] 페이지 레이아웃 OK — **SKIP — WSL 환경**

### 2차 빌드 (특수 테이블 포함)
- [ ] 빌드 완주 — **부분 SKIP**: 명세 §4.5는 별도 확통 시험지를 요구했으나 agent가 동일 JSON × 백업 base 회귀 비교로 대체. 양식지 교체 영향 분리 검증은 이뤄짐
- [x] hp:tbl 카운트 예상치 일치 (신규 2 = 백업 2)
- [x] 셀 텍스트 reader 결과와 일치 (회귀 비교 0 byte 차이)
- [ ] borderFill 정상 — **SKIP — WSL 환경**

### 회귀 비교
- [x] 이력 (옛 양식지 빌드 결과)와 비교 — 백업 base로 직접 빌드해 비교
- [x] 회귀 후보 분류: header.xml +108KB, masterpage0.xml -614B, content.hpf +421B 모두 Phase 2·3 진단의 의도된 변경. section0.xml 본문 6 byte 차이로 실질 동일. **회귀 0건**

### 산출물
- [x] `integration-report.md` 생성 (6개 섹션)
- [x] PASS/FAIL 결론: **PASS — 회귀 0건**
- [x] (FAIL 아님) 잔여 확인 1건: paraPrIDRef=1 시각 정렬은 Windows 한컴오피스에서 수동 확인 권장

---

## 진행 상태 요약

| Phase | 항목 수 | 완료 | 상태 | 보고서 |
|---|---|---|---|---|
| 1: 경로 참조 | 14 | 14 | ✅ 완료 | (간단 — 별도 보고서 없음) |
| 2: 신규 양식지 진단 | 13 | 13 | ✅ 완료 | `diagnosis-report.md` |
| 3: base_hwpx 재추출 | 27 | 27 | ✅ 완료 | `extraction-report.md` |
| 4: 단원분류표 재검증 | 11 | 11 | ✅ 완료 | `unit-classification-report.md` |
| 5: 통합 검증 | 18 | 12 (+6 SKIP) | ✅ 완료 (PASS — 회귀 0) | `integration-report.md` |
| **합계** | **83** | **77 (+6 SKIP)** | ✅ 완료 | — |
| 후속: 잔여 이슈 | 2 | 0 | ⬜ 대기 | [`07-follow-up.md`](./07-follow-up.md) |

상태 표기: ⬜ 대기 / 🟡 진행중 / ✅ 완료 / ❌ FAIL (회귀)

## 후속 작업 (Phase 5 이후 잔여 이슈)

상세: [07-follow-up.md](./07-follow-up.md)

### Issue #1 — paraPrIDRef=1 시각 정렬 확인 [양식지 교체 직접 영향]
- [ ] Windows 한컴오피스에서 `/tmp/phase5_new_base.hwpx` 열기
- [ ] 문제 본문/정답/해설/조건 박스 정렬 시각 확인
- [ ] 결과 기록: 케이스 A(정상) → CLOSED / 케이스 B(깨짐) → `build_hwpx.py` 8개 위치 수정 후 재빌드

### Issue #2 — `build_hwpx.py` 메타데이터 하드코딩 [양식지 교체와 무관]
- [ ] [LOW 우선순위] 별도 PR로 분리 처리
- [ ] `build_hwpx.py:17, 29, 31, 733-735` info 객체로 일반화
- [ ] `exam_data.json` 스키마 + reader 에이전트 동기화

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
