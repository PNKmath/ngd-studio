---
name: ngd-exam-create
description: "NGD 시험지 제작 오케스트레이터. 문제별 이미지 기반으로 extractor→solver→verifier 병렬 처리 후 figure→builder→checker 순차 처리. '시험지 제작', '작업' 키워드에 사용."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: "[이미지 폴더 경로 또는 메타 정보]"
---

# NGD 시험지 제작 오케스트레이터

이 스킬은 직접 시험지를 만들지 않고, **에이전트들을 병렬/순차 조합**하여 완성된 시험지를 생성한다.

## 서브 에이전트 구조

```
ngd-exam-create (이 스킬 = 오케스트레이터)
│
├─ Phase 1-A: Extractor 전체 (8개씩 배치, 병렬)
│   └─ [1] ngd-exam-extractor : 이미지 → 문제 JSON
│
├─ [프론트엔드 편집] 사용자가 추출 결과를 직접 수정
│
├─ Phase 1-B: Solver + Verifier (8개씩 배치, 병렬)
│   ├─ [2] ngd-exam-solver    : 문제 JSON → 해설 생성
│   └─ [3] ngd-exam-verifier  : 해설 검증 (↔ solver 최대 3회)
│
└─ Phase 2: 순차 처리
    ├─ [4] ngd-exam-figure    : 그림 처리 (nano-banana)
    ├─ [5] ngd-exam-builder   : JSON + 이미지 → HWPX
    └─ [6] ngd-exam-checker   : HWPX 품질 검수
```

## 작업 절차

### Step 0: 입력 확인 및 작업 디렉토리 준비

#### 0-1. 실행 모드 판별

프롬프트를 파싱하여 **신규 실행** vs **부분 재실행(resume)** 을 판별한다.

**프롬프트 패턴**:

| 프롬프트 예시 | 모드 | 동작 |
|-------------|------|------|
| `작업해줘 [메타정보]` | 신규 | 처음부터 전체 실행 |
| `resume` | 자동 resume | 기존 파일 스캔 → 미완료 지점부터 |
| `resume --q=3 --from=extractor` | 지정 resume | 3번 extractor부터 재실행 |
| `resume --q=3,7 --from=extractor` | 지정 resume (복수) | 3,7번 extractor 병렬 재실행 |
| `resume --from=review_extract` | 추출 검증 resume | 추출 유지 + 검증 화면부터 (solver 미실행 시) |
| `resume --q=3,7 --from=solver` | 지정 resume | 3,7번 solver부터 재실행 |
| `resume --from=builder` | Phase 2 resume | builder부터 재실행 |
| `resume --q=3 --from=cleaned` | 지정 resume | 3번 이미지 정리부터 재실행 |
| `resume --q=3 --from=image_replace` | 이미지 교체 resume | 3번 원본 이미지 교체 후 정리→추출 자동 재실행 |
| `resume --from=extractor` | 전체 resume | 모든 문제 extractor부터 재실행 → [EXTRACTION_REVIEW] 출력 |
| `resume --from=solver` | 전체 resume | 모든 문제 solver부터 재실행 |
| `resume --from=verifier` | 전체 resume | 모든 문제 verifier부터 재실행 |
| `resume --from=figure` | Phase 2 resume | figure부터 재실행 |
| `resume --q=3 --from=figure` | 지정 resume | 3번 그림만 재처리 |
| `resume --from=confirm` | confirm | figure 결과 확인 완료 → builder 진행 |

**프론트엔드 버튼 매핑** (SSE 호출 시 프롬프트로 전달):

| 버튼 | 프롬프트 |
|------|---------|
| [문제N 이미지 교체] | `resume --q=N --from=image_replace` |
| [문제N 이미지 재정리] | `resume --q=N --from=cleaned` |
| [문제N 재추출] | `resume --q=N --from=extractor` |
| [추출 결과 검증] | `resume --from=review_extract` |
| [문제N 해설 재작성] | `resume --q=N --from=solver` |
| [문제N 검증 재실행] | `resume --q=N --from=verifier` |
| [전체 이어서] | `resume` |
| [HWPX 재조립] | `resume --from=builder` |
| [그림 재처리] | `resume --from=figure` |
| [문제N 그림 재처리] | `resume --q=N --from=figure` |
| [확인] | `resume --from=confirm` |

