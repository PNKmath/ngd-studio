interface QuestionImagePath {
  number: number;
  path: string;
}

export function buildCreatePrompt(
  files: { pdf: string; hwpx: string },
  questionImages?: QuestionImagePath[]
): string {
  const hasPdf = !!files.pdf;
  const hasImages = questionImages && questionImages.length > 0;

  const lines = [
    `시험지를 제작해줘.`,
  ];

  if (hasPdf) {
    // PDF 모드: PDF 1차 추출 + 이미지 2차 검증
    lines.push(`- 원본 PDF: ${files.pdf}`);

    if (files.hwpx) {
      lines.push(`- 양식 HWPX: ${files.hwpx}`);
    }

    if (hasImages) {
      lines.push(``);
      lines.push(`## 문제별 개별 이미지 (2차 검증용)`);
      lines.push(`아래 문제들은 개별 crop 이미지가 제공되었습니다.`);
      lines.push(`reader 에이전트는 PDF에서 1차 추출한 후, 이 이미지들로 **반드시 2차 검증**하여 불일치를 수정해야 합니다.`);
      lines.push(`읽을 수 없는 부분은 [UNCLEAR]로 표시하고, 절대 추측하거나 문제를 창작하지 않습니다.`);
      lines.push(``);
      for (const img of questionImages) {
        lines.push(`- ${img.number}번: ${img.path}`);
      }
      lines.push(``);
    }
  } else if (hasImages) {
    // 이미지 전용 모드: 삽입된 이미지만으로 시험지 생성
    if (files.hwpx) {
      lines.push(`- 양식 HWPX: ${files.hwpx}`);
    }

    lines.push(``);
    lines.push(`## 이미지 전용 모드`);
    lines.push(`원본 PDF가 없습니다. 아래 문제별 개별 이미지만으로 시험지를 제작합니다.`);
    lines.push(`reader 에이전트는 각 이미지를 순서대로 Read 도구로 읽어 문제를 추출합니다.`);
    lines.push(`이미지가 제공된 문제만 시험지에 포함됩니다 (총 ${questionImages.length}문제).`);
    lines.push(`읽을 수 없는 부분은 [UNCLEAR]로 표시하고, 절대 추측하거나 문제를 창작하지 않습니다.`);
    lines.push(``);
    for (const img of questionImages) {
      lines.push(`- ${img.number}번: ${img.path}`);
    }
    lines.push(``);
  }

  lines.push(`Skill 도구로 "ngd-exam-create" 스킬을 호출해서 진행해.`);

  return lines.join("\n");
}

export function buildCreateV3Prompt(
  files: { hwpx: string },
  questionImages: QuestionImagePath[],
  meta: {
    school?: string;
    grade?: number;
    subject?: string;
    semester?: string;
    examType?: string;
    range?: string;
  }
): string {
  const lines = [
    `V3 모드로 시험지를 제작해줘.`,
  ];

  if (files.hwpx) {
    lines.push(`- 양식 HWPX: ${files.hwpx}`);
  }

  lines.push(``);
  lines.push(`## 시험 정보`);
  if (meta.school) lines.push(`- 학교: ${meta.school}`);
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

  lines.push(`Skill 도구로 "ngd-exam-create-v3" 스킬을 호출해서 진행해.`);

  return lines.join("\n");
}

export function buildCropPrompt(pdfPath: string, outputDir: string): string {
  return [
    `# PDF 자동 크롭 작업`,
    ``,
    `이 작업은 **PDF 자동 크롭만** 수행한다. 시험지 제작, 오검, HWPX 조립 등 다른 작업은 하지 않는다.`,
    ``,
    `## 입력`,
    `- PDF 경로: ${pdfPath}`,
    `- 출력 디렉토리: ${outputDir}`,
    ``,
    `## 지시`,
    `Agent 도구로 subagent_type="ngd-exam-cropper" 에이전트를 호출하라.`,
    `에이전트 프롬프트에 다음을 전달하라:`,
    `- PDF 경로: ${pdfPath}`,
    `- 출력 디렉토리: ${outputDir}`,
    ``,
    `크롭 완료 후 결과 JSON을 ${outputDir}/crop_results.json 에 저장하라.`,
    ``,
    `**주의: ngd-exam-create, ngd-exam-review 등 다른 스킬/에이전트를 호출하지 마라. 크롭만 수행.**`,
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
