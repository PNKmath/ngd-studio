#!/usr/bin/env python3
"""
NGD HWPX Builder v3 — 경북고 2025 2학년 1학기 기말 수학 II 전범위
19 problems (15 choice + 4 essay)
Fixed: bogi table for Q12, score_in_parts detection for Q8
"""

import json
import zipfile
import os
import re
import io
from datetime import datetime
from PIL import Image

# === Paths ===
BASE = "/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx"
EXAM_JSON = "/mnt/c/NGD/inputs/시험지 제작/.v3cache/exam_data.json"
OUTPUT_DIR = "/mnt/c/NGD/outputs"
IMAGES_DIR = "/mnt/c/NGD/outputs/images"

# === Load exam data ===
with open(EXAM_JSON, "r", encoding="utf-8") as f:
    exam = json.load(f)

info = exam["info"]
problems = exam["problems"]

# === Info substitutions ===
YEAR_SEMESTER = "2025년 1학기 기말"
SCHOOL_NAME = "경북 고등학교"
GRADE_SUBJECT = "2학년 수학 II"
RANGE_STR = "전범위"
CREATED_DATE = "2026년 4월 30일"
MODIFIED_DATE = "2026-04-30T09:00:00Z"

# === Counters ===
eq_id_counter = 1654899650
zorder_counter = 10
inst_id_counter = 1654899642

def next_eq_id():
    global eq_id_counter
    eq_id_counter += 1
    return eq_id_counter

def next_zorder():
    global zorder_counter
    zorder_counter += 1
    return zorder_counter

def next_inst_id():
    global inst_id_counter
    inst_id_counter += 1
    return inst_id_counter

def xml_escape(s):
    if s is None:
        return ""
    s = str(s)
    s = s.replace("&", "&amp;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    s = s.replace('"', "&quot;")
    return s

def estimate_eq_width(script):
    reduced = re.sub(r'(LEFT|RIGHT|over|sqrt|times|leq|geq|int_|int |rmP|rmE|rmV|rmN|rmB|rmF|rmG|rm|it|bar|sigma|alpha|beta|gamma|delta|theta|pi|lambda|mu|omega|inf|cdots|cdot|therefore|because|TRIANGLE|BOT|left\(|right\)|SEARROW|NEARROW|partial|cases|matrix|binom|choose|lim_|sum_|prod_|LSUB|LSUP|SUB|SUP)', '.', script)
    vis_chars = max(len(reduced), 2)
    width = max(vis_chars * 420, 525)
    return min(width, 29000)

def has_fraction(script):
    return " over " in script or " over\n" in script

def has_root(script):
    return "sqrt" in script or "root " in script

def has_integral(script):
    return "int_" in script or "int " in script or script.startswith("int")

def lineseg_params_for_parts(parts_list):
    """Get best lineseg params from a list of parts"""
    best = (1000, 1000, 850, 600)
    for part in parts_list:
        if "eq" in part:
            s = part["eq"]
            if has_integral(s) or (has_fraction(s) and has_root(s)):
                p = (2580, 2580, 1677, 600)
            elif has_fraction(s):
                p = (2580, 2580, 1677, 600)
            elif has_root(s):
                p = (1478, 1478, 1301, 600)
            else:
                p = (1125, 1125, 956, 600)
            if p[0] > best[0]:
                best = p
    return best

def make_equation_xml(script):
    eq_id = next_eq_id()
    zorder = next_zorder()
    width = estimate_eq_width(script)

    if has_integral(script) or (has_fraction(script) and has_root(script)):
        height = 2580
        baseline = 65
    elif has_fraction(script):
        height = 2580
        baseline = 65
    elif has_root(script):
        height = 1478
        baseline = 87
    else:
        height = 1125
        baseline = 85

    escaped_script = xml_escape(script)

    return (f'<hp:equation id="{eq_id}" zOrder="{zorder}" numberingType="EQUATION" '
            f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
            f'version="Equation Version 60" baseLine="{baseline}" textColor="#000000" '
            f'baseUnit="1100" lineMode="CHAR" font="HYhwpEQ">'
            f'<hp:sz width="{width}" widthRelTo="ABSOLUTE" height="{height}" heightRelTo="ABSOLUTE" protect="0"/>'
            f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
            f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
            f'vertOffset="0" horzOffset="0"/>'
            f'<hp:outMargin left="56" right="56" top="0" bottom="0"/>'
            f'<hp:shapeComment>수식입니다.</hp:shapeComment>'
            f'<hp:script>{escaped_script}</hp:script>'
            f'</hp:equation>')

def make_lineseg(vertpos=0, vertsize=1000, textheight=1000, baseline=850, spacing=600, horzsize=30188):
    return (f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vertpos}" '
            f'vertsize="{vertsize}" textheight="{textheight}" baseline="{baseline}" '
            f'spacing="{spacing}" horzpos="0" horzsize="{horzsize}" flags="393216"/>'
            f'</hp:linesegarray>')

