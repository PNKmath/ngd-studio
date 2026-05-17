---
phase: 4
title: 자동 분할 rotation 전달
status: completed
depends_on: [2]
scope:
  - ngd-studio/app/api/auto-crop/route.ts
  - workspaces/crop/gemini_crop.py
  - ngd-studio/components/cropper/CropperWorkspace.tsx
intervention_likely: false
intervention_reason: ""
executor: sonnet
---

# Phase 4: 자동 분할 rotation 전달

> **범위**: Backend + Python cropper
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `app/api/auto-crop/route.ts`, `workspaces/crop/gemini_crop.py`

## 배경

자동 분할은 `/api/auto-crop`이 `gemini_crop.py --json-only`를 호출하고, Python 스크립트가 PDF 페이지를 PIL 이미지로 렌더링해 Gemini에 보낸다. UI가 회전된 preview를 보여주더라도 자동 분할 입력 이미지가 원본 방향이면 반환 bbox는 화면과 맞지 않는다.

## 설계

- `/api/auto-crop` POST body에 `rotation`을 추가한다.
- `gemini_crop.py`에 `--rotation` 인자를 추가한다. 기본값은 `0`.
- `pdf_page_to_pil()` 또는 호출부에서 PIL 이미지를 `0/90/180/270` 기준으로 회전한다.
- `--json-only` 응답의 `imageWidth`, `imageHeight`, `bbox`는 회전된 이미지 기준을 유지한다.
- 기존 PNG+JSON 저장 모드도 같은 `--rotation`을 받을 수 있게 하되, 기본값 `0`에서 기존 동작을 유지한다.

## 체크리스트

- [x] `/api/auto-crop`이 `rotation`을 수신하고 Python 인자로 전달
- [x] `gemini_crop.py` argparse에 `--rotation` 추가
- [x] Gemini 입력용 page PIL 이미지가 rotation에 맞게 실제 회전
- [x] `--json-only`의 `imageWidth/imageHeight`가 회전 후 이미지 치수와 일치
- [x] `CropperWorkspace`의 자동 분할 요청이 현재 rotation을 전달

## 영향 범위

Gemini API 호출 결과가 달라질 수 있으므로 기본 rotation `0`의 기존 동작은 보존해야 한다. 회전은 전체 PDF 공통으로만 적용한다. 페이지별 회전은 이 phase 범위에 포함하지 않는다.

## 검증

```bash
cd ngd-studio
pnpm build
```

가능하면 API key가 있는 환경에서 샘플 PDF로 수동 확인:

```bash
python3 workspaces/crop/gemini_crop.py <pdf_path> --json-only --rotation 180
```

## 실행 결과

### 1회차 (2026-05-17 13:48 KST) — completed
**상태**: completed
**소요 시간**: 약 15분
**진행 모델**: codex

#### 요약
`/api/auto-crop`이 `rotation`을 수신해 숫자 검증 후 `0/90/180/270`으로 정규화하고 `gemini_crop.py --rotation`으로 전달하도록 연결했다.
`gemini_crop.py`는 `--rotation` argparse 옵션을 추가하고, PDF 페이지를 PIL 이미지로 렌더링한 뒤 전체 페이지 회전을 적용해 Gemini 입력 이미지와 `imageWidth/imageHeight`가 회전 기준을 따르게 했다.
`CropperWorkspace`의 자동 분할 요청은 현재 rotation 상태를 함께 전송한다.

#### 변경 파일
- `ngd-studio/app/api/auto-crop/route.ts` (수정)
- `workspaces/crop/gemini_crop.py` (수정)
- `ngd-studio/components/cropper/CropperWorkspace.tsx` (수정)
- `docs/planning/create-v4-pdf-rotation/phase-04-auto-crop-rotation.md` (수정)
- `docs/planning/create-v4-pdf-rotation/checklist.md` (수정)

#### 검증 결과
- [x] production build: `pnpm build` → pass
- [x] Python syntax: `python3 -m py_compile workspaces/crop/gemini_crop.py` → pass
- [ ] Python CLI runtime: `python3 workspaces/crop/gemini_crop.py --help` → skip — 현재 로컬 Python 환경에 PyMuPDF(`fitz`)가 없어 import 단계에서 실행 불가

#### 추가 발견사항
Gemini API key와 PyMuPDF가 있는 환경에서 실제 `--json-only --rotation 180` 샘플 확인은 Phase 5 수동 검증으로 넘긴다.

#### 질문 / 결정 사항
없음

#### Commit
3feb073
