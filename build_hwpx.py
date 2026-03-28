#!/usr/bin/env python3
"""
NGD HWPX Builder — Generates HWPX exam file from exam_data.json
"""

import json
import zipfile
import os
import re
import struct
from datetime import datetime
from PIL import Image
import io

# === Paths ===
BASE = "/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx"
EXAM_JSON = "/tmp/exam_data.json"
OUTPUT_DIR = "/mnt/c/NGD/outputs"

# === Load exam data ===
with open(EXAM_JSON, "r", encoding="utf-8") as f:
    exam = json.load(f)

info = exam["info"]
problems = exam["problems"]

# === Info substitutions ===
YEAR_SEMESTER = f"{info['year']}년 {info['semester']} {info['exam_type']}"
SCHOOL_NAME = "소명여 고등학교"
GRADE_SUBJECT = f"{info['grade']}학년 {info['subject']}"
RANGE_STR = "조건부확률 ~ 통계적추정"
CREATED_DATE = datetime.now().strftime("%Y년 %m월 %d일")
MODIFIED_DATE = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

# === Counters ===
eq_id_counter = 1654899650  # Start after header IDs
zorder_counter = 10
inst_id_counter = 1654899642  # endNote instIds start here

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
    """Escape for XML content"""
    if s is None:
        return ""
    s = s.replace("&", "&amp;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    s = s.replace('"', "&quot;")
    return s

def estimate_eq_width(script):
    """Rough estimate of equation width in HWPUNIT"""
    # Very rough: ~525 per character, min 525
    chars = len(script)
    # Account for special commands taking less visual space
    reduced = re.sub(r'(LEFT|RIGHT|over|sqrt|times|leq|geq|rmP|rmE|rmV|rmN|rmB|rmX|rmY|rmZ|rm|it|bar|sigma)', '.', script)
    vis_chars = max(len(reduced), 1)
    width = max(vis_chars * 400, 525)
    return min(width, 30000)

def has_fraction(script):
    """Check if equation has fraction (over)"""
    return " over " in script or script.startswith("over ")

def has_root(script):
    return "sqrt" in script or "root" in script

def has_integral(script):
    return "int_" in script or "int " in script

def lineseg_params_for_eq(script):
    """Return (vertsize, textheight, baseline, spacing) based on equation type"""
    if script is None:
        return (1000, 1000, 850, 600)
    if has_integral(script) or (has_fraction(script) and has_root(script)):
        return (2580, 2580, 1677, 600)
    if has_fraction(script):
        return (2580, 2580, 1677, 600)
    if has_root(script):
        return (1478, 1478, 1301, 600)
    return (1125, 1125, 956, 600)

def make_equation_xml(script, eq_id=None, baseunit=1100, textcolor="#000000",
                      treat_as_char=1, baseline=85):
    """Generate <hp:equation> XML"""
    if eq_id is None:
        eq_id = next_eq_id()
    zorder = next_zorder()
    width = estimate_eq_width(script)

    if has_fraction(script):
        height = 2580
        baseline = 65
    elif has_root(script):
        height = 1478
        baseline = 87
    elif has_integral(script):
        height = 2580
        baseline = 65
    else:
        height = 1125
        baseline = 85

    escaped_script = xml_escape(script)

    return (f'<hp:equation id="{eq_id}" zOrder="{zorder}" numberingType="EQUATION" '
            f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
            f'version="Equation Version 60" baseLine="{baseline}" textColor="{textcolor}" '
            f'baseUnit="{baseunit}" lineMode="CHAR" font="HYhwpEQ">'
            f'<hp:sz width="{width}" widthRelTo="ABSOLUTE" height="{height}" heightRelTo="ABSOLUTE" protect="0"/>'
            f'<hp:pos treatAsChar="{treat_as_char}" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
            f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
            f'vertOffset="0" horzOffset="0"/>'
            f'<hp:outMargin left="56" right="56" top="0" bottom="0"/>'
            f'<hp:shapeComment>수식입니다.</hp:shapeComment>'
            f'<hp:script>{escaped_script}</hp:script>'
            f'</hp:equation>')

def parts_to_run_content(parts):
    """Convert parts array to content inside <hp:run>: <hp:t> and <hp:equation> elements"""
    content = ""
    max_eq_params = (1000, 1000, 850, 600)  # default text-only

    for part in parts:
        if "eq" in part:
            eq_script = part["eq"]
            content += make_equation_xml(eq_script)
            params = lineseg_params_for_eq(eq_script)
            if params[0] > max_eq_params[0]:
                max_eq_params = params
        elif "t" in part:
            text = xml_escape(part["t"])
            content += f'<hp:t>{text}</hp:t>'
        # br parts are handled at a higher level

    return content, max_eq_params

def make_lineseg(vertpos=0, vertsize=1000, textheight=1000, baseline=850, spacing=600, horzsize=30188):
    return (f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vertpos}" '
            f'vertsize="{vertsize}" textheight="{textheight}" baseline="{baseline}" '
            f'spacing="{spacing}" horzpos="0" horzsize="{horzsize}" flags="393216"/>'
            f'</hp:linesegarray>')