#### 0-2. Resume 로직

resume 모드일 때, 지정된 문제/단계 **이후의 파일을 삭제**하고 해당 지점부터 재실행한다.

```python
import os, json

def cleanup_from_stage(question_nums, from_stage):
    """지정 단계 이후의 중간 파일을 삭제한다."""
    # 단계 순서: cleaned → extractor → solver → verifier → figure
    stage_files = {
        'cleaned':        [],  # cleaned 이미지 삭제는 별도 처리
        'image_replace':  ['_extracted.json', '_solved.json', '_verified.json'],  # cleaned 이미지도 별도 삭제
        'extractor':      ['_extracted.json', '_solved.json', '_verified.json'],
        'review_extract': ['_solved.json', '_verified.json'],  # 추출 결과 보존, 해설만 재작성
        'solver':         ['_solved.json', '_verified.json'],
        'verifier':       ['_verified.json'],
        'figure':         [],  # figure 출력 이미지 삭제는 별도 처리
    }

    # image_replace 전용: cleaned 이미지도 삭제
    if from_stage == 'image_replace':
        for n in question_nums:
            cleaned_path = f'inputs/시험지 제작/question_images/cleaned/q{n:02d}.png'
            if os.path.exists(cleaned_path):
                os.remove(cleaned_path)
                print(f"  삭제: {cleaned_path}")

    # figure 전용: 해당 문제의 figure 출력 이미지 삭제
    if from_stage == 'figure':
        for n in question_nums:
            fig_path = f'outputs/images/prob{n}_final.png'
            if os.path.exists(fig_path):
                os.remove(fig_path)
                print(f"  삭제: {fig_path}")
        # figure_status.json도 초기화 (재처리 시작)
        status_path = 'inputs/시험지 제작/.v3cache/figure_status.json'
        if os.path.exists(status_path):
            os.remove(status_path)
            print(f"  삭제: {status_path}")

    suffixes = stage_files.get(from_stage, [])
    for n in question_nums:
        for suffix in suffixes:
            path = f'inputs/시험지 제작/.v3cache/q{n}{suffix}'
            if os.path.exists(path):
                os.remove(path)
                print(f"  삭제: {path}")

def detect_resume_state(total_questions):
    """기존 파일을 스캔하여 각 문제의 완료 상태를 반환한다."""
    states = {}
    for n in range(1, total_questions + 1):
        if os.path.exists(f'inputs/시험지 제작/.v3cache/q{n}_verified.json'):
            states[n] = 'verified'
        elif os.path.exists(f'inputs/시험지 제작/.v3cache/q{n}_solved.json'):
            states[n] = 'solved'
        elif os.path.exists(f'inputs/시험지 제작/.v3cache/q{n}_extracted.json'):
            states[n] = 'extracted'
        else:
            states[n] = 'none'
    return states
```

**자동 resume** (`resume` — 문제/단계 미지정):
1. `detect_resume_state()`로 각 문제 상태 확인
2. 모든 문제가 `extracted`이고 `solved`가 하나도 없으면 → **Step 3.5(프론트엔드 편집) 단계로**
3. `verified` → 스킵, `solved` → verifier부터, `extracted` → solver부터, `none` → extractor부터
4. 모든 문제가 `verified`이면 Phase 2로 직접 진행
5. `exam_data.json`이 있고 모든 verified가 있으면 → Phase 2(figure)부터 재실행

**전체 resume with stage** (`--from=<stage>` — `--q` 미지정):
1. `cleanup_from_stage(list(range(1, total+1)), from_stage)` 실행 — 전체 문제에 적용
2. 전체 문제를 해당 단계부터 배치 병렬 실행 (Phase 1-A/1-B와 동일 방식)
3. 완료 후 처리:
   - `--from=extractor`: 전체 `[EXTRACTION_REVIEW]` 블록 출력 → Step 3.5
   - `--from=solver`: solver → verifier 배치 처리 (Step 4로 진행)
   - `--from=verifier`: verifier 배치 처리 후 Step 5로 진행