def parts_to_run_xml(parts):
    """Convert parts array to <hp:run> inner content. Returns (xml_str, lineseg_params)"""
    content = ""
    lsp = (1000, 1000, 850, 600)
    for part in parts:
        if "eq" in part:
            content += make_equation_xml(part["eq"])
            p = lineseg_params_for_parts([part])
            if p[0] > lsp[0]:
                lsp = p
        elif "t" in part:
            t = xml_escape(part["t"].replace("\n", " "))
            content += f'<hp:t>{t}</hp:t>'
    return content, lsp

def make_empty_para(para_id="0"):
    return (f'<hp:p id="{para_id}" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="7"/>'
            f'{make_lineseg(0, 1000, 1000, 850, 600)}'
            f'</hp:p>')

def make_colbreak():
    return (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="1" merged="0">'
            f'<hp:run charPrIDRef="7"/>'
            f'{make_lineseg(0, 1000, 1000, 850, 600)}'
            f'</hp:p>')

def make_pagebreak():
    return (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="7"/>'
            f'{make_lineseg(0, 1000, 1000, 850, 600)}'
            f'</hp:p>')

CHOICE_SYMBOLS = ["①", "②", "③", "④", "⑤"]

def make_tab3():
    return ('<hp:tab width="4000" leader="0" type="1"/>'
            '<hp:tab width="4000" leader="0" type="1"/>'
            '<hp:tab width="4000" leader="0" type="1"/>')

def is_short_choice(choices):
    """True if all choices are equations only (no text parts)"""
    if not choices:
        return False
    for c in choices:
        for part in c:
            if "t" in part:
                return False
    return True

def make_choices_xml(choices):
    if not choices:
        return ""
    paragraphs = []
    if is_short_choice(choices):
        # Line 1: ①②③
        c1 = ""
        lsp1 = (1000, 1000, 850, 600)
        for i in range(min(3, len(choices))):
            if i > 0:
                c1 += f'<hp:t>{make_tab3()}</hp:t>'
            c1 += f'<hp:t>{CHOICE_SYMBOLS[i]} </hp:t>'
            for part in choices[i]:
                if "eq" in part:
                    c1 += make_equation_xml(part["eq"])
                    p = lineseg_params_for_parts([part])
                    if p[0] > lsp1[0]: lsp1 = p
                elif "t" in part:
                    c1 += f'<hp:t>{xml_escape(part["t"])}</hp:t>'
        paragraphs.append(
            f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="7">{c1}</hp:run>'
            f'{make_lineseg(0, lsp1[0], lsp1[1], lsp1[2], lsp1[3])}'
            f'</hp:p>')
        # Line 2: ④⑤
        if len(choices) > 3:
            c2 = ""
            lsp2 = (1000, 1000, 850, 600)
            for i in range(3, len(choices)):
                if i > 3:
                    c2 += f'<hp:t>{make_tab3()}</hp:t>'
                c2 += f'<hp:t>{CHOICE_SYMBOLS[i]} </hp:t>'
                for part in choices[i]:
                    if "eq" in part:
                        c2 += make_equation_xml(part["eq"])
                        p = lineseg_params_for_parts([part])
                        if p[0] > lsp2[0]: lsp2 = p
                    elif "t" in part:
                        c2 += f'<hp:t>{xml_escape(part["t"])}</hp:t>'
            paragraphs.append(
                f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="7">{c2}</hp:run>'
                f'{make_lineseg(0, lsp2[0], lsp2[1], lsp2[2], lsp2[3])}'
                f'</hp:p>')
    else:
        # Individual lines for text+eq choices
        for i, choice_parts in enumerate(choices):
            c = f'<hp:t>{CHOICE_SYMBOLS[i]} </hp:t>'
            lsp = (1000, 1000, 850, 600)
            for part in choice_parts:
                if "eq" in part:
                    c += make_equation_xml(part["eq"])
                    p = lineseg_params_for_parts([part])
                    if p[0] > lsp[0]: lsp = p
                elif "t" in part:
                    c += f'<hp:t>{xml_escape(part["t"])}</hp:t>'
            paragraphs.append(
                f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="7">{c}</hp:run>'
                f'{make_lineseg(0, lsp[0], lsp[1], lsp[2], lsp[3])}'
                f'</hp:p>')
    return "".join(paragraphs)