def make_paragraph(content="", para_id="2147483648", paraPrIDRef="1", charPrIDRef="7",
                   pageBreak="0", columnBreak="0", vertpos=0,
                   vertsize=1000, textheight=1000, baseline=850, spacing=600, horzsize=30188):
    if content:
        return (f'<hp:p id="{para_id}" paraPrIDRef="{paraPrIDRef}" styleIDRef="0" '
                f'pageBreak="{pageBreak}" columnBreak="{columnBreak}" merged="0">'
                f'<hp:run charPrIDRef="{charPrIDRef}">{content}</hp:run>'
                f'{make_lineseg(vertpos, vertsize, textheight, baseline, spacing, horzsize)}'
                f'</hp:p>')
    else:
        return (f'<hp:p id="{para_id}" paraPrIDRef="{paraPrIDRef}" styleIDRef="0" '
                f'pageBreak="{pageBreak}" columnBreak="{columnBreak}" merged="0">'
                f'<hp:run charPrIDRef="{charPrIDRef}"/>'
                f'{make_lineseg(vertpos, vertsize, textheight, baseline, spacing, horzsize)}'
                f'</hp:p>')

def make_empty_para(para_id="0"):
    return make_paragraph(content="", para_id=para_id, charPrIDRef="7",
                         vertsize=1000, textheight=1000, baseline=850, spacing=600)

def make_colbreak():
    return make_paragraph(content="", para_id="2147483648", columnBreak="1",
                         vertsize=1000, textheight=1000, baseline=850, spacing=600)

def make_pagebreak():
    return make_paragraph(content="", para_id="2147483648", pageBreak="1",
                         vertsize=1000, textheight=1000, baseline=850, spacing=600)

# === Choice number symbols ===
CHOICE_SYMBOLS = ["①", "②", "③", "④", "⑤"]

def make_tab3():
    return ('<hp:tab width="4000" leader="0" type="1"/>'
            '<hp:tab width="4000" leader="0" type="1"/>'
            '<hp:tab width="4000" leader="0" type="1"/>')

def is_short_choice(choices):
    """Check if choices are short (equation only, no text)"""
    if choices is None:
        return False
    for c in choices:
        for part in c:
            if "t" in part:
                return False
    return True

