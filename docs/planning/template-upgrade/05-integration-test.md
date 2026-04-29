# Phase 5 — 통합 검증 (end-to-end 빌드)

> **에이전트 미션 브리프**: Phase 1~4 산출물을 모두 결합한 상태에서, 신규 양식지로 시험지 1건을 실제 빌드한다. 한컴오피스 호환성, 머릿말, 특수 테이블, 단원 태그 모두 정합성 확인. 회귀 발견 시 보고서에 기록하고 별도 이슈로 분리.

상위 문서: [00-overview.md](./00-overview.md)

## 1. 목표

신규 양식지 + 갱신된 base_hwpx + 갱신된 단원분류표 조합으로 다음을 모두 통과시킨다.

1. ngd-exam-create-v3 파이프라인이 에러 없이 완주.
2. 산출 HWPX의 ZIP 무결성·XML validity.
3. 한컴오피스 열기 가능 (수동 확인 — 가능한 환경에서).
4. 머릿말/꼬릿말 영역 정상 표시.
5. 특수 테이블(있는 경우)이 깨지지 않음.
6. 단원 태그가 신규 단원분류표와 일치.
7. 옛 양식지 기준 회귀가 없음 (이력 비교).

문제 발견 시 “수정”이 아니라 “보고” 우선. 회귀를 별도 이슈로 분리하고 본 페이즈는 “FAIL — 회귀 N건” 상태로 종료할 수 있다.

## 2. 사전 조건

- **Phase 1 완료**: 6개 파일의 경로 참조 갱신 완료, grep 검증 통과.
- **Phase 2 완료**: `diagnosis-report.md` 존재.
- **Phase 3 완료**: `base_hwpx/.backup-2022-05-20/` 백업 + 18개 XML 갱신, `extraction-report.md` 존재.
- **Phase 4 완료**: `unit_classification.json` 갱신, `unit-classification-report.md` 존재.
- 작업 디렉토리 루트(`/mnt/c/NGD`)에서 ngd-exam-create-v3 스킬 실행 가능.
- **샘플 PDF 1건 선정**: `inputs/시험지 제작/`의 PDF 중 1개 (예: `[04039]…[수2]…[2-1-b]…[대구][경북고]…[04039].pdf`).
  - 그림이 적은(또는 없는) PDF를 우선 선택 → figure 단계 실패 변수 최소화.
  - 데이터 테이블이 포함된 시험지를 1건 더 추가하면 특수 테이블 회귀 검증 가능.

## 3. 입력

| 항목 | 경로 |
|---|---|
| 신규 양식지 | `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` |
| 샘플 PDF (1차) | `/mnt/c/NGD/inputs/시험지 제작/[04039][고][2025][2-1-b][대구][경북고][수2][답지첨부][04039].pdf` |
| 샘플 PDF (2차, 데이터테이블 포함 후보) | `/mnt/c/NGD/inputs/시험지 제작/[04039][고][2025][3-1-b][경기부천시][소명여고][확통][미래엔][독립사건-통계적추정][04039].pdf` |
| 갱신된 base_hwpx | `/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx/` |
| 갱신된 unit_classification.json | `/mnt/c/NGD/.claude/data/unit_classification.json` |
| 비교용 이력 | `/mnt/c/NGD/ngd-studio/data/jobs/*.json` (옛 양식지 결과) |

## 4. 작업 단계

### 4.1 환경 점검

```bash
# Phase 1~4 산출물 확인
ls -la /mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx/.backup-2022-05-20/ | head
ls -la /mnt/c/NGD/docs/planning/template-upgrade/diagnosis-report.md \
       /mnt/c/NGD/docs/planning/template-upgrade/extraction-report.md \
       /mnt/c/NGD/docs/planning/template-upgrade/unit-classification-report.md

# Phase 1 잔여물 점검
grep -rn -F "기출작업양식지[2022" /mnt/c/NGD --include="*.md" --include="*.json" --include="*.sh" \
  --include="*.ts" --include="*.tsx" --include="*.py" 2>/dev/null \
  | grep -v "node_modules\|\.next\|ngd-studio/data/jobs\|\.backup-2022-05-20"
# 기대: 0건
```

### 4.2 1차 빌드 (간단 시험지)

다음 중 가능한 방법으로 실행:

**옵션 A: ngd-exam-create-v3 스킬 직접 호출 (권장)**

```
Claude Code에서:
/ngd-exam-create-v3 sample=[04039][...][수2]...pdf
```

**옵션 B: build_hwpx.py 직접 호출 (재현 빠름)**

```bash
# 정확한 호출 시그니처는 build_hwpx.py 인자 참조
python3 /mnt/c/NGD/build_hwpx.py \
  --template "/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx" \
  --json /tmp/sample_exam.json \
  --output /tmp/test_build.hwpx
```

(JSON은 reader 단계가 만들어줌. 옵션 B는 reader 결과 JSON이 이미 있을 때 유용.)

빌드 로그를 `/tmp/phase5_build_1.log`에 저장.