> `--from=extractor/solver/verifier`에서 `--q`가 없으면 항상 이 분기. `--q`가 있으면 아래 "지정 resume"으로.

**지정 resume** (`--q=3 --from=solver`):
1. `cleanup_from_stage([3], 'solver')` 실행
2. **전체 상태 스캔(`detect_resume_state`) 건너뜀** — 타겟 문제/단계가 명시되었으므로
3. 해당 문제만 지정 단계부터 재실행
4. 완료 후 처리 (단계에 따라 다름):
   - `--from=extractor` (Step 3.5 중 재추출): 해당 문제의 `[EXTRACTION_REVIEW]` 블록만 단독 출력 후 종료 — exam_data.json 재취합 불필요, 다른 문제 JSON 읽기 불필요
   - `--from=solver` / `--from=verifier`: 해당 문제의 `_verified.json`만 읽어서 기존 `exam_data.json`의 해당 문제 항목만 교체 (전체 재읽기 불필요)
   - `--from=builder` 이후: Phase 2 해당 단계부터 재실행

**과목 정보 조달** (`--q=N` 시): `exam_data.json`이 있으면 그것에서, 없으면 임의의 기존 `_extracted.json` 1개에서 읽는다. 전체 JSON을 순회하지 않는다.

#### 0-3. 캐시 초기화 (신규 실행 시만)

신규 실행(`작업해줘`)이면 이전 캐시를 `_prev`로 백업 후 새로 시작한다.

```bash
# 신규 실행 시: 직전 캐시 1개 보존 후 초기화
rm -rf "inputs/시험지 제작/.v3cache_prev"
mv "inputs/시험지 제작/.v3cache" "inputs/시험지 제작/.v3cache_prev" 2>/dev/null || true
mkdir -p "inputs/시험지 제작/.v3cache"
# question_images/cleaned도 삭제 (이전 작업 정리본 제거)
rm -rf "inputs/시험지 제작/question_images/cleaned"
rm -f "inputs/시험지 제작/question_images/q"*.png
```

**resume 모드에서는 삭제하지 않는다** — 기존 파일을 활용하는 것이 목적이므로.

> 실수로 신규 작업을 눌렀을 때 `.v3cache_prev/`에서 이전 작업 JSON을 복구할 수 있다.

#### 0-4. 기본 확인 (신규/resume 공통)

1. 문제 이미지 확인
   - 프론트엔드에서 업로드된 이미지: `inputs/시험지 제작/question_images/q{N}.png`
   - 또는 프롬프트에서 지정한 경로
2. 이미지 개수 = 문제 수 확인
3. 메타 정보 확인 (학교, 학년, 과목, 범위 — 프롬프트에서 제공 또는 기존 exam_data.json에서 로드)
4. 양식지 존재 확인: `ngd-studio/inputs/시험지 제작/[NGD고등부]기출작업양식지[2025년08월10일].hwpx`
5. GEMINI_API_KEY 환경변수 확인

```bash
mkdir -p "inputs/시험지 제작/.v3cache"
ls "inputs/시험지 제작/question_images/"
# --q=N 지정 resume: 해당 문제 파일만 확인 (전체 스캔 불필요)
#   ls "inputs/시험지 제작/.v3cache/q{N}"*.json 2>/dev/null
# 자동 resume (--q 미지정): 전체 스캔으로 상태 파악
#   ls "inputs/시험지 제작/.v3cache/q"*_*.json 2>/dev/null
```

### Step 1: 교과 컨텍스트 준비

`.claude/data/unit_classification.json`을 Read 도구로 읽는다. 이 JSON에는 과목별 단원 목록이 **교과 순서대로** 정렬되어 있다.

**교과 컨텍스트 생성 방법** (extractor 완료 후, solver 호출 전에 수행):

1. extractor 출력의 `subtopic` 값을 확인한다 (예: `"지수함수"`)
2. `unit_classification.json`에서 해당 과목(`subject` 코드)을 찾는다
3. 해당 과목의 모든 `units[].topics[]`를 **순서대로** 나열한다
4. `subtopic`이 나타나는 지점까지의 토픽 목록 = **선수 학습 범위**
5. 이 목록을 solver에게 전달한다