def make_choices_xml(choices):
    """Generate choice paragraphs"""
    if not choices:
        return ""

    paragraphs = []

    if is_short_choice(choices):
        # 3+2 pattern with tabs
        # Line 1: ①②③
        line1_content = ""
        max_eq_params1 = (1000, 1000, 850, 600)
        for i in range(min(3, len(choices))):
            if i > 0:
                line1_content += f'<hp:t>{make_tab3()}</hp:t>'
            sym = CHOICE_SYMBOLS[i]
            line1_content += f'<hp:t>{sym} </hp:t>'
            for part in choices[i]:
                if "eq" in part:
                    line1_content += make_equation_xml(part["eq"])
                    params = lineseg_params_for_eq(part["eq"])
                    if params[0] > max_eq_params1[0]:
                        max_eq_params1 = params
                elif "t" in part:
                    line1_content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'

        p1 = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
              f'<hp:run charPrIDRef="7">{line1_content}</hp:run>'
              f'{make_lineseg(0, max_eq_params1[0], max_eq_params1[1], max_eq_params1[2], max_eq_params1[3])}'
              f'</hp:p>')
        paragraphs.append(p1)

        # Line 2: ④⑤
        if len(choices) > 3:
            line2_content = ""
            max_eq_params2 = (1000, 1000, 850, 600)
            for i in range(3, len(choices)):
                if i > 3:
                    line2_content += f'<hp:t>{make_tab3()}</hp:t>'
                sym = CHOICE_SYMBOLS[i]
                line2_content += f'<hp:t>{sym} </hp:t>'
                for part in choices[i]:
                    if "eq" in part:
                        line2_content += make_equation_xml(part["eq"])
                        params = lineseg_params_for_eq(part["eq"])
                        if params[0] > max_eq_params2[0]:
                            max_eq_params2 = params
                    elif "t" in part:
                        line2_content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'

            p2 = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                  f'<hp:run charPrIDRef="7">{line2_content}</hp:run>'
                  f'{make_lineseg(0, max_eq_params2[0], max_eq_params2[1], max_eq_params2[2], max_eq_params2[3])}'
                  f'</hp:p>')
            paragraphs.append(p2)
    else:
        # Individual lines for each choice
        for i, choice_parts in enumerate(choices):
            content = f'<hp:t>{CHOICE_SYMBOLS[i]} </hp:t>'
            max_eq = (1000, 1000, 850, 600)
            for part in choice_parts:
                if "eq" in part:
                    content += make_equation_xml(part["eq"])
                    params = lineseg_params_for_eq(part["eq"])
                    if params[0] > max_eq[0]:
                        max_eq = params
                elif "t" in part:
                    content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'

            p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                 f'<hp:run charPrIDRef="7">{content}</hp:run>'
                 f'{make_lineseg(0, max_eq[0], max_eq[1], max_eq[2], max_eq[3])}'
                 f'</hp:p>')
            paragraphs.append(p)

    return "".join(paragraphs)

def make_endnote(number, answer, explanation_parts, prob_type="choice"):
    """Generate endNote XML"""
    inst_id = next_inst_id()

    # Answer line
    if prob_type == "choice":
        answer_text = f' [정답] {answer}'
    else:
        answer_text = f' [정답] {answer}'

    answer_run = (f'<hp:run charPrIDRef="5">'
                  f'<hp:ctrl><hp:autoNum num="{number}" numType="ENDNOTE">'
                  f'<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="." supscript="0"/>'
                  f'</hp:autoNum></hp:ctrl></hp:run>'
                  f'<hp:run charPrIDRef="7"><hp:t>{xml_escape(answer_text)}</hp:t></hp:run>')

    answer_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'{answer_run}'
                f'{make_lineseg(0, 1200, 1200, 1020, 720)}'
                f'</hp:p>')

    # Split explanation_parts by {"br": true}
    explanation_paragraphs = []
    current_parts = []

    for part in explanation_parts:
        if "br" in part and part.get("br") is True:
            if current_parts:
                explanation_paragraphs.append(current_parts)
                current_parts = []
        else:
            current_parts.append(part)
    if current_parts:
        explanation_paragraphs.append(current_parts)

    # Generate explanation <hp:p> elements
    expl_xml = ""
    for parts_group in explanation_paragraphs:
        content, max_eq = parts_to_run_content(parts_group)
        if content:
            expl_xml += (f'<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                        f'<hp:run charPrIDRef="7">{content}</hp:run>'
                        f'{make_lineseg(0, max_eq[0], max_eq[1], max_eq[2], max_eq[3])}'
                        f'</hp:p>')

    endnote = (f'<hp:ctrl><hp:endNote number="{number}" suffixChar="46" instId="{inst_id}">'
               f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" '
               f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" '
               f'hasTextRef="0" hasNumRef="0">'
               f'{answer_p}'
               f'{expl_xml}'
               f'</hp:subList></hp:endNote></hp:ctrl>')

    return endnote

