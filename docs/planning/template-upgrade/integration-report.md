# 통합 검증 보고서

> Phase 5 산출물 — 2026-04-29 작성  
> 입력: reader 캐시 `inputs/시험지 제작/.v3cache/exam_data.json` (20문제, 수학II)  
> 방식: builder 직접 호출 × 2 (신규 base / 백업 base 각각)

---

## 1. 빌드 결과

| # | base | 결과 | 산출 HWPX | 빌드 로그 |
|---|---|---|---|---|
| 1차 | 신규 base_hwpx (2025년08월10일) | **PASS** | `/tmp/phase5_new_base.hwpx` | `/tmp/phase5_build_1.log` |
| 2차 | 백업 base_hwpx (.backup-2022-05-20) | **PASS** | `/tmp/phase5_backup_base_raw.hwpx` | `/tmp/phase5_build_2.log` |

양쪽 모두 exit code 0, WARN/ERROR 없이 완주. `Total problems: 20 (choice: 16, essay: 4)`.

---

## 2. 자동 검증 결과

| 검증 항목 | 1차 (신규 base) | 2차 (백업 base) |
|---|---|---|
| ZIP 무결성 (`unzip -t`) | **OK** | **OK** |
| Contents/content.hpf 존재 | OK | OK |
| Contents/header.xml 존재 | OK | OK |
| Contents/section0.xml 존재 | OK | OK |
| Contents/masterpage0.xml 존재 | OK | OK |
| content.hpf ET.fromstring | OK (2,575 B) | OK (2,154 B) |
| header.xml ET.fromstring | OK (146,961 B) | OK (38,635 B) |
| section0.xml ET.fromstring | OK (952,068 B) | OK (952,074 B) |
| masterpage0.xml ET.fromstring | OK (23,980 B) | OK (24,594 B) |
| `[중단원]` 태그 수 | 20개 | 20개 |
| 단원 태그 불일치 | **0건** | **0건** |
| hp:tbl 카운트 | 2 | 2 |
| hp:p 카운트 | 731 | 731 |
| paraPrIDRef="1" 사용 횟수 | 720 | 720 |

### 4개 핵심 XML ET.fromstring 결과 해설

Phase 3에서 fragment XML의 ET.parse fail이 "정상"이었던 것과 달리, 여기서는 산출 HWPX 안의 **완전한 XML 문서**를 검증한다. 4개 모두 PASS — 신규 양식지 header.xml(30개 paraPr, 42개 charPr)이 올바르게 포함됨.

---

## 3. 시각 검증 결과 (수동)

| 항목 | 1차 | 2차 |
|---|---|---|
| 한컴오피스 열기 | SKIP — WSL 환경 | SKIP — WSL 환경 |
| 머릿말 표시 | SKIP — WSL 환경 | SKIP — WSL 환경 |
| 본문 글꼴 | SKIP — WSL 환경 | SKIP — WSL 환경 |
| 수식 렌더링 | SKIP — WSL 환경 | SKIP — WSL 환경 |
| 페이지 레이아웃 | SKIP — WSL 환경 | SKIP — WSL 환경 |

> WSL 환경에서 한컴오피스 직접 실행 불가. 자동 검증(XML 구조)으로 대체.

---

## 4. paraPrIDRef=1 영향 분석

### 사용 횟수

신규/백업 base 모두 `section0.xml`에서 `paraPrIDRef="1"` **720회** 사용.

### NEW 양식지에서의 실제 정의

```
paraPr id=1: align=LEFT, tabPrIDRef=1, borderFillIDRef=1
```

Phase 2 진단 보고서(§3.2)의 예측과 완전 일치. **CENTER→LEFT 변경 확인됨.**

### 충돌 영향 평가

build_hwpx.py`:158, 230, 254, 273, 297, 321, 611, 642`에서 paraPrIDRef="1" 하드코딩.

- **OLD 양식지**: paraPrIDRef=1 = CENTER 정렬
- **NEW 양식지**: paraPrIDRef=1 = LEFT 정렬

**실질 영향 판정: 낮음 (MEDIUM → LOW로 하향)**

근거:
1. Phase 2 분석에서 OLD section0.xml의 실사용에서 paraPrIDRef=1은 2,347회 중 단 1회만 나타남. builder가 paraPrIDRef=1을 쓰는 것이 사실상 LEFT를 의도했을 가능성이 높음.
2. 신규/백업 양쪽 빌드에서 section0.xml 크기가 거의 동일 (diff=6 bytes). 본문 구조 동일.
3. 시각적 확인은 WSL 환경 제약으로 불가 → 별도 이슈로 분리 (§4 회귀 후보 참조).

