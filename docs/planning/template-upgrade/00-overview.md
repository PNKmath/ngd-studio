# 양식지 교체 후속작업 — 개요

> 기출작업양식지가 `[2022년5월20일]` 버전에서 `[2025년08월10일]` 버전으로 교체되었다.
> 본 문서군은 그에 따른 후속작업을 5개 페이즈로 분해하고, 각 페이즈를 sonnet 에이전트가 단독으로 실행할 수 있도록 명세한다.

## 문서 인덱스

| 문서 | 페이즈 | 역할 |
|---|---|---|
| [00-overview.md](./00-overview.md) | — | 전체 개요, 변경 요약, 페이즈 의존관계 (현재 문서) |
| [01-path-references.md](./01-path-references.md) | Phase 1 | 6개 위치 경로 문자열 일괄 교체 |
| [02-template-diagnosis.md](./02-template-diagnosis.md) | Phase 2 | 신규 양식지 변경점 진단 (`diagnosis-report.md` 생성) |
| [03-base-hwpx-extraction.md](./03-base-hwpx-extraction.md) | Phase 3 | `base_hwpx/*.xml` 18개 템플릿 재추출 |
| [04-unit-classification.md](./04-unit-classification.md) | Phase 4 | `unit_classification.json` 단원분류표 재검증 |
| [05-integration-test.md](./05-integration-test.md) | Phase 5 | 신규 양식지 + 갱신 산출물로 end-to-end 빌드 검증 |
| [06-checklist.md](./06-checklist.md) | — | 통합 체크리스트 / 진행 추적 |

---

## 1. 배경

`/mnt/c/NGD` 프로젝트는 양식지(template) HWPX의 ZIP 구조를 기반으로 새 시험지 HWPX를 조립한다. 양식지는 다음 두 갈래로 사용된다.

1. **builder의 base_template**: section0.xml/header.xml/masterpage0.xml/content.hpf의 골격을 그대로 빌리고, 본문만 교체하여 출력 HWPX를 만든다.
2. **참조 데이터 추출원**: 단원분류표(8p), 특수 테이블 XML(보기/확률분포/정규분포/조립제법 등)을 양식지에서 사전 추출하여 `.claude/skills/ngd-exam-create/base_hwpx/`와 `.claude/data/unit_classification.json`에 보관한다.

따라서 양식지가 바뀌면 위 두 경로 모두에 영향이 간다. 단순 파일명 교체로는 끝나지 않는다.

## 2. 변경 요약 (실측)

기존: `/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` (337.9 KB) — **루트에 그대로 보존**

신규: `/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` (352.1 KB)

ZIP 내부 파일별 변화:

| 파일 | 기존 | 신규 | 변화 |
|---|---|---|---|
| `Contents/header.xml` | 118,289 B | 146,961 B | **+24%** (스타일/charPr 정의 다수 추가 가능성 ↑) |
| `Contents/section0.xml` | 2,125,276 B | 2,060,225 B | -3% (본문 슬림화) |
| `Contents/masterpage0.xml` | 24,028 B | 23,980 B | 미세변경 (머릿말/꼬릿말) |
| `Contents/content.hpf` | 2,629 B | 2,708 B | +3% (BinData 등록 항목 변동 가능) |
| `Preview/PrvImage.png` | 81,093 B | 84,191 B | 미리보기 갱신 |
| `Preview/PrvText.txt` | 2,292 B | 2,306 B | 미리보기 갱신 |
| `settings.xml` | 281 B | 282 B | 거의 동일 |

영향이 큰 것은 **header.xml**(스타일 ID 매핑 변경 가능성)과 **section0.xml**(템플릿 추출 위치 변경)이다.

## 3. 영향 범위 (touched paths)

### A. 경로 문자열만 갱신하면 되는 곳 — Phase 1
1. `.claude/skills/ngd-exam-create/SKILL.md:28, 81`
2. `.claude/skills/ngd-exam-create-v3/skill.md:137, 512`
3. `docs/builder-upgrade-todo.md:57`
4. `docs/hwpx-templates.md:3`
5. `ngd-studio/scripts/test-sse.sh:13` (`HWPX_TEMPLATE_PATH` 기본값)
6. `.claude/data/unit_classification.json:3` (`source` 필드)

### B. 양식지 변경에 따라 재추출이 필요한 곳 — Phase 2~4
- `.claude/skills/ngd-exam-create/base_hwpx/*.xml` (18개 추출 템플릿)
- `.claude/data/unit_classification.json` (단원분류표 본문)
- (필요 시) `docs/hwpx-pitfalls.md` — charPr/paraPr ID 매핑 표

### C. 절대 건드리지 않는 곳
- `/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` — **옛 양식지 그대로 보존**
- `ngd-studio/data/jobs/*.json` — 과거 작업 이력 8건. 옛 양식지 기준으로 실행된 기록이므로 보존
- `ngd-studio/.next/` — 빌드 캐시
- `build_hwpx.py`의 코드 본체 — 양식지 경로를 하드코딩하지 않으므로 코드 수정 불필요 (인자/환경변수로 받음)

