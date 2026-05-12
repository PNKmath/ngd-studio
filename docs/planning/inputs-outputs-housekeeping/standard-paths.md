---
phase: 2
created: 2026-05-12
---

# 표준 경로 결정 (Phase 2 산출물)

## V3 표준 양식지

**경로**: `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`

**확정 근거**:
- V3 SKILL.md (`.claude/skills/ngd-exam-create-v3/SKILL.md`) line 193이 가리키는 표준 경로
- 구버전(`2022년5월20일`)보다 최신(mtime 2026-04-29)
- 크기 352,120 bytes (구버전 345,964 bytes)
- 사용자 결정: "V3가 모든 기준" → V3 SKILL.md가 표준

**사용 규칙**:
- V3 스킬 실행 시 이 경로의 양식지를 기본으로 사용
- 다음 task (`exam-skill-v3-promotion`)에서 V3 SKILL.md를 `ngd-exam-create/SKILL.md`로 통합할 때, 이 경로를 유지
- 기타 모든 양식지 참조는 이 표준 경로로 통일

---

## 양식지 위치 현황

### 1. 표준 경로 (V3)
| 경로 | 크기 | mtime | git tracked |
|------|------|-------|-------------|
| `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` | 352,120 | 2026-04-29 14:57:45 | yes |

### 2. 구버전 (2022년5월20일)
| 경로 | 크기 | mtime | git tracked |
|------|------|-------|-------------|
| `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` | 345,964 | 2026-03-07 14:47:05 | yes |
| `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` | 345,964 | 2026-03-07 14:47:05 | yes |

---

## 구버전 양식지 처리 방향 (사용자 결정 대기)

**현황**: 구버전 양식지가 2곳에 git tracked 상태로 존재.

**처리 옵션**:

| 옵션 | git 작업 | 설명 | 권고 |
|------|---------|------|------|
| **(a) 완전 폐기** | `git rm --cached` + `.gitignore` 추가 | 구버전을 완전히 제거하고, 최신 V3만 유지 | **권고** |
| **(b) Archive로 이동** | `git mv` → `archive/templates/` 또는 `archive/inputs/` | 역사 보존 목적. 향후 참고용 | 선택지 |
| **(c) 모두 유지** | 변경 없음 | V3 표준만 활용하고 구버전은 그대로 남겨둔다 | 비권고 |

**권고 근거**:
- Phase 1에서 사용자가 "양식지가 아닌 작업물(PDF/HWPX/JSON/이미지) → discard"로 결정
- 구버전 양식지는 V3 양식지로 완전히 대체됨 (2025년08월 신규 제작)
- 이전 작업 산출물이 아닌 **템플릿 폐기**이므로 archive보다 discard가 자연스러움
- Git 저장소 정리: 미래 모든 작업은 V3 표준 경로만 참조하게 됨

**실행 방법** (Phase 5에서 처리):
```bash
git rm --cached 'inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx'
git rm --cached 'ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx'
echo 'inputs/시험지 제작/[NGD고등부]*2022년*.hwpx' >> .gitignore
echo 'ngd-studio/inputs/시험지 제작/[NGD고등부]*2022년*.hwpx' >> .gitignore
git add .gitignore
git commit -m "chore: 구버전 양식지 폐기 (V3 표준으로 통일)"
```

---

## 헤더 PNG 파일

**경로**: `ngd-studio/inputs/png/양식지 헤더.png`
**크기**: 7.0K
**용도**: (확인됨) 양식지의 헤더 영역 생성 시 사용할 기본 이미지 (V3 builder에서 선택적 활용)

**처리**: V3 표준 경로와 함께 유지 (삭제 불필요)

---

## 후속 task 인계

다음 task `exam-skill-v3-promotion`에서는:

1. **V3 SKILL.md → ngd-exam-create/SKILL.md 통합 시**:
   - Line 193의 양식지 경로를 유지: `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`
   - 변경 없음 ✓

2. **구버전 양식지 처리 (Phase 5 또는 이후)**:
   - 사용자가 위 "처리 옵션"에서 선택하면 그에 따라 실행
   - 기본 권고는 **(a) 완전 폐기**

3. **V3 SKILL.md 내 양식지 경로 참조 추출 결과**:
   - 총 1건: line 193 (이미 표준 경로)
   - 추가 수정 불필요

---

## 결정 사항 요약

| 항목 | 상태 | 값 |
|------|------|-----|
| V3 표준 양식지 경로 확정 | ✅ 완료 | `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx` |
| 구버전 양식지 처리 | ⏳ 사용자 결정 대기 | 권고: (a) 완전 폐기 |
| 헤더 PNG | ✅ 확인 | 유지 (삭제 불필요) |
| SKILL.md 본문 경로 참조 | ✅ 확인 | 1건 (line 193, 변경 불필요) |
