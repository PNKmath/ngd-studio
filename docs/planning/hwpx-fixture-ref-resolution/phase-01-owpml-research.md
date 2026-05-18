---
phase: 1
title: HWPX/OWPML 포맷 리서치 — paraPrIDRef/charPrIDRef/borderFillIDRef 작동 원리
status: completed
depends_on: []
scope:
  - docs/planning/hwpx-fixture-ref-resolution/notes/
intervention_likely: false
intervention_reason: ""
---

# Phase 1: HWPX/OWPML 포맷 리서치 — ref 시스템 정확히 이해

> **범위**: Research / Docs
> **난이도**: M
> **의존성**: 없음
> **영향 파일**: `docs/planning/hwpx-fixture-ref-resolution/notes/*.md` (신규)

## 배경

지금까지 fixture 교체를 시행착오로 시도해 사용자 시간을 낭비했다. 근본 원인은 HWPX/OWPML 포맷의 ref 시스템(paraPrIDRef, charPrIDRef, borderFillIDRef 등)을 정확히 모른 채 인덱스를 직관으로 만져온 데 있다. 이후 phase 가 정확한 분석에 의존하므로, 본 phase 에서 reference 문서들을 읽고 다음을 명확히 한다:

- `<hh:paraProperties>` / `<hh:charProperties>` / `<hh:borderFills>` 컨테이너가 `header.xml` 에서 어떻게 정의되고 numbering 되는가
- `paraPrIDRef="N"` 이 그 컨테이너의 N 번째 항목을 가리키는가, 아니면 `id="N"` 속성 매칭인가
- 한컴오피스가 저장 시 GC/컴팩션을 어떻게 수행하는가 (사용되지 않는 정의 제거 + 인덱스 재매김 가능 여부)
- `<hh:style>`, `<hh:tabPr>`, `<hh:numbering>` 같은 다른 ref 들도 동일 패턴인가
- 두 다른 header.xml 간 정의 매핑을 자동화할 수 있는 키 (예: 정의 본문 hash + align/font 등 핵심 attribute)

## 설계

### 리서치 대상

