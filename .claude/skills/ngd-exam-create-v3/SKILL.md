---
name: ngd-exam-create-v3
description: "NGD V3 시험지 제작 오케스트레이터. 문제별 이미지 기반으로 extractor→solver→verifier 병렬 처리 후 figure→builder→checker 순차 처리. '시험지 제작 v3', 'V3 작업' 키워드에 사용."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: "[이미지 폴더 경로 또는 메타 정보]"
---

# NGD V3 시험지 제작 오케스트레이터

이 스킬은 직접 시험지를 만들지 않고, **에이전트들을 병렬/순차 조합**하여 완성된 시험지를 생성한다.

## 서브 에이전트 구조

```
ngd-exam-create-v3 (이 스킬 = 오케스트레이터)
│
├─ Phase 1: 문제별 병렬 처리 (4개씩 배치)
│   ├─ [1] ngd-exam-extractor : 이미지 → 문제 JSON
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
| `V3 작업해줘 [메타정보]` | 신규 | 처음부터 전체 실행 |
| `V3 resume` | 자동 resume | 기존 파일 스캔 → 미완료 지점부터 |
| `V3 resume --q=3 --from=extractor` | 지정 resume | 3번 extractor부터 재실행 |
| `V3 resume --q=3,7 --from=solver` | 지정 resume | 3,7번 solver부터 재실행 |
| `V3 resume --from=builder` | Phase 2 resume | builder부터 재실행 |
| `V3 resume --from=figure` | Phase 2 resume | figure부터 재실행 |
| `V3 resume --from=review` | 검증 resume | 사용자 검증 단계부터 |

**프론트엔드 버튼 매핑** (SSE 호출 시 프롬프트로 전달):

| 버튼 | 프롬프트 |
|------|---------|
| [문제N 재추출] | `V3 resume --q=N --from=extractor` |
| [문제N 해설 재작성] | `V3 resume --q=N --from=solver` |
| [문제N 검증 재실행] | `V3 resume --q=N --from=verifier` |
| [전체 이어서] | `V3 resume` |
| [HWPX 재조립] | `V3 resume --from=builder` |
| [그림 재처리] | `V3 resume --from=figure` |

#### 0-2. Resume 로직

resume 모드일 때, 지정된 문제/단계 **이후의 파일을 삭제**하고 해당 지점부터 재실행한다.

```python
import os, json

def cleanup_from_stage(question_nums, from_stage):
    """지정 단계 이후의 중간 파일을 삭제한다."""
    # 단계 순서: extractor → solver → verifier
    stage_files = {
        'extractor': ['_extracted.json', '_solved.json', '_verified.json'],
        'solver':    ['_solved.json', '_verified.json'],
        'verifier':  ['_verified.json'],
    }

    suffixes = stage_files.get(from_stage, [])
    for n in question_nums:
        for suffix in suffixes:
            path = f'/tmp/v3/q{n}{suffix}'
            if os.path.exists(path):
                os.remove(path)
                print(f"  삭제: {path}")

def detect_resume_state(total_questions):
    """기존 파일을 스캔하여 각 문제의 완료 상태를 반환한다."""
    states = {}
    for n in range(1, total_questions + 1):
        if os.path.exists(f'/tmp/v3/q{n}_verified.json'):
            states[n] = 'verified'
        elif os.path.exists(f'/tmp/v3/q{n}_solved.json'):
            states[n] = 'solved'
        elif os.path.exists(f'/tmp/v3/q{n}_extracted.json'):
            states[n] = 'extracted'
        else:
            states[n] = 'none'
    return states
```

**자동 resume** (`V3 resume` — 문제/단계 미지정):
1. `detect_resume_state()`로 각 문제 상태 확인
2. `verified` → 스킵, `solved` → verifier부터, `extracted` → solver부터, `none` → extractor부터
3. 모든 문제가 `verified`이면 Phase 2로 직접 진행
4. `exam_data.json`이 있고 모든 verified가 있으면 → 사용자 검증 단계로

**지정 resume** (`--q=3 --from=solver`):
1. `cleanup_from_stage([3], 'solver')` 실행
2. 해당 문제만 solver부터 재실행
3. 완료 후 기존 verified와 합쳐서 exam_data.json 재취합

#### 0-3. 기본 확인 (신규/resume 공통)

1. 문제 이미지 확인
   - 프론트엔드에서 업로드된 이미지: `/tmp/v3/images/q{N}.png`
   - 또는 프롬프트에서 지정한 경로
2. 이미지 개수 = 문제 수 확인
3. 메타 정보 확인 (학교, 학년, 과목, 범위 — 프롬프트에서 제공 또는 기존 exam_data.json에서 로드)
4. 양식지 존재 확인: `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`
5. GEMINI_API_KEY 환경변수 확인

```bash
mkdir -p /tmp/v3/images
ls /tmp/v3/images/
# resume 모드: 기존 중간 파일 상태 확인
ls /tmp/v3/q*_*.json 2>/dev/null
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