def split_by_br(parts):
    """Split parts list by {br:true} markers into sub-lists"""
    groups = []
    current = []
    for part in parts:
        if "br" in part and part.get("br") is True:
            groups.append(current)
            current = []
        else:
            current.append(part)
    if current:
        groups.append(current)
    return groups

def make_endnote(number, answer, explanation_parts, prob_type="choice"):
    inst_id = next_inst_id()
    answer_text = f' [정답] {answer}'

    answer_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="5">'
                f'<hp:ctrl><hp:autoNum num="{number}" numType="ENDNOTE">'
                f'<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="." supscript="0"/>'
                f'</hp:autoNum></hp:ctrl>'
                f'</hp:run>'
                f'<hp:run charPrIDRef="7"><hp:t>{xml_escape(answer_text)}</hp:t></hp:run>'
                f'{make_lineseg(0, 1200, 1200, 1020, 720)}'
                f'</hp:p>')

    groups = split_by_br(explanation_parts)
    expl_xml = ""
    for group in groups:
        if not group:
            continue
        content, lsp = parts_to_run_xml(group)
        if content:
            expl_xml += (f'<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                        f'<hp:run charPrIDRef="7">{content}</hp:run>'
                        f'{make_lineseg(0, lsp[0], lsp[1], lsp[2], lsp[3])}'
                        f'</hp:p>')

    endnote = (f'<hp:ctrl><hp:endNote number="{number}" suffixChar="46" instId="{inst_id}">'
               f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" '
               f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" '
               f'hasTextRef="0" hasNumRef="0">'
               f'{answer_p}'
               f'{expl_xml}'
               f'</hp:subList></hp:endNote></hp:ctrl>')
    return endnote

