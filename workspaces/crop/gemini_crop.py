#!/usr/bin/env python3
"""
Gemini Vision 기반 PDF 시험지 자동 크롭.
Gemini의 native bounding box 기능으로 문제 영역을 감지하고 크롭한다.

사용법:
    python3 gemini_crop.py <pdf_path> <output_dir>

환경변수:
    GEMINI_API_KEY 또는 GOOGLE_API_KEY
"""
import fitz  # PyMuPDF
import google.generativeai as genai
from PIL import Image
import json
import sys
import os
import io
import re

DPI = 200

def pdf_page_to_pil(page, dpi=DPI):
    """PyMuPDF 페이지를 PIL Image로 변환."""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def pil_to_bytes(img, fmt="PNG"):
    """PIL Image를 bytes로 변환."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def detect_questions_gemini(page_images):
    """
    Gemini에 모든 페이지 이미지를 보내고 문제별 bbox를 받는다.
    Gemini bbox는 1000x1000 정규화 좌표: [y_min, x_min, y_max, x_max]
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = """이 이미지들은 수학 시험지 PDF의 각 페이지입니다.

각 페이지에서 **개별 문제**의 영역을 bounding box로 반환해주세요.

규칙:
- 2단 레이아웃(좌/우)입니다. 좌단 문제들이 먼저, 우단 문제들이 그 다음입니다.
- 문제 번호(1., 2., 3... 또는 [서술형 1] 등)를 기준으로 영역을 구분합니다.
- 각 문제 영역에는 문제 텍스트, 보기, 그림, 표가 모두 포함되어야 합니다.
- 학생 필기는 무시하고 인쇄된 내용만 기준으로 합니다.
- 해설/정답 페이지는 "answer_page": true로 표시하고 문제를 추출하지 않습니다.
- bounding box는 [y_min, x_min, y_max, x_max] 형식 (0-1000 정규화)으로 반환합니다.

JSON 형식으로 반환:
```json
[
  {
    "page": 1,
    "answer_page": false,
    "questions": [
      {"number": 1, "box_2d": [y_min, x_min, y_max, x_max]},
      {"number": 2, "box_2d": [y_min, x_min, y_max, x_max]}
    ]
  },
  {
    "page": 2,
    "answer_page": true,
    "questions": []
  }
]
```

JSON만 반환하세요. 다른 텍스트는 포함하지 마세요."""

    # 이미지를 Gemini에 전달
    contents = [prompt]
    for i, img in enumerate(page_images):
        contents.append(img)

    print(f"Gemini API 호출 중... ({len(page_images)} 페이지)")
    response = model.generate_content(contents)

    # JSON 파싱
    text = response.text.strip()
    # markdown 코드블록 제거
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"Gemini 응답 파싱 실패:")
        print(text[:1000])
        sys.exit(1)


def crop_from_bbox(img, box_2d):
    """
    Gemini 1000x1000 정규화 bbox를 실제 픽셀로 변환하여 크롭.
    box_2d: [y_min, x_min, y_max, x_max] (0-1000)
    """
    w, h = img.size
    y_min, x_min, y_max, x_max = box_2d

    x1 = int(x_min / 1000 * w)
    y1 = int(y_min / 1000 * h)
    x2 = int(x_max / 1000 * w)
    y2 = int(y_max / 1000 * h)

    # 클램핑
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(w, x2)
    y2 = min(h, y2)

    return img.crop((x1, y1, x2, y2))


def main():
    if len(sys.argv) < 3:
        print("사용법: python3 gemini_crop.py <pdf_path> <output_dir>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"오류: PDF 파일을 찾을 수 없습니다: {pdf_path}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print(f"=== Gemini 기반 PDF 자동 크롭 ===")
    print(f"PDF: {os.path.basename(pdf_path)}")

    # Step 1: PDF → 페이지 이미지
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"페이지: {total_pages}장")

    page_images = []
    page_pils = []
    for i in range(total_pages):
        pil_img = pdf_page_to_pil(doc[i])
        page_images.append(pil_img)
        page_pils.append(pil_img)
        print(f"  Page {i+1}: {pil_img.width}x{pil_img.height}px")
    doc.close()

    # Step 2: Gemini로 문제 영역 감지
    result = detect_questions_gemini(page_images)

    # Step 3: 크롭 실행
    saved = []
    problem_pages = 0
    answer_pages = 0

    for page_data in result:
        page_num = page_data["page"]
        if page_data.get("answer_page", False):
            answer_pages += 1
            print(f"  Page {page_num}: 해설/정답 페이지 (건너뜀)")
            continue

        problem_pages += 1
        pil_img = page_pils[page_num - 1]

        for q in page_data.get("questions", []):
            num = q["number"]
            box = q["box_2d"]
            cropped = crop_from_bbox(pil_img, box)

            # 번호가 문자열(서술형 등)이면 그대로, 정수면 zero-pad
            if isinstance(num, int):
                fname = f"q{num:02d}.png"
            else:
                # "서술형 1" → "q_s1.png"
                snum = re.search(r'\d+', str(num))
                fname = f"q_s{snum.group() if snum else num}.png"
            fpath = os.path.join(output_dir, fname)
            cropped.save(fpath)

            saved.append({
                "number": num,
                "image": fname,
                "page": page_num,
                "box_2d": box,
                "crop_box": {
                    "x": int(box[1] / 1000 * pil_img.width),
                    "y": int(box[0] / 1000 * pil_img.height),
                    "width": cropped.width,
                    "height": cropped.height,
                },
            })
            print(f"  문제 {num}번: {fname} ({cropped.width}x{cropped.height}px) [p{page_num}]")

    # Step 4: 결과 JSON 저장
    crop_result = {
        "pdf": os.path.basename(pdf_path),
        "total_pages": total_pages,
        "problem_pages": problem_pages,
        "answer_pages": answer_pages,
        "questions": saved,
    }

    result_path = os.path.join(output_dir, "crop_results.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(crop_result, f, ensure_ascii=False, indent=2)

    print(f"\n=== 완료 ===")
    print(f"문제 페이지: {problem_pages}장, 해설 페이지: {answer_pages}장")
    print(f"총 {len(saved)}개 문제 크롭")
    print(f"결과: {result_path}")


if __name__ == "__main__":
    main()
