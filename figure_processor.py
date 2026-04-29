#!/usr/bin/env python3
"""NGD Figure Processor - V3: crop → Gemini regenerate → trim + NGD watermark"""

import os
import sys
import json
import time
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types

EXAM_DATA_PATH = "inputs/시험지 제작/.v3cache/exam_data.json"
QUESTION_IMAGES_DIR = "inputs/시험지 제작/question_images"
CACHE_DIR = "inputs/시험지 제작/.v3cache"
OUTPUT_DIR = "outputs/images"
GEMINI_MODEL = "gemini-3.1-flash-image-preview"

PROMPT_TEMPLATE = (
    "Redraw this math exam figure cleanly and precisely as a simple diagram on a white background. "
    "{desc}"
    "Simple, geometric, textbook-style, black-and-white, white background, clean crisp lines. "
    "No text, no numbers, no labels, no handwriting."
)


def aspect_ratio_str(w, h):
    r = w / h
    if r > 1.5:
        return "16:9"
    elif r > 1.1:
        return "4:3"
    elif r > 0.9:
        return "1:1"
    elif r > 0.6:
        return "3:4"
    else:
        return "9:16"


def trim_and_watermark(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    def is_white(px, t=240):
        return px[0] > t and px[1] > t and px[2] > t

    top = next((y for y in range(h) if any(not is_white(pixels[x, y]) for x in range(w))), 0)
    bottom = next((y for y in range(h - 1, -1, -1) if any(not is_white(pixels[x, y]) for x in range(w))), h - 1)

    pad = 15
    cropped = img.crop((0, max(0, top - pad), w, min(h, bottom + pad)))

    draw = ImageDraw.Draw(cropped)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), "NGD", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cw, ch = cropped.size
    draw.text((cw - tw - 12, ch - th - 10), "NGD", fill=(200, 200, 200, 255), font=font)

    cropped.convert("RGB").save(output_path)


def generate_with_gemini(client, ref_path, desc, ar):
    prompt = PROMPT_TEMPLATE.format(desc=f"{desc} " if desc else "")
    ref_image = Image.open(ref_path)

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[prompt, ref_image],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio=ar, image_size="1K"),
                ),
            )
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    return part.inline_data.data
            print(f"    attempt {attempt + 1}: 이미지 없음, 재시도...")
        except Exception as e:
            print(f"    attempt {attempt + 1}: {e}")
            if attempt < 2:
                time.sleep(3)

    return None


def process_figure(client, prob):
    n = prob["number"]
    info = prob["figure_info"]
    crop_ratio = info.get("crop_ratio")
    desc = info.get("description_en", "")

    src = f"{QUESTION_IMAGES_DIR}/q{n:02d}.png"
    if not os.path.exists(src):
        print(f"  [Q{n}] 소스 이미지 없음: {src}")
        return None

    img = Image.open(src)
    iw, ih = img.size

    if crop_ratio:
        cr = crop_ratio
        box = (int(cr[0] * iw), int(cr[1] * ih), int(cr[2] * iw), int(cr[3] * ih))
    else:
        box = (0, 0, iw, ih)

    cropped = img.crop(box).convert("RGB")
    ref_path = f"{CACHE_DIR}/prob{n}_ref.jpg"
    cropped.save(ref_path, quality=95)

    cw, ch = cropped.size
    ar = aspect_ratio_str(cw, ch)
    print(f"  [Q{n}] Gemini 생성 중... (crop={box}, aspect={ar})")

    data = generate_with_gemini(client, ref_path, desc, ar)
    if data is None:
        print(f"  [Q{n}] 생성 실패")
        return None

    gen_path = f"{CACHE_DIR}/prob{n}_generated.png"
    with open(gen_path, "wb") as f:
        f.write(data)

    final_path = f"{OUTPUT_DIR}/prob{n}_final.png"
    trim_and_watermark(gen_path, final_path)
    print(f"  [Q{n}] 완료 → {final_path}")
    return final_path


def main():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY 환경변수 없음")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    with open(EXAM_DATA_PATH, encoding="utf-8") as f:
        exam_data = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    figures = [p for p in exam_data["problems"] if p.get("has_figure") and p.get("figure_info")]
    if not figures:
        print("그림 있는 문제 없음, 종료")
        status_path = f"{CACHE_DIR}/figure_status.json"
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump({"completed": True, "success": [], "failed": []}, f, ensure_ascii=False)
        return

    print(f"그림 처리 시작: {len(figures)}개")
    success, failed = [], []

    for prob in figures:
        result = process_figure(client, prob)
        n = prob["number"]
        if result:
            prob["figure_info"]["final_image"] = result
            success.append(n)
        else:
            failed.append(n)

    with open(EXAM_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(exam_data, f, ensure_ascii=False, indent=2)

    status_path = f"{CACHE_DIR}/figure_status.json"
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump({"completed": True, "success": success, "failed": failed}, f, ensure_ascii=False)

    print(f"\n완료: {len(success)}개 성공 {success}")
    if failed:
        print(f"실패: {len(failed)}개 {failed}")
        sys.exit(1)


if __name__ == "__main__":
    main()