**구체적 예시**: 과목 `수1`(수학 I), subtopic `"삼각함수의 그래프"` 인 경우

```
unit_classification.json에서 수1의 topics 순서:
  지수 → 로그 → 상용로그 → 지수함수 → 로그함수 → 지수함수와 로그함수의 활용
  → 삼각함수 → [삼각함수의 그래프] ← 여기까지

선수 학습 범위:
- 지수
- 로그
- 상용로그
- 지수함수
- 로그함수
- 지수함수와 로그함수의 활용
- 삼각함수
- 삼각함수의 그래프 (현재 단원 포함)
```

**구현 코드** (Bash로 실행):

```python
import json

with open('.claude/data/unit_classification.json') as f:
    curriculum = json.load(f)

def get_prerequisite_topics(subject_code, subtopic):
    """주어진 과목/중단원에 대해 선수 학습 토픽 목록을 반환한다."""
    for subject in curriculum['subjects']:
        if subject['code'] == subject_code:
            all_topics = []
            for unit in subject['units']:
                for topic in unit['topics']:
                    all_topics.append(topic)
                    if topic == subtopic:
                        return {
                            'subject_name': subject['name'],
                            'unit_name': unit['name'],
                            'subtopic': subtopic,
                            'prerequisite_topics': all_topics,  # 현재 단원 포함
                        }
            # subtopic을 못 찾으면 전체 반환
            return {
                'subject_name': subject['name'],
                'unit_name': '(매칭 실패)',
                'subtopic': subtopic,
                'prerequisite_topics': all_topics,
            }
    return None

def format_curriculum_context(ctx):
    """solver/verifier에게 전달할 텍스트 형식으로 변환한다."""
    if not ctx:
        return "(교과 컨텍스트 없음)"
    lines = [
        f"이 문제는 {ctx['subject_name']} 과목, '{ctx['subtopic']}' 단원({ctx['unit_name']})입니다.",
        f"학생은 다음 단원까지 학습한 상태입니다:",
    ]
    for t in ctx['prerequisite_topics']:
        lines.append(f"- {t}")
    lines.append("")
    lines.append("이 범위의 개념만 사용하여 풀이를 작성하세요.")
    lines.append(f"{ctx['subject_name']} 이후 과목(미적분, 기하 등)의 개념은 사용하지 마세요.")
    return '\n'.join(lines)
```

**주의**: extractor가 subtopic을 `[UNCLEAR]`로 출력한 경우, 오케스트레이터가 문제 내용을 보고 수동으로 판단하거나, 교과 컨텍스트 없이 solver를 호출한다.

**과목 코드와 과목명 매핑**:
| 코드 | 과목명 |
|------|--------|
| `수상` | 고등수학 |
| `수1` | 수학 I |
| `수2` | 수학 II |
| `확통` | 확률과 통계 |
| `미적` | 미적분 |
| `기하` | 기하 |

---

### Step 2: 이미지 정리 (nano-banana)

extractor의 정확도를 높이기 위해, 원본 이미지를 nano-banana로 정리한다.
**원본 이미지는 보존**하고, 정리본을 별도 폴더에 저장한다.

```
inputs/시험지 제작/question_images/
├── q01.png          # 원본 (삭제 금지)
├── q02.png
├── ...
└── cleaned/         # nano-banana 정리본
    ├── q01.png
    └── ...
```

#### 2-0. 정리 배치 호출

8문제씩 배치로 nano-banana를 **동시에** 호출한다:

```
Agent(prompt="""
nano-banana 스킬로 이미지를 정리해줘.

입력: inputs/시험지 제작/question_images/q{N:02d}.png
출력: inputs/시험지 제작/question_images/cleaned/q{N:02d}.png

이 이미지는 수학 시험지 문제 사진이다. 다음을 수행:
- 손글씨, 필기 흔적 제거
- 인쇄된 텍스트, 수식, 테이블은 그대로 유지
- 원본과 동일한 내용 유지 (숫자, 수식 변경 금지)
- 배경을 깨끗한 흰색으로

프롬프트: "Clean scan of a Korean math exam question. Remove all handwriting and pen marks. Keep all printed text, numbers, equations, tables, and circle markers exactly as they are. White background, crisp black text. Do not change any numbers or mathematical expressions."
""")
```

