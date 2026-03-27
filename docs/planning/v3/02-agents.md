# V3 에이전트 상세 설계

## 1. ngd-exam-extractor (신규)

### 역할
문제 이미지 1장을 받아서 구조화된 JSON으로 추출한다.
기존 `ngd-exam-reader`가 PDF 전체를 텍스트로 변환하던 것을 대체.

### 입력
- 문제 이미지 파일 경로 (PNG/JPG)
- 문제 번호
- 단원분류표 (`unit_classification.json`)

### 출력
```json
{
  "number": 1,
  "type": "choice",
  "score": "4.2",
  "difficulty": "중",
  "subtopic": "지수함수 그래프(수1)",
  "has_figure": true,
  "figure_info": {
    "description": "y=2^x 그래프와 직선 y=4의 교점",
    "position": "right"
  },
  "parts": [
    {"t": "함수 "},
    {"eq": "f(x) = 2^x"},
    {"t": "의 그래프와 직선 "},
    {"eq": "y = 4"},
    {"t": "가 만나는 점의 "},
    {"eq": "x"},
    {"t": "좌표를 구하시오."}
  ],
  "choices": [
    {"num": 1, "parts": [{"eq": "1"}]},
    {"num": 2, "parts": [{"eq": "2"}]},
    {"num": 3, "parts": [{"eq": "3"}]},
    {"num": 4, "parts": [{"eq": "4"}]},
    {"num": 5, "parts": [{"eq": "5"}]}
  ],
  "answer": "2",
  "condition_box": null,
  "bogi_box": null
}
```

### 핵심 규칙
- 이미지를 직접 보고 추출 (텍스트 변환 아님)
- **모든 수학 내용은 eq로**: 변수, 영문자, 숫자 포함
- **HWP 수식 문법** 사용 (hwp-equation 스킬)
- 읽을 수 없는 내용은 `[UNCLEAR]` 표기 (추측 금지)
- 단원 분류는 `unit_classification.json` 정규 값과 일치해야 함
- `parts` 배열: `{"t": "텍스트"}` + `{"eq": "HWP수식"}` 교차
- 수식 연산자 앞뒤 공백: `x + y = 3` (O), `x+y=3` (X)

### 참조 파일
- `.claude/data/unit_classification.json` — 단원 분류
- `.claude/skills/hwp-equation/` — HWP 수식 문법
- `docs/guidelines-layout.md` — 배점, 선지 형식

### 기존 reader와의 차이

| 항목 | reader (V1) | extractor (V3) |
|------|------------|----------------|
| 입력 | PDF 전체 | 문제 이미지 1장 |
| 처리 단위 | 시험지 전체 (20문제) | 문제 1개 |
| 해설 추출 | 원본 PDF에 해설 있으면 추출 | 해설 추출 안 함 (solver 담당) |
| 메타 정보 | 머릿말, 파일명 등 전체 | 문제 레벨 메타만 |
| 2차 검증 | 이미지로 재검증 | 이미지가 유일한 소스 |

---

## 2. ngd-exam-solver (기존 강화)

### 변경 사항
1. **문제별 독립 호출**: 한 번에 1문제씩 처리 (기존: 부실 해설만 일괄)
2. **교과 순서 컨텍스트**: "이 단원의 선수 학습 범위" 정보 제공
3. **난이도별 줄 수 제한 제거**: "쎈 교재 수준으로 상세히 풀이"만 유지
4. **입력 변경**: extractor 출력 JSON을 직접 받음

### 입력
```json
{
  "problem": { /* extractor 출력 JSON */ },
  "curriculum_context": {
    "subject": "수학I",
    "unit": "지수함수과 로그함수",
    "topic": "지수함수 그래프",
    "prerequisite_topics": ["지수", "로그", "지수법칙"]
  },
  "guidelines": {
    "depth": "쎈 교재 수준으로 상세히 풀이",
    "format": "explanation_parts 배열 (t/eq/br 교차)",
    "rules": "통수식 금지, 등호 단위로 끊기, rm체 규칙 준수"
  }
}
```

### 출력
```json
{
  "number": 1,
  "answer": "2",
  "explanation_parts": [
    {"eq": "f(x) = 2^x"},
    {"t": "에서 "},
    {"eq": "y = 4"},
    {"t": "일 때"},
    {"br": true},
    {"eq": "2^x = 4"},
    {"eq": "= 2^2"},
    {"br": true},
    {"t": "따라서 "},
    {"eq": "x = 2"}
  ]
}
```

### 교과 순서 컨텍스트 생성 방법
`unit_classification.json`에서 해당 문제의 단원을 찾은 뒤:
1. 해당 과목의 단원 목록에서 현재 단원의 위치 확인
2. 현재 단원 이전의 단원들 = 선수 학습 범위
3. solver에게 "이 범위의 개념만 사용하여 풀이 작성" 지시

### 해설 작성 규칙 (guidelines-answer.md 기반)
- [정답] 라인 → 풀이 순서
- 정답 bold 금지
- shift+enter 금지 (정답 2줄일 때만)
- 통수식 금지 — 등호 단위로 끊기
- [다른 풀이] 있으면 추가
- 서술형: 소문항 (1), (2) 통일

### 풀이 예시 (기존 solver에서 가져옴)