### Step 2: Phase 1 — 문제별 병렬 처리

문제를 **4개씩 배치**로 묶어 처리한다. 각 배치 내에서는 **동시에** Agent를 호출한다.

#### 2-1. Extractor 배치 호출

한 배치(4문제)의 extractor를 **동시에** Agent 도구로 호출:

```
Agent(subagent_type="ngd-exam-extractor", prompt="""
문제 {N}번 이미지에서 문제를 추출해줘.
이미지 경로: /tmp/v3/images/q{N}.png
문제 번호: {N}
과목: {subject}
출력 경로: /tmp/v3/q{N}_extracted.json
""")
```

4개를 **한 메시지에서** 동시 호출한다.

**확인**: 모든 extractor JSON이 생성되었는지, 필수 필드가 있는지 검증.

#### 2-2. Solver 배치 호출

extractor 완료 후:
1. 각 문제의 `q{N}_extracted.json`을 Read 도구로 읽어 `subtopic` 값을 확인한다
2. Step 1의 `get_prerequisite_topics(subject_code, subtopic)`로 교과 컨텍스트를 생성한다
3. `format_curriculum_context(ctx)`로 텍스트로 변환한다
4. 같은 배치의 solver를 **동시에** 호출:

```
Agent(subagent_type="ngd-exam-solver", prompt="""
V3 모드로 문제 {N}번 해설을 생성해줘.
문제 JSON: /tmp/v3/q{N}_extracted.json
출력 경로: /tmp/v3/q{N}_solved.json

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

#### 2-3. Verifier 배치 호출 + 재시도 루프

solver 완료 후, 같은 배치의 verifier를 **동시에** 호출:

```
Agent(subagent_type="ngd-exam-verifier", prompt="""
문제 {N}번 해설을 검증해줘.
문제 이미지: /tmp/v3/images/q{N}.png
extractor JSON: /tmp/v3/q{N}_extracted.json
solver JSON: /tmp/v3/q{N}_solved.json
출력 경로: /tmp/v3/q{N}_verified.json

교과 컨텍스트:
{curriculum_context}
""")
```

**재시도 루프** (문제별, 최대 3회):

```
attempt = 1
while attempt <= 3:
    verifier 호출
    결과 확인 (/tmp/v3/q{N}_verified.json)
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

#### 2-4. 배치 반복

배치 1(Q1~Q4) → 배치 2(Q5~Q8) → ... → 마지막 배치

**배치 내 모든 문제 실패 시**: 전체 작업 중단, 에러 리포트 출력.

---

### Step 3: Phase 1 완료 — JSON 취합 + 사용자 검증 + Figure 병렬 처리

#### 3-1. JSON 취합

모든 문제의 verified JSON을 하나의 `exam_data.json`으로 합친다:

```python
import json, glob

problems = []
failed = []
manual_review = []

for n in range(1, total_questions + 1):
    verified_path = f'/tmp/v3/q{n}_verified.json'
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
        "school": "...",
        "year": 2025,
        "semester": "1학기",
        "exam_type": "중간",
        "grade": 2,
        "subject": "수학 I",
        "textbook": "",
        "range": "...",
        "total_pages": 5
    },
    "problems": problems
}

with open('/tmp/exam_data.json', 'w') as f:
    json.dump(exam_data, f, ensure_ascii=False, indent=2)
```

메타 정보(`info`)는 프롬프트에서 제공된 값으로 채운다.

#### 3-2. 사용자 검증 화면 출력 + Figure 병렬 시작

JSON 취합 후 **두 가지를 동시에** 진행한다:

**A) 사용자 검증 화면 출력**

각 문제에 대해 **원본 이미지 + 추출/해설 요약**을 나란히 보여준다. Read 도구로 문제 이미지를 읽어 표시하고, verified JSON에서 핵심 정보를 텍스트로 요약한다.

```
=== 문제 {N}번 검증 ===

[Read 도구로 /tmp/v3/images/q{N}.png 표시]

유형: choice / 배점: 4.2 / 단원: 지수함수 / 난이도: 중
본문: 함수 f(x) = 2^x 의 그래프와 직선 y = 4 가 만나는 점의 x 좌표를 구하시오.
선지: ① 1  ② 2  ③ 3  ④ 4  ⑤ 5
정답: ②
해설: (solver 해설 요약 1~2줄)
그림: 있음 (right, crop_ratio: [0.55, 0.1, 0.95, 0.7])
verifier: PASS (1회차)
```

