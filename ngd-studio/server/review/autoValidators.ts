/**
 * autoValidators.ts
 *
 * Phase 7 — deterministic XML-level validators for 12 of the 22 fixed review
 * checklist items.
 *
 * Each validator receives `sectionXml` (Contents/section0.xml text) and returns
 * zero or more ReviewIssueDraft objects.  Returned drafts have `auto_verified:
 * true` so the caller (reviewRunner.ts) can exclude these rule_ids from the
 * reviewer agent prompt, preventing duplicate issues.
 *
 * Rule mapping (ngd-exam-reviewer.md §Phase 4 자동 검증 항목):
 *   #1  배점 위치/수식
 *   #4  확률과통계, 좌표 로마체
 *   #5  therefore/because → `<hp:script>` 뒤 `~`
 *   #6  cdots → 양쪽 ` `
 *   #7  괄호 → left( right)
 *   #9  통수식 → `<hp:script>`에 `=` 2개 이상
 *   #14 바탕글 → 스타일 개수
 *   #15 독립수식 tab
 *   #17 콤마 → 쉼표 뒤 `~`
 *   #19 선지 간격
 *   #20 미주-문제 간격
 *   #22 해설 정렬
 */

import type { ReviewIssueDraft } from "./mutation";

// ─────────────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map from checklist rule_id to its validator function.
 *
 * Each function returns an array of ReviewIssueDraft; an empty array means no
 * violations were found for that rule.
 */
export const AUTO_VALIDATORS: Record<
  string,
  (sectionXml: string) => ReviewIssueDraft[]
> = {
  "#1": validateScoreLocation,
  "#4": validateProbStatRomanType,
  "#5": validateThereforeBecauseTilde,
  "#6": validateCdotsBackticks,
  "#7": validateParenthesesLeftRight,
  "#9": validateRunOnEquations,
  "#14": validateBatangStyleCount,
  "#15": validateIndependentEquationTab,
  "#17": validateCommaTilde,
  "#19": validateChoiceSpacing,
  "#20": validateEndnoteProblemSpacing,
  "#22": validateExplanationAlignment,
};

/** Ordered list of rule IDs covered by AUTO_VALIDATORS. */
export const AUTO_VALIDATED_RULE_IDS: string[] = Object.keys(AUTO_VALIDATORS);

/**
 * Run all 12 deterministic validators and return the merged draft list.
 *
 * The returned drafts all carry `auto_verified: true`.  reviewRunner.ts merges
 * these with agent drafts, filtering out any agent drafts whose `rule_id` is
 * already in AUTO_VALIDATED_RULE_IDS.
 */
