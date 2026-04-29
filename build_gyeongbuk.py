#!/usr/bin/env python3
"""
경북고 수학II 2025년 1학기 기말 HWPX 빌더
"""

import zipfile
import os
import json
import shutil
from PIL import Image
import io

# ─── 경로 설정 ───────────────────────────────────────────────
BASE = "/mnt/c/NGD/.claude/skills/ngd-exam-create/base_hwpx"
V3CACHE = "/mnt/c/NGD/inputs/시험지 제작/.v3cache"
IMG_DIR = "/mnt/c/NGD/inputs/시험지 제작/question_images"
OUTPUT_DIR = "/mnt/c/NGD/outputs"
SCRIPTS_DIR = "/mnt/c/NGD/.claude/skills/ngd-exam-create/scripts"

OUTPUT_FILE = os.path.join(
    OUTPUT_DIR,
    "[04039][고][2025][2-1-b][대구][경북고][수2][미분법~적분법의활용][04039][AI][미검수][그림4-0-4-0].hwpx"
)

# ─── 문제 데이터 로딩 ────────────────────────────────────────
problems = []
for i in range(1, 21):
    p = json.load(open(f"{V3CACHE}/q{i}_verified.json", encoding="utf-8"))
    problems.append(p)

# ─── 이미지 데이터 (PNG → BMP 변환) ─────────────────────────
# image1.bmp, image2.bmp는 base_hwpx/BinData에서 복사
# image3~image6 = 문제 그림 (fig_q07, fig_q13, fig_q14, fig_q17)
FIG_MAP = {
    7:  ("fig_q07.png", "image3.png"),
    13: ("fig_q13.png", "image4.png"),
    14: ("fig_q14.png", "image5.png"),
    17: ("fig_q17.png", "image6.png"),
}
# img_index[문제번호] = BinData 내 binaryItemIDRef 값
IMG_ITEM_ID = {7: "image3", 13: "image4", 14: "image5", 17: "image6"}

# PNG를 읽어 BMP 바이트로 변환
def png_to_bmp_bytes(png_path):
    img = Image.open(png_path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    return buf.getvalue(), img.width, img.height

# ─── XML 이스케이프 ───────────────────────────────────────────
def xesc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

# ─── 수식 크기 계산 ───────────────────────────────────────────
def eq_size(script):
    """수식 문자열 길이로 대략적인 width 계산"""
    n = len(script)
    # 분수 포함 여부
    if "over" in script or "frac" in script:
        return max(1800, n * 340), 2580, 65
    elif "sqrt" in script or "root" in script:
        return max(1200, n * 340), 1478, 88
    elif "int" in script or "sum" in script or "lim" in script:
        return max(2000, n * 340), 2580, 65
    else:
        return max(600, n * 340), 1125, 85

# ─── 수식 XML 생성 ───────────────────────────────────────────
_eq_counter = [1654899700]  # 전역 ID 카운터
_eq_zorder = [10]

def make_equation(script, is_score=False):
    """수식 XML 문자열 반환"""
    eid = _eq_counter[0]
    _eq_counter[0] += 1
    zo = _eq_zorder[0]
    _eq_zorder[0] += 1

    w, h, bl = eq_size(script)
    if is_score:
        h = 1125
        bl = 85

    escaped = xesc(script)
    return (
        f'<hp:equation id="{eid}" zOrder="{zo}" numberingType="EQUATION" '
        f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
        f'version="Equation Version 60" baseLine="{bl}" textColor="#000000" '
        f'baseUnit="1100" lineMode="CHAR" font="HYhwpEQ">'
        f'<hp:sz width="{w}" widthRelTo="ABSOLUTE" height="{h}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" '
        f'horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="56" right="56" top="0" bottom="0"/>'
        f'<hp:shapeComment>수식입니다.</hp:shapeComment>'
        f'<hp:script>{escaped}</hp:script>'
        f'</hp:equation>'
    )

# ─── linesegarray 결정 ───────────────────────────────────────
def lineseg_for_parts(parts, horzsize=30188, vertpos=0):
    """parts 배열에서 수식 유형을 보고 lineseg 속성 결정"""
    has_frac = any("over" in p.get("eq","") or "frac" in p.get("eq","") or
                   "int" in p.get("eq","") or "sum" in p.get("eq","") for p in parts
                   if "eq" in p and not isinstance(p.get("eq"), bool))
    has_root = any("sqrt" in p.get("eq","") or "root" in p.get("eq","") for p in parts
                   if "eq" in p and not isinstance(p.get("eq"), bool))
    has_eq = any("eq" in p for p in parts if "eq" in p and not isinstance(p.get("eq"), bool))

    if has_frac:
        vs, th, bl = 2580, 2580, 1677
    elif has_root:
        vs, th, bl = 1478, 1478, 1301
    elif has_eq:
        vs, th, bl = 1125, 1125, 956
    else:
        vs, th, bl = 1000, 1000, 850

    return (f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vertpos}" '
            f'vertsize="{vs}" textheight="{th}" baseline="{bl}" spacing="600" '
            f'horzpos="0" horzsize="{horzsize}" flags="393216"/></hp:linesegarray>')

