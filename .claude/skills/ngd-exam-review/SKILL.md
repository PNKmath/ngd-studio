---
name: ngd-exam-review
description: "NGD 오검(오류검수). 원본 시험지 PDF와 작업된 HWPX를 비교하여 오타/누락을 찾고, 체크리스트 위반사항을 자동 수정한다."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: "[원본PDF경로] [작업HWPX경로]"
---

# NGD 오검(오류검수) 스킬

원본 시험지 PDF와 작업된 HWPX를 비교하여 오타/누락을 찾고, 체크리스트 위반사항을 HWPX 파일에 직접 수정한다.
수정 후 문서 끝의 편집오검 내역표에 해당번호를 기입하고, 추가 수정사항은 두 번째 내역표를 추가한다.

체크리스트 전체: checklist.md 참조.

## 전체 워크플로우

1. 원본 PDF를 JPG로 변환 후 Read로 이미지 읽기
2. 작업 HWPX 파싱: 문제별 텍스트/수식/선지/정답/해설 추출
3. 내용 비교 (PDF vs HWPX): 오타/누락 탐지
4. 체크리스트 자동 검증 (22개 고정 항목 + 추가 항목)
5. HWPX 직접 수정 (ZIP-level 문자열 치환)
6. 편집오검 내역표 작성: 해당번호 기입 + add_review_table.py로 추가 내역표 삽입
7. fix_namespaces.py 후처리
8. 수정 리포트 출력

## 5단계: HWPX 직접 수정

핵심 원칙: 반드시 zip_replace()(문자열 치환)를 사용한다.
XML 파서(ElementTree 등)로 재직렬화하면 편집오검 내역표가 유실된다.

zip_replace() 함수: 원본 ZIP을 그대로 복사하면서 section0.xml 내 문자열만 치환.

## 6단계: 편집오검 내역표 작성

### 첫 번째 내역표 (22개 고정 항목)

문서 끝에 이미 존재하는 3열 x 23행 테이블의 해당번호 셀에 문제번호를 기입한다.
str.replace()로 빈 셀을 찾아 치환.

### 두 번째 내역표 (추가 수정사항)

add_review_table.py 스크립트로 삽입한다:

  추가 수정사항이 있는 경우:
    python scripts/add_review_table.py <hwpx> "수정내용:해당번호" "수정내용2:해당번호2"

  이상 없는 경우:
    python scripts/add_review_table.py <hwpx> --no-issues

이 스크립트는 첫 번째 내역표의 스타일을 자동 복사하여 동일한 형식의 테이블을 생성한다.

## 7단계: 후처리

fix_namespaces.py 실행.

## 8단계: 리포트

오검 리포트 양식:
  편집오검 내역표 기입 내역
  추가 수정 N건
  확인 필요 N건

## 판단 기준

- 확실한 오타: 바로 수정, 추가 내역표에 기재
- 체크리스트 위반: 규칙대로 자동 수정, 22개 항목 해당번호 기입
- 애매한 차이: 확인 필요로 남기고 수정 안함
- 그림 관련: 자동 수정 불가, 확인 필요
