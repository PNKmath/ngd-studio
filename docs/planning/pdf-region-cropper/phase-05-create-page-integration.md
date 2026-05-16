---
phase: 5
title: 시험지 제작 페이지 통합
status: pending
depends_on: [4]
scope:
  - ngd-studio/app/create/page.tsx
  - ngd-studio/components/upload/QuestionSlotGrid.tsx
intervention_likely: true
intervention_reason: "Phase 4의 동작을 사용자가 직접 검증한 뒤 진행. UX 통합 방식(완전 대체 / 토글 / 모달) 사용자 선택 필요."
executor: sonnet
---

# Phase 5: 시험지 제작 페이지 통합

> **범위**: Frontend
> **난이도**: S
> **의존성**: Phase 4
> **영향 파일**: `app/create/page.tsx`, `components/upload/QuestionSlotGrid.tsx`

## 배경

Phase 4의 cropper가 동작 확인된 후 시험지 제작 페이지에 통합한다. 기존 UX는 `components/upload/QuestionSlotGrid.tsx`에 paste/drag/PDF-page-preview로 슬롯 단위 입력을 받고, `app/create/page.tsx:85-104`에서 `/api/question-images` POST로 서버 전송한다.

통합 후 사용자는 PDF를 한 번 업로드해 cropper로 박스를 그리고, 결과가 곧장 `/api/question-images`로 전송되어 기존 파이프라인(extractor)이 그대로 받는다 — 슬롯에 일일이 붙여넣는 단계가 사라진다.

## 설계

### 결정 필요 (사용자 개입)

UX 통합 방식 3안 — Phase 시작 전 사용자에게 확인:

- **A. 완전 대체**: `QuestionSlotGrid`를 제거하고 cropper 워크플로우만 남김
- **B. 토글**: 라디오/탭으로 "슬롯 붙여넣기 / PDF 드래그 분할" 선택
- **C. 모달**: 슬롯 그리드 위에 "PDF에서 한 번에 추출" 버튼 → 모달에서 cropper → 결과가 슬롯들에 자동 채워짐

**기본 권장은 C** — 기존 흐름 보존(폴백 가능) + cropper를 1차 입력 수단으로 노출. 사용자 결정 후 본 phase 구현 진행.

### 공통 변경 사항 (어느 안이든 필요)

- `app/create/page.tsx:88-104`의 `/api/question-images` POST 흐름은 그대로 유지 — cropper가 만든 Blob들을 `q{N}` 키로 FormData에 담아 동일 엔드포인트로 전송
- `QuestionSlot` 인터페이스(`components/upload/QuestionSlotGrid.tsx:6-13`)와 호환 유지: cropper 결과를 `{ number, file: Blob→File, fileName }` 형태로 변환
- 페이지 새로고침 시 localStorage에 cropper 상태가 남아있으면 알림 (`Phase 4의 저장 키 사용`)

### 안 C 구체 설계 (권장 안 채택 시)

- `QuestionSlotGrid` 헤더에 버튼 "PDF에서 한 번에 추출" 추가
- 클릭 시 모달 오픈 → `CropperWorkspace`를 모달 내에 마운트
- 모달 내 "슬롯에 채우기" 액션 → 박스 → PNG Blob 변환 → 부모(`QuestionSlotGrid`)에 slot 채움 콜백 호출
- 모달 닫기 후 기존 슬롯 UI에서 결과 확인/개별 수정 가능
- `app/page.tsx`의 임시 `/pdf-cropper` 카드는 유지 (개발자용 standalone 테스트 경로)

## 체크리스트

- [ ] 사용자에게 UX 통합 방식 (A/B/C) 확정 받기
- [ ] 확정안에 따라 `components/upload/QuestionSlotGrid.tsx` 수정 (또는 `app/create/page.tsx` 직접 수정)
- [ ] cropper 결과 → `q{N}` FormData → `/api/question-images` POST 흐름이 기존과 동일하게 작동
- [ ] 결과 PNG가 zero-padded 명명 규칙 따름 (`q01.png` 등) — `/api/question-images/route.ts:62-66` 참조
- [ ] 시험지 제작 end-to-end: PDF 업로드 → cropper로 박스 → 추출 → "시험지 제작 시작" → extractor 첫 문제까지 정상 진행
- [ ] `pnpm --filter ngd-studio build` 통과

## 영향 범위

- 시험지 제작 흐름의 입력 단계가 바뀜 — 기존 사용자 흐름과 다른 UX
- 안 A(완전 대체) 선택 시 paste 흐름이 사라지므로 기존 사용자에게 통보 필요
- `/api/question-images` 백엔드 변경 없음 — 입력 형태가 동일
- 다른 흐름(오검 등)은 영향 없음

## 검증

```bash
cd /mnt/c/NGD/ngd-studio
pnpm dev
# /create 페이지 접속
```

end-to-end 검증:
1. 양식 HWPX 업로드
2. PDF로 cropper 진입 → 박스 그리기 → 추출
3. 슬롯에 결과 채워진 상태 확인 (안 C) 또는 cropper UI만 있는 상태 확인 (안 A)
4. "시험지 제작 시작" 버튼 → extractor가 첫 문제 이미지 받아 진행 시작
5. `inputs/시험지 제작/question_images/` 디렉터리에 `q01.png` ~ `qNN.png`가 zero-padded로 저장됐는지 확인