def make_condition_rect(condition_box):
    """Generate condition box (hp:rect) for (가)/(나)/(다) items"""
    items = condition_box["items"]
    n_items = len(items)
    height = n_items * 1600 + 2000
    center_y = height // 2
    sca_y = round(height / 12587, 6)
    rect_id = next_eq_id()
    zorder = next_zorder()
    iid = next_inst_id()

    items_content = ""
    for idx, item in enumerate(items):
        label = item["label"]
        vpos = idx * 1600

        # Build content for this item
        item_run_content = f'<hp:t>{xml_escape(label)} </hp:t>'
        max_eq = (1000, 1000, 850, 600)
        for part in item["parts"]:
            if "eq" in part:
                item_run_content += make_equation_xml(part["eq"])
                params = lineseg_params_for_eq(part["eq"])
                if params[0] > max_eq[0]:
                    max_eq = params
            elif "t" in part:
                item_run_content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'

        items_content += (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                         f'<hp:run charPrIDRef="7">{item_run_content}</hp:run>'
                         f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vpos}" '
                         f'vertsize="{max_eq[0]}" textheight="{max_eq[1]}" baseline="{max_eq[2]}" '
                         f'spacing="{max_eq[3]}" horzpos="0" horzsize="27736" flags="393216"/>'
                         f'</hp:linesegarray></hp:p>')

    # Read condition_rect_template.xml
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

def make_data_table_xml(data_table):
    """Generate data table using pre-extracted templates from 양식지"""
    dt_type = data_table["type"]
    row_parts = data_table.get("row_parts", [])

    if dt_type == "normal_dist":
        # Select template by data row count (3, 4, or 5)
        n_data_rows = len(row_parts)
        if n_data_rows <= 3:
            tpl_name = "normal_dist_3rows.xml"
        elif n_data_rows <= 4:
            tpl_name = "normal_dist_4rows.xml"
        else:
            tpl_name = "normal_dist_5rows.xml"

        with open(f"{BASE}/{tpl_name}", "r", encoding="utf-8") as f:
            tbl_xml = f.read()

        # Replace IDs
        tbl_xml = tbl_xml.replace("{{TABLE_ID}}", str(next_eq_id()))
        tbl_xml = tbl_xml.replace("{{ZORDER}}", str(next_zorder()))

        # Replace equation IDs (count them from template)
        import re as _re
        eq_count = len(_re.findall(r'\{\{EQ_ID_\d+\}\}', tbl_xml))
        for i in range(1, eq_count + 1):
            tbl_xml = tbl_xml.replace(f"{{{{EQ_ID_{i}}}}}", str(next_eq_id()))
            tbl_xml = tbl_xml.replace(f"{{{{EQ_ZO_{i}}}}}", str(next_zorder()))

        # Replace Z and P values from row_parts
        for ri, row in enumerate(row_parts):
            row_num = ri + 1
            # row = [[{"eq": "1.0"}], [{"eq": "0.3413"}]]
            z_val = ""
            p_val = ""
            if len(row) >= 1:
                for part in row[0]:
                    z_val += part.get("eq", part.get("t", ""))
            if len(row) >= 2:
                for part in row[1]:
                    p_val += part.get("eq", part.get("t", ""))
            tbl_xml = tbl_xml.replace(f"{{{{Z_{row_num}}}}}", z_val)
            tbl_xml = tbl_xml.replace(f"{{{{P_{row_num}}}}}", p_val)

        return tbl_xml

    elif dt_type == "probability":
        # Select template by column count (5, 6, or 7)
        header_parts = data_table.get("header_parts", [])
        n_cols = len(header_parts)
        if n_cols <= 5:
            tpl_name = "prob_dist_5cols.xml"
        elif n_cols <= 6:
            tpl_name = "prob_dist_6cols.xml"
        else:
            tpl_name = "prob_dist_7cols.xml"

        with open(f"{BASE}/{tpl_name}", "r", encoding="utf-8") as f:
            tbl_xml = f.read()

        # Replace IDs
        tbl_xml = tbl_xml.replace("{{TABLE_ID}}", str(next_eq_id()))
        tbl_xml = tbl_xml.replace("{{ZORDER}}", str(next_zorder()))

        import re as _re
        eq_count = len(_re.findall(r'\{\{EQ_ID_\d+\}\}', tbl_xml))
        for i in range(1, eq_count + 1):
            tbl_xml = tbl_xml.replace(f"{{{{EQ_ID_{i}}}}}", str(next_eq_id()))
            tbl_xml = tbl_xml.replace(f"{{{{EQ_ZO_{i}}}}}", str(next_zorder()))

        # For probability tables, the cell contents need to be injected into
        # the template's existing cells. Since the template has fixed structure,
        # we inject header and data values into the equation scripts.
        # The template has equations with placeholder scripts that need replacement.
        return tbl_xml

    return ""