def make_bogi_table(condition_box):
    """Build a < 보 기 > table (hp:tbl) for ㄱ/ㄴ/ㄷ bogi items using bogi_table_3items.xml as template."""
    items = condition_box["items"]
    n_items = len(items)

    # Build item paragraphs for the content cell (colAddr=1, rowAddr=2, colSpan=3)
    # Each item gets its own <hp:p> with ㄱ./ㄴ./ㄷ. prefix
    items_content = ""
    vpos = 0
    LABEL_PREFIXES = {"ㄱ": "ㄱ. ", "ㄴ": "ㄴ. ", "ㄷ": "ㄷ. ", "ㄹ": "ㄹ. ",
                      "ㄱ.": "ㄱ. ", "ㄴ.": "ㄴ. ", "ㄷ.": "ㄷ. "}
    for idx, item in enumerate(items):
        label = item["label"]
        prefix = LABEL_PREFIXES.get(label, label + ". ")
        item_content = f'<hp:t>{xml_escape(prefix)}</hp:t>'
        lsp = (1000, 1000, 850, 600)
        for part in item["parts"]:
            if "eq" in part:
                item_content += make_equation_xml(part["eq"])
                p = lineseg_params_for_parts([part])
                if p[0] > lsp[0]:
                    lsp = p
            elif "t" in part:
                item_content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'
        # Use paraPrIDRef=12 to match template, charPrIDRef=4 (blue meta color matches bogi style)
        para_id = "2147483648" if idx < n_items - 1 else "2147483648"
        pr_ref = "12" if idx < n_items - 1 else "0"
        items_content += (
            f'<hp:p id="{para_id}" paraPrIDRef="{pr_ref}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="4">{item_content}</hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vpos}" '
            f'vertsize="{lsp[0]}" textheight="{lsp[1]}" baseline="{lsp[2]}" '
            f'spacing="{lsp[3]}" horzpos="0" horzsize="27816" flags="393216"/>'
            f'</hp:linesegarray></hp:p>'
        )
        vpos += lsp[0] + lsp[3]

    # Pad with remaining empty label slots (ㄹ always shows in template, but we use actual items)
    # For items < 4, we still need the ㄹ slot if template requires it - just use blank
    # Actually bogi_table_3items.xml has ㄱ~ㄹ but we only fill actual items.
    # We'll use the template XML directly and splice our content into the content cell.
    with open(f"{BASE}/bogi_table_3items.xml", "r", encoding="utf-8") as f:
        template = f.read()

    # The template content cell is the <hp:tc> with colAddr="1" rowAddr="2" colSpan="3" rowSpan="1"
    # It contains 4 pre-filled items (ㄱ~ㄹ). We replace entire subList content.
    # Find the subList of that cell and replace its paragraphs.
    # Strategy: replace the fixed subList content between the cell markers.
    # The cell: borderFillIDRef="4", colAddr="1" rowAddr="2"
    # Locate the pattern: colAddr="1" rowAddr="2"
    # Then find the subList and replace its paragraphs.

    # Use a targeted string replace: find the ㄱ. ㄴ. ㄷ. ㄹ. content block
    old_block = (
        '<hp:p id="2147483648" paraPrIDRef="12" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="4"><hp:t>ㄱ. </hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="27816" flags="393216"/></hp:linesegarray>'
        '</hp:p>'
        '<hp:p id="2147483648" paraPrIDRef="12" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="4"><hp:t>ㄴ. </hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="1600" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="27816" flags="393216"/></hp:linesegarray>'
        '</hp:p>'
        '<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="4"><hp:t>ㄷ. </hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="3200" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="27816" flags="393216"/></hp:linesegarray>'
        '</hp:p>'
        '<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="4"><hp:t>ㄹ. </hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="4800" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="27816" flags="393216"/></hp:linesegarray>'
        '</hp:p>'
    )
    tbl_xml = template.replace(old_block, items_content)

    # Update table ID and zOrder to use unique values
    tbl_id = next_eq_id()
    zorder1 = next_zorder()
    zorder2 = next_zorder()
    tbl_xml = re.sub(r'id="1740266737"', f'id="{tbl_id}"', tbl_xml, count=1)
    tbl_xml = re.sub(r'zOrder="702"', f'zOrder="{zorder1}"', tbl_xml, count=1)
    # Also update embedded eq IDs and zOrders
    eq_id_new = next_eq_id()
    tbl_xml = re.sub(r'id="1740266738"', f'id="{eq_id_new}"', tbl_xml, count=1)
    tbl_xml = re.sub(r'zOrder="708"', f'zOrder="{zorder2}"', tbl_xml, count=1)

    return tbl_xml


def make_condition_rect(condition_box):
    """Build a condition rect (hp:rect) for (가)(나)(다) style conditions."""
    items = condition_box["items"]
    ctype = condition_box.get("type", "condition")
    n_items = len(items)

    # Each item: base height, adjusted for equations
    item_heights = []
    for item in items:
        has_eq = any("eq" in p for p in item["parts"])
        if has_eq:
            lsp = lineseg_params_for_parts(item["parts"])
            item_heights.append(lsp[0] + 600)
        else:
            item_heights.append(1600)

    content_height = sum(item_heights) + 800
    height = content_height + 1200

    center_y = height // 2
    sca_y = round(height / 12587, 6)
    rect_id = next_eq_id()
    zorder = next_zorder()
    iid = next_inst_id()

    items_content = ""
    vpos_offset = 0
    for idx, item in enumerate(items):
        label = item["label"]
        item_content = f'<hp:t>{xml_escape(label)} </hp:t>'
        lsp = (1000, 1000, 850, 600)
        for part in item["parts"]:
            if "eq" in part:
                item_content += make_equation_xml(part["eq"])
                p = lineseg_params_for_parts([part])
                if p[0] > lsp[0]: lsp = p
            elif "t" in part:
                item_content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'

        items_content += (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                         f'<hp:run charPrIDRef="7">{item_content}</hp:run>'
                         f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vpos_offset}" '
                         f'vertsize="{lsp[0]}" textheight="{lsp[1]}" baseline="{lsp[2]}" '
                         f'spacing="{lsp[3]}" horzpos="0" horzsize="27736" flags="393216"/>'
                         f'</hp:linesegarray></hp:p>')
        vpos_offset += item_heights[idx]

    with open(f"{BASE}/condition_rect_template.xml", "r", encoding="utf-8") as f:
        template = f.read()

    rect_xml = template.replace("{{RECT_ID}}", str(rect_id))
    rect_xml = rect_xml.replace("{{ZORDER}}", str(zorder))
    rect_xml = rect_xml.replace("{{INST_ID}}", str(iid))
    rect_xml = rect_xml.replace("{{HEIGHT}}", str(height))
    rect_xml = rect_xml.replace("{{CENTER_Y}}", str(center_y))
    rect_xml = rect_xml.replace("{{SCA_Y}}", str(sca_y))
    rect_xml = rect_xml.replace("{{ITEMS_CONTENT}}", items_content)
    return rect_xml

