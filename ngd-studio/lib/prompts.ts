export function buildCreatePrompt(files: { pdf: string; hwpx: string }): string {
  return [
    `시험지를 제작해줘.`,
    `- 원본 PDF: ${files.pdf}`,
    `- 양식 HWPX: ${files.hwpx}`,
    `Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`,
  ].join("\n");
}

export function buildReviewPrompt(files: { pdf: string; hwpx: string }): string {
  return [
    `오검(오류검수)을 진행해줘.`,
    `- 원본 PDF: ${files.pdf}`,
    `- 작업 HWPX: ${files.hwpx}`,
    `Skill 도구로 "ngd-exam-review" 스킬을 호출해서 진행해.`,
  ].join("\n");
}