def png_to_bmp_bytes(png_path):
    """Convert PNG image to BMP bytes for HWPX"""
    img = Image.open(png_path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    return buf.getvalue()

def make_pic_xml(img_name, img_path):
    """Generate hp:pic for an image"""
    pic_id = next_eq_id()
    zorder = next_zorder()
    iid = next_inst_id()

    img = Image.open(img_path)
    w, h = img.size
    # Convert pixels to HWPUNIT (approx 75.59 per mm, 1 pixel ~ 7559/dpi ~ 75.59/dpi * 100)
    # For 200dpi: 1 pixel ~ 37.8 HWPUNIT. For simplicity use width relative to column
    hw_w = min(int(w * 37.8), 28000)
    hw_h = int(h * 37.8 * hw_w / (w * 37.8))

    binaryItemIDRef = img_name.replace(".bmp", "").replace(".png", "")

    return (f'<hp:pic id="{pic_id}" zOrder="{zorder}" numberingType="PICTURE" '
            f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
            f'href="" groupLevel="0" instid="{iid}" reverse="0">'
            f'<hp:offset x="0" y="0"/>'
            f'<hp:orgSz width="{hw_w}" height="{hw_h}"/>'
            f'<hp:curSz width="{hw_w}" height="{hw_h}"/>'
            f'<hp:flip horizontal="0" vertical="0"/>'
            f'<hp:rotationInfo angle="0" centerX="{hw_w // 2}" centerY="{hw_h // 2}" rotateimage="1"/>'
            f'<hp:renderingInfo>'
            f'<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
            f'<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
            f'<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
            f'</hp:renderingInfo>'
            f'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="{hw_w}" y="0"/>'
            f'<hc:pt2 x="{hw_w}" y="{hw_h}"/><hc:pt3 x="0" y="{hw_h}"/></hp:imgRect>'
            f'<hp:imgClip left="0" right="{hw_w}" top="0" bottom="{hw_h}"/>'
            f'<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
            f'<hp:imgDim dimwidth="{hw_w}" dimheight="{hw_h}"/>'
            f'<hc:img binaryItemIDRef="{binaryItemIDRef}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
            f'<hp:effects/>'
            f'<hp:sz width="{hw_w}" widthRelTo="ABSOLUTE" height="{hw_h}" heightRelTo="ABSOLUTE" protect="0"/>'
            f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
            f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
            f'vertOffset="0" horzOffset="0"/>'
            f'<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
            f'<hp:shapeComment>그림입니다.</hp:shapeComment>'
            f'</hp:pic>')

def get_subtopic_name(subtopic):
    """Map subtopic to official unit_classification topic name"""
    mapping = {
        "확률분포": "확률분포",
        "이항분포": "이항분포",
        "정규분포": "정규분포",
        "통계적 추정": "통계적 추정",
        "조건부 확률": "조건부 확률",
        "조건부확률": "조건부 확률",
    }
    return mapping.get(subtopic, subtopic)

# === Build section0.xml ===
print("Building section0.xml...")

# Read header_area_template
with open(f"{BASE}/header_area_template.xml", "r", encoding="utf-8") as f:
    header_template = f.read()

# Substitute placeholders
header_xml = header_template.replace("{{YEAR_SEMESTER}}", xml_escape(YEAR_SEMESTER))
header_xml = header_xml.replace("{{SCHOOL_NAME}}", xml_escape(SCHOOL_NAME))
header_xml = header_xml.replace("{{GRADE_SUBJECT}}", xml_escape(GRADE_SUBJECT))
header_xml = header_xml.replace("{{RANGE}}", xml_escape(RANGE_STR))
header_xml = header_xml.replace("{{CREATED_DATE}}", xml_escape(CREATED_DATE))

# Build problem paragraphs
problem_paras = []
endnote_num = 1  # endNote numbering starts at 1 (0 is in header)
problem_count = 0
essay_count = 0

# Track images for Q18
extra_images = []  # List of (bindata_name, file_data) tuples

for prob in problems:
    num = prob["number"]
    ptype = prob["type"]
    score = prob["score"]
    parts = prob["parts"]
    choices = prob.get("choices")
    answer = prob["answer"]
    explanation = prob.get("explanation_parts", [])
    condition_box = prob.get("condition_box")
    data_table = prob.get("data_table")
    has_figure = prob.get("has_figure", False)
    figure_info = prob.get("figure_info")

    # Determine if we need column/page breaks before this problem
    # Layout: 2 problems per column, 4 per page
    if problem_count > 0:
        if problem_count % 4 == 0:
            # Page break
            problem_paras.append(make_pagebreak())
        elif problem_count % 2 == 0:
            # Column break
            problem_paras.append(make_colbreak())

        # Add spacing between problems (in same column)
        if problem_count % 2 == 1:
            for _ in range(15):
                problem_paras.append(make_empty_para())

    # --- Build problem paragraph ---

    # For essay type: [서술형 N] label
    if ptype == "essay":
        essay_count += 1

    # Generate endNote
    endnote_xml = make_endnote(endnote_num, answer, explanation, ptype)
    endnote_num += 1

    # Problem text: endNote marker + parts conversion
    # The parts already include score for choice type
    # We need to separate the score from parts first

    # Build parts content (excluding score which is already in parts)
    prob_content = endnote_xml
    max_eq_params = (1000, 1000, 850, 600)

    # Convert parts to XML
    for part in parts:
        if "eq" in part:
            prob_content += make_equation_xml(part["eq"])
            params = lineseg_params_for_eq(part["eq"])
            if params[0] > max_eq_params[0]:
                max_eq_params = params
        elif "t" in part:
            text = part["t"]
            # Handle newlines in text - they should create visual line breaks
            # For inline text, replace \n with space since HWPX handles wrapping
            text = text.replace("\n", " ")
            prob_content += f'<hp:t>{xml_escape(text)}</hp:t>'

    # Problem paragraph
    prob_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
              f'<hp:run charPrIDRef="7">{prob_content}</hp:run>'
              f'{make_lineseg(0, max_eq_params[0], max_eq_params[1], max_eq_params[2], max_eq_params[3])}'
              f'</hp:p>')
    problem_paras.append(prob_p)

    # Empty line between problem and choices/table
    problem_paras.append(make_empty_para())

    # Figure (Q18)
    if has_figure and figure_info and figure_info.get("final_image"):
        img_path = figure_info["final_image"]
        if os.path.exists(img_path):
            img_name = f"image3"
            bmp_data = png_to_bmp_bytes(img_path)
            extra_images.append((f"image3.bmp", bmp_data))

            pic_xml = make_pic_xml("image3.bmp", img_path)
            pic_p = (f'<hp:p id="2147483648" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                     f'<hp:run charPrIDRef="7">{pic_xml}<hp:t/></hp:run>'
                     f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                     f'</hp:p>')
            problem_paras.append(pic_p)
            problem_paras.append(make_empty_para())

    # Condition box
    if condition_box:
        cond_type = condition_box.get("type", "condition")
        if cond_type == "condition":
            rect_xml = make_condition_rect(condition_box)
            # Wrap in a paragraph
            cond_p = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                      f'<hp:run charPrIDRef="7">{rect_xml}<hp:t/></hp:run>'
                      f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                      f'</hp:p>')
            problem_paras.append(cond_p)
            problem_paras.append(make_empty_para())

    # Data table
    if data_table:
        dt_label = ""
        if data_table["type"] == "normal_dist":
            dt_label = "<표준정규분포표>"

        if dt_label:
            label_p = make_paragraph(
                content=f'<hp:t>{xml_escape(dt_label)}</hp:t>',
                paraPrIDRef="2", charPrIDRef="7",
                vertsize=1000, textheight=1000, baseline=850, spacing=600
            )
            problem_paras.append(label_p)

        tbl_xml = make_data_table_xml(data_table)
        tbl_p = (f'<hp:p id="2147483648" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                 f'<hp:run charPrIDRef="7">{tbl_xml}<hp:t/></hp:run>'
                 f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                 f'</hp:p>')
        problem_paras.append(tbl_p)
        problem_paras.append(make_empty_para())

    # Choices (for objective only)
    if ptype == "choice" and choices:
        choices_xml = make_choices_xml(choices)
        problem_paras.append(choices_xml)

    # Meta tags
    topic_name = get_subtopic_name(prob.get("subtopic", ""))
    meta_topic = make_paragraph(
        content=f'<hp:t>[중단원] {xml_escape(topic_name)}</hp:t>',
        charPrIDRef="4",
        vertsize=1000, textheight=1000, baseline=850, spacing=600
    )
    problem_paras.append(meta_topic)

    difficulty = prob.get("difficulty", "중")
    meta_diff = make_paragraph(
        content=f'<hp:t>[난이도] {xml_escape(difficulty)}</hp:t>',
        charPrIDRef="4",
        vertsize=1000, textheight=1000, baseline=850, spacing=600
    )
    problem_paras.append(meta_diff)

    problem_count += 1