### 4.3 1차 산출물 검증

```bash
OUT=/tmp/test_build.hwpx     # 또는 outputs/ 안의 실제 파일

# (a) ZIP 무결성
unzip -t "$OUT" | tail -3
# 기대: "No errors detected in compressed data"

# (b) 필수 파일 포함 확인
unzip -l "$OUT" | grep -E "Contents/(content\.hpf|header\.xml|section0\.xml|masterpage0\.xml)"
# 기대: 4개 모두 있음

# (c) XML validity
python3 - <<'PY'
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile("$OUT") as z:
    for f in ['Contents/content.hpf', 'Contents/header.xml',
              'Contents/section0.xml', 'Contents/masterpage0.xml']:
        try:
            ET.fromstring(z.read(f))
            print(f, 'OK')
        except Exception as e:
            print(f, 'FAIL', e)
PY
```

### 4.4 시각 검증 (수동)

자동화 어려운 항목. 한컴오피스(또는 ZIP 풀어서 hp:p/hp:tbl 텍스트 확인)으로 다음 점검:

| 항목 | 확인 방법 |
|---|---|
| 한컴오피스 열기 | 한컴오피스에서 더블클릭 — 에러창 없이 열림 |
| 머릿말 | 학년/과정/과목/출판사/시험범위가 신규 양식지 머릿말 칸에 그대로 표시 |
| 본문 글꼴 | 나눔고딕 10pt (요청 시 다름) |
| 수식 | HYhwpEQ, 11pt, 글씨 깨짐 없음 |
| 단원 태그 | [중단원] 텍스트가 단원분류표 표기와 정확히 일치 |
| 페이지 레이아웃 | 양식지의 페이지 크기·여백 그대로 적용 |

자동 가능한 부분은 자동:

```bash
# (d) 단원 태그 일치성 (데이터 측 검증)
python3 - <<'PY'
import zipfile, json, re
with zipfile.ZipFile("$OUT") as z:
    sec = z.read('Contents/section0.xml').decode('utf-8')
tags = re.findall(r'\[중단원\][^<]+', sec)
print('found tags:', tags[:10])

with open('/mnt/c/NGD/.claude/data/unit_classification.json', encoding='utf-8') as f:
    uc = json.load(f)
all_topics = {t for s in uc['subjects'] for u in s['units'] for t in u['topics']}
mismatched = [t for t in tags if t.replace('[중단원]','').strip() not in all_topics]
print('mismatched:', mismatched)
PY
# 기대: mismatched = []
```

### 4.5 2차 빌드 (특수 테이블 포함 시험지)

확통(`[확통][미래엔][독립사건-통계적추정]`) 시험지로 빌드 → 표준정규분포표/확률분포표 등 특수 테이블 회귀 검증.

검증 항목 (4.3·4.4 포함):

- 특수 테이블이 본문에 정상 삽입되어 있음 (`<hp:tbl>` 검색).
- 셀 텍스트가 reader 단계 데이터와 일치.
- borderFill이 깨지지 않음 (h컴오피스에서 테두리 정상).

### 4.6 회귀 비교 (이력 vs 신규)

`ngd-studio/data/jobs/*.json` 중 1~2개 골라 옛 양식지 빌드 결과 메타데이터를 확인 (실제 산출 HWPX는 `outputs/` 또는 `data/`에 보존되어 있을 수 있음).

가능한 비교:
- 같은 PDF로 옛/신 양식지 빌드 → 머릿말 외 *본문* 영역의 hp:tbl/hp:pic 수가 동일한지.
- 신규에서만 누락/추가된 요소가 있는지 → 회귀 후보.

옛 양식지 빌드 결과 산출물이 보존되어 있지 않으면 본 단계는 “스킵 (이력 미보존)”으로 표시.

### 4.7 보고서 작성

```
/mnt/c/NGD/docs/planning/template-upgrade/integration-report.md
```

내용:

```markdown
# 통합 검증 보고서

## 1. 빌드 결과
| # | 입력 PDF | 결과 | 산출 HWPX | 빌드 로그 |
| 1 | [04039]…[수2]…   | PASS / FAIL | /tmp/test_build_1.hwpx | /tmp/phase5_build_1.log |
| 2 | [04039]…[확통]… | PASS / FAIL | /tmp/test_build_2.hwpx | /tmp/phase5_build_2.log |

## 2. 자동 검증 결과
| 검증 항목 | 1차 | 2차 |
| ZIP 무결성 | OK | OK |
| 4개 핵심 XML 파싱 | OK | OK |
| 단원 태그 일치 | OK / N건 불일치 | … |
| 특수 테이블 hp:tbl 카운트 | n/a | N개 (예상치와 일치) |

## 3. 시각 검증 결과 (수동)
| 항목 | 1차 | 2차 |
| 한컴오피스 열기 | (예/아니오) | … |
| 머릿말 표시 | (정상/깨짐) | … |
| 본문 글꼴 | … | … |
| 수식 | … | … |
| 페이지 레이아웃 | … | … |

## 4. 회귀 후보
- (이력 비교에서 발견된 차이를 항목별로)
- 각 항목에 대해 (a) 신규 양식지의 의도된 변경인지 (b) 회귀인지 구분
- 회귀로 판정 시: “별도 이슈 #N — 제목”

## 5. 결론
- 전체: PASS / FAIL — 회귀 N건
- (FAIL인 경우) 차후 해결까지 신규 양식지 사용을 어디까지 허용할지 권고

## 6. 다음 작업
- (PASS) 06-checklist 모두 [x], 본 작업군 완료
- (FAIL) 회귀 이슈 처리 후 본 페이즈 재실행
```

