#!/usr/bin/env python3
"""
PDF 시험지 자동 크롭 스크립트.
OCR로 문제 번호를 감지하고, 좌표 기반으로 각 문제를 개별 이미지로 크롭한다.

사용법:
    python3 auto_crop.py <pdf_path> <output_dir>
"""
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import re
import json
import sys
import os
import io

# --- 설정 ---
DPI = 200
PAGE_MARGIN_TOP = 30      # 상단 마진 (pt)
PAGE_MARGIN_BOTTOM = 30   # 하단 마진 (pt)
CROP_PADDING_TOP = 10     # 크롭 상단 여유 (px, DPI 기준)
CROP_PADDING_BOTTOM = 10  # 크롭 하단 여유 (px)
CROP_PADDING_X = 10       # 좌우 여유 (px)

# 문제 번호 패턴
Q_PATTERNS = [
    re.compile(r'^(\d{1,2})\.\s'),         # "1. ", "12. "
    re.compile(r'^\[서술형\s*(\d+)\]'),     # "[서술형 1]"
    re.compile(r'^\[논술형\s*(\d+)\]'),     # "[논술형 1]"
    re.compile(r'^\[단답형\s*(\d+)\]'),     # "[단답형 1]"
]

# 해설 페이지 감지: "정답" 관련 키워드가 많이 등장하면 해설 페이지
# "배점"은 문제지 유의사항에도 등장하므로 단독으로 판별하지 않음
ANSWER_PAGE_PATTERNS = [
    re.compile(r'\[정답\]'),
    re.compile(r'정\s*답'),
]


def pdf_page_to_image(page, dpi=DPI):
    """PyMuPDF 페이지를 PIL Image로 변환."""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def ocr_with_boxes(image, lang="kor+eng"):
    """Tesseract OCR로 텍스트 + bbox 추출."""
    data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
    results = []
    n = len(data["text"])
    for i in range(n):
        text = data["text"][i].strip()
        conf = int(data["conf"][i])
        if text and conf > 20:  # 신뢰도 20% 이상만
            results.append({
                "text": text,
                "x": data["left"][i],
                "y": data["top"][i],
                "w": data["width"][i],
                "h": data["height"][i],
                "conf": conf,
            })
    return results


def is_answer_page(ocr_results):
    """해설/정답 페이지인지 판별. 정답 키워드가 3회 이상 등장하면 해설 페이지."""
    full_text = " ".join(r["text"] for r in ocr_results)
    count = sum(len(p.findall(full_text)) for p in ANSWER_PAGE_PATTERNS)
    return count >= 3


def find_question_numbers(ocr_results, page_width):
    """OCR 결과에서 문제 번호와 좌표를 찾는다."""
    questions = []
    mid_x = page_width / 2

    # 2단 레이아웃: 좌단 마진 ~0-200px, 우단 마진 ~mid_x ~ mid_x+200px
    # 문제 번호는 각 단의 왼쪽 끝 근처에 위치
    LEFT_MARGIN_MAX = 250        # 좌단 문제번호 x 상한
    RIGHT_MARGIN_MIN = mid_x - 50  # 우단 문제번호 x 하한
    RIGHT_MARGIN_MAX = mid_x + 250  # 우단 문제번호 x 상한

    def is_at_margin(x):
        """문제 번호가 단의 왼쪽 마진에 있는지 확인."""
        return x < LEFT_MARGIN_MAX or (RIGHT_MARGIN_MIN < x < RIGHT_MARGIN_MAX)

    for i, r in enumerate(ocr_results):
        text = r["text"]
        x = r["x"]

        if not is_at_margin(x):
            continue

        # "12." 또는 "5." 형태
        for pattern in Q_PATTERNS:
            m = pattern.match(text)
            if m:
                num_str = m.group(1)
                num = int(num_str) if num_str.isdigit() else 0
                if 1 <= num <= 30:
                    questions.append({
                        "number": num,
                        "label": text,
                        "x": x,
                        "y": r["y"],
                        "column": "left" if x < mid_x else "right",
                    })
                break
        else:
            # "12" + 다음 토큰이 "." 인 경우
            if re.match(r'^\d{1,2}$', text):
                num = int(text)
                if not (1 <= num <= 30):
                    continue
                # 다음 토큰에서 "." 찾기 (근접한 위치)
                for j in range(i + 1, min(i + 3, len(ocr_results))):
                    next_r = ocr_results[j]
                    if next_r["text"].strip() == "." and abs(next_r["y"] - r["y"]) < 20:
                        questions.append({
                            "number": num,
                            "label": f"{num}.",
                            "x": x,
                            "y": r["y"],
                            "column": "left" if x < mid_x else "right",
                        })
                        break

            # [서술형 N] 패턴 — 여러 토큰에 걸침
            if "서술" in text or "논술" in text or "단답" in text:
                # 주변 토큰에서 숫자 찾기
                nearby_text = text
                for j in range(i + 1, min(i + 5, len(ocr_results))):
                    nearby_text += " " + ocr_results[j]["text"]
                m_num = re.search(r'(\d+)', nearby_text)
                if m_num:
                    snum = int(m_num.group(1))
                    questions.append({
                        "number": 100 + snum,  # 서술형은 100+N
                        "label": f"[서술형 {snum}]",
                        "x": x,
                        "y": r["y"],
                        "column": "left" if x < mid_x else "right",
                    })

    # 중복 제거 (같은 번호, 가장 위쪽 y만 유지)
    seen = {}
    for q in questions:
        key = q["number"]
        if key not in seen or q["y"] < seen[key]["y"]:
            seen[key] = q

    return sorted(seen.values(), key=lambda q: q["number"])