def png_to_bmp_bytes(png_path):
    img = Image.open(png_path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    return buf.getvalue()

def make_pic_xml(binaryItemIDRef, img_path):
    pic_id = next_eq_id()
    zorder = next_zorder()
    iid = next_inst_id()

    img = Image.open(img_path)
    w, h = img.size
    # Target display width ~25000 HWPUNIT (fits in one column)
    target_w = min(25000, int(w * 37.8))
    scale = target_w / (w * 37.8)
    hw_w = target_w
    hw_h = int(h * 37.8 * scale)

    return (f'<hp:pic id="{pic_id}" zOrder="{zorder}" numberingType="PICTURE" '
            f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
            f'href="" groupLevel="0" instid="{iid}" reverse="0">'
            f'<hp:offset x="0" y="0"/>'
            f'<hp:orgSz width="{int(w*37.8)}" height="{int(h*37.8)}"/>'
            f'<hp:curSz width="{hw_w}" height="{hw_h}"/>'
            f'<hp:flip horizontal="0" vertical="0"/>'
            f'<hp:rotationInfo angle="0" centerX="{hw_w//2}" centerY="{hw_h//2}" rotateimage="1"/>'
            f'<hp:renderingInfo>'
            f'<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
            f'<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
            f'<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
            f'</hp:renderingInfo>'
            f'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="{int(w*37.8)}" y="0"/>'
            f'<hc:pt2 x="{int(w*37.8)}" y="{int(h*37.8)}"/>'
            f'<hc:pt3 x="0" y="{int(h*37.8)}"/></hp:imgRect>'
            f'<hp:imgClip left="0" right="{int(w*37.8)}" top="0" bottom="{int(h*37.8)}"/>'
            f'<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
            f'<hp:imgDim dimwidth="{int(w*37.8)}" dimheight="{int(h*37.8)}"/>'
            f'<hc:img binaryItemIDRef="{binaryItemIDRef}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
            f'<hp:effects/>'
            f'<hp:sz width="{hw_w}" widthRelTo="ABSOLUTE" height="{hw_h}" heightRelTo="ABSOLUTE" protect="0"/>'
            f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
            f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
            f'vertOffset="0" horzOffset="0"/>'
            f'<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
            f'<hp:shapeComment>그림입니다.</hp:shapeComment>'
            f'</hp:pic>')

# Figure image mapping: prob number -> (image_name, file_path)
FIGURE_MAP = {
    8: ("image3", f"{IMAGES_DIR}/prob8_final.png"),
    9: ("image4", f"{IMAGES_DIR}/prob9_final.png"),
    18: ("image5", f"{IMAGES_DIR}/prob18_final.png"),
}

# === Build section0.xml ===
print("Building section0.xml...")

with open(f"{BASE}/header_area_template.xml", "r", encoding="utf-8") as f:
    header_template = f.read()

header_xml = header_template.replace("{{YEAR_SEMESTER}}", xml_escape(YEAR_SEMESTER))
header_xml = header_xml.replace("{{SCHOOL_NAME}}", xml_escape(SCHOOL_NAME))
header_xml = header_xml.replace("{{GRADE_SUBJECT}}", xml_escape(GRADE_SUBJECT))
header_xml = header_xml.replace("{{RANGE}}", xml_escape(RANGE_STR))
header_xml = header_xml.replace("{{CREATED_DATE}}", xml_escape(CREATED_DATE))

problem_paras = []
extra_images = []  # (name.bmp, data)
endnote_num = 1
problem_count = 0
essay_count = 0

for prob in problems:
    num = prob.get("number")
    ptype = prob.get("type", "choice")
    score = str(prob.get("score", "4"))
    parts = prob.get("parts", [])
    choices = prob.get("choices")
    answer = str(prob.get("answer", ""))
    explanation_parts = prob.get("explanation_parts", [])
    condition_box = prob.get("condition_box")
    has_figure = prob.get("has_figure", False)
    figure_info = prob.get("figure_info")
    subtopic = prob.get("subtopic", "")
    difficulty = prob.get("difficulty", "중")

    print(f"Processing Q{num} ({ptype}, score={score})...")

    # Column/page breaks before problem (except first)
    if problem_count > 0:
        if problem_count % 4 == 0:
            problem_paras.append(make_pagebreak())
        elif problem_count % 2 == 0:
            problem_paras.append(make_colbreak())

    # Spacing between problems in same column (2nd problem in column)
    if problem_count % 2 == 1:
        for _ in range(15):
            problem_paras.append(make_empty_para())

    # Essay type label + 서답형 안내문 (첫 번째 서술형일 때만)
    if ptype == "essay":
        essay_count += 1
        if essay_count == 1:
            # 서답형 안내문
            problem_paras.append(
                f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="7"><hp:t>※ 여기서 부터는 서답형 문제입니다.</hp:t></hp:run>'
                f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                f'</hp:p>')
            problem_paras.append(make_empty_para())
            problem_paras.append(make_empty_para())
        # parts에 이미 서술형 라벨이 있는지 확인 (예: "서술형 4.")
        first_part_t = parts[0].get("t", "") if parts else ""
        has_label_in_parts = "서술형" in first_part_t
        if has_label_in_parts:
            # parts에서 서술형 라벨을 제거하고 별도 라벨로 대체
            parts = [p for p in parts if not (("t" in p) and "서술형" in p.get("t", ""))]
        label_content = f'<hp:t>[서술형 {essay_count}]</hp:t>'
        problem_paras.append(
            f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="7">{label_content}</hp:run>'
            f'{make_lineseg(0, 1000, 1000, 850, 600)}'
            f'</hp:p>')

    # Generate endNote
    endnote_xml = make_endnote(endnote_num, answer, explanation_parts, ptype)
    endnote_num += 1

    # Build problem paragraph content
    prob_content = endnote_xml
    lsp = (1000, 1000, 850, 600)

    # Check if score is already embedded in parts (for choice with [N.N점] in parts)
    # Q8 and Q9 have score embedded in their parts
    score_in_parts = False
    if parts:
        last_t = None
        for part in reversed(parts):
            if "t" in part:
                last_t = part["t"]
                break
        if last_t and "점]" in last_t:
            score_in_parts = True

    for part in parts:
        if "eq" in part:
            prob_content += make_equation_xml(part["eq"])
            p = lineseg_params_for_parts([part])
            if p[0] > lsp[0]: lsp = p
        elif "t" in part:
            t = xml_escape(part["t"].replace("\n", " "))
            prob_content += f'<hp:t>{t}</hp:t>'

    # Add score inline for choice type (if not already in parts)
    if ptype == "choice" and not score_in_parts:
        prob_content += f'<hp:t> [</hp:t>'
        prob_content += make_equation_xml(score)
        prob_content += f'<hp:t>점]</hp:t>'
        p = lineseg_params_for_parts([{"eq": score}])
        if p[0] > lsp[0]: lsp = p

    # Problem paragraph
    prob_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
              f'<hp:run charPrIDRef="7">{prob_content}</hp:run>'
              f'{make_lineseg(0, lsp[0], lsp[1], lsp[2], lsp[3])}'
              f'</hp:p>')
    problem_paras.append(prob_p)

    # Empty line after problem text
    problem_paras.append(make_empty_para())

    # Figure
    if has_figure and num in FIGURE_MAP:
        img_name_base, img_path = FIGURE_MAP[num]
        if os.path.exists(img_path):
            bmp_name = f"{img_name_base}.bmp"
            bmp_data = png_to_bmp_bytes(img_path)
            extra_images.append((bmp_name, bmp_data))
            pic_xml = make_pic_xml(img_name_base, img_path)
            pic_p = (f'<hp:p id="2147483648" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                     f'<hp:run charPrIDRef="7">{pic_xml}<hp:t/></hp:run>'
                     f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                     f'</hp:p>')
            problem_paras.append(pic_p)
            problem_paras.append(make_empty_para())
        else:
            print(f"  WARNING: Image not found: {img_path}")

    # Condition box
    if condition_box:
        cond_type = condition_box.get("type", "condition")
        if cond_type == "bogi":
            # bogi type: use hp:tbl (< 보 기 > table)
            tbl_xml = make_bogi_table(condition_box)
            cond_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                      f'<hp:run charPrIDRef="7">{tbl_xml}<hp:t/></hp:run>'
                      f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                      f'</hp:p>')
            problem_paras.append(cond_p)
            problem_paras.append(make_empty_para())
        elif cond_type == "condition":
            # condition type: use hp:rect
            rect_xml = make_condition_rect(condition_box)
            cond_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                      f'<hp:run charPrIDRef="7">{rect_xml}<hp:t/></hp:run>'
                      f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                      f'</hp:p>')
            problem_paras.append(cond_p)
            problem_paras.append(make_empty_para())

    # Choices (objective only)
    if ptype == "choice" and choices:
        choices_xml = make_choices_xml(choices)
        problem_paras.append(choices_xml)

    # Essay: score right-aligned
    if ptype == "essay":
        score_content = f'<hp:t>[</hp:t>'
        score_content += make_equation_xml(score)
        score_content += f'<hp:t>점]</hp:t>'
        score_p = (f'<hp:p id="2147483648" paraPrIDRef="4" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                   f'<hp:run charPrIDRef="7">{score_content}</hp:run>'
                   f'{make_lineseg(0, 1125, 1125, 956, 600)}'
                   f'</hp:p>')
        problem_paras.append(score_p)

    # Meta: [중단원] [난이도]
    meta_topic_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                    f'<hp:run charPrIDRef="4"><hp:t>[중단원] {xml_escape(subtopic)}</hp:t></hp:run>'
                    f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                    f'</hp:p>')
    problem_paras.append(meta_topic_p)

    meta_diff_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                   f'<hp:run charPrIDRef="4"><hp:t>[난이도] {xml_escape(difficulty)}</hp:t></hp:run>'
                   f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                   f'</hp:p>')
    problem_paras.append(meta_diff_p)

    problem_count += 1

