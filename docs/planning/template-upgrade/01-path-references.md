# Phase 1 — 경로 참조 일괄 교체

> **에이전트 미션 브리프**: 6개 파일에 흩어진 옛 양식지 경로 문자열을 신규 양식지 경로로 교체한다. 코드 동작 변경 없음, 문자열만 갱신.

상위 문서: [00-overview.md](./00-overview.md)

## 1. 목표

옛 양식지 경로(`inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`)를 참조하는 6개 위치를 모두 신규 양식지 경로로 갱신한다.

신규 양식지의 정식 경로는 다음과 같다:
```
ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx
```

## 2. 사전 조건

- 신규 양식지 파일이 위 경로에 실재해야 한다. 다음 명령으로 확인:
  ```bash
  ls -la "/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx"
  ```
- 옛 양식지 파일도 그대로 보존되어 있어야 한다 (루트 `inputs/`):
  ```bash
  ls -la "/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx"
  ```

둘 다 `ls` 결과가 정상이어야 작업 시작.

## 3. 입력 — 정확한 변경 대상

| # | 파일 | 라인 | 변경 전 (발췌) |
|---|---|---|---|
| 1 | `.claude/skills/ngd-exam-create/SKILL.md` | 28 | `` 양식지 존재 확인: `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` `` |
| 2 | `.claude/skills/ngd-exam-create/SKILL.md` | 81 | `양식지: inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` |
| 3 | `.claude/skills/ngd-exam-create-v3/skill.md` | 137 | `` 4. 양식지 존재 확인: `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` `` |
| 4 | `.claude/skills/ngd-exam-create-v3/skill.md` | 512 | `- 양식지: inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` |
| 5 | `docs/builder-upgrade-todo.md` | 57 | `` - 양식지: `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx` `` |
| 6 | `docs/hwpx-templates.md` | 3 | `` 양식지(`inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`)에는 `` |
| 7 | `ngd-studio/scripts/test-sse.sh` | 13 | `HWPX_TEMPLATE_PATH="inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx" \` |
| 8 | `.claude/data/unit_classification.json` | 3 | `"source": "inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx (8페이지 단원분류표)",` |

⚠️ 라인 번호는 작업 시점 기준이며, 다른 변경이 끼어든 경우 어긋날 수 있다. **반드시 grep으로 실제 위치를 재확인한 뒤 Edit 한다.**

## 4. 작업 단계

### 4.1 사전 검증

```bash
# 1) 신규/구 양식지 파일 존재 확인
ls -la "/mnt/c/NGD/ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx"
ls -la "/mnt/c/NGD/inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx"

# 2) 변경 대상 8개 위치 재확인 (라인 번호 동기화)
grep -nF "기출작업양식지[2022" /mnt/c/NGD/.claude/skills/ngd-exam-create/SKILL.md \
  /mnt/c/NGD/.claude/skills/ngd-exam-create-v3/skill.md \
  /mnt/c/NGD/docs/builder-upgrade-todo.md \
  /mnt/c/NGD/docs/hwpx-templates.md \
  /mnt/c/NGD/ngd-studio/scripts/test-sse.sh \
  /mnt/c/NGD/.claude/data/unit_classification.json
```

8건 모두 매치되어야 한다. 만약 더 많거나 적으면 누락/중복을 추적한다.

### 4.2 경로 치환 규칙

치환은 **절대 sed -i로 일괄 처리하지 말고**, Edit 도구로 한 곳씩 수행한다. 한글이 포함된 경로에서 인코딩 사고가 잦기 때문이다.

#### 4.2a 1~6, 8번 (root cwd에서 사용되는 경로)

스킬과 docs는 모두 `/mnt/c/NGD`(root)에서 실행된다는 가정 하에 상대경로를 사용한다. 따라서:

```
변경 전: inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx
변경 후: ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx
```

#### 4.2b 7번 (ngd-studio cwd에서 사용되는 경로)

`ngd-studio/scripts/test-sse.sh`는 ngd-studio 디렉토리에서 실행된다. 디렉토리 prefix는 빼고 파일명만 갱신:

```
변경 전: HWPX_TEMPLATE_PATH="inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx" \
변경 후: HWPX_TEMPLATE_PATH="inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx" \
```

### 4.3 8건을 차례대로 Edit

각 Edit은 `old_string`이 파일 내에서 **유일**해야 한다. 파일 내 동일 문자열이 여러 번 나오는 경우(예: SKILL.md는 같은 경로가 2번 등장), `replace_all: true`를 쓰거나 충분한 주변 문맥을 포함해 분리한다.

권장: 라인별 주변 문맥 1줄씩 포함하여 Edit. 예시 (SKILL.md:28):
```text
old:
- 양식지 존재 확인: `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`

