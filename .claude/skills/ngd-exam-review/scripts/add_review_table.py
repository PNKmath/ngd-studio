#!/usr/bin/env python3
"""
편집오검 내역표 두 번째 테이블 생성 및 삽입 스크립트.

사용법:
    python add_review_table.py <hwpx_path> [항목1:해당번호1] [항목2:해당번호2] ...

예시:
    # 추가 수정사항이 있는 경우
    python add_review_table.py output.hwpx "left,right 추가:17" "단위 앞 쉼표 추가:20"

    # 이상 없는 경우
    python add_review_table.py output.hwpx --no-issues
"""

import sys
import os
import re
import zipfile


def extract_style_refs(xml_text):
    """첫 번째 편집오검 내역표에서 스타일 참조값을 추출한다."""
    idx = xml_text.find("편집오검")
    if idx < 0:
        raise ValueError("편집오검 내역표를 찾을 수 없습니다")

    tbl_start = xml_text.rfind("<hp:tbl", 0, idx)
    tbl_end = xml_text.find("</hp:tbl>", tbl_start) + len("</hp:tbl>")
    tbl = xml_text[tbl_start:tbl_end]

    # 테이블 레벨
    tbl_bfid = re.search(r'<hp:tbl[^>]*borderFillIDRef="(\d+)"', tbl).group(1)

    # 헤더 행
    header_end = tbl.find("</hp:tr>")
    header = tbl[:header_end]
    header_tcs = re.findall(r'borderFillIDRef="(\d+)"', header)
    header_charpr = re.findall(r'charPrIDRef="(\d+)"', header)
    header_parapr = re.findall(r'paraPrIDRef="(\d+)"', header)

    # 일반 데이터 행 (2번째 행)
    row1_start = tbl.find("<hp:tr>", header_end)
    row1_end = tbl.find("</hp:tr>", row1_start)
    row1 = tbl[row1_start:row1_end]
    row1_bfids = re.findall(r'borderFillIDRef="(\d+)"', row1)
    row1_charpr = re.findall(r'charPrIDRef="(\d+)"', row1)
    row1_parapr = re.findall(r'paraPrIDRef="(\d+)"', row1)

    # 마지막 행 (하단 테두리)
    last_row_start = tbl.rfind("<hp:tr>")
    last_row = tbl[last_row_start:]
    last_row_bfids = re.findall(r'borderFillIDRef="(\d+)"', last_row)

    return {
        "tbl_bfid": tbl_bfid,
        "header_bfid_left": header_tcs[0] if len(header_tcs) > 0 else "4",
        "header_bfid_right": header_tcs[1] if len(header_tcs) > 1 else "4",
        "header_charpr": header_charpr[0] if header_charpr else "1",
        "header_parapr": header_parapr[0] if header_parapr else "3",
        "data_bfid": row1_bfids[1] if len(row1_bfids) > 1 else "4",
        "data_bfid_right": row1_bfids[2] if len(row1_bfids) > 2 else "4",
        "data_charpr": row1_charpr[0] if row1_charpr else "1",
        "data_parapr": row1_parapr[0] if row1_parapr else "0",
        "last_bfid_left": last_row_bfids[0] if len(last_row_bfids) > 0 else "4",
        "last_bfid_mid": last_row_bfids[1] if len(last_row_bfids) > 1 else "4",
        "last_bfid_right": last_row_bfids[2] if len(last_row_bfids) > 2 else "4",
    }


def make_header_row(refs):
    """편집오검 내역표 헤더 행 XML"""
    return (
        '<hp:tr>'
        '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + refs["header_bfid_left"] + '">' 
        '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        '<hp:p id="2147483648" paraPrIDRef="' + refs["header_parapr"] + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="' + refs["header_charpr"] + '"><hp:t>편집오검 내역표</hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="18728" flags="393216"/></hp:linesegarray>'
        '</hp:p></hp:subList>'
        '<hp:cellAddr colAddr="0" rowAddr="0"/>'
        '<hp:cellSpan colSpan="1" rowSpan="1"/>'
        '<hp:cellSz width="19748" height="1842"/>'
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        '</hp:tc>'
        '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + refs["header_bfid_right"] + '">'
        '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        '<hp:p id="2147483648" paraPrIDRef="' + refs["header_parapr"] + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="' + refs["header_charpr"] + '"><hp:t>해당번호</hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="8852" flags="393216"/></hp:linesegarray>'
        '</hp:p></hp:subList>'
        '<hp:cellAddr colAddr="1" rowAddr="0"/>'
        '<hp:cellSpan colSpan="1" rowSpan="1"/>'
        '<hp:cellSz width="9874" height="1842"/>'
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        '</hp:tc>'
        '</hp:tr>'
    )