# Final breaks
problem_paras.append(make_colbreak())
problem_paras.append(make_pagebreak())

# === Assemble section0.xml ===
section_xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'
               + header_xml
               + "".join(problem_paras)
               + "</hs:sec>")

# === Build content.hpf ===
hpf_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'
    '<opf:package xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" '
    'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" '
    'xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" '
    'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
    'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" '
    'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" '
    'xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" '
    'xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" '
    'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:opf="http://www.idpf.org/2007/opf/" '
    'xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" '
    'xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" '
    'xmlns:epub="http://www.idpf.org/2007/ops" '
    'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" '
    'version="" unique-identifier="" id="">'
    '<opf:metadata>'
    '<opf:title xml:space="preserve">① </opf:title>'
    '<opf:language>ko</opf:language>'
    '<opf:meta name="creator" content="text">user</opf:meta>'
    '<opf:meta name="subject" content="text"/>'
    '<opf:meta name="description" content="text"/>'
    '<opf:meta name="lastsaveby" content="text">abund</opf:meta>'
    '<opf:meta name="CreatedDate" content="text">2024-10-04T11:21:12Z</opf:meta>'
    f'<opf:meta name="ModifiedDate" content="text">{MODIFIED_DATE}</opf:meta>'
    '<opf:meta name="date" content="text">2017년 8월 3일 목요일 오후 4:55:39</opf:meta>'
    '<opf:meta name="keyword" content="text"/>'
    '</opf:metadata>'
    '<opf:manifest>'
    '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>'
    '<opf:item id="image1" href="BinData/image1.bmp" media-type="image/bmp" isEmbeded="1"/>'
    '<opf:item id="masterpage0" href="Contents/masterpage0.xml" media-type="application/xml"/>'
    '<opf:item id="image2" href="BinData/image2.bmp" media-type="image/bmp" isEmbeded="1"/>'
)

