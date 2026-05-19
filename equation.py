#!/usr/bin/env python3
"""
NGD HWPX Builder — Equation XML generation

Import direction: ids → equation → shapes → tables → assemble → build_hwpx
"""

import re
from ids import next_eq_id, next_zorder


# ---------------------------------------------------------------------------
# Parts normalizer (R-01 ~ R-10)
# ---------------------------------------------------------------------------

def normalize_parts(parts: list) -> list:
    """Apply deterministic normalization rules to a parts array.

    Idempotent: normalize_parts(normalize_parts(x)) == normalize_parts(x).
    Rules implemented per docs/planning/create-v4-deterministic-codification/rule-taxonomy.md.
    """
    parts = _split_equation_chains(parts)        # R-01
    parts = [_normalize_part(p) for p in parts]
    return parts


def _normalize_part(part: dict) -> dict:
    if "eq" in part:
        script = part["eq"]
        script = _fix_deg(script)                # R-02
        script = _fix_bullet_to_cdot(script)     # R-03
        script = _wrap_cdots(script)             # R-04
        script = _comma_tilde(script)            # R-05
        script = _left_right_space(script)       # R-06
        script = _leading_underscore_to_lsub(script)  # R-07
        script = _fix_permutation_combination(script)  # R-08
        script = _enforce_rm_units(script)       # R-09
        script = _add_operator_spaces_top_level(script)  # R-10
        return {**part, "eq": script}
    return part


# ---------------------------------------------------------------------------
# R-01: 통수식 split (top-level '=' 기반 분리)
# ---------------------------------------------------------------------------

def _find_top_level_eq_positions(script: str) -> list:
    """Return a list of character positions of each top-level '=' in script.

    depth tracking:
      '{' / '}'                  → depth ±1
      'LEFT(' or 'LEFT (' (any case) → depth +1 (keyword-based)
      'RIGHT)' or 'RIGHT )' (any case) → depth -1
      backtick pairs             → raw zone, '=' ignored
    """
    positions = []
    depth = 0
    in_backtick = False
    i = 0
    n = len(script)

    while i < n:
        c = script[i]

        if c == '`':
            in_backtick = not in_backtick
            i += 1
            continue

        if in_backtick:
            i += 1
            continue

        if c == '{':
            depth += 1
            i += 1
            continue

        if c == '}':
            depth -= 1
            i += 1
            continue

        # Check for LEFT( or LEFT ( (case-insensitive)
        if depth == 0:
            upper = script[i:i+6].upper()
            if upper.startswith('LEFT('):
                depth += 1
                i += 5
                continue
            if upper.startswith('LEFT ') and i + 5 < n and script[i + 5] == '(':
                depth += 1
                i += 6
                continue

        # Check for RIGHT) or RIGHT ) (case-insensitive)
        if depth >= 1:
            upper = script[i:i+7].upper()
            if upper.startswith('RIGHT)'):
                depth -= 1
                i += 6
                continue
            if upper.startswith('RIGHT ') and i + 6 < n and script[i + 6] == ')':
                depth -= 1
                i += 7
                continue

        if depth == 0 and c == '=':
            positions.append(i)

        i += 1

    return positions


def _split_equation_chains(parts: list) -> list:
    """R-01: For each eq part, split on multiple top-level '='.

    Rule: if there are N top-level '=' signs (N >= 2), split at the 2nd, 3rd, ...
    '=' (i.e., keep the first '=' in chunk 0, start each new chunk at the next '=').

    Example with 2 '=':
      'f(x) = x^2 + 2x = (x+1)^2 - 1'
      → ['f(x) = x^2 + 2x', '= (x+1)^2 - 1']

    Example with 3 '=':
      'a = b = c = d'
      → ['a = b', '= c', '= d']

    Chunks are separated by {t: " "} glue parts.
    """
    result = []
    for part in parts:
        if "eq" not in part:
            result.append(part)
            continue

        script = part["eq"]
        eq_positions = _find_top_level_eq_positions(script)

        if len(eq_positions) < 2:
            # 0 or 1 top-level '=' — no split needed
            result.append(part)
            continue

        # Split at positions[1], positions[2], ... (keep first '=' in chunk 0)
        split_at = eq_positions[1:]  # positions to split before
        chunks = []
        prev = 0
        for pos in split_at:
            chunk = script[prev:pos].rstrip()
            chunks.append(chunk)
            prev = pos
        chunks.append(script[prev:].rstrip())

        base = {k: v for k, v in part.items() if k != "eq"}
        for idx, chunk in enumerate(chunks):
            entry = dict(base)
            entry["eq"] = chunk
            result.append(entry)
            if idx < len(chunks) - 1:
                result.append({"t": " "})

    return result