## 4. 페이즈 의존관계

```
Phase 1 (path refs) ──┐
                      │
Phase 2 (diagnosis) ──┼──► Phase 3 (base_hwpx 재추출) ──┐
                      │                                 │
                      └──► Phase 4 (단원분류표 재검증) ──┼──► Phase 5 (통합 검증)
                                                        │
                                       Phase 1 결과 ────┘
```

- **Phase 1과 Phase 2는 병렬 가능**. Phase 1은 단순 문자열 교체, Phase 2는 조사.
- **Phase 3**은 Phase 2의 진단 보고서를 입력으로 받아 18개 XML을 재추출.
- **Phase 4**도 Phase 2의 진단을 참고하나, 8p 텍스트만 보면 되므로 Phase 2와 부분 병렬 가능.
- **Phase 5**는 모든 페이즈가 끝나야 시작.

## 5. 산출물 요약

| Phase | 신규/수정 파일 | 비고 |
|---|---|---|
| 1 | 6개 파일의 경로 문자열 교체 | 단순 sed |
| 2 | `docs/planning/template-upgrade/diagnosis-report.md` (신규) | 변경점 카탈로그 |
| 3 | `.claude/skills/ngd-exam-create/base_hwpx/*.xml` 18개 갱신 + `.backup-2022-05-20/` 보존 | 기존 백업 후 교체 |
| 4 | `.claude/data/unit_classification.json` 갱신 | source + 본문 |
| 5 | `docs/planning/template-upgrade/integration-report.md` (신규) + 테스트 빌드 1개 | 회귀 검증 |

## 6. 작업 원칙

1. **옛 양식지 보존**: 루트 `inputs/시험지 제작/[…2022년5월20일].hwpx`는 절대 삭제·이동 금지. 비교/회귀용으로 유지.
2. **신규 양식지 위치 고정**: `ngd-studio/inputs/시험지 제작/[…2025년08월10일].hwpx`. 다른 곳에 복사하지 않는다.
3. **모든 경로 참조는 ngd-studio 경로로 통일**: 루트에서 실행되는 스킬도 `ngd-studio/inputs/시험지 제작/…` 형태로 참조한다 (Phase 1 명세 참조).
4. **백업 후 변경**: `base_hwpx/`를 갱신하기 전 `.backup-2022-05-20/`로 전체 복사한다.
5. **이력 보존**: `ngd-studio/data/jobs/*.json` 안의 옛 경로 문자열은 *과거 사실*이므로 갱신하지 않는다.
6. **검증 우선**: Phase 5의 회귀 빌드가 성공하기 전까지 어떤 페이즈도 “완료”로 마킹하지 않는다.

## 7. 위험 요소 (사전 식별)

| 위험 | 페이즈 | 대응 |
|---|---|---|
| header.xml의 charPr/paraPr ID 매핑이 달라져 builder가 잘못된 글꼴/크기 사용 | Phase 2/3 | diagnosis에서 ID 매핑 표 작성, builder 코드 점검 (별도 이슈로 분리) |
| 신규 양식지의 단원분류표가 새 교과과정 반영해 구조 자체가 바뀜 | Phase 4 | JSON 스키마는 유지하되 본문만 교체. 변경 클 경우 별도 이슈 보고 |
| 18개 base_hwpx 템플릿 중 일부가 신규 양식지에 더이상 없음 | Phase 3 | 발견 시 `diagnosis-report.md`에 “MISSING” 표시, builder 사용처 함께 검토 |
| 신규 양식지에 추가된 새 템플릿(예: 새로운 표/박스)을 기존 추출에 포함 안 시킴 | Phase 2 | diagnosis에서 “NEW” 항목으로 식별, Phase 3 작업 범위에 포함 여부 결정 |

## 8. 진행 추적

[06-checklist.md](./06-checklist.md)에 통합 체크리스트가 있다. 페이즈별 작업이 끝나면 해당 체크박스를 `[x]`로 표시한다.

각 페이즈 문서 자체에도 **acceptance checklist**가 있어, sonnet 에이전트는 그 체크리스트를 모두 통과시켜야 페이즈 완료로 인정된다.

## 9. 참조

- 프로젝트 가이드: `/mnt/c/NGD/CLAUDE.md`
- 기존 양식지 분석: `/mnt/c/NGD/.claude/skills/ngd-exam-create/sample_analysis.md`
- 특수 템플릿 명세: `/mnt/c/NGD/docs/hwpx-templates.md`
- HWPX 함정: `/mnt/c/NGD/docs/hwpx-pitfalls.md`
- builder 업그레이드 기존 TODO: `/mnt/c/NGD/docs/builder-upgrade-todo.md`