모든 정리본이 생성되었는지 확인한다.
정리 실패 시 해당 문제는 원본 이미지로 fallback한다.

---

### Step 3: Phase 1-A — Extractor 전체 완료

문제를 **8개씩 배치**로 묶어 extractor를 실행한다. **Solver는 아직 시작하지 않는다.**

#### 3-1. Extractor 배치 호출

한 배치(8문제)의 extractor를 **동시에** Agent 도구로 호출.
**정리본 이미지**를 입력으로 사용한다:

```
Agent(subagent_type="ngd-exam-extractor", prompt="""
문제 {N}번 이미지에서 문제를 추출해줘.
이미지 경로: inputs/시험지 제작/question_images/cleaned/q{N:02d}.png
문제 번호: {N}
과목: {subject}
출력 경로: inputs/시험지 제작/.v3cache/q{N}_extracted.json
""")
```

8개를 **한 메시지에서** 동시 호출한다.

**확인**: 모든 extractor JSON이 생성되었는지, 필수 필드가 있는지 검증.

#### 3-2. 배치 반복

배치 1(Q1~Q8) → 배치 2(Q9~Q16) → ... → 마지막 배치까지 **extractor만** 실행.

**배치 내 모든 문제 실패 시**: 전체 작업 중단, 에러 리포트 출력.

---

### Step 3.5: 추출 결과 프론트엔드 편집 대기

**모든 extractor가 완료된 후, solver를 시작하기 전에** Claude는 추출 데이터를 출력하고 프론트엔드 편집을 기다린다.

#### Claude의 역할: 추출 데이터 출력

각 `q{N}_extracted.json`을 Read 도구로 읽어 아래 형식으로 출력한다. 프론트엔드가 이 출력을 파싱하여 편집 UI를 렌더링한다.

```
[EXTRACTION_REVIEW]
total: N
---
[Q1]
type: choice
score: 4.2
subtopic: 지수함수
difficulty: 중
parts: [{"t":"함수 "},{"eq":"f(x) = 2^x"},{"t":"의 그래프와 직선 "},{"eq":"y = 4"},{"t":"가 만나는 점의 "},{"eq":"x"},{"t":"좌표를 구하시오."}]
choices: [[{"eq":"1"}],[{"eq":"2"}],[{"eq":"3"}],[{"eq":"4"}],[{"eq":"5"}]]
answer: ②
has_figure: true
figure_position: right
figure_crop_ratio: [0.55, 0.1, 0.95, 0.7]
condition_box: null
---
[Q2]
...
[/EXTRACTION_REVIEW]
```

#### 프론트엔드의 역할

프론트엔드는 위 출력을 파싱하여 각 문제별 편집 UI를 표시한다:
- 원본 이미지 + 정리본 이미지 나란히 표시
- `parts` → 편집 가능한 텍스트/수식 필드
- `choices` → 편집 가능한 선지 필드 (5개)
- `answer` → 정답 선택 드롭다운
- `subtopic`, `difficulty` → 드롭다운
- `figure_crop_ratio` → 수치 입력 필드 (그림이 있는 경우)

사용자가 필드를 수정하면 **프론트엔드가 직접 `q{N}_extracted.json`을 저장**한다. Claude는 이 단계에서 JSON을 수정하지 않는다.

#### 진행 / 재추출 / 이미지 교체

| 사용자 액션 | 프론트엔드 전송 |
|-----------|--------------|
| [진행] 클릭 | `resume --from=solver` → Step 4 시작 |
| [문제N 재추출] 클릭 | `resume --q=N --from=extractor` → 해당 문제 재추출 후 Step 3.5로 복귀 (복수 선택 시 `--q=N,M`) |
| [문제N 이미지 교체] 클릭 | 프론트엔드가 새 이미지를 `q{N:02d}.png`로 저장 → `resume --q=N --from=image_replace` |