## 5. 산출물

| 파일 | 비고 |
|---|---|
| `/mnt/c/NGD/docs/planning/template-upgrade/integration-report.md` | 신규 |
| 테스트 HWPX 1~2개 | `/tmp/` 또는 `outputs/`. 영속 보관 불필요 |
| 빌드 로그 | `/tmp/phase5_build_*.log` |

## 6. 검증 (Acceptance Criteria)

- [ ] `integration-report.md` 6개 섹션 모두 채워짐
- [ ] 자동 검증(ZIP/XML/태그)이 모두 OK이거나 실패 항목이 명확히 기록됨
- [ ] 시각 검증 항목이 빠짐없이 체크됨 (수동 확인 결과 포함, 환경 제약으로 못한 항목은 “SKIP — 환경”)
- [ ] 회귀 발견 시 §4 §5에 명시
- [ ] PASS인 경우 [06-checklist.md](./06-checklist.md) 전체 완료 표시
- [ ] FAIL인 경우 신규 양식지 채택을 일시 중지하는 결정이 §5에 적혀있음

## 7. 주의사항

1. **롤백 시나리오**: FAIL이고 회귀가 심각하면, base_hwpx의 `.backup-2022-05-20/`을 활용해 즉시 롤백 (Phase 3 §10). 단 Phase 1의 경로 갱신은 그대로 두지 말고 함께 되돌릴지 결정 (보고서에 명시).

2. **한컴오피스 환경**: WSL에서는 한컴오피스 직접 실행 불가. 산출 HWPX를 Windows로 옮겨 수동 검증하거나, 검증 환경이 없으면 자동 검증만 통과시키고 시각 검증 항목은 “SKIP — 환경”으로 표시.

3. **샘플 선택의 함정**: 그림 많은 PDF를 1차로 쓰면 figure 단계의 nano-banana API 변수 때문에 양식지 변경 영향을 분리할 수 없다. 1차는 그림 적은 PDF, 2차는 데이터 테이블 위주.

4. **빌드 시간**: ngd-exam-create-v3는 reader→solver→figure→builder→checker 5단계. figure 단계는 LLM 호출 다수로 5~15분 소요 가능. 본 페이즈는 *전체 흐름 검증*이 목적이므로 충분한 시간 확보 필요.

5. **이력 데이터 보호**: 본 페이즈가 만드는 테스트 HWPX는 `ngd-studio/outputs/` 영구 디렉토리에 저장하지 않는다. `/tmp/` 임시 위치 사용. 영구 저장 시 작업자 혼란 방지를 위해 파일명에 `__phase5_test__` 접두사 권장.

6. **신규 회귀 vs 기존 버그**: 본 페이즈에서 발견되는 모든 문제가 양식지 교체로 인한 것은 아니다. 옛 양식지로 동일 PDF를 빌드해 같은 문제가 재현되면 *기존 버그*로 분류 → 본 페이즈 PASS 판정 가능 (단 보고서에 명시).

## 8. 함정

- builder가 stderr로 경고만 내고 완주하는 경우(silent regression). stderr/로그 파싱 시 “WARN/ERROR” grep 필수.
- 옛 양식지로는 동작했으나 신규 양식지에서 깨지는 미묘한 케이스 (charPrIDRef 매핑) → 시각 검증에서만 잡힌다.
- ngd-exam-create-v3는 환경변수/캐시(`/.v3cache/`)에 의존. 본 페이즈는 캐시 비활성화 또는 캐시 폴더 비우고 시작 권장.

## 9. 작업 시간 가이드

- 4.1 환경 점검: 5분
- 4.2 1차 빌드: 5~15분 (reader/solver/figure/builder/checker)
- 4.3 자동 검증: 10분
- 4.4 시각 검증: 15분 (한컴 환경 있을 때)
- 4.5 2차 빌드: 5~15분
- 4.6 회귀 비교: 20분
- 4.7 보고서: 15분

총 ~80~110분.

## 10. 참조

- ngd-exam-create-v3 스킬: `/mnt/c/NGD/.claude/skills/ngd-exam-create-v3/skill.md`
- builder: `/mnt/c/NGD/build_hwpx.py`
- 검수 에이전트(checker): `/mnt/c/NGD/.claude/agents/ngd-exam-checker.md`
- 사전 페이즈 보고서: `diagnosis-report.md`, `extraction-report.md`, `unit-classification-report.md`