# Add extra images (image3, image4, image5 for prob 8, 9, 18)
for img_name, _ in extra_images:
    item_id = img_name.replace(".bmp", "")
    hpf_xml += f'<opf:item id="{item_id}" href="BinData/{img_name}" media-type="image/bmp" isEmbeded="1"/>'

hpf_xml += (
    '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>'
    '<opf:item id="settings" href="settings.xml" media-type="application/xml"/>'
    '</opf:manifest>'
    '<opf:spine>'
    '<opf:itemref idref="header" linear="yes"/>'
    '<opf:itemref idref="section0" linear="yes"/>'
    '</opf:spine>'
    '</opf:package>'
)

# === Preview text ===
prv_lines = []
for prob in problems:
    parts_prv = prob.get("parts", [])
    line = f"{prob.get('number', '')}.  "
    for part in parts_prv:
        if "t" in part:
            line += part["t"]
        elif "eq" in part:
            line += part["eq"]
    prv_lines.append(line[:100])

prv_text = "\n".join(prv_lines[:25])

# === Output filename ===
filename = "[04039][고][2025][2-1-b][대구][경북고][수2][전범위][04039][AI][미검수][그림3-0-3-0].hwpx"
output_path = os.path.join(OUTPUT_DIR, filename)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# === Write HWPX (ZIP) ===
print(f"Writing HWPX to {output_path}...")

