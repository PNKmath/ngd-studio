interface QuestionImagePath {
  number: number;
  path: string;
}

export function buildCreatePrompt(
  files: { hwpx: string },
  questionImages: QuestionImagePath[],
  meta: {
    school?: string;
    year?: number;
    grade?: number;
    subject?: string;
    semester?: string;
    examType?: string;
    range?: string;
  }
): string {
  const lines = [
    `시험지를 제작해줘.`,
  ];

  if (files.hwpx) {
    lines.push(`- 양식 HWPX: ${files.hwpx}`);
  }

  lines.push(``);
  lines.push(`## 시험 정보`);
  if (meta.school) lines.push(`- 학교: ${meta.school}`);
  if (meta.year) lines.push(`- 연도: ${meta.year}`);
  if (meta.grade) lines.push(`- 학년: ${meta.grade}`);
  if (meta.subject) lines.push(`- 과목: ${meta.subject}`);
  if (meta.semester) lines.push(`- 학기: ${meta.semester}`);
  if (meta.examType) lines.push(`- 시험: ${meta.examType}`);
  if (meta.range) lines.push(`- 범위: ${meta.range}`);

  lines.push(``);
  lines.push(`## 문제 이미지 (총 ${questionImages.length}문제)`);
  lines.push(`각 이미지는 문제 1개를 크롭한 것입니다.`);
  lines.push(``);
  for (const img of questionImages) {
    lines.push(`- ${img.number}번: ${img.path}`);
  }
  lines.push(``);

  lines.push(`Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`);

  return lines.join("\n");
}

export function buildResumePrompt(
  files: { hwpx: string },
  startFrom: string,
  questionCount: number,
  meta: {
    school?: string;
    year?: number;
    grade?: number;
    subject?: string;
    semester?: string;
    examType?: string;
    range?: string;
  }
): string {
  const lines = [
    `resume --from=${startFrom}`,
  ];

  if (files.hwpx) {
    lines.push(`- 양식 HWPX: ${files.hwpx}`);
  }
  lines.push(`- 총 문제 수: ${questionCount}`);

  lines.push(``);
  lines.push(`## 시험 정보`);
  if (meta.school) lines.push(`- 학교: ${meta.school}`);
  if (meta.year) lines.push(`- 연도: ${meta.year}`);
  if (meta.grade) lines.push(`- 학년: ${meta.grade}`);
  if (meta.subject) lines.push(`- 과목: ${meta.subject}`);
  if (meta.semester) lines.push(`- 학기: ${meta.semester}`);
  if (meta.examType) lines.push(`- 시험: ${meta.examType}`);
  if (meta.range) lines.push(`- 범위: ${meta.range}`);

  lines.push(``);
  lines.push(`Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`);

  return lines.join("\n");
}

export function buildCropPrompt(pdfPath: string, outputDir: string): string {
  return [
    `PDF 시험지의 각 문제를 개별 이미지로 크롭해줘.`,
    ``,
    `- PDF 경로: ${pdfPath}`,
    `- 출력 디렉토리: ${outputDir}`,
    ``,
    `Skill 도구로 "ngd-exam-crop" 스킬을 호출해서 진행해.`,
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