def lineseg_simple(vertsize=1000, textheight=1000, baseline=850, spacing=600, horzsize=30188, vertpos=0):
    return (f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vertpos}" '
            f'vertsize="{vertsize}" textheight="{textheight}" baseline="{baseline}" spacing="{spacing}" '
            f'horzpos="0" horzsize="{horzsize}" flags="393216"/></hp:linesegarray>')

# ─── parts → XML 변환 ────────────────────────────────────────
def parts_to_xml(parts, char_pr=7):
    """parts 배열을 <hp:run> 안의 XML로 변환"""
    xml = f'<hp:run charPrIDRef="{char_pr}">'
    for p in parts:
        if "br" in p:
            continue  # br는 문단 분리 시 처리
        elif "eq" in p:
            xml += make_equation(p["eq"])
        elif "t" in p:
            txt = p["t"].replace("\n", "")  # 줄바꿈 제거
            if txt:
                xml += f'<hp:t>{xesc(txt)}</hp:t>'
    xml += '</hp:run>'
    return xml

def parts_to_paragraphs(parts, para_pr=1, char_pr=7, horzsize=30188):
    """br를 기준으로 여러 <hp:p> 문단으로 분리"""
    paragraphs = []
    current = []
    for p in parts:
        if "br" in p and p.get("br"):
            paragraphs.append(current)
            current = []
        else:
            current.append(p)
    if current:
        paragraphs.append(current)

    result = []
    for i, seg in enumerate(paragraphs):
        if not seg:  # 빈 세그먼트
            continue
        pid = "2147483648" if i == 0 else "0"
        run_xml = f'<hp:run charPrIDRef="{char_pr}">'
        for p in seg:
            if "eq" in p:
                run_xml += make_equation(p["eq"])
            elif "t" in p:
                txt = p["t"].replace("\n", "")
                if txt:
                    run_xml += f'<hp:t>{xesc(txt)}</hp:t>'
        run_xml += '</hp:run>'
        lsa = lineseg_for_parts(seg, horzsize=horzsize)
        result.append(
            f'<hp:p id="{pid}" paraPrIDRef="{para_pr}" styleIDRef="0" '
            f'pageBreak="0" columnBreak="0" merged="0">'
            f'{run_xml}{lsa}</hp:p>'
        )
    return result

