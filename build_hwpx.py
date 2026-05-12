#!/usr/bin/env python3
"""
NGD HWPX Builder — Generates HWPX exam file from exam_data.json
"""

import json
import zipfile
import os
import re
import struct
import sys
from datetime import datetime
from PIL import Image
import io

# === Paths ===
BASE = "/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx"
EXAM_JSON = sys.argv[1] if len(sys.argv) > 1 else "/tmp/exam_data.json"
OUTPUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "/mnt/c/NGD/outputs"

# === Load exam data ===
with open(EXAM_JSON, "r", encoding="utf-8") as f:
    exam = json.load(f)

info = exam["info"]
problems = exam["problems"]

# === Info substitutions ===
YEAR_SEMESTER = f"{info['year']}년 {info['semester']} {info['exam_type']}"
SCHOOL_NAME = info["school"]
GRADE_SUBJECT = f"{info['grade']}학년 {info['subject']}"
RANGE_STR = info.get("range", "")
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
            if part.get("indent"):
                content += '<hp:tab width="2000" leader="0" type="1"/>'
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

def make_paragraph(content="", para_id="2147483648", paraPrIDRef="0", charPrIDRef="1",
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
    return make_paragraph(content="", para_id=para_id, charPrIDRef="1",
                         vertsize=1000, textheight=1000, baseline=850, spacing=600)

def make_colbreak():
    return make_paragraph(content="", para_id="2147483648", paraPrIDRef="1", charPrIDRef="7",
                         columnBreak="1", vertsize=1000, textheight=1000, baseline=850, spacing=600)

def make_pagebreak():
    return make_paragraph(content="", para_id="2147483648", paraPrIDRef="1", charPrIDRef="7",
                         pageBreak="1", vertsize=1000, textheight=1000, baseline=850, spacing=600)

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

        p1 = (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
              f'<hp:run charPrIDRef="1">{line1_content}</hp:run>'
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

            p2 = (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                  f'<hp:run charPrIDRef="1">{line2_content}</hp:run>'
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

            p = (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                 f'<hp:run charPrIDRef="1">{content}</hp:run>'
                 f'{make_lineseg(0, max_eq[0], max_eq[1], max_eq[2], max_eq[3])}'
                 f'</hp:p>')
            paragraphs.append(p)

    return "".join(paragraphs)

_HWP_EQ_MARKERS = ['over', 'sqrt', 'left(', 'right)', 'int_', 'sum_', 'LSUB', 'LSUP', 'cdot', 'leq', 'geq']

def _is_hwp_eq_string(s):
    s = str(s)
    return ('{' in s and any(m in s for m in _HWP_EQ_MARKERS)) or ('^' in s and ('{' in s or 'x' in s))

def make_endnote(number, answer, explanation_parts, prob_type="choice", explanation_table=None):
    """Generate endNote XML"""
    inst_id = next_inst_id()

    ans_str = str(answer)
    if prob_type == "essay" and _is_hwp_eq_string(ans_str):
        answer_content = f'<hp:t> [정답] </hp:t>' + make_equation_xml(ans_str)
    else:
        answer_text = f' [정답] {ans_str}'
        answer_content = f'<hp:t>{xml_escape(answer_text)}</hp:t>'

    answer_run = (f'<hp:run charPrIDRef="11">'
                  f'<hp:ctrl><hp:autoNum num="{number}" numType="ENDNOTE">'
                  f'<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="." supscript="0"/>'
                  f'</hp:autoNum></hp:ctrl></hp:run>'
                  f'<hp:run charPrIDRef="1">{answer_content}</hp:run>')

    answer_p = (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
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

    expl_xml = ""
    for parts_group in explanation_paragraphs:
        content, max_eq = parts_to_run_content(parts_group)
        if content:
            expl_xml += (f'<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                        f'<hp:run charPrIDRef="1">{content}</hp:run>'
                        f'{make_lineseg(0, max_eq[0], max_eq[1], max_eq[2], max_eq[3])}'
                        f'</hp:p>')

    # explanation_table (증감표, 조립제법 등) — explanation_parts 뒤에 삽입
    if explanation_table:
        et_type = explanation_table.get("type")
        tbl_xml = ""
        if et_type == "increase_decrease":
            tbl_xml = make_increase_decrease_table(explanation_table)
        elif et_type == "synthetic_division":
            tbl_xml = make_synthetic_division_table(explanation_table)
        if tbl_xml:
            expl_xml += (f'<hp:p id="0" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                        f'<hp:run charPrIDRef="1">{tbl_xml}<hp:t/></hp:run>'
                        f'{make_lineseg(0, 1000, 1000, 850, 600)}'
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
                         f'<hp:run charPrIDRef="1">{item_run_content}</hp:run>'
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

        # 템플릿에 placeholder가 없고 ID/예시값이 하드코딩되어 있어,
        # ID는 정규식으로 새로 할당하고 데이터 셀은 비운 뒤 입력값으로 주입한다.
        tbl_xml = _replace_table_ids(tbl_xml)

        template_rows = int(re.search(r'normal_dist_(\d+)rows', tpl_name).group(1))
        cells = re.findall(r'<hp:tc .*?</hp:tc>', tbl_xml, re.DOTALL)

        # 셀 [0]=제목, [1..2]=헤더(z, P), [3..]=데이터 셀 (Z, P 쌍)
        for i in range(3, 3 + template_rows * 2):
            if i < len(cells):
                cells[i] = _empty_cell(cells[i])

        for ri, row in enumerate(row_parts[:template_rows]):
            z_idx = 3 + ri * 2
            p_idx = 4 + ri * 2
            if p_idx >= len(cells):
                break
            z_val = "".join(part.get("eq", part.get("t", "")) for part in row[0]) if len(row) >= 1 else ""
            p_val = "".join(part.get("eq", part.get("t", "")) for part in row[1]) if len(row) >= 2 else ""
            if z_val:
                cells[z_idx] = _inject_cell_value(cells[z_idx], z_val)
            if p_val:
                cells[p_idx] = _inject_cell_value(cells[p_idx], p_val)

        # 재조립: 제목 1셀 + 헤더 2셀 + 데이터 행(Z, P) × template_rows
        header_tag = re.match(r'^(.*?)<hp:tr>', tbl_xml, re.DOTALL).group(1)
        trs = f'<hp:tr>{cells[0]}</hp:tr>'
        trs += f'<hp:tr>{cells[1]}{cells[2]}</hp:tr>'
        for ri in range(template_rows):
            z_idx = 3 + ri * 2
            trs += f'<hp:tr>{cells[z_idx]}{cells[z_idx + 1]}</hp:tr>'
        return header_tag + trs + '</hp:tbl>'

    elif dt_type == "probability":
        # header_parts: x값 목록 [[{"eq":"0"}], [{"eq":"1"}], ...]
        # row_parts: P값 목록 [[{"eq":"0.2"}], [{"eq":"0.5"}], ...]
        header_parts = data_table.get("header_parts", [])
        prob_row = data_table.get("row_parts", [])
        n_data = len(header_parts)  # 데이터 열 수 (X, 계 제외)

        if n_data <= 3:
            tpl_name = "prob_dist_5cols.xml"
            n_total = 5
        elif n_data <= 4:
            tpl_name = "prob_dist_6cols.xml"
            n_total = 6
        else:
            tpl_name = "prob_dist_7cols.xml"
            n_total = 7

        with open(f"{BASE}/{tpl_name}", "r", encoding="utf-8") as f:
            tbl_xml = f.read()

        # 템플릿에 placeholder가 없고 ID가 하드코딩되어 있어, 정규식으로 새 ID 할당
        tbl_xml = _replace_table_ids(tbl_xml)

        # 셀 분리 후 데이터 주입
        cells = re.findall(r'<hp:tc .*?</hp:tc>', tbl_xml, re.DOTALL)
        # row 0: [0]=X헤더, [1..n_data]=x값, [n_data+1]=계
        # row 1: [n_total]=P헤더, [n_total+1..n_total+n_data]=P값, [n_total+n_data+1]=1
        def extract_val(parts_list):
            return "".join(p.get("eq", p.get("t", "")) for p in parts_list)

        for i, hp in enumerate(header_parts[:n_data]):
            val = extract_val(hp) if isinstance(hp, list) else str(hp)
            cells[1 + i] = _inject_cell_value(cells[1 + i], val)

        for i, pp in enumerate(prob_row[:n_data]):
            val = extract_val(pp) if isinstance(pp, list) else str(pp)
            cells[n_total + 1 + i] = _inject_cell_value(cells[n_total + 1 + i], val)

        # 재조립 (2행)
        header_tag = re.match(r'^(.*?)<hp:tr>', tbl_xml, re.DOTALL).group(1)
        tr0 = f'<hp:tr>{"".join(cells[:n_total])}</hp:tr>'
        tr1 = f'<hp:tr>{"".join(cells[n_total:])}</hp:tr>'
        return header_tag + tr0 + tr1 + '</hp:tbl>'

    return ""

def _inject_cell_value(cell_xml, value):
    """빈 셀(empty run)에 값(텍스트 or 수식)을 삽입"""
    if not value:
        return cell_xml

    arrow_map = {"NEARROW": "NEARROW", "SEARROW": "SEARROW"}
    if value in arrow_map:
        eq_xml = make_equation_xml(arrow_map[value])
        params = lineseg_params_for_eq(arrow_map[value])
        run = f'<hp:run charPrIDRef="1">{eq_xml}<hp:t/></hp:run>'
        ls = make_lineseg(0, params[0], params[1], params[2], params[3])
    elif re.search(r'[a-zA-Z_{}^\\`]', value):
        eq_xml = make_equation_xml(value)
        params = lineseg_params_for_eq(value)
        run = f'<hp:run charPrIDRef="1">{eq_xml}<hp:t/></hp:run>'
        ls = make_lineseg(0, params[0], params[1], params[2], params[3])
    else:
        run = f'<hp:run charPrIDRef="1"><hp:t>{xml_escape(value)}</hp:t></hp:run>'
        ls = make_lineseg(0, 1000, 1000, 850, 600)

    cell_xml = re.sub(r'<hp:run charPrIDRef="\d+"/>', run, cell_xml, count=1)
    cell_xml = re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', ls, cell_xml, count=1, flags=re.DOTALL)
    return cell_xml

def _empty_cell(cell_xml):
    """셀 안의 <hp:run> 내용(예시 수식·텍스트)을 비워 자기닫힘 형식으로 만든다.
    이후 _inject_cell_value()로 다시 채울 수 있도록."""
    m = re.search(r'<hp:run charPrIDRef="(\d+)">.*?</hp:run>', cell_xml, re.DOTALL)
    if m:
        cell_xml = cell_xml.replace(m.group(0), f'<hp:run charPrIDRef="{m.group(1)}"/>', 1)
    return cell_xml


def _replace_table_ids(xml):
    """테이블 XML의 id/zOrder를 새 값으로 교체"""
    # `[^>]*`로 0개 이상 매칭 (id가 첫 속성인 경우 포함)
    xml = re.sub(r'(<hp:tbl\b[^>]* id=)"[^"]*"', lambda m: f'{m.group(1)}"{next_eq_id()}"', xml, count=1)
    xml = re.sub(r'(<hp:equation\b[^>]* id=)"[^"]*"', lambda m: f'{m.group(1)}"{next_eq_id()}"', xml)
    xml = re.sub(r'(zOrder=)"[^"]*"', lambda m: f'{m.group(1)}"{next_zorder()}"', xml)
    return xml


def make_increase_decrease_table(explanation_table):
    """증감표 생성
    x값 1개: 양식지 1-x 템플릿 (3행 4열) 사용
    x값 2개: 양식지 2-x 템플릿 (3행 6열) 사용
    x값 3개 이상: 양식지 borderFill 패턴으로 프로그래매틱 생성
    """
    x_values = explanation_table.get("x_values", [])
    rows = explanation_table.get("rows", [])
    n_x = len(x_values)

    # 양식지 템플릿이 있는 케이스 (n_x = 1, 2)
    if n_x in (1, 2):
        tpl_name = ("increase_decrease_template.xml" if n_x == 1
                    else "increase_decrease_template_2x.xml")
        with open(f"{BASE}/{tpl_name}", encoding="utf-8") as f:
            tbl_xml = f.read()
        tbl_xml = _replace_table_ids(tbl_xml)
        cells = re.findall(r'<hp:tc .*?</hp:tc>', tbl_xml, re.DOTALL)
        n_cols = 2 * n_x + 2  # 1-x→4, 2-x→6
        # 헤더 row의 x값 셀: cells[2], cells[4], ... (홀수 col idx)
        for vi, xv in enumerate(x_values):
            cells[2 + vi * 2] = _inject_cell_value(cells[2 + vi * 2], str(xv))
        # 데이터 행: row 0 → cells[n_cols..2n_cols-1], row 1 → cells[2n_cols..3n_cols-1]
        # 각 데이터 행: cells[base+0]=label(보존), cells[base+1..n_cols-1]=values
        for ri, row_data in enumerate(rows[:2]):
            base = (ri + 1) * n_cols
            n_val_slots = n_cols - 1
            values = row_data.get("values", [])
            for vi in range(n_val_slots):
                if vi < len(values):
                    cells[base + 1 + vi] = _inject_cell_value(cells[base + 1 + vi], str(values[vi]))
        hdr = re.match(r'^(.*?)<hp:tr>', tbl_xml, re.DOTALL).group(1)
        out = hdr
        for ri in range(3):
            out += f'<hp:tr>{"".join(cells[ri * n_cols:(ri + 1) * n_cols])}</hp:tr>'
        return out + '</hp:tbl>'

    # x값 3개 이상 — 양식지 borderFill 패턴으로 프로그래매틱 생성
    # 구조: label | ... | x1 | ... | x2 | ...
    n_val_cols = 2 * n_x + 1  # 값 열 수
    n_cols = 1 + n_val_cols
    n_rows = 1 + len(rows)

    LABEL_W = 3805
    val_w = min(4937, (29000 - LABEL_W) // n_val_cols)
    total_w = LABEL_W + val_w * n_val_cols
    H_HDR, H_DATA = 1690, 1973

    # 양식지의 borderFillIDRef 패턴 (1-x/2-x 양식지에서 도출)
    # col 0: label, col 1: 첫 cdots, 중간 cols: 27/4/29, 마지막 col: 28/22/30
    BFR_LABEL = ["37", "38", "39"]   # row 0(헤더), row 1(f'(x)), row 2(f(x))
    BFR_FIRST = ["31", "32", "33"]
    BFR_MID   = ["27", "4",  "29"]
    BFR_LAST  = ["28", "22", "30"]

    def get_bfr(col, row):
        r = min(row, 2)  # 데이터 row가 2개 이상이어도 마지막 패턴 재사용
        if col == 0:           return BFR_LABEL[r]
        if col == 1:           return BFR_FIRST[r]
        if col == n_cols - 1:  return BFR_LAST[r]
        return BFR_MID[r]

    def tc(content_xml, col, row, w, h, bfr=None):
        if bfr is None:
            bfr = get_bfr(col, row)
        return (f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{bfr}">'
                f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
                f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
                f'{content_xml}</hp:subList>'
                f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
                f'<hp:cellSpan colSpan="1" rowSpan="1"/>'
                f'<hp:cellSz width="{w}" height="{h}"/>'
                f'<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
                f'</hp:tc>')

    def eq_p(script, h):
        eq_xml = make_equation_xml(script)
        p = lineseg_params_for_eq(script)
        return (f'<hp:p id="2147483648" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="1">{eq_xml}<hp:t/></hp:run>'
                f'{make_lineseg(0, p[0], p[1], p[2], p[3])}</hp:p>')

    def txt_p(t, h):
        return (f'<hp:p id="2147483648" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="1"><hp:t>{xml_escape(t)}</hp:t></hp:run>'
                f'{make_lineseg(0, h, h, int(h*0.85), int(h*0.6))}</hp:p>')

    def val_p(v, h):
        if not v:
            return txt_p("", h)
        if v in ("NEARROW", "SEARROW"):
            return eq_p(v, h)
        if re.search(r'[a-zA-Z_{}^\\`]', v):
            return eq_p(v, h)
        return txt_p(v, h)

    tbl_id = next_eq_id()
    zo = next_zorder()
    total_h = H_HDR + H_DATA * len(rows)

    trs = []
    # 헤더 행
    hdr_cells = tc(eq_p("{x}", H_HDR), 0, 0, LABEL_W, H_HDR)
    for vi in range(n_val_cols):
        if vi % 2 == 0:
            content = eq_p("{CDOTS }", H_HDR)
        else:
            content = eq_p(x_values[vi // 2], H_HDR)
        hdr_cells += tc(content, vi + 1, 0, val_w, H_HDR)
    trs.append(f'<hp:tr>{hdr_cells}</hp:tr>')

    # 데이터 행 — values를 n_val_cols 길이로 패딩하여 헤더와 폭 일치
    for ri, row_data in enumerate(rows):
        label = row_data.get("label", "")
        values = list(row_data.get("values", []))
        values += [""] * max(0, n_val_cols - len(values))
        row_cells = tc(eq_p(label, H_DATA) if re.search(r'[a-zA-Z_{}^\\`\']', label) else txt_p(label, H_DATA),
                       0, ri + 1, LABEL_W, H_DATA)
        for vi in range(n_val_cols):
            row_cells += tc(val_p(str(values[vi]), H_DATA), vi + 1, ri + 1, val_w, H_DATA)
        trs.append(f'<hp:tr>{row_cells}</hp:tr>')

    return (f'<hp:tbl id="{tbl_id}" zOrder="{zo}" numberingType="TABLE" '
            f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
            f'pageBreak="CELL" repeatHeader="1" rowCnt="{n_rows}" colCnt="{n_cols}" '
            f'cellSpacing="0" borderFillIDRef="4" noAdjust="0">'
            f'<hp:sz width="{total_w}" widthRelTo="ABSOLUTE" height="{total_h}" heightRelTo="ABSOLUTE" protect="0"/>'
            f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
            f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
            f'vertOffset="0" horzOffset="0"/>'
            f'<hp:outMargin left="0" right="0" top="284" bottom="284"/>'
            f'<hp:inMargin left="140" right="140" top="140" bottom="140"/>'
            f'{"".join(trs)}</hp:tbl>')


def make_synthetic_division_table(explanation_table):
    """조립제법 표 생성 — 양식지 템플릿 기반 (10행×5열)
    solver 형식: {divisor, coefficients, result}
    템플릿 배치:
      Row 0: [divisor, c0, c1, c2, c3]  (계수 행)
      Row 1: [empty, empty, m1, m2, m3]  (곱셈 행)
      Row 2: thin separator
      Row 3: [empty, r0, r1, r2, r3]    (결과 행)
    """
    divisor = explanation_table.get("divisor", "")
    coefficients = explanation_table.get("coefficients", [])
    result = explanation_table.get("result", [])

    # 곱셈 행 계산: multiplied[i] = divisor × result[i-1]
    try:
        d = float(divisor)
        multiplied = [""] + [str(d * float(r)) for r in result[:-1]]
        multiplied = [m.rstrip("0").rstrip(".") if "." in m else m for m in multiplied]
    except (ValueError, TypeError):
        multiplied = [""] * (len(coefficients))

    # rows 형식으로 변환 (10행×5열)
    n = max(len(coefficients), 5)
    row0 = [divisor] + list(coefficients[:n-1])
    row1 = [""] + list(multiplied[1:n])
    row3 = [""] + list(result[:n-1])

    rows_data = [
        row0,   # idx 0: 계수
        row1,   # idx 1: 곱셈
        [],     # idx 2: thin separator (비워둠)
        row3,   # idx 3: 결과
    ]

    with open(f"{BASE}/synthetic_division_template.xml", encoding="utf-8") as f:
        tbl_xml = f.read()

    tbl_xml = _replace_table_ids(tbl_xml)
    cells = re.findall(r'<hp:tc .*?</hp:tc>', tbl_xml, re.DOTALL)

    for ri, row_vals in enumerate(rows_data):
        for ci, val in enumerate(row_vals[:5]):
            cell_idx = ri * 5 + ci
            if val:
                cells[cell_idx] = _inject_cell_value(cells[cell_idx], str(val))

    header = re.match(r'^(.*?)<hp:tr>', tbl_xml, re.DOTALL).group(1)
    trs = ""
    for ri in range(10):
        trs += f'<hp:tr>{"".join(cells[ri*5:(ri+1)*5])}</hp:tr>'
    return header + trs + '</hp:tbl>'


def make_empty_box(condition_box):
    """서술형 빈 답안 박스 (empty_box_template.xml)"""
    height = condition_box.get("height", 5059)
    center_y = height // 2
    sca_y = round(height / 12587, 6)
    rect_id = next_eq_id()
    zorder = next_zorder()
    iid = next_inst_id()

    with open(f"{BASE}/empty_box_template.xml", encoding="utf-8") as f:
        tmpl = f.read()

    xml = tmpl.replace("{{RECT_ID}}", str(rect_id))
    xml = xml.replace("{{ZORDER}}", str(zorder))
    xml = xml.replace("{{INST_ID}}", str(iid))
    xml = xml.replace("{{HEIGHT}}", str(height))
    xml = xml.replace("{{CENTER_Y}}", str(center_y))
    xml = xml.replace("{{SCA_Y}}", str(sca_y))
    return xml


def make_proof_table(condition_box):
    """[ 증 명 ] 테이블 (proof_table_template.xml)"""
    items = condition_box.get("items", [])

    with open(f"{BASE}/proof_table_template.xml", encoding="utf-8") as f:
        tbl_xml = f.read()

    tbl_xml = _replace_table_ids(tbl_xml)

    # 내용 문단 생성
    items_content = ""
    for idx, item in enumerate(items):
        content = ""
        max_eq = (1000, 1000, 850, 600)
        for part in item.get("parts", []):
            if "eq" in part:
                content += make_equation_xml(part["eq"])
                params = lineseg_params_for_eq(part["eq"])
                if params[0] > max_eq[0]:
                    max_eq = params
            elif "t" in part:
                content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'
        vpos = idx * max_eq[0]
        items_content += (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                         f'<hp:run charPrIDRef="1">{content}</hp:run>'
                         f'{make_lineseg(vpos, max_eq[0], max_eq[1], max_eq[2], max_eq[3])}'
                         f'</hp:p>')

    # 셀 [6] (colAddr=1, rowAddr=2) — 내용 영역에 주입
    cells = re.findall(r'<hp:tc .*?</hp:tc>', tbl_xml, re.DOTALL)
    content_height = max(len(items) * 1600 + 500, 2383)
    old_cell = cells[6]
    new_cell = re.sub(r'<hp:run charPrIDRef="\d+"/>',
                      f'<hp:run charPrIDRef="1">{items_content}</hp:run>',
                      old_cell, count=1)
    new_cell = re.sub(r'<hp:cellSz width="\d+" height="\d+"',
                      f'<hp:cellSz width="28096" height="{content_height}"',
                      new_cell, count=1)
    tbl_xml = tbl_xml.replace(old_cell, new_cell, 1)

    table_height = 963 + 963 + content_height + 580
    tbl_xml = re.sub(r'(heightRelTo="ABSOLUTE" protect="0"/>.*?<hp:sz[^>]+height=)"\d+"',
                     lambda m: m.group(0),  # 내부 sz는 유지
                     tbl_xml)
    tbl_xml = re.sub(r'(<hp:tbl\b.*?height=)"\d+"', lambda m: f'{m.group(1)}"{table_height}"',
                     tbl_xml, count=1)

    return tbl_xml


def make_choice_table(condition_box):
    """그리드형 선지 테이블 (choice_table_*.xml)"""
    table_type = condition_box.get("table_type", "6x3")
    tpl_name = f"choice_table_{table_type}.xml"
    rows_data = condition_box.get("rows", [])  # [[v0,v1,...], ...]

    with open(f"{BASE}/{tpl_name}", encoding="utf-8") as f:
        tbl_xml = f.read()

    tbl_xml = _replace_table_ids(tbl_xml)

    if not rows_data:
        return tbl_xml

    cells = re.findall(r'<hp:tc .*?</hp:tc>', tbl_xml, re.DOTALL)
    n_cols = int(table_type.split("x")[1])
    n_rows = int(table_type.split("x")[0])

    for ri, row_vals in enumerate(rows_data[:n_rows]):
        for ci, val in enumerate(row_vals[:n_cols]):
            cell_idx = ri * n_cols + ci
            if val and cell_idx < len(cells):
                cells[cell_idx] = _inject_cell_value(cells[cell_idx], str(val))

    header = re.match(r'^(.*?)<hp:tr>', tbl_xml, re.DOTALL).group(1)
    trs = ""
    for ri in range(n_rows):
        trs += f'<hp:tr>{"".join(cells[ri*n_cols:(ri+1)*n_cols])}</hp:tr>'
    return header + trs + '</hp:tbl>'


def make_bogi_table(condition_box):
    """Generate < 보 기 > table using template"""
    items = condition_box["items"]
    n_items = len(items)

    tpl_name = "bogi_table_6items.xml" if n_items > 4 else "bogi_table_3items.xml"
    with open(f"{BASE}/{tpl_name}", "r", encoding="utf-8") as f:
        tbl_xml = f.read()

    # Replace table id, equation ids, zOrders
    tbl_xml = re.sub(r'(<hp:tbl id=)"[^"]*"', lambda m: f'{m.group(1)}"{next_eq_id()}"', tbl_xml, count=1)
    tbl_xml = re.sub(r'(<hp:equation\b[^>]+ id=)"[^"]*"', lambda m: f'{m.group(1)}"{next_eq_id()}"', tbl_xml)
    tbl_xml = re.sub(r'(zOrder=)"[^"]*"', lambda m: f'{m.group(1)}"{next_zorder()}"', tbl_xml)

    # Inject item content after each label (ㄱ. / ㄴ. / ...)
    labels = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ"]
    for idx, item in enumerate(items):
        if idx >= len(labels):
            break
        label = labels[idx]
        item_content = ""
        for part in item.get("parts", []):
            if "eq" in part:
                item_content += make_equation_xml(part["eq"])
            elif "t" in part:
                item_content += f'<hp:t>{xml_escape(part["t"])}</hp:t>'
        if item_content:
            # 3items 템플릿은 라벨이 'ㄱ. ' (trailing space), 6items 템플릿은 'ㄱ.' — 둘 다 매치
            tbl_xml = re.sub(
                rf'<hp:t>{label}\.(\s?)</hp:t></hp:run>',
                lambda m: f'<hp:t>{label}.{m.group(1)}</hp:t>{item_content}</hp:run>',
                tbl_xml, count=1
            )

    return tbl_xml


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

extra_images = []  # List of (bindata_name, file_data) tuples
extra_image_counter = 3  # image1/2 are reserved (저작권바, 로고)

for prob in problems:
    num = prob["number"]
    ptype = prob["type"]
    score = prob["score"]
    parts = prob["parts"]
    choices = prob.get("choices")
    answer = prob["answer"]
    explanation = prob.get("explanation_parts", [])
    explanation_table = prob.get("explanation_table")
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

    if ptype == "essay":
        essay_count += 1

    # Generate endNote
    endnote_xml = make_endnote(endnote_num, answer, explanation, ptype, explanation_table)
    endnote_num += 1

    # [서술형 N] prefix for essay problems — skip if parts already starts with marker
    parts_has_marker = bool(parts) and parts[0].get("t", "").startswith("[서술형")
    prefix = f'<hp:t>[서술형 {essay_count}] </hp:t>' if ptype == "essay" and not parts_has_marker else ""

    prob_content = endnote_xml + prefix
    max_eq_params = (1000, 1000, 850, 600)

    # Convert parts to XML
    for part in parts:
        if "eq" in part:
            if part.get("indent"):
                prob_content += '<hp:tab width="2000" leader="0" type="1"/>'
            prob_content += make_equation_xml(part["eq"])
            params = lineseg_params_for_eq(part["eq"])
            if params[0] > max_eq_params[0]:
                max_eq_params = params
        elif "t" in part:
            text = part["t"].replace("\n", " ")
            prob_content += f'<hp:t>{xml_escape(text)}</hp:t>'

    # Score at end: [(score)점] — skip if parts already contain a score marker
    score_val = prob.get("score")
    if score_val is not None:
        all_texts = " ".join(p.get("t", "") for p in parts)
        has_score_in_parts = "점]" in all_texts or "점수" in all_texts
        if not has_score_in_parts:
            score_script = str(score_val)
            prob_content += f'<hp:t>[</hp:t>'
            prob_content += make_equation_xml(score_script)
            prob_content += f'<hp:t>점]</hp:t>'

    # Problem paragraph
    prob_p = (f'<hp:p id="2147483648" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
              f'<hp:run charPrIDRef="1">{prob_content}</hp:run>'
              f'{make_lineseg(0, max_eq_params[0], max_eq_params[1], max_eq_params[2], max_eq_params[3])}'
              f'</hp:p>')
    problem_paras.append(prob_p)

    # Empty line between problem and choices/table
    problem_paras.append(make_empty_para())

    # Figure
    if has_figure and figure_info and figure_info.get("final_image"):
        img_path = figure_info["final_image"]
        if os.path.exists(img_path):
            img_name = f"image{extra_image_counter}"
            extra_image_counter += 1
            bmp_data = png_to_bmp_bytes(img_path)
            extra_images.append((f"{img_name}.bmp", bmp_data))

            pic_xml = make_pic_xml(f"{img_name}.bmp", img_path)
            pic_p = (f'<hp:p id="2147483648" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                     f'<hp:run charPrIDRef="1">{pic_xml}<hp:t/></hp:run>'
                     f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                     f'</hp:p>')
            problem_paras.append(pic_p)
            problem_paras.append(make_empty_para())

    # Condition box
    if condition_box:
        cond_type = condition_box.get("type", "condition")
        box_xml = None
        box_para_pr = "0"

        if cond_type == "condition":
            box_xml = make_condition_rect(condition_box)
        elif cond_type == "image_choice":
            box_xml = make_condition_rect(condition_box)  # 동일 템플릿, 높이만 크게
        elif cond_type == "bogi":
            box_xml = make_bogi_table(condition_box)
            box_para_pr = "3"
        elif cond_type == "empty_box":
            box_xml = make_empty_box(condition_box)
        elif cond_type == "proof":
            box_xml = make_proof_table(condition_box)
            box_para_pr = "3"
        elif cond_type == "choice_table":
            box_xml = make_choice_table(condition_box)
            box_para_pr = "3"

        if box_xml:
            box_p = (f'<hp:p id="2147483648" paraPrIDRef="{box_para_pr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                     f'<hp:run charPrIDRef="1">{box_xml}<hp:t/></hp:run>'
                     f'{make_lineseg(0, 1000, 1000, 850, 600)}'
                     f'</hp:p>')
            problem_paras.append(box_p)
            problem_paras.append(make_empty_para())

    # Data table
    if data_table:
        dt_label = ""
        if data_table["type"] == "normal_dist":
            dt_label = "<표준정규분포표>"

        if dt_label:
            label_p = make_paragraph(
                content=f'<hp:t>{xml_escape(dt_label)}</hp:t>',
                paraPrIDRef="3", charPrIDRef="1",
                vertsize=1000, textheight=1000, baseline=850, spacing=600
            )
            problem_paras.append(label_p)

        tbl_xml = make_data_table_xml(data_table)
        tbl_p = (f'<hp:p id="2147483648" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                 f'<hp:run charPrIDRef="1">{tbl_xml}<hp:t/></hp:run>'
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
        charPrIDRef="2",
        vertsize=1000, textheight=1000, baseline=850, spacing=600
    )
    problem_paras.append(meta_topic)

    difficulty = prob.get("difficulty", "중")
    meta_diff = make_paragraph(
        content=f'<hp:t>[난이도] {xml_escape(difficulty)}</hp:t>',
        charPrIDRef="2",
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
if "filename_base" in info:
    filename = info["filename_base"] + ".hwpx"
else:
    code = info.get("code", "00000")
    year = info.get("year", "?")
    grade = info.get("grade", "?")
    sem_num = "1" if "1학기" in info.get("semester", "") else "2"
    exam_code = "a" if "중간" in info.get("exam_type", "") else "b"
    region = info.get("region", "")
    school = info.get("school", "")
    subject_code = info.get("subject_code", info.get("subject", ""))
    range_str = info.get("range", "").replace(" ~ ", "~")
    filename = f"[{code}][고][{year}][{grade}-{sem_num}-{exam_code}][{region}][{school}][{subject_code}][{range_str}][{code}].hwpx"

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
    for img_idx in range(3, 9):
        img_path = f'{BASE}/BinData/image{img_idx}.bmp'
        if os.path.exists(img_path):
            zout.write(img_path, f'BinData/image{img_idx}.bmp', compress_type=zipfile.ZIP_DEFLATED)

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