# Remove old file if exists
if os.path.exists(output_path):
    os.remove(output_path)

with zipfile.ZipFile(output_path, 'w') as zout:
    # STORED
    zout.write(f'{BASE}/mimetype', 'mimetype', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/version.xml', 'version.xml', compress_type=zipfile.ZIP_STORED)

    # DEFLATED in order
    zout.write(f'{BASE}/Contents/header.xml', 'Contents/header.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image1.bmp', 'BinData/image1.bmp', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Contents/masterpage0.xml', 'Contents/masterpage0.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image2.bmp', 'BinData/image2.bmp', compress_type=zipfile.ZIP_DEFLATED)

    # Extra images (prob 8->image3, 9->image4, 18->image5)
    for img_bmp_name, img_bmp_data in extra_images:
        zout.writestr(f'BinData/{img_bmp_name}', img_bmp_data, compress_type=zipfile.ZIP_DEFLATED)

    zout.writestr('Contents/section0.xml', section_xml, compress_type=zipfile.ZIP_DEFLATED)
    zout.writestr('Preview/PrvText.txt', prv_text.encode('utf-8'), compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/settings.xml', 'settings.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Preview/PrvImage.png', 'Preview/PrvImage.png', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/META-INF/container.rdf', 'META-INF/container.rdf', compress_type=zipfile.ZIP_DEFLATED)
    zout.writestr('Contents/content.hpf', hpf_xml, compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/container.xml', 'META-INF/container.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/manifest.xml', 'META-INF/manifest.xml', compress_type=zipfile.ZIP_DEFLATED)

print(f"HWPX written: {output_path}")
print(f"Problems: {problem_count} total (choice: {problem_count - essay_count}, essay: {essay_count})")
print(f"Images: {len(extra_images)}")
print(f"Endnotes: {endnote_num - 1}")

# === Verification ===
print("\n=== Verification ===")
with zipfile.ZipFile(output_path) as z:
    xml = z.read('Contents/section0.xml').decode('utf-8')
    import re
    nums = re.findall(r'endNote number="(\d+)"', xml)
    print(f"Endnote numbers: {sorted(set(int(n) for n in nums))}")
    print(f"Has 보기: {'&lt; 보 기 &gt;' in xml or '보 기' in xml}")
    print(f"Has condition rects: {xml.count('hp:rect') // 2}")  # open/close tags
    print(f"Has Q8 score in parts: {'4.3점]' in xml or '4.3' in xml}")
    print(f"Section XML size: {len(xml):,} bytes")