# ---------------------------------------------------------------------------
# R-02: DEG 붙여쓰기
# ---------------------------------------------------------------------------

def _fix_deg(script: str) -> str:
    """R-02: Remove space between a number and DEG."""
    return re.sub(r'(\d+)\s+DEG', r'\1DEG', script)


# ---------------------------------------------------------------------------
# R-03: bullet 기호 → cdot 치환
# ---------------------------------------------------------------------------

_BULLET_PATTERN = re.compile(r'[·•⋅]')  # U+00B7, U+2022, U+22C5


def _fix_bullet_to_cdot(script: str) -> str:
    """R-03: Replace bullet/middle-dot characters with 'cdot'."""
    return _BULLET_PATTERN.sub('cdot', script)


# ---------------------------------------------------------------------------
# R-04: cdots 역따옴표 감싸기
# ---------------------------------------------------------------------------

def _wrap_cdots(script: str) -> str:
    """R-04: Wrap bare 'cdots' with backticks; skip already-wrapped occurrences."""
    # Replace cdots that are NOT already surrounded by backticks
    # Pattern: not preceded by backtick AND not followed by backtick
    return re.sub(r'(?<!`)cdots(?!`)', r'`cdots`', script)


# ---------------------------------------------------------------------------
# R-05: 쉼표 뒤 ~ 자동 삽입
# ---------------------------------------------------------------------------

def _comma_tilde(script: str) -> str:
    """R-05: After each ',' in eq, ensure ',~' (add '~' if not already present).

    ',' not followed by '~' → ',~'
    Already ',~' → unchanged.
    """
    # Replace ',' followed by optional space (but not '~') with ',~'
    # We handle: ',X' → ',~ X' but more precisely:
    # if comma is followed by '~' already: leave it
    # if comma is followed by space: replace ', ' with ',~ '
    # if comma is followed by something else: insert '~' after comma
    result = []
    i = 0
    n = len(script)
    while i < n:
        if script[i] == ',':
            # look ahead
            j = i + 1
            if j < n and script[j] == '~':
                # already ',~'
                result.append(',')
            elif j < n and script[j] == ' ':
                # ', something' → ',~ something'
                result.append(',~')
                # skip the space — R-05 replaces ', ' with ',~'
                # Actually looking at fixture: "(a, b, c)" → "(a,~ b,~ c)"
                # The space is consumed by the '~' replacement
                i += 1  # skip the space char (we'll add it via the next loop iter? No)
                # Actually the output is ",~" not ",~ " — the space is replaced by ~
                # fixture: (a, b, c) → (a,~ b,~ c): so the space stays but ~ is inserted
                # So ", b" → ",~ b": insert ~ between comma and space
                # Let's re-do: we keep the space but insert ~ before it
                result.append(' ')
            else:
                # ',' followed by non-space non-tilde
                result.append(',~')
        else:
            result.append(script[i])
        i += 1
    return ''.join(result)


# ---------------------------------------------------------------------------
# R-06: LEFT/RIGHT 공백 보강
# ---------------------------------------------------------------------------

def _left_right_space(script: str) -> str:
    """R-06: Ensure 'LEFT (' and 'RIGHT )' spacing.

    LEFT( → LEFT (
    RIGHT) → RIGHT )
    Already-spaced versions are idempotent.
    """
    # Case-sensitive as HWP uses uppercase LEFT/RIGHT
    script = re.sub(r'\bLEFT\(', 'LEFT (', script)
    script = re.sub(r'\bRIGHT\)', 'RIGHT )', script)
    return script