# Final breaks after last problem
problem_paras.append(make_colbreak())
problem_paras.append(make_pagebreak())

# === Assemble section0.xml ===
# Read root_element.xml (just the XML declaration)
root_open = ('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>')

# section0 = root_element + header_area + problem_paras + closing tag
section_xml = root_open + header_xml + "".join(problem_paras) + "</hs:sec>"

# === Build content.hpf ===
with open(f"{BASE}/content_hpf_template.xml", "r", encoding="utf-8") as f:
    hpf_template = f.read()

extra_img_items = ""
if extra_images:
    for img_name, _ in extra_images:
        item_id = img_name.replace(".bmp", "")
        extra_img_items += f'<opf:item id="{item_id}" href="BinData/{img_name}" media-type="image/bmp" isEmbeded="1"/>'

hpf_xml = hpf_template.replace("{{MODIFIED_DATE}}", MODIFIED_DATE)
hpf_xml = hpf_xml.replace("{{EXTRA_IMAGES}}", extra_img_items)

# === Build PrvText.txt ===
prv_lines = []
for prob in problems:
    line = ""
    for part in prob["parts"]:
        if "t" in part:
            line += part["t"]
        elif "eq" in part:
            line += part["eq"]
    prv_lines.append(line[:80])
prv_text = "\n".join(prv_lines[:20])