**본문 렌더링 규칙**:
- `parts` 배열에서 `{"t": "텍스트"}` → 그대로 출력
- `{"eq": "수식"}` → 수식 스크립트 그대로 출력 (사용자가 HWP 수식 문법을 알고 있음)
- 선지는 `①②③④⑤` 원숫자를 붙여서 한 줄로 출력
- `condition_box`가 있으면 보기 내용도 표시
- `data_table`이 있으면 테이블 타입과 크기 표시

모든 문제를 순서대로 출력한 후, 사용자에게 확인을 요청한다:

```
모든 문제 검증 화면을 출력했습니다.
수정이 필요한 문제가 있으면 번호와 수정 내용을 알려주세요.
문제없으면 "확인" 또는 "진행"이라고 답해주세요.
```

**사용자 수정 요청 처리**:
- 사용자가 특정 문제의 본문/수식/정답/해설 수정을 요청하면, 해당 `q{N}_verified.json`을 수정하고 `exam_data.json`을 다시 취합한다
- 수정 후 해당 문제만 다시 검증 화면을 보여준다
- 사용자가 "확인"/"진행"이라고 답하면 builder 단계로 넘어간다

**B) Figure 처리 (병렬)**

사용자 검증과 **동시에** figure 처리를 백그라운드 Agent로 시작한다.
`exam_data.json`에서 `has_figure: true`인 문제가 있으면:

```
Agent(subagent_type="ngd-exam-figure", run_in_background=true, prompt="""
/tmp/exam_data.json에서 그림 정보를 읽고 처리해줘

V3 모드 (문제 이미지 기반):
- 문제 이미지 폴더: /tmp/v3/images/ (PDF JPG가 아님!)
- 각 문제의 figure_info.crop_ratio (비율 좌표)로 문제 이미지에서 그림 영역 crop
- crop한 그림을 nano-banana로 깔끔하게 재생성
- 트리밍 + NGD 워터마크 적용
- 최종 이미지를 outputs/images/에 저장
- JSON에 final_image 경로 업데이트
""")
```

그림이 없는 시험지는 이 단계를 건너뛴다.

#### 3-3. Builder 진행 조건

다음 **두 조건이 모두 충족**되어야 Step 4(Builder)로 진행한다:

1. ✅ **사용자 검수 완료** — 사용자가 "확인"/"진행" 응답
2. ✅ **Figure 처리 완료** — 백그라운드 figure 에이전트 완료 (그림 없으면 자동 충족)

사용자 수정으로 `exam_data.json`이 변경된 경우, figure 에이전트가 이미 처리한 그림은 그대로 사용하고, 새로 그림이 추가/변경된 문제만 figure를 재처리한다.

---

### Step 4: Phase 2 — Builder 호출

Agent 도구로 `ngd-exam-builder` 에이전트를 호출:

```
Agent(subagent_type="ngd-exam-builder", prompt="""
/tmp/exam_data.json과 outputs/images/의 이미지로 HWPX를 생성해줘
- 양식지: inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx
- 모든 문제, 해설, 이미지 빠짐없이 포함
- 특수 테이블(표준정규분포표, 확률분포표, 증감표 등)은 양식지에서 XML 템플릿을 추출하여 사용 (docs/hwpx-templates.md 참조)
  - data_table.type == "normal_dist" → 양식지의 "표준 정규분포표" 템플릿
  - data_table.type == "probability" → 양식지의 "확률분포표 양식" 템플릿
  - data_table.type == "increase_decrease" → 양식지의 "함수 증감표양식" 템플릿
  - explanation_table.type == "synthetic_division" → 양식지의 "조립제법 틀" 템플릿
- fix_namespaces.py 후처리 필수
- validate.py --fix 검증 필수
- outputs/에 파일명 규칙대로 저장
""")
```

**확인**: HWPX 파일 생성, 문제 누락 없는지 검증.

### Step 5: Phase 2 — Checker 호출

Agent 도구로 `ngd-exam-checker` 에이전트를 호출:

```
Agent(subagent_type="ngd-exam-checker", prompt="""
[HWPX 파일 경로]를 검수해줘
- 10가지 체크리스트로 AI 실수 검증
- 수정 지시 JSON 생성
""")
```

### Step 6: Checker 피드백 반영 (최대 2회)

checker FAIL 시 해당 에이전트 재호출:
- XML 구조 오류 → builder 재호출
- 수식 오류 → builder 재호출 (V3에서는 해설 오류는 verifier가 이미 잡았으므로 거의 없음)
- 수정 후 checker 재호출 (최대 2회)

---

### Step 7: 최종 결과 리포트

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

[Phase 1] extractor→solver→verifier
  배치: N개 (4문제×M + 나머지)
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
/tmp/v3/
├── images/                  # 문제 이미지 (프론트엔드 업로드)
│   ├── q1.png
│   └── ...
├── q1_extracted.json        # extractor 출력
├── q1_solved.json           # solver 출력
├── q1_verified.json         # verifier 출력 (최종)
└── exam_data.json           # 취합 JSON (builder 입력)
```