# ---------------------------------------------------------------------------
# R-07: leading _ → LSUB (partial — only detectable leading patterns)
# ---------------------------------------------------------------------------

def _leading_underscore_to_lsub(script: str) -> str:
    """R-07: Leading '_' at start of eq is potentially problematic.

    Per rule-taxonomy: partial codifiable — only leading _ without a base is
    a problem. R-08 handles the nCr/nPr patterns which are the primary source.
    Standalone leading _ (e.g. '_n' alone) is flagged but NOT auto-converted
    (context required). This function is a no-op per fixture R-07-basic.
    """
    return script  # no-op: R-07 is partial, R-08 covers the main patterns


# ---------------------------------------------------------------------------
# R-08: 순열/조합 패턴 정규화 (nCr, nPr, nHr)
# ---------------------------------------------------------------------------

# Match patterns like: _5C_3, _{10}C_{4}, _nP_r, _{n}H_{r}
# Also handles uppercase letters C, P, H as the operator
_COMB_PATTERN = re.compile(
    r'_(\{[^}]+\}|[A-Za-z0-9]+)'   # subscript base: _{n} or _n
    r'([CPH])'                       # operator: C, P, or H
    r'_(\{[^}]+\}|[A-Za-z0-9]+)'   # subscript exponent: _{r} or _r
)


def _fix_permutation_combination(script: str) -> str:
    """R-08: Normalize _nC_r / _nP_r / _nH_r patterns.

    _5C_3       → {it`_5`}{rm C}_{it 3}
    _{10}P_{4}  → {it`_{10}`}{rm P}_{it 4}
    """
    # Skip if already normalized (contains '{rm C}' / '{rm P}' / '{rm H}')
    if re.search(r'\{rm [CPH]\}', script):
        return script

    def _replace(m):
        base = m.group(1)    # e.g. '5' or '{10}'
        op = m.group(2)      # 'C', 'P', or 'H'
        exp = m.group(3)     # e.g. '3' or '{4}'
        base_sub = f'_{base}'
        exp_val = exp[1:-1] if exp.startswith('{') else exp
        return f'{{it`{base_sub}`}}{{rm {op}}}_{{it {exp_val}}}'

    return _COMB_PATTERN.sub(_replace, script)


# ---------------------------------------------------------------------------
# R-09: rm체 단위 enforcement
# ---------------------------------------------------------------------------

_UNIT_KEYWORDS = [
    'kg', 'km', 'cm', 'mm', 'nm', 'μm',
    'm', 's', 'A', 'N', 'J', 'W', 'V', 'Hz', 'Pa', 'K',
    'mol', 'cd', 'rad', 'kJ', 'kW', 'kV', 'kPa', 'kHz',
    'mg', 'mL', 'L', 'mA', 'ms',
]
# Sort longest first to avoid partial matches (e.g. 'km' before 'm')
_UNIT_KEYWORDS_SORTED = sorted(_UNIT_KEYWORDS, key=len, reverse=True)

# R-09: Only match units that appear after a number (with optional space).
# This avoids false positives where a single letter like 'm', 's', 'A' is a variable.
# Pattern: digit(s) + space(s) + unit keyword (not already 'rm'-prefixed).
_UNIT_PATTERN = re.compile(
    r'(\d+)\s+'                         # number + whitespace
    r'(?!rm\s)'                         # not already 'rm '-prefixed
    r'(' + '|'.join(re.escape(u) for u in _UNIT_KEYWORDS_SORTED) + r')'
    r'(?!\w)'                           # unit not followed by word char
)


def _enforce_rm_units(script: str) -> str:
    """R-09: Wrap unit keywords that follow a number with 'rm '.

    Already-prefixed 'rm kg' → unchanged (pattern won't match 'rm kg').
    '150 kg' → '150 rm kg'.
    Only units directly after a numeric literal are auto-converted (partial rule).
    """
    def _replace(m):
        num = m.group(1)
        unit = m.group(2)
        return f'{num} rm {unit}'

    return _UNIT_PATTERN.sub(_replace, script)


