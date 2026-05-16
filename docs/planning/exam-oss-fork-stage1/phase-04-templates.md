---
phase: 4
title: 양식지·단원분류표 일반화 (anonymized + env override)
status: pending
depends_on: [3]
scope:
  - /mnt/c/openexam/templates
  - /mnt/c/openexam/inputs
  - /mnt/c/openexam/.claude/data/unit_classification.json
  - /mnt/c/openexam/studio/inputs/png
  - /mnt/c/openexam/docs/customization
intervention_likely: true
intervention_reason: "양식지 anonymize 깊이 결정 — 머릿말 placeholder 어떤 문구로 할지, 체크리스트 본문 통째 제거할지 일부 유지할지"
executor: opus
---

# Phase 4: 양식지·단원분류표 일반화

> **범위**: 자산 정리 (HWPX 양식지 + PNG + 단원분류표 JSON)
> **난이도**: M
> **의존성**: Phase 3
> **영향 파일**: `templates/default.hwpx`(신규), `.claude/data/unit_classification.json`, `studio/inputs/png/`

## 배경

기존 `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`는 NGD 회사 로고 PNG가 머릿말에 박혀 있고, 검수 체크리스트 HWPX에도 회사명/내부 문구가 있다. OSS로는 공개 불가.

또한 `.claude/data/unit_classification.json`은 한국 고등 수학 교과과정 기준의 단원 분류표라 일반화 자체는 어렵지만 (한국어 수학 시험지 작업 도구로 시작하는 게 현실적), "예시 분류표"임을 명시하고 사용자가 자기 과목/국가 분류표로 교체할 수 있는 가이드를 제공한다.

## 설계

### 양식지 처리 — 2축 모두 지원
1. **anonymized 기본 양식지** (`templates/default.hwpx`):
   - 기존 NGD 양식지에서 회사 로고 PNG 제거 → placeholder PNG로 교체 ("Your Organization Logo Here" 텍스트만 들어간 단순 PNG)
   - 머릿말 텍스트 일반화 ("○○○ 모의고사 양식지" → "Exam Template Sample")
   - 검수 체크리스트 시트 통째 제거 (한국어 일반 체크리스트는 README에 별도 가이드)
   - 단원분류표 시트는 형태만 유지 (내용은 unit_classification.json로 채워지므로)

2. **사용자 양식지 지정** (`HWPX_TEMPLATE_PATH` env):
   - 사용자가 자기 양식지를 `inputs/시험지 제작/`에 두고 환경변수로 경로 지정
   - 미지정 시 `templates/default.hwpx` 사용
   - `build_hwpx.py`와 studio에서 이 env를 일관되게 읽도록 확인 (Phase 3에서 일부 처리)

### 단원분류표 (`.claude/data/unit_classification.json`)
- 파일 자체는 유지 (한국 고등 수학 분류표 — 저작권 이슈는 낮음, 교육과정 공개 자료)
- 파일 상단 메타 주석/필드에 `"_note": "Example classification for Korean high-school math. Replace with your own for other subjects/regions."` 추가
- `docs/customization/unit-classification.md` 작성 — 사용자가 자기 분류표로 교체하는 절차

### Placeholder 헤더 PNG (`studio/inputs/png/`)
- 기존 헤더 PNG에 회사 로고가 있으면 placeholder ("Your Logo" 텍스트만) PNG로 교체
- 또는 머릿말 영역을 비워두고 사용자가 자기 PNG를 넣도록 README 안내

## 체크리스트

- [ ] 기존 양식지 HWPX 안의 회사 로고 PNG를 placeholder PNG로 교체 (BinData/ 안의 image 파일 교체)
- [ ] 양식지 HWPX 안의 머릿말 텍스트·검수 체크리스트 시트의 NGD 표현 제거 (한컴오피스로 직접 편집하거나, XML 직접 수정)
- [ ] 정리된 양식지를 `/mnt/c/openexam/templates/default.hwpx`로 저장
- [ ] 원본 `inputs/시험지 제작/[NGD고등부]…hwpx` 파일은 삭제 (Phase 2에서 보류했던 것)
- [ ] `.claude/data/unit_classification.json` 상단에 `"_note": "Example..."` 메타 추가
- [ ] `docs/customization/unit-classification.md` 작성 — 분류표 교체 절차
- [ ] `studio/inputs/png/` 헤더 PNG 정리 (회사 식별성 제거, placeholder로 교체 또는 삭제 후 사용자 입력 안내)

## 영향 범위

- HWPX 양식지 수정은 한컴오피스 GUI 또는 ZIP+XML 직접 편집 — XML 직접 편집 권장 (재현성 + git diff 가능)
- `build_hwpx.py`가 `HWPX_TEMPLATE_PATH` env를 읽는지 사전 점검 (현재 구현 상태에 따라 추가 필요)

## 검증

```bash
cd /mnt/c/openexam
ls templates/                  # default.hwpx 존재
ls inputs/시험지 제작/         # NGD 양식지 .hwpx 잔존 없음, .gitkeep만

# 양식지 안의 NGD 흔적 점검
unzip -p templates/default.hwpx Contents/section0.xml 2>/dev/null | grep -i ngd
unzip -p templates/default.hwpx Contents/masterpage0.xml 2>/dev/null | grep -i ngd
# 위 두 grep 결과 비어있어야

# 동작 검증 — Phase 5/6 이후로 미룰 수도 있음
# python build_hwpx.py --template templates/default.hwpx --minimal-input
```

## 실행 결과