new:
- 양식지 존재 확인: `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`
```

같은 파일 안의 두 번째 등장(81줄)은 prefix가 다르므로(``양식지: …``) 별도 Edit으로 처리.

### 4.4 사후 검증

```bash
# 1) 옛 경로 잔여물 확인 — node_modules, .next, data/jobs 제외
grep -rn -F "기출작업양식지[2022" /mnt/c/NGD --include="*.md" --include="*.py" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.sh" 2>/dev/null \
  | grep -v "node_modules\|\.next\|ngd-studio/data/jobs"

# 기대 결과: 0건 (단, ngd-studio/data/jobs/*.json 의 이력은 그대로 두므로 grep 제외)
```

```bash
# 2) 신규 경로가 8곳에 정확히 들어갔는지 확인
grep -rn -F "기출작업양식지[2025년08월10일]" /mnt/c/NGD --include="*.md" \
  --include="*.json" --include="*.sh" --include="*.ts" --include="*.tsx" --include="*.py" 2>/dev/null \
  | grep -v "node_modules\|\.next"

# 기대 결과: 최소 8건
```

## 5. 산출물

| 파일 | 변경 |
|---|---|
| `.claude/skills/ngd-exam-create/SKILL.md` | 2개 라인 갱신 |
| `.claude/skills/ngd-exam-create-v3/skill.md` | 2개 라인 갱신 |
| `docs/builder-upgrade-todo.md` | 1개 라인 갱신 |
| `docs/hwpx-templates.md` | 1개 라인 갱신 (line 3 본문 헤더 한 줄) |
| `ngd-studio/scripts/test-sse.sh` | 1개 라인 갱신 |
| `.claude/data/unit_classification.json` | `source` 필드 1개 갱신 |

총 8개 위치, 6개 파일.

## 6. 검증 (Acceptance Criteria)

- [ ] 4.1의 사전 grep이 8건과 정확히 일치
- [ ] 4.4의 옛 경로 잔여 grep이 0건 (ngd-studio/data/jobs 제외)
- [ ] 4.4의 신규 경로 grep이 8건 이상
- [ ] `unit_classification.json`이 여전히 valid JSON (`python3 -c "import json; json.load(open(...))"`)
- [ ] `test-sse.sh`의 따옴표 짝이 맞고 백슬래시 line continuation 그대로 보존
- [ ] 시각적 diff 검토: `git diff`에서 의도하지 않은 변경(공백, 인코딩) 없음

## 7. 주의사항

1. **`docs/hwpx-templates.md:31, 69`는 변경 대상 아님**: 31번 라인은 `with zipfile.ZipFile(양식지_경로, 'r') as z:`로, 한글 변수명(`양식지_경로`)일 뿐 경로 리터럴이 아니다. 69번도 마찬가지로 일반 설명. grep이 `양식지` 키워드로 다른 줄을 매치할 수 있으나 대상은 line 3뿐.
2. **이력 JSON 비건드림**: `ngd-studio/data/jobs/*.json` 8건은 옛 경로를 그대로 둔다. 이는 *과거 실행 사실*의 기록이며, 미래에도 그 시점 양식지가 그 경로였음을 보존해야 한다.
3. **루트 옛 양식지 비건드림**: `/mnt/c/NGD/inputs/시험지 제작/[…2022년5월20일].hwpx` 파일은 삭제·이동 금지.
4. **CLAUDE.md는 변경 대상 아님**: 본 문서들의 사전 grep이 CLAUDE.md를 매치하지 않음을 확인했다 (양식지 파일명을 직접 박지 않음). 만약 매치된다면 별도 보고.
5. **백슬래시 라인 컨티뉴**: `test-sse.sh`의 라인 끝 `\`는 환경변수 라인을 다음 명령에 이어붙이는 역할이다. 절대 삭제 금지.

## 8. 함정

- 한글이 포함된 경로 문자열은 정규식/sed에서 자주 깨진다. **항상 Edit 도구의 `old_string` 그대로 매칭** 방식을 쓴다.
- `[`, `]`은 정규식 메타문자이므로 grep에서 `-F`(fixed) 플래그 필수.
- macOS의 `[NGD고등부]`와 Windows에서 작성된 NFC/NFD 정규화 차이로 매치 안 되는 경우가 있다. 매치가 0건일 때는 `git ls-files | xargs grep -l 양식지` 같은 우회 검색.

## 9. 롤백 절차

문제 발생 시:
```bash
git diff --stat                  # 변경 파일 목록 확인
git checkout -- <변경된 파일들>   # 한 파일씩 되돌리기 (a 또는 .은 사용 금지)
```

## 10. 다음 페이즈로 넘기기

본 페이즈가 완료되면 [06-checklist.md](./06-checklist.md)의 Phase 1 항목을 모두 `[x]`로 표시한다. Phase 2와는 독립이므로 Phase 2 진행 중이어도 본 페이즈를 끝낼 수 있다.
