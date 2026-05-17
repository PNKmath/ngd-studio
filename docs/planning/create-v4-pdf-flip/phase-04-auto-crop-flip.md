---
phase: 4
title: 자동 분할 flip 전달
status: completed
depends_on: [2]
scope:
  - ngd-studio/app/api/auto-crop/route.ts
  - workspaces/crop/gemini_crop.py
  - ngd-studio/components/cropper/CropperWorkspace.tsx
intervention_likely: false
intervention_reason: ""
executor: qwen
---

# Phase 4: 자동 분할 flip 전달

> **범위**: Backend + Python cropper
> **난이도**: M
> **의존성**: Phase 2
> **영향 파일**: `app/api/auto-crop/route.ts`, `workspaces/crop/gemini_crop.py`

## 배경

자동 분할은 `/api/auto-crop`이 `gemini_crop.py --json-only`를 호출, Python 스크립트가 PDF 페이지를 PIL 이미지로 렌더링 후 Gemini에 전송한다. 직전 작업으로 `--rotation` 인자가 추가돼 `apply_rotation(img, rotation)`이 적용되고 있다 (`gemini_crop.py:26~44, :191, :200, :223`). UI가 flip된 preview를 보여줘도 Gemini 입력이 원본 좌우면 반환 bbox가 화면과 맞지 않는다.

## 설계

- `/api/auto-crop` POST body에 `flip: boolean`을 추가하고 `--flip`으로 Python에 전달.
- `gemini_crop.py`에 `--flip` argparse 플래그(`action="store_true"` 등)를 추가, 기본 false.
- `pdf_page_to_pil()`의 rotation 적용 직후 flip이 true면 `PIL.ImageOps.mirror(img)`를 호출 (또는 `img.transpose(Image.FLIP_LEFT_RIGHT)`).
- `--json-only` 응답의 `imageWidth/imageHeight`는 변화 없음(flip은 dimension 무영향) — 변환 후 측정값을 그대로 쓰면 자연히 일치.
- 기존 PNG+JSON 저장 모드도 동일한 `--flip`을 받을 수 있게 하되, 기본값 false에서 기존 동작 유지.
- `CropperWorkspace`의 자동 분할 요청 body에 현재 flip 값을 함께 전송.

## 체크리스트

- [x] `/api/auto-crop`이 `flip`을 수신·검증하고 `--flip`을 Python 인자로 전달
- [x] `gemini_crop.py` argparse에 `--flip` 추가
- [x] Gemini 입력용 PIL 이미지가 rotation 적용 후 flip 적용
- [x] `--json-only`의 `imageWidth/imageHeight`가 flip 적용 후에도 일관됨 (rotation만 적용한 결과와 동일)
- [x] `CropperWorkspace`의 자동 분할 요청이 현재 flip을 함께 전송

## 영향 범위

Gemini API 호출 결과가 달라질 수 있으므로 기본 flip false의 기존 동작은 보존해야 한다. 반전은 전체 PDF 공통으로만 적용. 페이지별 반전은 범위 외.

## 검증

```bash
cd ngd-studio
pnpm build
python3 -m py_compile workspaces/crop/gemini_crop.py
```

API key/PyMuPDF가 있는 환경에서 수동 확인 (선택):

```bash
python3 workspaces/crop/gemini_crop.py <pdf_path> --json-only --rotation 0 --flip
```

## 실행 결과

### 1회차 (2026-05-17 17:30 KST) — completed
**상태**: completed
**소요 시간**: ~5분
**진행 모델**: claude-sonnet-4-6

#### 요약
자동 분할 flip 전달 구현 완료. `/api/auto-crop` → `gemini_crop.py` 파이프라인 전체에 `flip` 파라미터 추가.

#### 변경 파일
- `ngd-studio/app/api/auto-crop/route.ts` — `flip: boolean` 수신·검증 후 `--flip` Python 인자로 조건부 전달
- `workspaces/crop/gemini_crop.py` — `--flip` argparse 추가(`action="store_true"`), `pdf_page_to_pil()` 시그니처에 `flip=False` 파라미터 추가, rotation 적용 후 `ImageOps.mirror(img)` 호출; `--json-only` 및 PNG+JSON 저장 출력 모두에 `"flip"` 필드 포함
- `ngd-studio/components/cropper/CropperWorkspace.tsx` — `handleAutoCrop()` fetch body에 `flip` state 값 포함

#### 검증 결과
- `npx tsc --noEmit`: pass (출력 없음)
- `python3 -m py_compile workspaces/crop/gemini_crop.py`: pass

#### 추가 발견사항
- `imageWidth/imageHeight`는 mirror 후에도 동일(dimension 무변화)하므로 bbox 매핑 로직 변경 불필요.
- 기본값 `flip=False`이므로 기존 동작 완전 보존.
- PNG+JSON 저장 모드도 동일한 `--flip` 경로를 사용하므로 일관성 유지.

#### 질문 / 결정 사항
없음.

#### Scope Audit (orchestrator)
pass — 3 files in scope (auto-crop/route.ts, CropperWorkspace.tsx, gemini_crop.py)

#### Verification Re-run (orchestrator)
pnpm build exit 0 + python3 -m py_compile exit 0 — pass

#### Simplify (orchestrator)
SIMPLIFIED: 1 (gemini_crop.py: enumerate loop → extend), VERIFY: pass

#### Review (orchestrator)
VERDICT: pass — ISSUES: 0, 스펙 일치 / 5개 체크리스트 모두 구현 / 기본값 보존

#### Commit
74ed8ee — feat(crop): Phase 4 — 자동 분할 flip 전달