def make_data_row(refs, row_idx, description, numbers, is_last=False):
    """데이터 행 XML (설명 | 해당번호)"""
    bfid_left = refs["last_bfid_left"] if is_last else refs["data_bfid"]
    bfid_right = refs["last_bfid_right"] if is_last else refs["data_bfid_right"]
    return (
        '<hp:tr>'
        '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + bfid_left + '">'
        '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        '<hp:p id="2147483648" paraPrIDRef="' + refs["data_parapr"] + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="' + refs["data_charpr"] + '"><hp:t>' + description + '</hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="16744" flags="393216"/></hp:linesegarray>'
        '</hp:p></hp:subList>'
        '<hp:cellAddr colAddr="0" rowAddr="' + str(row_idx) + '"/>'
        '<hp:cellSpan colSpan="1" rowSpan="1"/>'
        '<hp:cellSz width="19748" height="1275"/>'
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        '</hp:tc>'
        '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + bfid_right + '">'
        '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        '<hp:p id="2147483648" paraPrIDRef="' + refs["data_parapr"] + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="' + refs["data_charpr"] + '"><hp:t>' + numbers + '</hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="8852" flags="393216"/></hp:linesegarray>'
        '</hp:p></hp:subList>'
        '<hp:cellAddr colAddr="1" rowAddr="' + str(row_idx) + '"/>'
        '<hp:cellSpan colSpan="1" rowSpan="1"/>'
        '<hp:cellSz width="9874" height="1275"/>'
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        '</hp:tc>'
        '</hp:tr>'
    )


def make_no_issues_row(refs, row_idx):
    """이상 없습니다 행 (colspan=2)"""
    bfid = refs["last_bfid_left"]
    return (
        '<hp:tr>'
        '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + bfid + '">'
        '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        '<hp:p id="2147483648" paraPrIDRef="' + refs["data_parapr"] + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        '<hp:run charPrIDRef="' + refs["data_charpr"] + '"><hp:t>이상 없습니다 수고하셨습니다</hp:t></hp:run>'
        '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="28600" flags="393216"/></hp:linesegarray>'
        '</hp:p></hp:subList>'
        '<hp:cellAddr colAddr="0" rowAddr="' + str(row_idx) + '"/>'
        '<hp:cellSpan colSpan="2" rowSpan="1"/>'
        '<hp:cellSz width="29622" height="1275"/>'
        '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        '</hp:tc>'
        '</hp:tr>'
    )


def build_second_table(refs, items=None):
    """두 번째 편집오검 내역표 XML 생성.
    
    items: [("설명", "해당번호"), ...] 또는 None(이상없음)
    """
    if items:
        row_cnt = 1 + len(items)  # header + data rows
        height = 1842 + 1275 * len(items)
    else:
        row_cnt = 2  # header + no-issues row
        height = 1842 + 1275

    tbl_header = (
        '<hp:tbl id="0" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
        'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" '
        'repeatHeader="1" rowCnt="' + str(row_cnt) + '" colCnt="2" cellSpacing="0" '
        'borderFillIDRef="' + refs["tbl_bfid"] + '" noAdjust="0">'
        '<hp:sz width="29622" widthRelTo="ABSOLUTE" height="' + str(height) + '" '
        'heightRelTo="ABSOLUTE" protect="0"/>'
        '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" '
        'horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        '<hp:outMargin left="0" right="0" top="284" bottom="284"/>'
        '<hp:inMargin left="510" right="510" top="141" bottom="141"/>'
    )

    rows_xml = make_header_row(refs)

    if items:
        for i, (desc, nums) in enumerate(items):
            is_last = (i == len(items) - 1)
            rows_xml += make_data_row(refs, i + 1, desc, nums, is_last=is_last)
    else:
        rows_xml += make_no_issues_row(refs, 1)

    return tbl_header + rows_xml + "</hp:tbl>"


def insert_second_table(xml_text, items=None):
    """section0.xml에 두 번째 편집오검 내역표를 삽입한다."""
    refs = extract_style_refs(xml_text)

    # 첫 번째 편집오검 테이블 끝 위치 찾기
    idx = xml_text.find("편집오검")
    tbl_end_pos = xml_text.find("</hp:tbl>", idx) + len("</hp:tbl>")

    table_xml = build_second_table(refs, items)

    # </hp:tbl> 바로 뒤에 삽입
    return xml_text[:tbl_end_pos] + table_xml + xml_text[tbl_end_pos:]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    hwpx_path = sys.argv[1]

    if "--no-issues" in sys.argv:
        items = None
    else:
        items = []
        for arg in sys.argv[2:]:
            if ":" in arg:
                desc, nums = arg.rsplit(":", 1)
                items.append((desc, nums))
            else:
                items.append((arg, ""))
        if not items:
            items = None

    # HWPX 수정
    tmp = hwpx_path + ".tmp"
    with zipfile.ZipFile(hwpx_path, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for info in zin.infolist():
                data = zin.read(info.filename)
                if info.filename == "Contents/section0.xml":
                    text = data.decode("utf-8")
                    text = insert_second_table(text, items)
                    data = text.encode("utf-8")
                zout.writestr(info, data)
    os.replace(tmp, hwpx_path)
    print(f"두 번째 편집오검 내역표 삽입 완료: {hwpx_path}")


if __name__ == "__main__":
    main()
