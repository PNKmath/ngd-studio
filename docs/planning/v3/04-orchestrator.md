# V3 오케스트레이터 / 병렬 처리 설계

## 오케스트레이터 스킬

### ngd-exam-create-v3 (SKILL.md)

V1의 `ngd-exam-create`를 대체. 5개 순차 에이전트 → 병렬 + 순차 혼합 구조.

### 실행 흐름

```
입력: 문제 이미지 목록 + 메타 정보

Phase 1 — 병렬 처리 (문제별, 4개씩)
├─ batch 1: Q1~Q4  각각 extractor → solver ↔ verifier
├─ batch 2: Q5~Q8  각각 extractor → solver ↔ verifier
├─ batch 3: Q9~Q12 각각 extractor → solver ↔ verifier
├─ batch 4: Q13~Q16 각각 extractor → solver ↔ verifier
└─ batch 5: Q17~Q18 각각 extractor → solver ↔ verifier

Phase 2 — 순차 처리
├─ figure  (그림 있는 문제만)
├─ builder (전체 JSON → HWPX)
└─ checker (최종 검수)
```

---

## Phase 1: 병렬 처리 상세

### 배치 구성
- 문제를 4개씩 묶어 배치 생성
- 각 배치 내 4문제는 **동시에** Agent 도구로 호출
- 한 배치가 완료되면 다음 배치 시작

### 문제 1개의 처리 흐름

```
[extractor]
  입력: 문제 이미지 경로
  출력: /tmp/v3/q{N}_extracted.json

  → 성공 시 ↓
  → 실패 시 → 에러 기록, 해당 문제 skip

[solver]
  입력: /tmp/v3/q{N}_extracted.json + 교과 컨텍스트
  출력: /tmp/v3/q{N}_solved.json

  → 성공 시 ↓

[verifier] (최대 3회 루프)
  입력: 문제 이미지 + q{N}_extracted.json + q{N}_solved.json
  출력: /tmp/v3/q{N}_verified.json

  → pass: 완료
  → fail (attempt < 3):
      feedback을 포함하여 solver 재호출
      → solver 출력 업데이트
      → verifier 재검증
  → fail (attempt = 3):
      실패로 기록, "수동 검토 필요" 표시
```

### 병렬 호출 구현 (오케스트레이터 내부)

Claude Code의 Agent 도구는 한 메시지에서 여러 개를 동시에 호출 가능:

```
오케스트레이터가 하나의 메시지에서 4개의 Agent 도구를 동시 호출:

Agent(subagent_type="ngd-exam-extractor", prompt="문제 1번 추출: /tmp/v3/images/q1.png")
Agent(subagent_type="ngd-exam-extractor", prompt="문제 2번 추출: /tmp/v3/images/q2.png")
Agent(subagent_type="ngd-exam-extractor", prompt="문제 3번 추출: /tmp/v3/images/q3.png")
Agent(subagent_type="ngd-exam-extractor", prompt="문제 4번 추출: /tmp/v3/images/q4.png")

→ 4개 모두 완료 대기

→ 다음 단계: solver 4개 동시 호출
Agent(subagent_type="ngd-exam-solver", prompt="문제 1번 해설: /tmp/v3/q1_extracted.json")
...

→ verifier 4개 동시 호출
...
```

### 배치 간 순차 실행 이유
- Claude Code는 한 번에 스폰할 수 있는 서브에이전트 수에 제한이 있음
- 4개씩 배치로 하면 rate limit 문제 방지
- 앞 배치 결과를 보고 문제가 있으면 조기 중단 가능

---

## Phase 2: 순차 처리 상세

### JSON 취합

Phase 1 완료 후, 문제별 결과를 하나의 `exam_data.json`으로 합침:

```python
import json, glob

problems = []
for f in sorted(glob.glob('/tmp/v3/q*_verified.json')):
    with open(f) as fp:
        problems.append(json.load(fp))

# 메타 정보는 오케스트레이터가 전달
exam_data = {
    "metadata": { ... },
    "problems": problems
}

with open('/tmp/exam_data.json', 'w') as fp:
    json.dump(exam_data, fp, ensure_ascii=False, indent=2)
```

### Figure 처리
- `exam_data.json`에서 `has_figure=true` 문제 추출
- 문제 이미지에서 그림 영역 crop
- nano-banana 재생성 + 트리밍 + 워터마크
- `final_image` 경로를 JSON에 업데이트

### Builder
- 기존 builder 에이전트 그대로 호출
- 입력: `/tmp/exam_data.json`
- 출력: `outputs/*.hwpx`

### Checker
- 기존 checker 에이전트 그대로 호출
- 피드백 루프 최대 2회

---

## 파일 구조 (/tmp/v3/)