1. **PNKLMS hancom_official** (https://github.com/PNKmath/PNKLMS/tree/main/docs/hancom_official)
   - HWP 공식 문서 모음. OWPML 명세 포함 가능성.
   - 핵심 어휘: paragraph properties, character properties, border fills, ID 매핑.
2. **hancom-io/dvc** (https://github.com/hancom-io/dvc)
   - 한컴 공식 저장소. 포맷 처리 코드/도구가 있으면 ref 해석 로직 참고.
3. **hancom-io/metatag-ex** (https://github.com/hancom-io/metatag-ex)
   - 메타태그 확장 — 직접 관련성 낮을 수 있으나 포맷 사이드 채널 정보 가능.
4. **추가 검색** (필요 시)
   - "HWPX OWPML paraPrIDRef" "한컴 paragraphPr ID reference"
   - 한컴오피스 SDK 문서, OWPML 1.0/1.5 명세.

### 산출물 구조

```
docs/planning/hwpx-fixture-ref-resolution/notes/
├── 01-owpml-ref-system.md       # ref 시스템 핵심 규칙 (3-5 페이지)
├── 02-header-containers.md      # header.xml 의 paraProperties/charProperties/borderFills 구조
├── 03-hancom-gc-behavior.md     # 한컴 저장 시 GC/컴팩션 동작 (관측 + 문서 근거)
└── 04-mapping-strategy.md       # 두 header 간 정의 매핑 자동화 전략
```

각 노트는 다음을 포함:
- **출처** (URL, 문서 페이지, commit hash) — 반드시 명시
- **핵심 발견** (3-7 bullet)
- **uncertain 항목** — 문서로 확정 안 된 부분은 정직히 기록

### Phase 2 에서 사용할 키 결정

매핑 도구 (Phase 2) 설계에 필요한 의사결정을 본 phase 에서 확정:

- 두 header 간 paraPr 정의가 "같다"고 판정하는 기준 (전체 본문 byte-equal? align + margin 정도면 충분?)
- charPr 정의 매칭 기준 (font + bold + size + color?)
- borderFill 정의 매칭 기준 (border style + color + 4-side pattern?)
- 정의 미존재 시 처리 (우리 header에 없으면 → 추가? 가장 비슷한 것으로 fallback?)

이 결정은 `04-mapping-strategy.md` 에 명시.

## 체크리스트

- [x] 3개 reference URL 의 관련 문서/코드 fetch (WebFetch 또는 git clone via Bash, 단 scope 내 디렉터리에만 보관)
- [x] `notes/01-owpml-ref-system.md` 작성 — ref 시스템 규칙 (paraPrIDRef 가 id 매칭인지 인덱스인지 명확히)
- [x] `notes/02-header-containers.md` 작성 — paraProperties / charProperties / borderFills 컨테이너 구조 + 우리 header.xml 의 실제 항목 수 확인 (현재 paraPr 30개, charPr 42개, borderFill 81개)
- [x] `notes/03-hancom-gc-behavior.md` 작성 — 한컴 GC 동작 관측 (우리 147KB → 사용자 82KB 의 정의 수 비교 결과 포함)
- [x] `notes/04-mapping-strategy.md` 작성 — 정의 매칭 기준 + 매핑 도구 설계안 (Phase 2 입력)

## 영향 범위

- 본 phase 는 문서만 생산. 코드/fixture 변경 없음.
- 후속 phase (2~5) 모두 본 phase 산출물에 의존.

## 검증

```bash
ls docs/planning/hwpx-fixture-ref-resolution/notes/
wc -l docs/planning/hwpx-fixture-ref-resolution/notes/*.md

# 각 노트가 "출처" 섹션을 가지는지 확인
grep -l "출처\|## Source" docs/planning/hwpx-fixture-ref-resolution/notes/*.md

# 우리 header 통계 재확인 (Phase 2 에 전달할 baseline)
python3 -c "
import re
h = open('resources/hwpx_base/Contents/header.xml').read()
print('paraPr:', len(re.findall(r'<hh:paraPr\b', h)))
print('charPr:', len(re.findall(r'<hh:charPr\b', h)))
print('borderFill:', len(re.findall(r'<hh:borderFill\b', h)))
"
```

검증 통과 조건: 4개 노트 파일 모두 존재, 각각 50줄 이상, "출처" 섹션 포함, 핵심 발견 명시.

## 실행 결과

### 1회차 (2026-05-19 14:30 KST) — 완료

**상태**: completed
**소요 시간**: 약 30분
**진행 모델**: claude-sonnet-4-6

#### 요약
PNKmath/PNKLMS HWP 공식 문서와 hancom-io/dvc 소스코드 fetch 후, 우리 header.xml 직접 분석을 병행해 4개 노트 파일 작성 완료. paraPrIDRef가 id 속성 매칭(인덱스 아님)임을 확정하고, borderFill만 1-기반임을 실증. GC 후 ~47KB 절감 가능, 정의 매핑 4-단계 전략(borderFill→tabPr→paraPr→charPr 순서) 수립.

#### 변경 파일
- `docs/planning/hwpx-fixture-ref-resolution/notes/01-owpml-ref-system.md` (신규, +79줄)
- `docs/planning/hwpx-fixture-ref-resolution/notes/02-header-containers.md` (신규, +125줄)
- `docs/planning/hwpx-fixture-ref-resolution/notes/03-hancom-gc-behavior.md` (신규, +91줄)
- `docs/planning/hwpx-fixture-ref-resolution/notes/04-mapping-strategy.md` (신규, +226줄)

#### 검증 결과
- [x] 4개 노트 파일 존재: `ls notes/` → 4개 파일 확인
- [x] 줄 수 50줄 이상: 79/125/91/226줄 → pass (최소 79줄)
- [x] 출처 섹션 포함: `grep -l "출처"` → 4개 모두 포함
- [x] header.xml 통계: paraPr=30, charPr=42, borderFill=81 → 스펙과 일치 pass

#### 추가 발견사항
- paraPrIDRef는 "id 속성 매칭"이 공식 기준이나 실질적으로 0-기반 순서 인덱스와 동일 (연속 할당). borderFill만 1-기반 예외.
- 4294967295 (0xFFFFFFFF)는 charPrIDRef 특수값 — "기본값 사용"의 의미로 numbering 내부에서 사용됨.
- 우리 header에 중복 paraPr 3쌍 발견 (paraPr[20]==[0], [21]==[3], [26]==[25]).
- 현재 fixture 37개가 참조하는 모든 IDRef가 우리 header 범위 내에 있어 우리 header는 fixture에 대해 완전함.
- 매핑 도구는 borderFill→tabPr→paraPr→charPr 순서로 4단계 처리해야 함 (상호 의존성 때문).

#### 질문 / 결정 사항
- Phase 2에서 실제 사용자 HWPX (target header)를 어떻게 구할지 — 테스트용 샘플 HWPX 필요.

#### Scope Audit (orchestrator)
pass — 4 files in scope (notes/01~04), PHASE_FILE exempt.

#### Verification Re-run (orchestrator)
exit 0 — ls + wc + grep + python3 header stats 모두 정상. paraPr=30, charPr=42, borderFill=81 일치.

#### Simplify (orchestrator)
no-op — 순수 리서치 노트 4개. 안전하게 제거 가능한 중복 없음. VERIFY pass.

#### Review (orchestrator)
VERDICT: pass — 5/5 체크리스트, scope 외 변경 없음, 검증 통계 일치, 인용 심볼 실존 확인.