# === Output filename ===
# [코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]
code = "04039"
filename = (f"[{code}][고][2025][3-1-b][경기부천시][소명여고][확통]"
            f"[조건부확률-통계적추정][{code}][그림1-0-1-0].hwpx")

output_path = os.path.join(OUTPUT_DIR, filename)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# === Write HWPX (ZIP) ===
print(f"Writing HWPX to {output_path}...")

with zipfile.ZipFile(output_path, 'w') as zout:
    # STORED files
    zout.write(f'{BASE}/mimetype', 'mimetype', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/version.xml', 'version.xml', compress_type=zipfile.ZIP_STORED)

    # DEFLATED files (order matters!)
    zout.write(f'{BASE}/Contents/header.xml', 'Contents/header.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image1.bmp', 'BinData/image1.bmp', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Contents/masterpage0.xml', 'Contents/masterpage0.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image2.bmp', 'BinData/image2.bmp', compress_type=zipfile.ZIP_DEFLATED)

    # Extra images (Q18 figure)
    for img_name, img_data in extra_images:
        zout.writestr(f'BinData/{img_name}', img_data, compress_type=zipfile.ZIP_DEFLATED)

    # Section0
    zout.writestr('Contents/section0.xml', section_xml, compress_type=zipfile.ZIP_DEFLATED)

    # Preview
    zout.writestr('Preview/PrvText.txt', prv_text.encode('utf-8'), compress_type=zipfile.ZIP_DEFLATED)

    # Settings
    zout.write(f'{BASE}/settings.xml', 'settings.xml', compress_type=zipfile.ZIP_DEFLATED)

    # Preview image (STORED)
    zout.write(f'{BASE}/Preview/PrvImage.png', 'Preview/PrvImage.png', compress_type=zipfile.ZIP_STORED)

    # META-INF
    zout.write(f'{BASE}/META-INF/container.rdf', 'META-INF/container.rdf', compress_type=zipfile.ZIP_DEFLATED)

    # content.hpf
    zout.writestr('Contents/content.hpf', hpf_xml, compress_type=zipfile.ZIP_DEFLATED)

    zout.write(f'{BASE}/META-INF/container.xml', 'META-INF/container.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/manifest.xml', 'META-INF/manifest.xml', compress_type=zipfile.ZIP_DEFLATED)

print(f"HWPX written: {output_path}")
print(f"Total problems: {problem_count} (choice: {problem_count - essay_count}, essay: {essay_count})")
print(f"Extra images: {len(extra_images)}")