```
/tmp/v3/
├── images/                  # 프론트엔드에서 업로드된 문제 이미지
│   ├── q1.png
│   ├── q2.png
│   └── ...
├── q1_extracted.json        # extractor 출력
├── q1_solved.json           # solver 출력
├── q1_verified.json         # verifier 출력 (최종)
├── q2_extracted.json
├── q2_solved.json
├── q2_verified.json
├── ...
└── exam_data.json           # 취합된 최종 JSON (builder 입력)
```

---

## 에러 처리

### 문제 레벨 실패
- extractor 실패: 해당 문제 skip, 로그에 경고
- solver 실패: 해당 문제 skip
- verifier 3회 실패: `"manual_review": true` 표시, builder에는 solver 마지막 출력 사용

### 배치 레벨 실패
- 배치 내 모든 문제가 실패하면 전체 작업 중단

### 전체 레벨 실패
- builder/checker 실패: 기존과 동일하게 처리

### 실패 문제 리포트
작업 완료 시 실패 문제 목록 출력:
```
=== V3 제작 결과 ===
총 18문제 중 16문제 성공, 2문제 주의

성공 (16): 1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17
주의 (1): 13번 — verifier 3회 실패 (수동 검토 필요)
실패 (1): 18번 — extractor 추출 실패 (이미지 품질 문제)

HWPX 생성: outputs/[...].hwpx
```

---

## 교과 순서 컨텍스트 생성

### 오케스트레이터가 solver 호출 전에 준비

```python
import json

with open('.claude/data/unit_classification.json') as f:
    curriculum = json.load(f)

def get_curriculum_context(subject_code, topic_name):
    """
    주어진 과목/단원에 대한 교과 컨텍스트 생성.
    solver에게 "이 범위의 개념만 사용하여 풀이" 지시.
    """
    for subject in curriculum['subjects']:
        if subject['code'] == subject_code:
            all_topics = []
            current_found = False
            for unit in subject['units']:
                for topic in unit['topics']:
                    all_topics.append(topic)
                    if topic == topic_name:
                        current_found = True
                        break
                if current_found:
                    break

            return {
                "subject": subject['name'],
                "unit": unit['name'],
                "topic": topic_name,
                "prerequisite_topics": all_topics[:-1],  # 현재 단원 이전
                "instruction": f"{subject['name']} 교과 범위 내에서, "
                              f"'{topic_name}' 단원까지 배운 학생이 "
                              f"이해할 수 있는 수준으로 풀이를 작성하세요."
            }

    return None  # 단원 매칭 실패 시
```

### solver에게 전달하는 형태
```
이 문제는 수학I 과목, '지수함수 그래프' 단원입니다.
학생은 다음 단원까지 학습한 상태입니다:
- 지수
- 로그
- 지수법칙
- 지수함수 그래프

이 범위의 개념만 사용하여 풀이를 작성하세요.
미적분, 확률과통계 등 상위 과목의 개념은 사용하지 마세요.
```

---

## 스테이지 감지 (SSE 이벤트 매핑)

### transformToSSE에 추가할 패턴

```typescript
// 기존 agentTypeToStage에 추가
const agentTypeToStage: Record<string, string> = {
  "ngd-exam-extractor": "extractor",
  "ngd-exam-solver":    "solver",
  "ngd-exam-verifier":  "verifier",
  "ngd-exam-figure":    "figure",
  "ngd-exam-builder":   "builder",
  "ngd-exam-checker":   "checker",
};
```

### 텍스트 패턴 매핑
```typescript
const stagePatterns = [
  { name: "extractor", patterns: [/ngd-exam-extractor/i, /문제.*추출/i] },
  { name: "solver",    patterns: [/ngd-exam-solver/i, /해설.*생성/i] },
  { name: "verifier",  patterns: [/ngd-exam-verifier/i, /해설.*검증/i, /verif/i] },
  // figure, builder, checker 기존 패턴 유지
];
```

---

## 성능 예상

### V1 (순차)
- 18문제 시험지: ~15분 (reader 3분 + solver 3분 + figure 2분 + builder 5분 + checker 2분)

### V3 (병렬)
- 18문제, 4개 병렬 = 5배치
- Phase 1: ~10분 (배치당 ~2분 × 5배치)
- Phase 2: ~7분 (figure 2분 + builder 3분 + checker 2분)
- 총: ~17분

V3가 V1보다 약간 느릴 수 있지만, **품질이 훨씬 높음**.
병렬 수를 늘리면 속도 향상 가능 (6개, 8개).

---

## 관련 문서

- [01-overview.md](./01-overview.md) — 전체 개요
- [02-agents.md](./02-agents.md) — 에이전트 상세 설계
- [03-frontend.md](./03-frontend.md) — 프론트엔드 상세 설계
- [05-checklist.md](./05-checklist.md) — 구현 체크리스트