# ─── 빈 문단 ─────────────────────────────────────────────────
def empty_para(vertpos=0, horzsize=30188, pid="0"):
    return (f'<hp:p id="{pid}" paraPrIDRef="1" styleIDRef="0" '
            f'pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="7"/>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{vertpos}" '
            f'vertsize="1000" textheight="1000" baseline="850" spacing="600" '
            f'horzpos="0" horzsize="{horzsize}" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def colbreak_para():
    return ('<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
            'pageBreak="0" columnBreak="1" merged="0">'
            '<hp:run charPrIDRef="7"/>'
            '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
            'vertsize="1000" textheight="1000" baseline="850" spacing="600" '
            'horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
            '</hp:p>')

def pagebreak_para():
    return ('<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
            'pageBreak="1" columnBreak="0" merged="0">'
            '<hp:run charPrIDRef="7"/>'
            '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
            'vertsize="1000" textheight="1000" baseline="850" spacing="600" '
            'horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
            '</hp:p>')

# ─── 메타 문단 ───────────────────────────────────────────────
def meta_para(subtopic, difficulty):
    jungtopic = (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="4"><hp:t>[중단원] {xesc(subtopic)}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
        f'vertsize="1000" textheight="1000" baseline="850" spacing="600" '
        f'horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )
    nanido = (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="4"><hp:t>[난이도] {xesc(difficulty)}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
        f'vertsize="1000" textheight="1000" baseline="850" spacing="600" '
        f'horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )
    return jungtopic + nanido

# ─── 이미지 삽입 문단 ─────────────────────────────────────────
def pic_para(binary_item_id, org_w, org_h):
    """CENTER 정렬 이미지 문단 (문제 그림)"""
    # 최대 폭 29622 (단 폭 절반), 비율 유지
    max_w = 29622
    ratio = min(max_w / org_w, max_w / org_h) if org_h > 0 else 1.0
    cur_w = int(org_w * ratio)
    cur_h = int(org_h * ratio)

    eid = _eq_counter[0]
    _eq_counter[0] += 1
    zo = _eq_zorder[0]
    _eq_zorder[0] += 1
    inst = 581157820 + zo

    return (
        f'<hp:p id="2147483648" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="7">'
        f'<hp:pic id="{eid}" zOrder="{zo}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="{inst}" reverse="0">'
        f'<hp:offset x="0" y="0"/>'
        f'<hp:orgSz width="{org_w}" height="{org_h}"/>'
        f'<hp:curSz width="{cur_w}" height="{cur_h}"/>'
        f'<hp:flip horizontal="0" vertical="0"/>'
        f'<hp:rotationInfo angle="0" centerX="{cur_w//2}" centerY="{cur_h//2}" rotateimage="1"/>'
        f'<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        f'<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        f'<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
        f'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="{org_w}" y="0"/>'
        f'<hc:pt2 x="{org_w}" y="{org_h}"/><hc:pt3 x="0" y="{org_h}"/></hp:imgRect>'
        f'<hp:imgClip left="0" right="{org_w}" top="0" bottom="{org_h}"/>'
        f'<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
        f'<hp:imgDim dimwidth="{org_w}" dimheight="{org_h}"/>'
        f'<hc:img binaryItemIDRef="{binary_item_id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
        f'<hp:effects/>'
        f'<hp:sz width="{cur_w}" widthRelTo="ABSOLUTE" height="{cur_h}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
        f'<hp:shapeComment>그림입니다.</hp:shapeComment>'
        f'</hp:pic><hp:t/></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
        f'vertsize="{cur_h}" textheight="{cur_h}" baseline="{int(cur_h*0.85)}" spacing="600" '
        f'horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )

# ─── 배점 수식 (선택형 인라인) ────────────────────────────────
def score_eq_inline(score_str):
    """[X.X점] 인라인 배점 XML"""
    return (
        f'<hp:t>[</hp:t>'
        f'{make_equation(score_str, is_score=True)}'
        f'<hp:t>점]</hp:t>'
    )

# ─── endNote XML ─────────────────────────────────────────────
_endnote_inst = [1654899642]

def make_endnote(number, answer_str, explanation_parts):
    """endNote XML 생성"""
    inst_id = _endnote_inst[0]
    _endnote_inst[0] += 1

    # 정답 문단
    answer_para = (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="5">'
        f'<hp:ctrl><hp:autoNum num="{number}" numType="ENDNOTE">'
        f'<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="." supscript="0"/>'
        f'</hp:autoNum></hp:ctrl>'
        f'</hp:run>'
        f'<hp:run charPrIDRef="7"><hp:t> [정답] {xesc(answer_str)}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1200" textheight="1200" baseline="1020" spacing="720" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )

    # 해설 문단들
    expl_paras = "".join(parts_to_paragraphs(explanation_parts))

    return (
        f'<hp:ctrl><hp:endNote number="{number}" suffixChar="46" instId="{inst_id}">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" '
        f'hasTextRef="0" hasNumRef="0">'
        f'{answer_para}{expl_paras}'
        f'</hp:subList>'
        f'</hp:endNote></hp:ctrl>'
    )

# ─── 선지 XML ────────────────────────────────────────────────
def make_choices_xml(choices):
    """5개 선지를 XML 문단으로 변환"""
    # 선지가 짧은 수식만인지 확인
    def choice_parts_to_run(label, parts):
        inner = f'<hp:t>{xesc(label)} </hp:t>'
        for p in parts:
            if "eq" in p:
                inner += make_equation(p["eq"])
            elif "t" in p:
                txt = p["t"]
                if txt:
                    inner += f'<hp:t>{xesc(txt)}</hp:t>'
        return inner

    def tab3():
        return ('<hp:t><hp:tab width="1200" leader="0" type="1"/>'
                '<hp:tab width="4000" leader="0" type="1"/>'
                '<hp:tab width="4000" leader="0" type="1"/></hp:t>')

    # 선지가 모두 짧은 수식이면 3+2 패턴
    all_short = all(
        len(c) == 1 and "eq" in c[0] and len(c[0]["eq"]) < 20
        for c in choices
    )

    if all_short:
        # 3+2 패턴
        labels = ["①", "②", "③", "④", "⑤"]
        # 첫 줄: ①②③
        line1 = '<hp:run charPrIDRef="7">'
        line1 += choice_parts_to_run(labels[0], choices[0])
        line1 += tab3()
        line1 += choice_parts_to_run(labels[1], choices[1])
        line1 += tab3()
        line1 += choice_parts_to_run(labels[2], choices[2])
        line1 += '</hp:run>'

        lsa1 = lineseg_for_parts(choices[0] + choices[1] + choices[2])
        p1 = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
              f'pageBreak="0" columnBreak="0" merged="0">{line1}{lsa1}</hp:p>')

        # 두 번째 줄: ④⑤
        line2 = '<hp:run charPrIDRef="7">'
        line2 += choice_parts_to_run(labels[3], choices[3])
        line2 += tab3()
        line2 += choice_parts_to_run(labels[4], choices[4])
        line2 += '</hp:run>'

        lsa2 = lineseg_for_parts(choices[3] + choices[4])
        p2 = (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
              f'pageBreak="0" columnBreak="0" merged="0">{line2}{lsa2}</hp:p>')

        return p1 + p2
    else:
        # 개별 선지
        labels = ["①", "②", "③", "④", "⑤"]
        result = ""
        for i, c in enumerate(choices):
            run = f'<hp:run charPrIDRef="7">'
            run += choice_parts_to_run(labels[i], c)
            run += tab3()
            run += '</hp:run>'
            lsa = lineseg_for_parts(c)
            result += (f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
                       f'pageBreak="0" columnBreak="0" merged="0">{run}{lsa}</hp:p>')
        return result

# ─── 보기 테이블 (bogi/condition_box) ────────────────────────
_rect_id_counter = [500000]
_rect_inst_counter = [900000]

def make_bogi_box(items):
    """< 보 기 > 형식 테이블 (ㄱ/ㄴ/ㄷ 또는 (가)/(나)/(다))"""
    # 간단한 rect 박스로 구현
    content = ""
    for item in items:
        label = item["label"]
        parts = item["parts"]
        run = f'<hp:run charPrIDRef="7"><hp:t>{xesc(label)}. </hp:t>'
        for p in parts:
            if "eq" in p:
                run += make_equation(p["eq"])
            elif "t" in p:
                txt = p["t"]
                if txt:
                    run += f'<hp:t>{xesc(txt)}</hp:t>'
        run += '</hp:run>'

        has_eq = any("eq" in p for p in parts)
        vs = 1125 if has_eq else 1000
        th = vs
        bl = 956 if has_eq else 850

        content += (
            f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
            f'pageBreak="0" columnBreak="0" merged="0">'
            f'{run}'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
            f'vertsize="{vs}" textheight="{th}" baseline="{bl}" spacing="600" '
            f'horzpos="0" horzsize="27737" flags="393216"/></hp:linesegarray>'
            f'</hp:p>'
        )

    n = len(items)
    height = n * 1600 + 2000
    center_y = height // 2
    sca_y_val = height / 12587

    rid = _rect_id_counter[0]
    _rect_id_counter[0] += 1
    inst = _rect_inst_counter[0]
    _rect_inst_counter[0] += 1
    zo = _eq_zorder[0]
    _eq_zorder[0] += 1

    # 보기 헤더 추가
    header_content = (
        f'<hp:p id="2147483648" paraPrIDRef="2" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="0"><hp:t>&lt; 보 기 &gt;</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="27737" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )
    full_content = header_content + content

    rect = (
        f'<hp:rect id="{rid}" zOrder="{zo}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="{inst}" ratio="0">'
        f'<hp:offset x="0" y="0"/>'
        f'<hp:orgSz width="28644" height="12587"/>'
        f'<hp:curSz width="29437" height="{height}"/>'
        f'<hp:flip horizontal="0" vertical="0"/>'
        f'<hp:rotationInfo angle="0" centerX="14718" centerY="{center_y}" rotateimage="1"/>'
        f'<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        f'<hc:scaMatrix e1="1.027685" e2="0" e3="0" e4="0" e5="{sca_y_val:.6f}" e6="0"/>'
        f'<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
        f'<hp:lineShape color="#000000" width="113" style="SOLID" endCap="FLAT" '
        f'headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" '
        f'headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
        f'<hc:fillBrush><hc:winBrush faceColor="#FFFFFF" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
        f'<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
        f'<hp:drawText lastWidth="29437" name="" editable="0">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'{full_content}'
        f'</hp:subList><hp:textMargin left="850" right="850" top="850" bottom="850"/>'
        f'</hp:drawText>'
        f'<hc:pt0 x="0" y="0"/><hc:pt1 x="28644" y="0"/>'
        f'<hc:pt2 x="28644" y="12587"/><hc:pt3 x="0" y="12587"/>'
        f'<hp:sz width="29437" widthRelTo="ABSOLUTE" height="{height}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
        f'vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="0" right="0" top="709" bottom="709"/>'
        f'</hp:rect>'
    )

    lsa = lineseg_simple(vertsize=height, textheight=height, baseline=int(height*0.85))
    return (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="7">{rect}<hp:t/></hp:run>'
        f'{lsa}</hp:p>'
    )

def make_condition_box(items):
    """조건 박스 (가)/(나)/(다) - rect 스타일"""
    content = ""
    for item in items:
        label = item["label"]
        parts = item["parts"]
        run = f'<hp:run charPrIDRef="7"><hp:t>{xesc(label)} </hp:t>'
        for p in parts:
            if "eq" in p:
                run += make_equation(p["eq"])
            elif "t" in p:
                txt = p["t"]
                if txt:
                    run += f'<hp:t>{xesc(txt)}</hp:t>'
        run += '</hp:run>'

        has_eq = any("eq" in p for p in parts)
        vs = 1125 if has_eq else 1000
        th = vs
        bl = 956 if has_eq else 850

        content += (
            f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
            f'pageBreak="0" columnBreak="0" merged="0">'
            f'{run}'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" '
            f'vertsize="{vs}" textheight="{th}" baseline="{bl}" spacing="600" '
            f'horzpos="0" horzsize="27737" flags="393216"/></hp:linesegarray>'
            f'</hp:p>'
        )

    n = len(items)
    height = n * 1600 + 2000
    center_y = height // 2
    sca_y_val = height / 12587

    rid = _rect_id_counter[0]
    _rect_id_counter[0] += 1
    inst = _rect_inst_counter[0]
    _rect_inst_counter[0] += 1
    zo = _eq_zorder[0]
    _eq_zorder[0] += 1

    rect = (
        f'<hp:rect id="{rid}" zOrder="{zo}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="{inst}" ratio="0">'
        f'<hp:offset x="0" y="0"/>'
        f'<hp:orgSz width="28644" height="12587"/>'
        f'<hp:curSz width="29437" height="{height}"/>'
        f'<hp:flip horizontal="0" vertical="0"/>'
        f'<hp:rotationInfo angle="0" centerX="14718" centerY="{center_y}" rotateimage="1"/>'
        f'<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        f'<hc:scaMatrix e1="1.027685" e2="0" e3="0" e4="0" e5="{sca_y_val:.6f}" e6="0"/>'
        f'<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
        f'<hp:lineShape color="#000000" width="113" style="SOLID" endCap="FLAT" '
        f'headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" '
        f'headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
        f'<hc:fillBrush><hc:winBrush faceColor="#FFFFFF" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
        f'<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
        f'<hp:drawText lastWidth="29437" name="" editable="0">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'{content}'
        f'</hp:subList><hp:textMargin left="850" right="850" top="850" bottom="850"/>'
        f'</hp:drawText>'
        f'<hc:pt0 x="0" y="0"/><hc:pt1 x="28644" y="0"/>'
        f'<hc:pt2 x="28644" y="12587"/><hc:pt3 x="0" y="12587"/>'
        f'<hp:sz width="29437" widthRelTo="ABSOLUTE" height="{height}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
        f'vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="0" right="0" top="709" bottom="709"/>'
        f'</hp:rect>'
    )

    lsa = lineseg_simple(vertsize=height, textheight=height, baseline=int(height*0.85))
    return (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="7">{rect}<hp:t/></hp:run>'
        f'{lsa}</hp:p>'
    )

# ─── 선택형 문제 XML ─────────────────────────────────────────
def build_choice_problem(prob, img_data=None):
    """선택형 문제 전체 XML 블록"""
    number = prob["number"]
    parts = prob["parts"]
    score = prob["score"]
    choices = prob["choices"]
    answer = prob["answer"]
    subtopic = prob["subtopic"]
    difficulty = prob["difficulty"]
    explanation_parts = prob.get("explanation_parts", [])
    condition_box = prob.get("condition_box")

    # 배점이 이미 parts에 포함되어 있는지 확인 (점] 텍스트가 있으면)
    has_score_in_parts = any("점]" in p.get("t", "") for p in parts)

    # 문제 본문 run 구성
    problem_run = f'<hp:run charPrIDRef="7">'

    # endNote 마커는 run 안에 포함
    problem_run += make_endnote(number, answer, explanation_parts)

    for p in parts:
        if "br" in p:
            continue
        elif "eq" in p:
            problem_run += make_equation(p["eq"])
        elif "t" in p:
            txt = p["t"].replace("\n", " ")
            if txt.strip():
                problem_run += f'<hp:t>{xesc(txt)}</hp:t>'

    # 배점 (parts에 없으면 추가)
    if not has_score_in_parts:
        problem_run += score_eq_inline(score)

    problem_run += '</hp:run>'

    lsa = lineseg_for_parts(parts)
    problem_para = (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'{problem_run}{lsa}</hp:p>'
    )

    result = problem_para
    result += empty_para()

    # 그림 (condition_box 전에)
    if img_data:
        result += pic_para(img_data["item_id"], img_data["width"], img_data["height"])
        result += empty_para()

    # 보기/조건 박스
    if condition_box:
        box_type = condition_box.get("type", "bogi")
        items = condition_box.get("items", [])
        if box_type == "bogi":
            result += make_bogi_box(items)
        elif box_type == "condition":
            result += make_condition_box(items)
        result += empty_para()

    # 선지
    result += make_choices_xml(choices)

    # 메타
    result += meta_para(subtopic, difficulty)

    # 문제 간 빈줄 15개
    for _ in range(15):
        result += empty_para()

    return result

# ─── 서술형 문제 XML ─────────────────────────────────────────
def build_essay_problem(prob, img_data=None):
    """서술형 문제 전체 XML 블록"""
    number = prob["number"]
    parts = prob["parts"]
    score = prob["score"]
    answer = prob.get("answer", "")
    subtopic = prob["subtopic"]
    difficulty = prob["difficulty"]
    explanation_parts = prob.get("explanation_parts", [])
    condition_box = prob.get("condition_box")

    # 서답형 번호 (17번이 서술형 1, 18이 2, 19가 3, 20이 4)
    essay_num = number - 16  # 17→1, 18→2, 19→3, 20→4

    # ※ 안내문 (첫 서술형에만)
    result = ""
    if number == 17:
        result += (
            f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="7"><hp:t>※ 여기서 부터는 서답형 문제입니다.</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
            f'</hp:p>'
        )
        result += empty_para()

    # [서술형 N] 라벨
    result += (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="7"><hp:t>[서술형 {essay_num}]</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )

    # 문제 본문 run
    problem_run = f'<hp:run charPrIDRef="7">'
    problem_run += make_endnote(number, answer if answer else "풀이참조", explanation_parts)

    for p in parts:
        if "br" in p:
            continue
        elif "eq" in p:
            problem_run += make_equation(p["eq"])
        elif "t" in p:
            txt = p["t"].replace("\n", " ")
            if txt.strip():
                problem_run += f'<hp:t>{xesc(txt)}</hp:t>'
    problem_run += '</hp:run>'

    lsa = lineseg_for_parts(parts)
    result += (
        f'<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'{problem_run}{lsa}</hp:p>'
    )

    result += empty_para()

    # 그림
    if img_data:
        result += pic_para(img_data["item_id"], img_data["width"], img_data["height"])
        result += empty_para()

    # 조건 박스
    if condition_box:
        box_type = condition_box.get("type", "bogi")
        items = condition_box.get("items", [])
        if box_type == "bogi":
            result += make_bogi_box(items)
        elif box_type == "condition":
            result += make_condition_box(items)
        result += empty_para()

    # 배점 (RIGHT 정렬)
    score_run = (
        f'<hp:run charPrIDRef="7">'
        f'<hp:t>[</hp:t>'
        f'{make_equation(score, is_score=True)}'
        f'<hp:t>점]</hp:t>'
        f'</hp:run>'
    )
    result += (
        f'<hp:p id="2147483648" paraPrIDRef="4" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'{score_run}'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1125" textheight="1125" baseline="956" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )

    # 메타
    result += meta_para(subtopic, difficulty)

    # 빈줄 15개
    for _ in range(15):
        result += empty_para()

    return result

# ─── 이미지 데이터 준비 ──────────────────────────────────────
img_bmp_data = {}  # {binaryItemIDRef: (bmp_bytes, w, h)}

for prob_num, (png_name, _) in FIG_MAP.items():
    png_path = os.path.join(IMG_DIR, png_name)
    item_id = IMG_ITEM_ID[prob_num]
    bmp_bytes, w, h = png_to_bmp_bytes(png_path)
    img_bmp_data[item_id] = (bmp_bytes, w, h)
    print(f"  이미지 로드: {png_name} → {item_id} ({w}x{h})")

# ─── section0.xml 조립 ──────────────────────────────────────
print("section0.xml 조립 중...")

# 헤더 템플릿 로드 및 치환
header_template = open(f"{BASE}/header_area_template.xml", encoding="utf-8").read()
header_xml = header_template.replace("{{YEAR_SEMESTER}}", "2025년 1학기 기말")
header_xml = header_xml.replace("{{SCHOOL_NAME}}", "경북 고등학교")
header_xml = header_xml.replace("{{GRADE_SUBJECT}}", "2학년 수학 II")
header_xml = header_xml.replace("{{RANGE}}", "미분법 ~ 적분법의 활용")
header_xml = header_xml.replace("{{CREATED_DATE}}", "2026년 4월 19일")

# 0번 미주 (빈)
endnote0 = (
    '<hp:ctrl><hp:endNote number="0" suffixChar="46" instId="1654899641">'
    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" '
    'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" '
    'hasTextRef="0" hasNumRef="0">'
    '<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="7"/>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="30188" flags="393216"/></hp:linesegarray>'
    '</hp:p>'
    '</hp:subList></hp:endNote></hp:ctrl>'
)

# 첫 run에 endnote0 삽입 (header_xml의 첫 run에 secPr와 colPr 다음)
# header_xml은 이미 p[0]를 포함하므로, endnote0을 적절한 위치에 삽입
# header_xml에서 </hp:ctrl></hp:run> (colPr 닫힘) 이후 run[1] 앞에 삽입
# 실제로 header_area_template.xml의 구조: run[0] = secPr+colPr, run[1] = footer+header+tbl
# endnote0은 run[0]의 colPr 다음에 추가해야 함
# 간단히: run[0]의 </hp:run> 직전에 endnote0 추가

# header_xml에서 첫 </hp:run> 찾아서 바로 앞에 endnote0 삽입
FIRST_RUN_END = '</hp:ctrl></hp:run><hp:run charPrIDRef="7"><hp:ctrl><hp:footer'
header_xml = header_xml.replace(
    FIRST_RUN_END,
    f'{endnote0}</hp:ctrl></hp:run><hp:run charPrIDRef="7"><hp:ctrl><hp:footer'
)

# 전체 section0.xml 내용 구성
section_parts = [header_xml]  # p[0] 포함

# 레이아웃: 20문제, 4문제/페이지 (좌2+우2), 5페이지
# 문제 1-4: 페이지1 (1,2: 좌, 3,4: 우)
# 문제 5-8: 페이지2
# ...
# 문제 17-20: 페이지5 (서술형)

# 이미지 데이터 준비
def get_img_data(prob_num):
    item_id = IMG_ITEM_ID.get(prob_num)
    if item_id and item_id in img_bmp_data:
        _, w, h = img_bmp_data[item_id]
        return {"item_id": item_id, "width": w, "height": h}
    return None

# 문제 생성
for i, prob in enumerate(problems):
    num = prob["number"]
    is_essay = prob["type"] == "essay"
    img_data = get_img_data(num)

    if is_essay:
        block = build_essay_problem(prob, img_data)
    else:
        block = build_choice_problem(prob, img_data)

    section_parts.append(block)

    # 레이아웃 브레이크
    # 선택형 16문제: 4문제씩 페이지, 2문제씩 단
    # 서술형 4문제: 각각 한 단씩
    if not is_essay:
        pos_in_page = (num - 1) % 4  # 0,1=좌, 2,3=우
        if pos_in_page == 1:  # 2번째 문제 후 → 단 바꿈
            section_parts.append(colbreak_para())
        elif pos_in_page == 3:  # 4번째 문제 후 → 페이지 바꿈
            if num < 16:  # 16번 이후 서술형 전환
                section_parts.append(pagebreak_para())
    else:
        # 서술형: 17, 18 → 좌, 19, 20 → 우
        essay_pos = num - 17  # 0=17, 1=18, 2=19, 3=20
        if essay_pos == 1:  # 18번 후 → 단 바꿈
            section_parts.append(colbreak_para())
        elif essay_pos == 3:  # 마지막
            pass  # 끝

# 16번과 17번 사이 (서술형 시작 전 페이지 브레이크)
# 이미 build_essay_problem에서 ※ 안내문을 넣었으므로, 15번 선택형 후
# pos_in_page=3이 되어 pagebreak가 삽입됨

# ─── 최종 section0 XML ───────────────────────────────────────
# header_area_template.xml은 <hs:sec ...> 로 시작하므로
# 그 자체가 루트 요소 시작임. 닫는 태그 </hs:sec>만 추가.
# <?xml ...?> 선언 + header_xml (이미 <hs:sec> 포함) + 나머지 parts + </hs:sec>
body_content = "".join(section_parts[1:])  # header_xml 이후의 문제 블록들
# header_xml은 이미 <hs:sec ...>로 시작하며, 끝에 닫는 태그 없음
section_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'
    + header_xml
    + body_content
    + '</hs:sec>'
)

print(f"  section0.xml 크기: {len(section_xml):,} bytes")

# ─── content.hpf 생성 ────────────────────────────────────────
hpf_template = open(f"{BASE}/content_hpf_template.xml", encoding="utf-8").read()

extra_images = ""
for item_id in ["image3", "image4", "image5", "image6"]:
    ext = "bmp"
    media_type = "image/bmp"
    extra_images += (
        f'<opf:item id="{item_id}" href="BinData/{item_id}.{ext}" '
        f'media-type="{media_type}" isEmbeded="1"/>'
    )

hpf_xml = hpf_template.replace("{{MODIFIED_DATE}}", "2026-04-19T09:00:00Z")
hpf_xml = hpf_xml.replace("{{EXTRA_IMAGES}}", extra_images)

# ─── PrvText.txt ─────────────────────────────────────────────
prv_text = "경북고등학교 2025년 1학기 기말 2학년 수학 II"

# ─── HWPX ZIP 조립 ───────────────────────────────────────────
print("HWPX ZIP 조립 중...")

with zipfile.ZipFile(OUTPUT_FILE, 'w') as zout:
    # STORED
    zout.write(f'{BASE}/mimetype', 'mimetype', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/version.xml', 'version.xml', compress_type=zipfile.ZIP_STORED)

    # DEFLATED
    zout.write(f'{BASE}/Contents/header.xml', 'Contents/header.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image1.bmp', 'BinData/image1.bmp', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Contents/masterpage0.xml', 'Contents/masterpage0.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/BinData/image2.bmp', 'BinData/image2.bmp', compress_type=zipfile.ZIP_DEFLATED)

    # 문제 그림 이미지 (BMP)
    for item_id in ["image3", "image4", "image5", "image6"]:
        bmp_bytes, w, h = img_bmp_data[item_id]
        zout.writestr(f'BinData/{item_id}.bmp', bmp_bytes, compress_type=zipfile.ZIP_DEFLATED)

    # 생성 파일
    zout.writestr('Contents/section0.xml', section_xml.encode('utf-8'), compress_type=zipfile.ZIP_DEFLATED)
    zout.writestr('Preview/PrvText.txt', prv_text.encode('utf-8'), compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/settings.xml', 'settings.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/Preview/PrvImage.png', 'Preview/PrvImage.png', compress_type=zipfile.ZIP_STORED)
    zout.write(f'{BASE}/META-INF/container.rdf', 'META-INF/container.rdf', compress_type=zipfile.ZIP_DEFLATED)
    zout.writestr('Contents/content.hpf', hpf_xml.encode('utf-8'), compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/container.xml', 'META-INF/container.xml', compress_type=zipfile.ZIP_DEFLATED)
    zout.write(f'{BASE}/META-INF/manifest.xml', 'META-INF/manifest.xml', compress_type=zipfile.ZIP_DEFLATED)

print(f"  HWPX 생성 완료: {OUTPUT_FILE}")
print(f"  파일 크기: {os.path.getsize(OUTPUT_FILE):,} bytes")