**재추출 후 복귀**: `--q=N` (단수) 또는 `--q=N,M,...` (복수) 모두 지원한다.

- 복수 지정 시 Phase 1-A와 동일하게 **모든 대상 문제를 한 메시지에서 동시에** Agent 호출
- cleanup → 병렬 extractor 완료 후 재추출된 문제들의 `[EXTRACTION_REVIEW]` 블록을 단독 출력
- 프론트엔드가 이를 파싱하여 해당 문제들의 편집 UI만 업데이트

```
[EXTRACTION_REVIEW]
total: K  ← 재추출된 문제 수
---
[QN]
...업데이트된 내용...
---
[QM]
...업데이트된 내용...
[/EXTRACTION_REVIEW]
```

**이미지 교체 플로우** (`--from=image_replace`):

프론트엔드가 먼저 새 이미지를 `inputs/시험지 제작/question_images/q{N:02d}.png`에 저장한 뒤 Claude를 호출한다. Claude는 다음 순서로 처리한다:

1. `cleanup_from_stage([N], 'image_replace')` 실행
   - `cleaned/q{N:02d}.png` 삭제
   - `q{N}_extracted.json`, `q{N}_solved.json`, `q{N}_verified.json` 삭제
2. 교체된 원본 이미지를 Read 도구로 표시 (교체 확인용)
3. 해당 문제만 nano-banana 정리 (Step 2와 동일한 방식):
   ```
   Agent(prompt="nano-banana 스킬로 inputs/시험지 제작/question_images/q{N:02d}.png를 정리해서
   inputs/시험지 제작/question_images/cleaned/q{N:02d}.png로 저장해줘 ...")
   ```
4. 해당 문제만 extractor 재실행 (Step 3과 동일한 방식)
5. 완료 후 해당 문제의 `[EXTRACTION_REVIEW]` 블록을 단독 출력 → Step 3.5로 복귀

---

### Step 4: Phase 1-B — Solver + Verifier 전체 완료

추출 검증이 완료된 후 solver와 verifier를 실행한다.

#### 4-1. Solver 배치 호출

전체 문제를 **8개씩 배치**로 묶어 처리. 각 배치 내에서는 **동시에** 호출한다.

1. 각 문제의 `q{N}_extracted.json`을 Read 도구로 읽어 `subtopic` 값을 확인한다
2. Step 1의 `get_prerequisite_topics(subject_code, subtopic)`로 교과 컨텍스트를 생성한다
3. `format_curriculum_context(ctx)`로 텍스트로 변환한다
4. 같은 배치의 solver를 **동시에** 호출:

```
Agent(subagent_type="ngd-exam-solver", prompt="""
문제 {N}번 해설을 생성해줘.
문제 JSON: inputs/시험지 제작/.v3cache/q{N}_extracted.json
출력 경로: inputs/시험지 제작/.v3cache/q{N}_solved.json

교과 컨텍스트:
{format_curriculum_context(ctx) 결과 — 아래와 같은 형식}

이 문제는 수학 I 과목, '삼각함수의 그래프' 단원(삼각함수)입니다.
학생은 다음 단원까지 학습한 상태입니다:
- 지수
- 로그
- 상용로그
- 지수함수
- 로그함수
- 지수함수와 로그함수의 활용
- 삼각함수
- 삼각함수의 그래프

이 범위의 개념만 사용하여 풀이를 작성하세요.
수학 I 이후 과목(미적분, 기하 등)의 개념은 사용하지 마세요.
""")
```

**핵심**: solver에게 **구체적인 토픽 목록**을 전달해야 한다. "수학 I 범위 내에서" 같은 모호한 지시 대신, 어떤 단원까지 배웠는지 **열거**한다.

#### 4-2. Verifier 배치 호출 + 재시도 루프

solver 완료 후, 같은 배치의 verifier를 **동시에** 호출:

