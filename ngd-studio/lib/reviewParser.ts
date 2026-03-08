export interface ReviewItem {
  id: number;
  category: ReviewCategory;
  description: string;
  status: "fixed" | "warning" | "passed";
  detail?: string;
}

export type ReviewCategory =
  | "equation"   // 수식 오류
  | "text"       // 텍스트 불일치
  | "style"      // 스타일 위반
  | "figure"     // 그림 관련
  | "structure"  // 구조/순서
  | "other";     // 기타

const categoryLabels: Record<ReviewCategory, string> = {
  equation: "수식 오류",
  text: "텍스트 불일치",
  style: "스타일 위반",
  figure: "그림 관련",
  structure: "구조/순서",
  other: "기타",
};

export function getCategoryLabel(cat: ReviewCategory): string {
  return categoryLabels[cat] ?? cat;
}

const categoryPatterns: { category: ReviewCategory; patterns: RegExp[] }[] = [
  { category: "equation", patterns: [/수식/i, /equation/i, /script/i, /rm[A-Z]/i, /분수/i, /첨자/i] },
  { category: "text", patterns: [/텍스트/i, /오타/i, /누락/i, /불일치/i, /띄어쓰기/i, /맞춤법/i] },
  { category: "style", patterns: [/서체/i, /폰트/i, /bold/i, /스타일/i, /크기/i, /간격/i, /탭/i] },
  { category: "figure", patterns: [/그림/i, /이미지/i, /figure/i, /워터마크/i, /crop/i] },
  { category: "structure", patterns: [/순서/i, /번호/i, /구조/i, /미주/i, /선지/i, /서술형/i] },
];

function detectCategory(text: string): ReviewCategory {
  for (const { category, patterns } of categoryPatterns) {
    if (patterns.some((p) => p.test(text))) return category;
  }
  return "other";
}

function detectStatus(text: string): ReviewItem["status"] {
  if (/수정|fixed|변경|교체|보정/i.test(text)) return "fixed";
  if (/경고|주의|확인.*필요|warn/i.test(text)) return "warning";
  return "passed";
}

/**
 * Parse review report text from CLI output into structured items.
 * Expects lines like:
 *   - ⚠ 3번 수식 오타 수정
 *   - ✓ 서체 검증 통과
 *   or numbered items, bullet points, etc.
 */
export function parseReviewReport(text: string): ReviewItem[] {
  const items: ReviewItem[] = [];
  const lines = text.split("\n");

  let id = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines starting with -, *, •, ⚠, ✓, ✗, numbers
    if (/^[-*•⚠✓✗✘\d]/.test(trimmed) && trimmed.length > 3) {
      const description = trimmed.replace(/^[-*•⚠✓✗✘]\s*/, "").replace(/^\d+[.)]\s*/, "");
      if (description.length < 3) continue;

      id++;
      items.push({
        id,
        category: detectCategory(description),
        description,
        status: detectStatus(description),
      });
    }
  }

  return items;
}

export function summarizeReport(items: ReviewItem[]): { fixed: number; warnings: number; passed: number } {
  return {
    fixed: items.filter((i) => i.status === "fixed").length,
    warnings: items.filter((i) => i.status === "warning").length,
    passed: items.filter((i) => i.status === "passed").length,
  };
}

export function groupByCategory(items: ReviewItem[]): Record<ReviewCategory, ReviewItem[]> {
  const groups: Record<string, ReviewItem[]> = {};
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups as Record<ReviewCategory, ReviewItem[]>;
}