**선택형 (확률)**:
```json
"explanation_parts": [
    {"t": "구하는 확률은 "},
    {"eq": "{it`_5}{rm C}_{it 3} times left( {1 over 2} right)^3 times left( {1 over 2} right)^2"},
    {"eq": "= 10 times {1 over 32}"},
    {"eq": "= {5 over 16}"}
]
```

**서답형 (수열)**:
```json
"explanation_parts": [
    {"eq": "a_1 = 2"},
    {"t": "이고 "},
    {"eq": "a_{n + 1} = a_n + 2n"},
    {"t": "이므로"},
    {"eq": "a_2 = 2 + 2 = 4"},
    {"eq": "a_3 = 4 + 4 = 8"},
    {"eq": "a_4 = 8 + 6 = 14"},
    {"t": "따라서 "},
    {"eq": "a_4 = 14"}
]
```

---

## 3. ngd-exam-verifier (신규)

### 역할
solver가 생성한 해설을 독립적으로 검증한다.
생성 에이전트와 검증 에이전트를 분리하여 품질을 보장.

### 입력
- 문제 이미지 (원본 — solver가 못 본 정보 확인용)
- extractor 출력 JSON (문제 텍스트)
- solver 출력 JSON (해설)
- 단원분류표

### 검증 항목

#### A. 수학적 정확성
1. **답 역산**: 해설의 풀이 과정을 따라가서 최종 답이 정답과 일치하는지
2. **중간 계산**: 각 등호 전환이 수학적으로 올바른지
3. **풀이 완결성**: 논리적 비약 없이 처음부터 답까지 도달하는지

#### B. 교과 범위 준수
4. **선수 학습 범위**: 해당 단원 이전에 배운 개념만 사용했는지
5. **용어 정확성**: 교과서 용어와 일치하는지

#### C. 서식 규칙 (guidelines-answer.md)
6. **통수식 금지**: 등호 단위로 끊어져 있는지
7. **rm체 규칙**: 단위/도형 대문자, 순열/조합 기호
8. **수식 문법**: HWP equation 스크립트 유효성
9. **구조**: [정답] → 풀이 순서, bold 금지

#### D. 원본 대조
10. **문제 텍스트**: extractor 추출과 이미지 원본이 일치하는지 (이미지 재확인)

### 출력
```json
{
  "number": 1,
  "status": "pass",  // "pass" | "fail"
  "issues": [],      // fail일 때만
  "feedback": null    // solver 재호출 시 전달할 수정 지시
}
```

실패 예시:
```json
{
  "number": 5,
  "status": "fail",
  "issues": [
    {
      "category": "math_accuracy",
      "description": "3번째 등호에서 2^3=6으로 계산했으나 실제로는 2^3=8",
      "location": "explanation_parts[4]"
    }
  ],
  "feedback": "3번째 등호 전환 오류: 2^3=8로 수정 필요. 이후 풀이도 재계산."
}
```

### 재시도 루프
```
solver 생성 → verifier 검증
  → pass: 다음 단계
  → fail (1회): feedback과 함께 solver 재호출
    → verifier 재검증
      → pass: 다음 단계
      → fail (2회): feedback 업데이트 후 solver 재호출
        → verifier 재검증
          → pass: 다음 단계
          → fail (3회): 실패로 기록, 수동 검토 필요 표시
```

---

## 4. ngd-exam-figure (기존 유지)

변경 없음. 기존 파이프라인 그대로 사용.

### 기존 흐름
1. `exam_data.json`에서 `has_figure=true` 문제 식별
2. 문제 이미지에서 그림 영역 crop (200dpi)
3. nano-banana (Gemini)로 깔끔하게 재생성
4. 상하 여백 트리밍
5. "NGD" 워터마크 (오른쪽 하단, 작고 연한 회색)
6. `outputs/images/prob{N}_final.png` 저장

### V3에서의 차이
- V1: PDF에서 crop 좌표 추출
- V3: extractor가 `figure_info`에 그림 위치 정보를 제공, 문제 이미지에서 직접 crop

---

## 5. ngd-exam-builder (기존 유지)

변경 없음. JSON 포맷이 동일하므로 기존 builder가 그대로 작동.

### 입력 JSON 포맷 (V3에서도 동일)
```json
{
  "metadata": { "year": "2025", "school": "...", ... },
  "problems": [
    {
      "number": 1,
      "type": "choice",
      "score": "4.2",
      "parts": [...],
      "choices": [...],
      "answer": "2",
      "explanation_parts": [...],
      "final_image": "outputs/images/prob1_final.png"
    }
  ]
}
```

---

## 6. ngd-exam-checker (기존 유지)

변경 없음. 10항목 체크리스트 + 피드백 루프 (최대 2회).

V3에서는 verifier가 해설 품질을 이미 검증하므로, checker는 **HWPX 구조/서식 검증**에 집중.

---

## 에이전트 호출 관계도

```
오케스트레이터 (ngd-exam-create-v3 스킬)
│
├─ 문제 1~4 병렬 ─┬─ extractor(1) → solver(1) ↔ verifier(1) [최대 3회]
│                  ├─ extractor(2) → solver(2) ↔ verifier(2)
│                  ├─ extractor(3) → solver(3) ↔ verifier(3)
│                  └─ extractor(4) → solver(4) ↔ verifier(4)
│
├─ 문제 5~8 병렬 ─┬─ ... (동일 패턴)
│                  └─ ...
│
├─ ... (문제 수에 따라 반복)
│
├─ figure (그림 있는 문제만)
├─ builder (전체 JSON → HWPX)
└─ checker (최종 검수)
```

---

## 관련 문서

- [01-overview.md](./01-overview.md) — 전체 개요
- [03-frontend.md](./03-frontend.md) — 프론트엔드 상세 설계
- [04-orchestrator.md](./04-orchestrator.md) — 오케스트레이터 / 병렬 처리
- [05-checklist.md](./05-checklist.md) — 구현 체크리스트
