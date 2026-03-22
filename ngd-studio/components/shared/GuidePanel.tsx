"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

interface GuideSection {
  title: string;
  items: string[];
}

interface GuidePanelProps {
  title: string;
  sections: GuideSection[];
}

export function GuidePanel({ title, sections }: GuidePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-medium cursor-pointer"
      >
        <span>{title}</span>
        <span className="text-muted-foreground text-xs">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 text-xs text-muted-foreground">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="font-medium text-foreground mb-1.5">
                {section.title}
              </h4>
              <ul className="space-y-0.5 list-disc list-inside">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --- 시험지 제작 참고사항 ---

export const createGuide = {
  title: "참고사항",
  sections: [
    {
      title: "레이아웃",
      items: [
        "고등부: 한 단에 2문항, 2단 레이아웃",
        "서체: 나눔고딕 10, 수식크기 11, 수식서체 HYhwpEQ",
        "F6 스타일: 바탕글 1개만 사용",
        "미주번호와 문제 사이 띄어쓰기 없음",
        "문제와 보기 사이 한 줄 띄움",
      ],
    },
    {
      title: "수식/선지",
      items: [
        "단위/도형 대문자 → rm체 (rmA, rmkg 등)",
        "순열/조합 → {rmP}, {rmC}",
        "통수식 금지 — 등호 단위로 끊기",
        "내적 → cdot (bullet 아님)",
        "선지 간격: 탭 3번",
      ],
    },
    {
      title: "해설/정답",
      items: [
        "구조: [정답] 라인 → 풀이 순서",
        "정답 bold 금지",
        "정답 라인 밑에 '해설', '풀이' 문구 넣지 않음",
        "shift+enter 금지 (정답 2줄일 때만 허용)",
        "서술형: [서술형 N] 형식, 소문항은 (1), (2)로 통일",
      ],
    },
    {
      title: "파일명/머리말",
      items: [
        "[코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]",
        "머리말: 학년/과정/과목/출판사 + 시험 범위",
        "범위: 대단원명까지만 기재",
        "난이도: 하 / 중 / 상 / 킬 (4단계)",
      ],
    },
    {
      title: "그림",
      items: [
        "모든 생성 그림에 NGD 워터마크 필수",
        "오른쪽 배치: 첫 어절 뒤, textWrap=AROUND",
        "단독 배치: treatAsChar=1, 가운데 정렬",
      ],
    },
  ],
};

// --- 오검 참고사항 ---

export const reviewGuide = {
  title: "오검 체크리스트",
  sections: [
    {
      title: "배점/단서 조항",
      items: [
        "배점은 반드시 수식으로 입력",
        "문제 텍스트와 배점 사이 한 칸",
        "단서 조항이 한 줄 안에 안 들어가면 → 오른쪽 정렬",
        "단서 조항이 두 줄 이상이면 → 이어서 작업",
      ],
    },
    {
      title: "수식 규칙",
      items: [
        "순열/조합/확률/분포 → rm체 (rmP, rmC, rmN)",
        "단위/도형 대문자 → rm체",
        "cdots 양쪽 backtick",
        "분수 괄호 → left( right)",
        "통수식 금지 → 등호 단위로 끊기",
        "콤마 뒤 ~ 또는 backtick",
      ],
    },
    {
      title: "서식/스타일",
      items: [
        "서체: 나눔고딕 10, 수식크기 11",
        "F6 스타일: 바탕글 1개만",
        "미주와 문제 사이 띄어쓰기 없음",
        "문제와 보기 사이 한 줄 띄움",
        "독립줄 수식: 탭 들여쓰기 (해설 제외)",
        "해설 항상 좌측 정렬",
      ],
    },
    {
      title: "정답/해설",
      items: [
        "정답 bold 금지",
        "정답 라인 밑에 '해설'/'풀이' 문구 넣지 않음",
        "shift+enter 금지 (정답 2줄일 때만 허용)",
        "[서술형 N] 형식, 소문항 (1), (2) 통일",
        "소문항에 배점 있으면 전체 배점 생략",
      ],
    },
    {
      title: "기타",
      items: [
        "조건틀/보기틀/증명틀 형식 확인",
        "중단원명 — 단원분류표와 일치 확인",
        "(가)(나)(다): 문자표 사용 안함, 한글 그대로",
        "비표(제곱근표/상용로그표): 표 직접 작성",
        "머릿말: 학년/과정/과목/출판사/시험범위",
      ],
    },
  ],
};