```
Agent(subagent_type="ngd-exam-verifier", prompt="""
문제 {N}번 해설을 검증해줘.
문제 이미지: inputs/시험지 제작/question_images/q{N}.png
extractor JSON: inputs/시험지 제작/.v3cache/q{N}_extracted.json
solver JSON: inputs/시험지 제작/.v3cache/q{N}_solved.json
출력 경로: inputs/시험지 제작/.v3cache/q{N}_verified.json

교과 컨텍스트:
{curriculum_context}
""")
```

**재시도 루프** (문제별, 최대 3회):

```
attempt = 1
while attempt <= 3:
    verifier 호출
    결과 확인 (inputs/시험지 제작/.v3cache/q{N}_verified.json)
    if status == "pass":
        break
    if attempt < 3:
        feedback 추출
        solver 재호출 (feedback 포함)
        attempt += 1
    else:
        # 3회 실패 → manual_review 표시
        mark_manual_review(N)
```

fail된 문제만 개별로 solver→verifier 재시도. pass된 문제는 대기.

#### 4-3. 배치 반복

배치 1(Q1~Q8) → 배치 2(Q9~Q16) → ... → 마지막 배치

**배치 내 모든 문제 실패 시**: 전체 작업 중단, 에러 리포트 출력.

---

### Step 5: Phase 1 완료 — JSON 취합 + 최종 검증 + Figure 병렬 처리

#### 5-1. JSON 취합

모든 문제의 verified JSON을 하나의 `exam_data.json`으로 합친다:

```python
import json, glob

problems = []
failed = []
manual_review = []

for n in range(1, total_questions + 1):
    verified_path = f'inputs/시험지 제작/.v3cache/q{n}_verified.json'
    try:
        with open(verified_path) as f:
            prob = json.load(f)
            problems.append(prob)
            if prob.get('manual_review'):
                manual_review.append(n)
    except FileNotFoundError:
        failed.append(n)

exam_data = {
    "info": {
        "school": "...",         # 학교명 (예: 소명여고등학교)
        "year": 2025,
        "semester": "1학기",
        "exam_type": "중간",
        "grade": 2,
        "subject": "수학 I",
        "subject_code": "수1",   # 파일명용 과목 약칭
        "textbook": "",
        "range": "...",          # 범위 (예: 지수로그함수~삼각함수)
        "region": "...",         # 지역 (예: 경기부천시)
        "code": "00000",         # 작업 코드
        "total_pages": 5
    },
    "problems": problems
}

with open('inputs/시험지 제작/.v3cache/exam_data.json', 'w') as f:
    json.dump(exam_data, f, ensure_ascii=False, indent=2)
```

메타 정보(`info`)는 프롬프트에서 제공된 값으로 채운다.

#### 5-2. Figure 병렬 시작

JSON 취합 후 **figure 처리를 백그라운드 Bash로 시작**하고 job을 종료한다.

`exam_data.json`에서 `has_figure: true`인 문제가 있으면:

```
Bash("python3 figure_processor.py", run_in_background=True)
```

`figure_processor.py`는 exam_data.json을 읽어 crop → Gemini 재생성 → 트리밍 + NGD 워터마크를 처리하고, `outputs/images/prob{N}_final.png`로 저장한다. 완료 시 `.v3cache/figure_status.json`에 결과를 기록한다. 실패한 문제 번호는 stdout에 출력되며 exit code 1로 종료된다.

그림이 없는 시험지는 이 단계를 건너뛰고 바로 `.v3cache/figure_status.json`에 완료 상태를 기록한다.

**job 종료**: figure 백그라운드 시작 후 Claude는 job을 종료한다(status="done"). 프론트엔드가 `figure_status.json`을 polling하여 완료 시 `outputs/images/prob{N}_final.png` 이미지를 표시한다. 사용자가 이미지를 확인하고 [확인] 버튼을 누르면 `resume --from=confirm`이 전송된다.

#### 5-3. --from=confirm 처리

`resume --from=confirm` 수신 시:
1. figure 완료 여부 확인 (`.v3cache/figure_status.json` 존재 확인)
2. 미완료면 완료까지 대기
3. 완료 후 바로 Step 6(Builder)로 진행

---

### Step 6: Phase 2 — HWPX 조립

