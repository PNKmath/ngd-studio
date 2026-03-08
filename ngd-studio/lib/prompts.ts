export function buildCreatePrompt(files: { pdf: string; hwpx: string }): string {
  return [
    `inputs/시험지 제작/ 폴더에 있는 파일로 시험지를 제작해줘.`,
    `- 원본 PDF: ${files.pdf}`,
    `- 양식 HWPX: ${files.hwpx}`,
    `/ngd-exam-create 스킬을 실행해줘.`,
  ].join("\n");
}

export function buildReviewPrompt(files: { pdf: string; hwpx: string }): string {
  return [
    `inputs/오검/ 폴더에 있는 파일로 오검을 진행해줘.`,
    `- 원본 PDF: ${files.pdf}`,
    `- 작업 HWPX: ${files.hwpx}`,
    `오검 체크리스트에 따라 검수하고 수정해줘.`,
  ].join("\n");
}
