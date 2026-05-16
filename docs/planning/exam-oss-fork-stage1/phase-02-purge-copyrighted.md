---
phase: 2
title: 저작권 위험 자료 + 백업/캐시 잔재 전수 제거
status: pending
depends_on: [1]
scope:
  - /mnt/c/openexam/inputs
  - /mnt/c/openexam/archive
  - /mnt/c/openexam/studio/inputs
  - /mnt/c/openexam/.claude/skills/ngd-exam-create/base_hwpx.backup-2026-04-29-followup
intervention_likely: true
intervention_reason: "어떤 파일을 남길지(예: 오검 체크리스트 HWP) 최종 확인. NGD 양식지 HWPX는 Phase 4 anonymize 대상이므로 일단 보존"
executor: sonnet
---

# Phase 2: 저작권 위험 자료 + 백업/캐시 잔재 전수 제거

> **범위**: 파일 정리
> **난이도**: S
> **의존성**: Phase 1
> **영향 파일**: `inputs/`, `archive/`, `*.backup-*`, `studio/inputs/`

## 배경

Phase 1의 rsync 제외 패턴이 완벽하지 않을 수 있고, NGD 비공개 자산(체크리스트 HWP, 회사 로고 PNG 등) 중 일부는 Phase 1 제외 패턴을 통과해 남았을 가능성이 있다. 퍼블릭 공개 전에 **전수 점검**으로 저작권/식별성 위험 파일을 정리한다.

또한 `archive/build_gyeongbuk*.py` 같은 NGD 내부 이력성 파일과 `*.backup-*` 백업 디렉터리도 OSS에는 불필요하므로 제거한다.

## 설계

### 삭제 대상 (확정)
- `archive/` 디렉터리 전체 (옛 build_gyeongbuk*.py 등)
- `.claude/skills/ngd-exam-create/base_hwpx.backup-2026-04-29-followup/` 백업 폴더
- `.claude/skills/ngd-exam-create/base_hwpx/.backup-2022-05-20/` 백업 폴더
- 모든 `*.backup-*`, `*.bak-*` 파일 (예: `build_hwpx.py.backup-2026-04-29`)
- `inputs/시험지 제작/*.pdf` 잔존 (Phase 1에서 제외됐어야 하지만 재확인)
- `inputs/오검/*.pdf`, `*.hwpx`, `*.hwp` 전수 (체크리스트 포함 — Phase 7 사용자 가이드로 대체)
- `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` — Phase 4에서 anonymize 후 `templates/default.hwpx`로 재배치하므로 **임시 유지**, 정리는 Phase 4에서

### 보존 + 빈 자리만 유지
- `inputs/시험지 제작/` 빈 디렉터리 + `.gitkeep` (사용자 입력 자리)
- `inputs/오검/` 빈 디렉터리 + `.gitkeep`

### studio/inputs 점검
- `studio/inputs/png/` — 헤더 PNG (회사 로고 가능성). 내용 점검 후 NGD 식별성 있는 PNG는 삭제, 일반 placeholder는 Phase 4에서 교체

## 체크리스트

- [ ] `archive/` 디렉터리 통째 삭제 (`rm -rf archive/`)
- [ ] `find . -name "*.backup-*" -o -name "*.bak-*" -o -name "*.bak"` 결과 전수 삭제
- [ ] `base_hwpx.backup-*` 및 `base_hwpx/.backup-*` 폴더 삭제
- [ ] `inputs/시험지 제작/*.pdf`, `inputs/오검/*.pdf`/`*.hwpx`/`*.hwp` 잔존 점검 + 삭제 (NGD 양식지 HWPX는 Phase 4까지 임시 보존)
- [ ] `studio/inputs/png/` 내부 헤더 PNG 점검 — NGD 식별성 있는 것은 삭제 (Phase 4에서 placeholder로 교체)
- [ ] `inputs/시험지 제작/`, `inputs/오검/`, `studio/inputs/시험지 제작/`, `studio/inputs/오검/`에 `.gitkeep` 추가 (빈 디렉터리 git 추적)
- [ ] `find /mnt/c/openexam -size +1M -not -path "*/.git/*"` 으로 1MB 이상 파일 전수 검토 — 의도된 것만 남았는지
- [ ] 정리 후 첫 커밋: `chore: purge copyrighted samples and backup artifacts`

## 영향 범위

- 원본 NGD 양식지 HWPX는 Phase 4에서 `templates/default.hwpx`로 anonymize 처리되므로 **Phase 2에서는 삭제하지 않음**
- 단원분류표 `unit_classification.json`은 한국 고등 수학 교과과정이므로 저작권 이슈 낮음 — Phase 4에서 "예시"임을 명시하고 유지

## 검증

```bash
cd /mnt/c/openexam
find . \( -name "*.pdf" -o -name "*.bak*" -o -name "*.backup-*" -o -path "*/archive/*" \) -not -path "./.git/*"
# 위 결과는 비어있어야 함 (NGD 양식지 HWPX는 Phase 4까지 예외)

find . -size +1M -not -path "./.git/*"
# 큰 파일 검토 — 의도된 것만

du -sh /mnt/c/openexam
```

## 실행 결과