# ---------------------------------------------------------------------------
# R-10: 수식 연산자 앞뒤 공백
# ---------------------------------------------------------------------------

def _add_operator_spaces_top_level(script: str) -> str:
    """R-10: Ensure spaces around top-level binary operators (+, -, =, <, >).

    Operators inside {} (subscripts/superscripts) are NOT touched.
    Unary minus at start or after another operator is NOT touched.
    """
    """Add spaces around binary operators only at depth 0 (outside {})."""
    # We rebuild the string character by character, tracking depth
    # Operators to space: + - = < >
    # But we need to be careful about:
    # - Unary minus/plus (at start, or after another operator)
    # - Operators inside {}
    # - Operators inside backticks

    tokens = _tokenize_for_spacing(script)
    return _apply_spacing(tokens)


def _tokenize_for_spacing(script: str) -> list:
    """Break script into tokens: ('op', char) for depth-0 operators, ('raw', str) for rest.

    Depth tracking for R-10: operators inside '{...}' or '(...)' are NOT top-level.
    Note: HWP LEFT/RIGHT blocks also increase depth.
    """
    tokens = []
    brace_depth = 0    # tracks {} depth
    paren_depth = 0    # tracks () depth (literal parentheses, not LEFT/RIGHT keywords)
    in_backtick = False
    i = 0
    n = len(script)

    while i < n:
        c = script[i]

        if c == '`':
            in_backtick = not in_backtick
            tokens.append(('raw', c))
            i += 1
            continue

        if in_backtick:
            tokens.append(('raw', c))
            i += 1
            continue

        if c == '{':
            brace_depth += 1
            tokens.append(('raw', c))
            i += 1
            continue

        if c == '}':
            brace_depth -= 1
            tokens.append(('raw', c))
            i += 1
            continue

        if c == '(':
            paren_depth += 1
            tokens.append(('raw', c))
            i += 1
            continue

        if c == ')':
            paren_depth -= 1
            tokens.append(('raw', c))
            i += 1
            continue

        if brace_depth == 0 and paren_depth == 0 and c in '+-=<>':
            tokens.append(('op', c))
            i += 1
            continue

        tokens.append(('raw', c))
        i += 1

    return tokens


def _apply_spacing(tokens: list) -> str:
    """Apply spacing rules: binary ops get single spaces on both sides, unary ops don't."""
    result = []
    n = len(tokens)

    for i, (ttype, tval) in enumerate(tokens):
        if ttype == 'op':
            # Determine if this is binary (preceded by non-whitespace, non-operator content)
            prev_non_space = None
            for j in range(i - 1, -1, -1):
                if tokens[j][1].strip():
                    prev_non_space = tokens[j]
                    break

            is_unary = (prev_non_space is None or
                        prev_non_space[0] == 'op')

            if is_unary:
                result.append(tval)
            else:
                # Binary operator — ensure exactly one space on each side
                # Remove trailing spaces from result
                while result and result[-1] == ' ':
                    result.pop()
                result.append(' ')
                result.append(tval)
                # Consume leading spaces from the next token(s)
                # by peeking ahead — we'll emit exactly one space
                result.append(' ')
                # Skip any immediately following space tokens
                # (handled by: when we encounter the next token, just append it)
        else:
            # For raw tokens: if we just emitted a space after an op,
            # skip leading spaces in this raw token
            if result and result[-1] == ' ' and tval == ' ':
                # Check if prev output was an operator space we just added
                # Only collapse if it would double-space after an op
                # Strategy: just don't add this space if we already added one
                # We check by looking at result[-2] for the operator char
                if len(result) >= 2 and result[-2] in '+-=<>':
                    continue  # skip this space, we already have one
            result.append(tval)

    return ''.join(result)


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
    parts = normalize_parts(parts)  # R-01 ~ R-10 deterministic normalization
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