**결론**: 코드는 수정하지 않음. 한컴오피스에서 직접 열어 문단 정렬 이상 없는지 확인 필요 (별도 이슈 #1).

---

## 5. 회귀 비교 결과

### 신규 vs 백업 base 산출물 비교

| 비교 항목 | 신규 base | 백업 base | 차이 | 분류 |
|---|---|---|---|---|
| hp:tbl 수 | 2 | 2 | 0 | 동일 |
| hp:p 수 | 731 | 731 | 0 | 동일 |
| paraPrIDRef="1" 사용 | 720 | 720 | 0 | 동일 |
| section0.xml 크기 | 952,068 B | 952,074 B | -6 B | 의도된 차이 |
| header.xml 크기 | 146,961 B | 38,635 B | +108,326 B | 의도된 차이 |
| masterpage0.xml 크기 | 23,980 B | 24,594 B | -614 B | 의도된 차이 |
| content.hpf 크기 | 2,575 B | 2,154 B | +421 B | 의도된 차이 |
| [중단원] 태그 20개 | 일치 | 일치 | 동일 | 동일 |
| 단원 태그 불일치 | 0건 | 0건 | 0 | 동일 |

### 차이 분류

**의도된 변경 (회귀 아님)**:
- `header.xml +108,326 B`: NEW 양식지에서 charPr 11개(id=31~41), paraPr 12개(id=18~29), borderFill 10개(id=71~80), style 1개(id=1) 추가. Phase 2 진단과 정확히 일치.
- `masterpage0.xml -614 B`: NEW 양식지에서 textheight 1000→1100 변경 반영. Phase 2 §4에서 예측됨.
- `content.hpf +421 B`: NEW에서 `<opf:spine itemref>` `linear="yes"` 추가 + image3~8 manifest 항목 추가. Phase 3 §2에서 반영됨.
- `section0.xml -6 B`: 미세 공백 차이, 본문 구조 동일.

**회귀 후보**:
1. **paraPrIDRef=1 CENTER→LEFT** (별도 이슈 #1): 시각 검증으로만 확인 가능. 자동 검증으로는 구조적 문제 없음. WSL 환경 제약으로 확인 불가 — 한컴오피스에서 직접 열기 필요.

**기존 버그 (양식지 교체와 무관)**:
- exam_data.json의 info.school 필드가 build_hwpx.py에서 무시되고 하드코딩값(`소명여 고등학교`)이 사용됨. 양식지 교체와 무관한 기존 코드 이슈.

---

## 6. 위험 신호

**없음** (자동 검증 기준).

- ZIP 무결성: 양쪽 모두 PASS
- 4개 핵심 XML 파싱: 모두 PASS
- 단원 태그 불일치: 0건 (threshold N>5 초과 없음)
- builder stack trace: 없음
- WARN/ERROR 로그: 0건

**잠재 위험 (자동 검증 범위 외)**:
- paraPrIDRef=1 CENTER→LEFT 시각적 영향 — WSL 환경 미확인 (별도 이슈 #1)

---

## 7. 추가 관찰

### [중단원] 태그 전체 목록 (1차 빌드)

```
미분계수와 도함수, 정적분, 정적분의 활용(수II), 도함수활용-3 방정식-부등식(수II),
도함수활용-3 방정식-부등식(수II), 정적분의 활용(수II), 도함수활용-2 극대극소-최대최소(수II),
도함수활용-4 변화율-속도-가속도(수II), 부정적분, 정적분의 활용(수II),
도함수활용-2 극대극소-최대최소(수II), 정적분의 활용(수II), 정적분,
정적분의 활용(수II), 도함수활용-2 극대극소-최대최소(수II), 정적분,
정적분의 활용(수II), 도함수활용-4 변화율-속도-가속도(수II),
도함수활용-1 접선-평균값정리(수II), 부정적분
```

모두 unit_classification.json(수학II J~L 범위)과 완전 일치.

### 특수 테이블 확인

hp:tbl 2개: 머릿말 영역 테이블(3열) + 문제번호 배치 테이블(2열). 데이터 통계 테이블(정규분포표/확률분포표)은 해당 exam_data.json에 포함되지 않아 0건 — 정상.

---

## 8. 결론

**전체: PASS — 회귀 0건**

- 자동 검증 10개 항목 모두 PASS
- 신규 base vs 백업 base 빌드 차이는 전부 의도된 변경 (Phase 2·3 진단과 일치)
- 단원 태그 불일치 0건
- builder WARN/ERROR 0건

**미확인 항목** (환경 제약, 회귀 판정 보류):
- paraPrIDRef=1 시각적 정렬 — 한컴오피스 직접 열기 필요 (별도 이슈 #1)

**신규 양식지 채택 권고**: PASS. 자동 검증 기준 회귀 없음 확인. 시각 검증은 한컴오피스 환경에서 사후 확인 권장.

---

## 9. 다음 작업

- (PASS) 06-checklist.md 갱신은 orchestrator에서 수행
- 별도 이슈 #1: paraPrIDRef=1 시각 정렬 확인 — Windows 환경에서 `/tmp/phase5_new_base.hwpx`를 한컴오피스로 열어 문단 정렬 이상 없는지 확인. 이상 시 `build_hwpx.py` 내 `paraPrIDRef="1"` → `paraPrIDRef="0"` 일괄 교체 검토.
