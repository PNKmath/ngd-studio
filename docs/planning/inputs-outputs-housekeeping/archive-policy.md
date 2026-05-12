# Archive 정책

> Phase 3 산출물 — 2026-05-12 확정

## 폴더 구조

**선택**: 단일 폴더 (평탄화, 하위 구조 없음)

```
archive/
├── build_gyeongbuk.py            # 기존 (tracked)
├── build_gyeongbuk_new.py        # 기존 (tracked)
├── build_gyeongbuk_v3.py         # 기존 (tracked)
├── ngd-exam-builder.md.backup-2026-04-30  # 기존 (ignored by *.backup*)
└── <이동된 파일들>               # Phase 4–6에서 mv (ignored)
```

- 하위 폴더 분할 없음 (원본 경로 미러링 없음, 날짜별 분할 없음).
- 이동 시 경로 충돌 방지를 위해 prefix 권장: 예) `outputs__파일명`, `inputs-create__파일명`.

## git 정책

**archive/ 전체를 .gitignore로 완전 ignore** (로컬 스냅샷 전용).

- 기존 `archive/*.py` 3개는 tracked 상태였으나, 이번 정책 변경으로 `archive/` 전체 ignore.
- `archive/*.py` 파일들은 이미 git history에 존재하므로 이력 보존됨.
- Phase 5에서 `git rm --cached archive/*.py` 실행 (orchestrator 담당).

## discard vs archive 구분 기준

| 구분 | 대상 | 처리 |
|------|------|------|
| **discard** | 작업 완료된 inputs PDF/HWPX, outputs HWPX/이미지/JSON, .v3cache | `rm` 삭제 (이미 .gitignore로 untracked이거나 git rm) |
| **archive** | Phase 1에서 분류된 V3 이전 단일본 HWPX 12개, ngd-studio outputs 중 보존 대상 | `mv archive/<prefix>__파일명` |

Phase 1 inventory에서 분류된 archive 대상 12개 파일은 `phase-04-outputs-execute.md`, `phase-05-inputs-create-execute.md`, `phase-06-inputs-review-execute.md`에서 각각 이동.

## 구버전 양식지 처리

**완전 폐기** (Phase 5에서 실행):

1. `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`
2. `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`

처리 방식:
- `git rm --cached` → `.gitignore` 패턴으로 ignore (orchestrator atomic commit).
- archive로 이동하지 않음 — 폐기.

## .gitignore 변경 사항

| 추가 패턴 | 이유 |
|-----------|------|
| `archive/` | archive 전체 로컬 ignore |
| `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` | 구버전 양식지 폐기 (Phase 5) |
| `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` | 구버전 양식지 폐기 (Phase 5) |
