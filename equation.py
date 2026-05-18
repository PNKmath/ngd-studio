#!/usr/bin/env python3
"""
NGD HWPX Builder — Equation XML generation

Import direction: ids → equation → shapes → tables → assemble → build_hwpx
"""

import re
from ids import next_eq_id, next_zorder


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


_HWP_EQ_MARKERS = ['over', 'sqrt', 'left(', 'right)', 'int_', 'sum_', 'LSUB', 'LSUP', 'cdot', 'leq', 'geq']


def _is_hwp_eq_string(s):
    s = str(s)
    return ('{' in s and any(m in s for m in _HWP_EQ_MARKERS)) or ('^' in s and ('{' in s or 'x' in s))