def determine_crop_regions(all_questions, page_sizes):
    """
    문제 번호 좌표로부터 크롭 영역을 결정한다.
    각 문제의 영역 = 현재 문제 y ~ 다음 문제 y (같은 페이지, 같은 단)
    """
    # (page, column, y) 순으로 정렬
    col_order = {"left": 0, "right": 1}
    sorted_q = sorted(all_questions, key=lambda q: (q["page"], col_order[q["column"]], q["y"]))

    regions = []
    for i, q in enumerate(sorted_q):
        page = q["page"]
        col = q["column"]
        pw, ph = page_sizes[page]

        # x 범위: 단 기준
        if col == "left":
            x_start = 0
            x_end = pw // 2
        else:
            x_start = pw // 2
            x_end = pw

        # y 범위: 현재 문제 ~ 다음 문제 (같은 페이지, 같은 단)
        y_start = max(0, q["y"] - CROP_PADDING_TOP)

        # 다음 문제 찾기 (같은 페이지, 같은 단)
        y_end = ph  # 기본값: 페이지 하단
        for j in range(i + 1, len(sorted_q)):
            nq = sorted_q[j]
            if nq["page"] == page and nq["column"] == col:
                y_end = nq["y"] - CROP_PADDING_TOP
                break

        regions.append({
            "number": q["number"],
            "page": page,
            "column": col,
            "crop_box": {
                "x": max(0, x_start - CROP_PADDING_X),
                "y": y_start,
                "width": (x_end - x_start) + CROP_PADDING_X * 2,
                "height": min(y_end - y_start + CROP_PADDING_BOTTOM, ph - y_start),
            },
        })

    return regions


def crop_and_save(pdf_path, regions, output_dir):
    """크롭 영역을 이미지로 저장."""
    doc = fitz.open(pdf_path)
    os.makedirs(output_dir, exist_ok=True)

    saved = []
    for r in regions:
        page = doc[r["page"]]
        mat = fitz.Matrix(DPI / 72, DPI / 72)

        box = r["crop_box"]
        # px → pt 변환 (DPI 기준 px을 72dpi pt로)
        scale = 72 / DPI
        clip = fitz.Rect(
            box["x"] * scale,
            box["y"] * scale,
            (box["x"] + box["width"]) * scale,
            (box["y"] + box["height"]) * scale,
        )

        pix = page.get_pixmap(matrix=mat, clip=clip)
        num = r["number"]
        fname = f"q{num:02d}.png"
        fpath = os.path.join(output_dir, fname)
        pix.save(fpath)

        saved.append({
            "number": num,
            "image": fname,
            "page": r["page"] + 1,
            "column": r["column"],
            "crop_box": box,
        })
        print(f"  문제 {num:2d}번: {fname} ({pix.width}x{pix.height}px) [p{r['page']+1} {r['column']}]")

    doc.close()
    return saved


def main():
    if len(sys.argv) < 3:
        print("사용법: python3 auto_crop.py <pdf_path> <output_dir>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"오류: PDF 파일을 찾을 수 없습니다: {pdf_path}")
        sys.exit(1)

    print(f"=== PDF 자동 크롭 ===")
    print(f"PDF: {os.path.basename(pdf_path)}")

    # Step 1: PDF → 페이지 이미지 + OCR
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"페이지: {total_pages}장")

    all_questions = []
    page_sizes = {}
    problem_pages = 0
    answer_pages = 0

    for page_num in range(total_pages):
        page = doc[page_num]
        img = pdf_page_to_image(page)
        page_sizes[page_num] = (img.width, img.height)

        print(f"\n[Page {page_num + 1}] OCR 진행중... ({img.width}x{img.height}px)")
        ocr_results = ocr_with_boxes(img)
        print(f"  OCR 결과: {len(ocr_results)}개 토큰")

        # 해설 페이지 판별
        if is_answer_page(ocr_results):
            print(f"  → 해설/정답 페이지 (건너뜀)")
            answer_pages += 1
            continue

        problem_pages += 1

        # 문제 번호 감지
        questions = find_question_numbers(ocr_results, img.width)
        for q in questions:
            q["page"] = page_num

        if questions:
            nums = [q["number"] for q in questions]
            print(f"  → 문제 감지: {nums}")
            all_questions.extend(questions)
        else:
            print(f"  → 문제 번호 없음")

    doc.close()

    if not all_questions:
        print("\n오류: 문제를 감지하지 못했습니다.")
        sys.exit(1)

    # Step 2: 크롭 영역 결정
    print(f"\n문제 페이지: {problem_pages}장, 해설 페이지: {answer_pages}장")
    print(f"감지된 문제: {len(all_questions)}개")

    regions = determine_crop_regions(all_questions, page_sizes)

    # Step 3: 크롭 실행
    print(f"\n크롭 실행:")
    saved = crop_and_save(pdf_path, regions, output_dir)

    # Step 4: 결과 JSON 저장
    result = {
        "pdf": os.path.basename(pdf_path),
        "total_pages": total_pages,
        "problem_pages": problem_pages,
        "answer_pages": answer_pages,
        "questions": saved,
    }

    result_path = os.path.join(output_dir, "crop_results.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n=== 완료 ===")
    print(f"총 {len(saved)}개 문제 크롭")
    print(f"결과: {result_path}")


if __name__ == "__main__":
    main()
