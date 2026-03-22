---
name: ngd-exam-create
description: "NGD 기출 시험지 제작 오케스트레이터. 5개 서브 에이전트(reader → solver → figure → builder → checker)를 순서대로 호출하여 완성된 시험지를 생성한다. '시험지 제작', '기출 작업', 'NGD 작업', '시험지 만들기' 키워드에 사용."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: "[PDF파일경로]"
---

# NGD 기출 시험지 제작 오케스트레이터

이 스킬은 직접 시험지를 만들지 않고, **5개 서브 에이전트를 순서대로 호출**하여 완성된 시험지를 생성한다.

## 서브 에이전트 구조

```
ngd-exam-create (이 스킬 = 오케스트레이터)
  ├─ [1] ngd-exam-reader   : PDF → /tmp/exam_data.json
  ├─ [2] ngd-exam-solver   : 부실 해설 보완 → JSON 업데이트
  ├─ [3] ngd-exam-figure   : JSON의 그림 정보 → outputs/images/*.png
  ├─ [4] ngd-exam-builder  : JSON + 이미지 → outputs/*.hwpx
  └─ [5] ngd-exam-checker  : HWPX 품질 검수 → 피드백 루프
```

## 작업 절차

### Step 1: 입력 확인

- PDF 파일 경로 확인 (`inputs/시험지 제작/` 폴더)
- 양식지 존재 확인: `inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx`
- GEMINI_API_KEY 환경변수 확인 (그림 처리용)

### Step 2: reader 에이전트 호출

Agent 도구로 `ngd-exam-reader` 에이전트를 호출한다:

```
PDF 경로: [경로]
- PDF의 모든 페이지를 읽고 문제를 추출해줘
- 수식은 HWP 수식 문법으로 변환 (hwp-equation 규칙 준수)
- 영단어/스펠링도 모두 수식으로 처리 (rm체)
- 난이도는 하/중/상/킬 4단계 (시험 준비 학생 기준)
- 수식 연산자 앞뒤 공백 필수
- 해설 절대 생략하지 말 것
- /tmp/exam_data.json에 저장
```

**확인**: JSON 파일이 생성되었는지, 문제 수가 맞는지 검증한다.

### Step 3: solver 에이전트 호출 (해설 보완)

JSON을 읽어 해설이 부실한 문제가 있으면, Agent 도구로 `ngd-exam-solver` 에이전트를 호출한다:

```
/tmp/exam_data.json에서 해설이 없거나 부실한 문제를 찾아 풀이를 생성해줘
- explanation_parts가 빈 배열이거나 수식 1개 이하인 문제
- HWP 수식 문법으로 풀이 작성
- JSON 업데이트
```

**확인**: 부실 해설이 보완되었는지 검증한다. 해설이 모두 충분한 경우 이 단계를 건너뛴다.

### Step 4: figure 에이전트 호출 (그림이 있을 때만)

JSON을 읽어 `has_figure: true`인 문제가 있으면, Agent 도구로 `ngd-exam-figure` 에이전트를 호출한다:

```
/tmp/exam_data.json에서 그림 정보를 읽고 처리해줘
- PDF JPG 경로: /tmp/exam_jpg/
- 각 그림을 crop → nano-banana로 재생성 → 트리밍+워터마크
- 최종 이미지를 outputs/images/에 저장
- JSON에 final_image 경로 업데이트
```

**확인**: 이미지 파일이 생성되었는지, JSON이 업데이트되었는지 검증한다.

### Step 5: builder 에이전트 호출

Agent 도구로 `ngd-exam-builder` 에이전트를 호출한다:

```
/tmp/exam_data.json과 outputs/images/의 이미지로 HWPX를 생성해줘
- 양식지: inputs/시험지 제작/[NGD고등부]기출작업양식지[2022년5월20일].hwpx
- 참조용: inputs/오검/ 폴더의 HWPX
- 모든 문제, 해설, 이미지 빠짐없이 포함
- 배점 수식은 <hp:t>[</hp:t><hp:equation>...</hp:equation><hp:t>점]</hp:t> 구조
- 조건 (가)(나)(다)는 bordered 테이블로
- fix_namespaces.py 후처리 필수
- validate.py --fix 검증 필수
- outputs/에 파일명 규칙대로 저장
```

**확인**: HWPX 파일이 생성되었는지, 텍스트 추출로 누락 검증한다.

### Step 6: checker 에이전트 호출 (품질 검수)

Agent 도구로 `ngd-exam-checker` 에이전트를 호출한다:

```
[HWPX 파일 경로]를 검수해줘
- 10가지 체크리스트로 AI 실수 검증
- 수정 지시 JSON 생성
```

**확인**: 검수 결과를 확인한다.

### Step 7: 피드백 반영 (최대 2회)

checker가 FAIL 항목을 발견하면, 해당 에이전트를 재호출하여 수정:
- 수식 내용 오류 → reader 재호출
- XML 구조 오류 → builder 재호출
- 해설 부실 → solver 재호출
- 수정 후 checker 재호출 (최대 2회 반복)

모든 항목이 PASS이거나 2회 반복 후 종료.

### Step 8: 최종 검증 리포트

```
=== NGD 시험지 제작 리포트 ===
파일: [출력 파일명]
학교: [학교명]
시험: [학년/학기/차수]
과목: [과목] (범위: [범위])

[문제] 선택형 N문항 + 서술형 N문항 = 총 N문항
[정답] N개 모두 입력 확인
[해설] N개 모두 입력 확인 (solver 보완: M개)
[그림] N개 생성 (NGD 워터마크 포함)
[수식] HWP 수식 문법 변환 완료 (rm체/띄어쓰기 규칙 적용)
[검수] checker 통과 (PASS: N/10, WARN: N/10)
[후처리] fix_namespaces.py 완료
[검증] validate.py 통과
```

## 파일명 규칙

```
[코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]
[그림코드] = [그림{문제그림}-{해설그림}-{작업자그림}-0]
```

## 서식 규칙

- 서체: 나눔고딕 10, 수식크기 11, 수식서체 HYhwpEQ
- 스타일: F6 → 바탕글 1개만
- 미주-문제: 붙여쓰기
- 문제-선지: Enter 한 줄
- shift+enter: 정답 라인 2줄 때만
- 서술형: `[서술형 N]`
- 그림: 모든 생성 그림에 NGD 워터마크 필수
