---
phase: 1
title: 새 퍼블릭 레포 부트스트랩
status: pending
depends_on: []
scope:
  - /mnt/c/openexam
intervention_likely: true
intervention_reason: "디렉터리 경로/레포 이름 최종 확인 (기본: /mnt/c/openexam, 레포명: openexam)"
executor: haiku
---

# Phase 1: 새 퍼블릭 레포 부트스트랩

> **범위**: 인프라 (디렉터리·git)
> **난이도**: XS
> **의존성**: 없음
> **영향 파일**: `/mnt/c/openexam` 신규 디렉터리

## 배경

원본 NGD 레포(`/mnt/c/NGD`)는 비공개로 유지하고, 별도 퍼블릭 레포(`/mnt/c/openexam`)로 분기해서 일반 시험지 제작 OSS로 발전시키려 한다. 원본 history에 저작권 자료/시크릿이 섞여 있을 가능성이 있으므로 `.git/`을 복사하지 않고 **새 history로 시작**한다.

## 설계

1. 새 디렉터리 `/mnt/c/openexam` 생성
2. 원본에서 **제외 목록**을 적용한 채 복사 (rsync 또는 cp + find)
3. 새 디렉터리에서 `git init` (origin 미설정 — Phase 9에서 GitHub 생성)
4. 첫 커밋: `chore: initial fork from NGD private repo`

**복사에서 제외할 항목**:
- `.git/` — history 새로 시작
- `inputs/시험지 제작/*.pdf` — 저작권 위험 (Phase 2에서 재확인)
- `inputs/오검/*.pdf`, `*.hwpx`, `*.hwp` — 저작권 위험
- `.v3cache/`, `.v3cache_prev/`, `.v3cache_*/` — 런타임 캐시
- `*.backup-*`, `*.bak-*`, `__pycache__/` — 백업/빌드 산출물
- `outputs/` — 빌드 결과물
- `archive/` — 옛 스크립트 (Phase 2에서 처리)
- `.engram/` — 로컬 인덱스
- `node_modules/`, `.next/` — JS 빌드 산출물
- `studio/data/jobs/` (구 `ngd-studio/data/jobs/`) — 런타임 상태
- `studio/bat_*.txt`, `sse_test*.txt` — 디버그 출력

## 체크리스트

- [ ] `/mnt/c/openexam` 디렉터리 신규 생성 (이미 있으면 사용자 확인 후 진행)
- [ ] 원본 `/mnt/c/NGD/`에서 위 제외 목록을 적용해 rsync로 복사 — 예: `rsync -av --exclude='.git' --exclude='inputs/시험지 제작/*.pdf' ... /mnt/c/NGD/ /mnt/c/openexam/`
- [ ] 복사된 트리에서 `du -sh` 출력해 총 용량 점검 (200MB 미만 권장)
- [ ] 복사된 트리에서 `find . \( -name "*.pdf" -o -name ".v3cache*" \)` 결과가 비어있는지 검증
- [ ] `/mnt/c/openexam`에서 `git init` + 첫 커밋 `chore: initial fork from private repo`
- [ ] 복사 보고서 작성 (Phase 2 입력): 어떤 디렉터리가 비었고, 어떤 파일이 남았는지

## 영향 범위

- 원본 `/mnt/c/NGD`는 **건드리지 않음** (read-only로 취급)
- 새 디렉터리에 git remote 미설정 — Phase 9에서 GitHub 새 레포 생성 시 추가

## 검증

```bash
ls -la /mnt/c/openexam
du -sh /mnt/c/openexam
find /mnt/c/openexam \( -name "*.pdf" -o -name "*.bak*" -o -name "*.backup-*" \) -not -path "*/.git/*"
cd /mnt/c/openexam && git log --oneline
```

## 실행 결과