export function runAutoValidators(sectionXml: string): ReviewIssueDraft[] {
  return Object.values(AUTO_VALIDATORS).flatMap((fn) => fn(sectionXml));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build a draft quickly
// ─────────────────────────────────────────────────────────────────────────────

function makeDraft(
  ruleId: string,
  snippet: string,
  xpath?: string,
  suggestedFix?: string,
  questionNumber?: number
): ReviewIssueDraft {
  return {
    issue_type: "checklist_violation",
    location: {
      file: "Contents/section0.xml",
      xpath,
      snippet,
    },
    ...(suggestedFix !== undefined ? { suggested_fix: suggestedFix } : {}),
    rule_id: ruleId,
    ...(questionNumber !== undefined ? { question_number: questionNumber } : {}),
    auto_verified: true,
  };
}

/** Extract each full <hp:script>…</hp:script> tag WITH surrounding context. */
function extractScriptTags(sectionXml: string): Array<{ full: string; inner: string }> {
  const results: Array<{ full: string; inner: string }> = [];
  const re = /(<hp:script>)([\s\S]*?)(<\/hp:script>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sectionXml)) !== null) {
    if (m[0] !== undefined && m[2] !== undefined) {
      results.push({ full: m[0], inner: m[2] });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// #1 — 배점 위치/수식
// 배점은 [N점] 형태로 문제 텍스트 내에 있어야 하며 <hp:equation>으로 감싸지 않는다.
// 위반: 배점 숫자가 <hp:script> 안에 있는 경우.
// ─────────────────────────────────────────────────────────────────────────────

export function validateScoreLocation(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // 배점 패턴: [숫자점] 이 <hp:script> 안에 있으면 위반
  const scriptRe = /<hp:script>([\s\S]*?)<\/hp:script>/g;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(sectionXml)) !== null) {
    const inner = m[1] ?? "";
    // 배점 수식 형태: \d+`rm 점` 또는 유사
    if (/\d+\s*`rm\s*점`/.test(inner) || /\[\d+점\]/.test(inner)) {
      drafts.push(
        makeDraft(
          "#1",
          m[0],
          "hp:equation/hp:script[배점수식]",
          undefined
        )
      );
    }
  }
  // 배점 텍스트 [N점]이 <hp:t> 바깥 즉 <hp:equation> 안에만 존재하는지 확인은
  // false-positive 위험이 높으므로 위 script 내 패턴만 검사.
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #4 — 확률과통계, 좌표 로마체
// 확률 P, 조합 C, 순열 P, 좌표 A/B 등 단위·기호 대문자는 rm체 필수.
// 위반: script 안에 단독 대문자(로마체 없이 이탤릭체로 쓰인 것).
// ─────────────────────────────────────────────────────────────────────────────

export function validateProbStatRomanType(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // 확률/통계 심볼: {rmP}, {rmC}, {rmN} 이 아닌 이탤릭체 P, C, N 사용 탐지.
  // 위반 패턴: P_r (이탤릭 순열), C_r (이탤릭 조합), nP, nC 형태.
  // 올바른 형태: {rmP}, {rmC}, {rmN} 으로 로마체 지정.
  const tags = extractScriptTags(sectionXml);
  for (const { full, inner } of tags) {
    // P 또는 C 가 직접 (rm 없이) sub/sup 첨자와 결합되는 패턴
    const hasBarePC =
      /(?<![a-z{])P_[0-9a-z]/.test(inner) || // P_r, P_n 등
      /(?<![a-z{])C_[0-9a-z]/.test(inner) || // C_r 등
      /_[0-9n]P(?![}a-z])/.test(inner) ||    // _nP 형태
      /_[0-9n]C(?![}a-z])/.test(inner);      // _nC 형태
    const hasRoman = /{rmP}/.test(inner) || /{rmC}/.test(inner) || /{rmN}/.test(inner);
    if (hasBarePC && !hasRoman) {
      drafts.push(makeDraft("#4", full, "hp:equation/hp:script[로마체누락]"));
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #5 — therefore/because → `<hp:script>` 뒤 `~`
// ∴ (therefore) 또는 ∵ (because) 수식 뒤에 `~` 없으면 위반.
// ─────────────────────────────────────────────────────────────────────────────

export function validateThereforeBecauseTilde(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // therefore = `therefore`, because = `because` in HWP equation script
  const tags = extractScriptTags(sectionXml);
  for (const { full, inner } of tags) {
    const hasTherefore = /\btherefore\b/.test(inner);
    const hasBecause = /\bbecause\b/.test(inner);
    if (hasTherefore || hasBecause) {
      // Script 바로 뒤 텍스트에 ~ 있는지 확인하려면 full tag 이후 컨텍스트 필요.
      // 근사: script 내 마지막 토큰이 therefore/because 이고 inner 끝이 ~ 없으면 위반.
      const endsWithTilde = inner.trimEnd().endsWith("~");
      if (!endsWithTilde) {
        drafts.push(makeDraft("#5", full, "hp:equation/hp:script[therefore/because뒤~없음]"));
      }
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #6 — cdots → 양쪽 ` `
// cdots 양쪽에 backtick 간격 필수.
// ─────────────────────────────────────────────────────────────────────────────

export function validateCdotsBackticks(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  const tags = extractScriptTags(sectionXml);
  for (const { full, inner } of tags) {
    if (/\bcdots\b/.test(inner)) {
      // Valid: `cdots`  (backtick on both sides)
      // Invalid: cdots without surrounding backtick
      const valid = /`\s*cdots\s*`/.test(inner);
      if (!valid) {
        drafts.push(makeDraft("#6", full, "hp:equation/hp:script[cdots양쪽backtick없음]"));
      }
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #7 — 괄호 → left( right)
// 수식 내 괄호는 left( right) 형태 필수.
// 위반: 단독 `(` 또는 `)` (left/right 없이).
// ─────────────────────────────────────────────────────────────────────────────

export function validateParenthesesLeftRight(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  const tags = extractScriptTags(sectionXml);
  for (const { full, inner } of tags) {
    // 분수 등 복잡한 수식에서 ( 없이 left( 없는 경우 탐지
    // 단순 ( ) 가 있으면서 left( right) 가 없는 경우
    const hasPlainParen = /(?<![a-z])\(/.test(inner) || /\)(?![a-z])/.test(inner);
    const hasLeftRight = /\bleft\s*\(/.test(inner) && /\bright\s*\)/.test(inner);
    if (hasPlainParen && !hasLeftRight) {
      drafts.push(makeDraft("#7", full, "hp:equation/hp:script[left(right)없음]"));
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #9 — 통수식 (run-on equations)
// <hp:script>에 = 가 2개 이상이면 등호 단위로 끊어야 함.
// ─────────────────────────────────────────────────────────────────────────────

export function validateRunOnEquations(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  const tags = extractScriptTags(sectionXml);
  for (const { full, inner } of tags) {
    // Count = signs that are standalone (not !=, <=, >=, ==)
    const cleaned = inner.replace(/[!<>]=/g, "").replace(/==/g, "");
    const eqCount = (cleaned.match(/(?<![!<>])=/g) ?? []).length;
    if (eqCount >= 2) {
      drafts.push(makeDraft("#9", full, "hp:equation/hp:script[통수식=2개이상]"));
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #14 — 바탕글 → 스타일 개수
// F6 스타일: 바탕글 1개만 허용.
// ─────────────────────────────────────────────────────────────────────────────

export function validateBatangStyleCount(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // 스타일 참조: styleId="N" where N maps to 바탕글
  // In HWPX, 바탕글 style typically has styleId starting with "바탕글" or id 0
  // Count <hp:style> definitions with name containing 바탕글
  const styleDefRe = /<hp:style[^>]*name="([^"]*바탕글[^"]*)"[^>]*>/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = styleDefRe.exec(sectionXml)) !== null) {
    if (m[1] !== undefined) found.push(m[1]);
  }
  if (found.length > 1) {
    drafts.push(
      makeDraft(
        "#14",
        found.map((n) => `<hp:style name="${n}">`).join(", "),
        "hp:styles[바탕글복수]"
      )
    );
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #15 — 독립수식 tab
// 독립(display) 수식 앞에 tab이 있어야 함.
// 위반: <hp:equation> 앞 단락에 tab(<hp:tab>) 없음.
// ─────────────────────────────────────────────────────────────────────────────

export function validateIndependentEquationTab(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // Detect <hp:p> blocks that contain <hp:equation> but no <hp:tab> before it
  const paraRe = /(<hp:p(?:\s[^>]*)?>)([\s\S]*?)(<\/hp:p>)/g;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(sectionXml)) !== null) {
    const paraContent = m[2] ?? "";
    if (!paraContent.includes("<hp:equation")) continue;
    // Check if there is a <hp:tab/> or <hp:tab > before <hp:equation
    const tabBeforeEq = /<hp:tab[\s/>]/.test(
      paraContent.slice(0, paraContent.indexOf("<hp:equation"))
    );
    if (!tabBeforeEq) {
      const snippet = (m[0] ?? "").slice(0, 200);
      drafts.push(makeDraft("#15", snippet, "hp:p[독립수식앞tab없음]"));
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #17 — 콤마 → 쉼표 뒤 `~`
// 수식 내 쉼표(,) 뒤에 `~` 없으면 위반.
// ─────────────────────────────────────────────────────────────────────────────

export function validateCommaTilde(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  const tags = extractScriptTags(sectionXml);
  for (const { full, inner } of tags) {
    // 쉼표 뒤 ~ 없는 패턴: comma followed by something other than ~
    if (/,(?!\s*~)/.test(inner)) {
      drafts.push(makeDraft("#17", full, "hp:equation/hp:script[쉼표뒤~없음]"));
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #19 — 선지 간격
// 선지는 탭키 3번 간격이어야 함: 각 선지 앞에 <hp:tab/> 3개.
// ─────────────────────────────────────────────────────────────────────────────

export function validateChoiceSpacing(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // 선지 패턴: ① ② ③ ④ ⑤ 또는 circled numbers in text
  // 검사: 선지 번호 앞의 탭 수
  const choiceRe = /(<hp:p[^>]*>[\s\S]*?)(①|②|③|④|⑤)/g;
  let m: RegExpExecArray | null;
  while ((m = choiceRe.exec(sectionXml)) !== null) {
    const before = m[1] ?? "";
    // Count <hp:tab/> occurrences in the content before this choice
    const tabCount = (before.match(/<hp:tab[\s/]/g) ?? []).length;
    if (tabCount < 3) {
      const snippet = (m[0] ?? "").slice(0, 200);
      drafts.push(makeDraft("#19", snippet, `hp:p[선지${m[2]}앞tab<3]`));
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #20 — 미주-문제 간격
// 미주(endNote)와 문제 텍스트 사이에 띄어쓰기 없어야 함.
// 위반: endNote 종료 직후 <hp:t> 내용이 공백 또는 개행으로 시작.
// ─────────────────────────────────────────────────────────────────────────────

export function validateEndnoteProblemSpacing(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // endNote 닫힘 태그 직후 텍스트 공백 체크
  const endNoteCloseRe = /(<\/hp:endNote>)\s*(<hp:t[^>]*>)\s+/g;
  let m: RegExpExecArray | null;
  while ((m = endNoteCloseRe.exec(sectionXml)) !== null) {
    drafts.push(
      makeDraft(
        "#20",
        (m[0] ?? "").slice(0, 200),
        "hp:endNote+hp:t[미주-문제간격]"
      )
    );
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────────
// #22 — 해설 정렬
// 해설([풀이] 또는 endNote 내부)은 왼쪽 정렬이어야 함.
// 위반: endNote 내 <hp:paraShape> align 이 JUSTIFY 또는 CENTER.
// ─────────────────────────────────────────────────────────────────────────────

export function validateExplanationAlignment(sectionXml: string): ReviewIssueDraft[] {
  const drafts: ReviewIssueDraft[] = [];
  // endNote 내부의 paraShape align 검사
  const endNoteRe = /<hp:endNote>([\s\S]*?)<\/hp:endNote>/g;
  let m: RegExpExecArray | null;
  while ((m = endNoteRe.exec(sectionXml)) !== null) {
    const noteContent = m[1] ?? "";
    // 잘못된 정렬: JUSTIFY | CENTER | RIGHT
    const alignRe = /align="(JUSTIFY|CENTER|RIGHT)"/g;
    let a: RegExpExecArray | null;
    while ((a = alignRe.exec(noteContent)) !== null) {
      const snippet = (m[0] ?? "").slice(0, 200);
      drafts.push(makeDraft("#22", snippet, `hp:endNote[align=${a[1]}]`));
    }
  }
  return drafts;
}