`build_hwpx.py` 스크립트를 직접 실행:

```python
JSON_PATH = "inputs/시험지 제작/.v3cache/exam_data.json"
OUTPUT_DIR = "outputs"

Bash(f"python3 /mnt/c/NGD/build_hwpx.py {JSON_PATH} {OUTPUT_DIR}")
```

성공 시 출력에서 `HWPX written: <경로>` 확인 후 후처리:

```python
# 출력 파일 경로 파악 후
Bash(f"python3 /mnt/c/NGD/.claude/skills/ngd-exam-create/scripts/fix_namespaces.py <hwpx_path>")
Bash(f"python3 /mnt/c/NGD/.claude/skills/ngd-exam-create/scripts/validate.py --fix <hwpx_path>")
```

**실패 시**: 에러 메시지를 그대로 리포트하고 중단. 스크립트 재실행은 동일한 결과가 나오므로 의미 없음.

**확인**: HWPX 파일 생성, 문제 누락 없는지 검증.

### Step 7: Phase 2 — Checker 호출

Agent 도구로 `ngd-exam-checker` 에이전트를 호출:

```
Agent(subagent_type="ngd-exam-checker", prompt="""
[HWPX 파일 경로]를 검수해줘
- 10가지 체크리스트로 AI 실수 검증
- 수정 지시 JSON 생성
""")
```

### Step 8: Checker 피드백 반영 (최대 2회)

checker FAIL 시:
- XML 구조 오류 / 수식 오류 → 에러 내용 리포트 (스크립트 재실행 불가, 수동 확인 필요)
- 내용 누락 / 순서 오류 → exam_data.json 수정 후 Step 6 재실행
- 수정 후 checker 재호출 (최대 2회)

---

### Step 9: 최종 결과 리포트

```
=== V3 시험지 제작 결과 ===
파일: [출력 파일명]
학교: [학교명]
시험: [학년/학기/차수]
과목: [과목] (범위: [범위])

[문제] 총 N문제
  성공: N개 (문제 1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17)
  주의: N개 (문제 13 — verifier 3회 실패, 수동 검토 필요)
  실패: N개 (문제 18 — extractor 추출 실패)

[Phase 1] extractor (전체) → 사용자 편집 → solver→verifier
  배치: N개 (8문제×M + 나머지)
  추출 단계 사용자 수정: N건
  verifier 재시도: N건

[Phase 2] figure→builder→checker
  그림: N개 생성 (NGD 워터마크 포함)
  HWPX: 생성 완료
  검수: checker PASS (N/10)

[후처리] fix_namespaces.py 완료, validate.py 통과
```

---

## 에러 처리

### 문제 레벨 실패
- extractor 실패 → 해당 문제 skip, 로그에 경고
- solver 실패 → 해당 문제 skip
- verifier 3회 실패 → `"manual_review": true` 표시, solver 마지막 출력 사용

### 배치 레벨 실패
- 배치 내 **모든 문제**가 실패하면 전체 작업 중단

### 전체 레벨 실패
- builder/checker 실패 → 기존과 동일하게 처리

## 파일명 규칙

```
[코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]
```

## 서식 규칙

- 서체: 나눔고딕 10, 수식크기 11, 수식서체 HYhwpEQ
- 스타일: F6 → 바탕글 1개만
- 미주-문제: 붙여쓰기
- 문제-선지: Enter 한 줄
- shift+enter: 정답 라인 2줄 때만
- 서술형: `[서술형 N]`
- 그림: 모든 생성 그림에 NGD 워터마크 필수

## 작업 디렉토리

```
inputs/시험지 제작/question_images/
├── q01.png                  # 원본 문제 이미지 (프론트엔드 업로드, 삭제 금지)
├── q02.png
├── ...
└── cleaned/                 # nano-banana 정리본 (extractor 입력으로 사용)
    ├── q01.png
    └── ...

inputs/시험지 제작/.v3cache/
├── q1_extracted.json        # extractor 출력
├── q1_solved.json           # solver 출력
├── q1_verified.json         # verifier 출력 (최종)
└── exam_data.json           # 취합 JSON (builder 입력)
```
