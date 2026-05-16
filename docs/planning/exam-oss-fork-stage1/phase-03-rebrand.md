---
phase: 3
title: NGD 브랜딩 일반화 (워터마크·이름·텍스트)
status: pending
depends_on: [2]
scope:
  - /mnt/c/openexam/figure_processor.py
  - /mnt/c/openexam/.claude/agents
  - /mnt/c/openexam/.claude/skills
  - /mnt/c/openexam/ngd-studio
  - /mnt/c/openexam/README.md
  - /mnt/c/openexam/CLAUDE.md
intervention_likely: true
intervention_reason: "rename 규칙 최종 확인 (기본: ngd-exam-* → exam-*, ngd-studio → studio, npm 패키지 openexam-studio)"
executor: sonnet
---

# Phase 3: NGD 브랜딩 일반화

> **범위**: rename + 텍스트 교체 (전체)
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: 다수 (에이전트 8개, 스킬 5개, studio 전체, Python 워터마크)

## 배경

레포 전반에 "NGD" 브랜딩이 박혀 있어 OSS로 공개하기 어렵다.
- `figure_processor.py:60,63` — 그림 워터마크 "NGD" 하드코딩
- 에이전트 8개 — `ngd-exam-builder.md` 등 파일명 + 내부 호출 이름
- 스킬 5개 — `ngd-exam-create*`, `ngd-exam-crop`, `ngd-exam-review` (`hwp-equation`은 일반명이라 유지)
- `ngd-studio/` 디렉터리 + `package.json` name 필드
- README, CLAUDE.md, agent.md, SKILL.md 내부 텍스트의 "NGD", "NGD고등부", 회사명 표현
- `.env.example`의 `HWPX_TEMPLATE_PATH` 기본값 (NGD 양식지 파일명 박혀있음)
- 양식지 검수 체크리스트 문서의 NGD 표현

## 설계

### Rename 규칙
| 변경 전 | 변경 후 |
|---------|---------|
| `ngd-studio/` (디렉터리) | `studio/` |
| `ngd-studio` (npm name) | `openexam-studio` |
| `.claude/agents/ngd-exam-*.md` × 8 | `.claude/agents/exam-*.md` |
| `.claude/skills/ngd-exam-create/` | `.claude/skills/exam-create/` |
| `.claude/skills/ngd-exam-create-v3/` | `.claude/skills/exam-create-v3/` |
| `.claude/skills/ngd-exam-crop/` | `.claude/skills/exam-crop/` |
| `.claude/skills/ngd-exam-review/` | `.claude/skills/exam-review/` |
| `.claude/skills/hwp-equation/` | (유지 — 일반명) |

### 워터마크 (figure_processor.py)
- 현재: `draw.text((...), "NGD", fill=(200, 200, 200, 255), font=font)` (line 63)
- 변경: 환경변수 `WATERMARK_TEXT` (기본값 빈 문자열). 빈 값이면 워터마크 그리기 자체를 skip
- `os.environ.get("WATERMARK_TEXT", "")` — 사용자가 자기 브랜드 워터마크를 지정할 수 있게

### 텍스트 교체 패턴
- `NGD` (대문자) → 제거 또는 "본 프로젝트" / 환경변수 안내
- `NGD고등부` → 제거
- `NGD오검 체크리스트` → "검수 체크리스트"
- `[NGD고등부]기출작업양식지[2022년5월20일].hwpx` (파일명 + 본문 참조) → `templates/default.hwpx` (Phase 4와 연계)
- `ngd-exam-*` (에이전트/스킬 내부 호출) → `exam-*`

## 체크리스트

- [ ] `ngd-studio/` → `studio/` 디렉터리 rename
- [ ] `studio/package.json`의 `"name": "ngd-studio"` → `"openexam-studio"`
- [ ] 에이전트 8개 파일 rename: `.claude/agents/ngd-exam-{builder,checker,extractor,figure,reader,reviewer,solver,verifier}.md` → `exam-*.md`
- [ ] 스킬 4개 디렉터리 rename: `.claude/skills/ngd-exam-{create,create-v3,crop,review}/` → `exam-*/`
- [ ] `figure_processor.py:60-63` — "NGD" 하드코딩 제거, `WATERMARK_TEXT` 환경변수 사용, 빈 값이면 워터마크 skip
- [ ] `studio/.env.example`의 `HWPX_TEMPLATE_PATH` 기본값을 `templates/default.hwpx`로 변경 (Phase 4와 일관)
- [ ] 전체 텍스트 교체: `grep -rli "NGD\|ngd-" --include="*.md" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=.git --exclude-dir=node_modules` 결과 각 파일 검토 + 적절히 교체
- [ ] 에이전트 .md와 스킬 SKILL.md 내부의 다른 에이전트/스킬 호출 이름 (`ngd-exam-builder` 형태) 일괄 갱신
- [ ] CLAUDE.md, `.claude/skills/exam-review/checklist.md` 등 문서 내부의 NGD 표현 제거
- [ ] 정리 후 커밋: `chore: rebrand NGD → openexam (agents, skills, studio, watermark)`

## 영향 범위

- studio 디렉터리 rename은 import 경로/스크립트 모두에 영향 (재귀 grep으로 점검)
- 에이전트/스킬 rename 후 `/exam-create-v3` 같은 호출이 동작하는지 확인 필요 (`.claude/agents/`, `.claude/skills/` 자동 등록)
- `HWPX_TEMPLATE_PATH` 기본값 변경은 Phase 4 결과물(templates/default.hwpx)이 있어야 동작 — 일단 경로만 변경, 파일 실체는 Phase 4

## 검증

```bash
cd /mnt/c/openexam
grep -rli "NGD\|ngd-exam\|ngd-studio" --exclude-dir=.git --exclude-dir=node_modules
# 위 결과는 의도된 잔존(예: CHANGELOG, 변경 이력)만 남아야

ls .claude/agents/ | grep -v "exam-"   # exam-*만 남아야 (다른 에이전트 없으면 빈 결과)
ls .claude/skills/ | grep "ngd"        # 빈 결과여야

cd studio && grep -r "ngd-studio" --exclude-dir=node_modules
# 빈 결과여야
```

## 실행 결과
