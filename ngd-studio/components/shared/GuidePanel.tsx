"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// --- Modal Component ---

interface GuidePage {
  title: string;
  content: React.ReactNode;
}

interface GuideModalProps {
  pages: GuidePage[];
  onClose: () => void;
}

function GuideModal({ pages, onClose }: GuideModalProps) {
  const [page, setPage] = useState(0);
  const current = pages[page];

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && page < pages.length - 1) setPage(page + 1);
      if (e.key === "ArrowLeft" && page > 0) setPage(page - 1);
    },
    [page, pages.length, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border rounded-lg shadow-lg w-[720px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="text-sm font-semibold">{current.title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {page + 1} / {pages.length}
            </span>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed guide-content">
          {current.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0">
          {/* Page dots */}
          <div className="flex gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                  i === page
                    ? "bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              &larr; 이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === pages.length - 1}
              onClick={() => setPage(page + 1)}
            >
              다음 &rarr;
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Guide Button ---

interface GuidePanelProps {
  label: string;
  pages: GuidePage[];
}

export function GuidePanel({ label, pages }: GuidePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        className="p-3 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">클릭하여 보기</span>
        </div>
      </Card>
      {open && <GuideModal pages={pages} onClose={() => setOpen(false)} />}
    </>
  );
}

// --- Helper: Section renderer ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="text-sm font-semibold mb-2 text-primary">{title}</h3>
      {children}
    </div>
  );
}

function List({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-1.5 text-[13px]">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground shrink-0 mt-0.5">&#8226;</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
      {children}
    </code>
  );
}

function Example({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 mb-3 bg-muted/50 rounded-md p-3 text-xs">
      {label && <div className="text-muted-foreground mb-1 font-medium">{label}</div>}
      <div className="font-mono whitespace-pre-wrap">{children}</div>
    </div>
  );
}

// ============================================================
//  시험지 제작 참고사항
// ============================================================

export const createGuidePages: GuidePage[] = [
  {
    title: "1. 레이아웃 / 페이지 배치",
    content: (
      <>
        <Section title="페이지/단 배치">
          <List items={[
            "고등부 시험지: 한 단에 2문항 배치 원칙",
            "중등부 시험지: 한 단에 3문항",
            "2단 레이아웃, 한 쪽에 4문제 (좌2 + 우2)",
          ]} />
        </Section>
        <Section title="머리말">
          <List items={[
            "기출작업양식의 머리말 오른쪽 칸에 학년/과정/과목/출판사와 시험 범위 기재",
            "고1학년인 경우 학년/과목/출판사와 범위를 기재",
            "출판사 모를 때는 입력하지 않음",
          ]} />
        </Section>
        <Section title="미주와 문제">
          <List items={[
            "미주번호와 문제 텍스트 사이는 붙여 쓴다 (한 칸 띄어쓰기 금지)",
            "endNote 마커 직후 바로 문제 텍스트 시작",
          ]} />
        </Section>
        <Section title="문제 - 보기 간격">
          <List items={[
            "문제와 객관식 보기 사이에 한 줄 띄움 (빈 문단 1개)",
            "문제와 보기 사이에 [그림], [조건], < 보 기 > 가 있는 경우에도 한 줄 띄움",
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "2. 서체 / 스타일 / 배점",
    content: (
      <>
        <Section title="서체/스타일">
          <List items={[
            <>서체: <Code>나눔고딕 10</Code>, 수식크기 <Code>11</Code>, 수식서체 <Code>HYhwpEQ</Code></>,
            <>F6 스타일: <Code>바탕글</Code> 1개만 (다른 스타일 없어야 함)</>,
            <><Code>styleIDRef="0"</Code> (바탕글) 하나만 사용</>,
          ]} />
        </Section>
        <Section title="배점">
          <List items={[
            "문제 텍스트와 배점 사이는 한 칸 띄움",
            <>배점 숫자는 반드시 수식(<Code>{"<hp:equation>"}</Code>)으로 입력</>,
            <>형식: <Code>{"[수식(배점)점]"}</Code></>,
            <>배점이 다음 줄로 넘어가면: 오른쪽 정렬 (<Code>paraPrIDRef="4"</Code>)</>,
          ]} />
        </Section>
        <Section title="선지 간격">
          <List items={[
            <>보기 번호 간격: 탭키 3번 (<Code>{"<hp:tab>"}</Code> 3개)</>,
            "선지 값이 긴 경우: 각 선지를 개별 문단으로 배치",
          ]} />
        </Section>
        <Section title="독립줄 수식">
          <List items={[
            "문제에서 수식이 독립줄(별도 줄)에 올 때: tab으로 들여쓰기 후 작업",
            "해설에서는 적용하지 않음",
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "3. 수식 규칙",
    content: (
      <>
        <Section title="rm체 규칙">
          <List items={[
            <>단위/도형 대문자 → <Code>rm</Code>체: <Code>rmA</Code>, <Code>{"150``rm kg"}</Code></>,
            <>순열/조합/확률/분포 → <Code>{"{rmP}"}</Code>, <Code>{"{rmC}"}</Code>, <Code>{"{rmN}{it(m,~sigma^2)}"}</Code></>,
          ]} />
        </Section>
        <Section title="왼쪽 첨자">
          <List items={[
            <>왼쪽 첨자는 LSUB/LSUP 필수: <Code>{"{rmP}_{r} LSUB {n}"}</Code></>,
            <><Code>_</Code>로 시작하면 렌더링 실패</>,
          ]} />
        </Section>
        <Section title="기타 수식 규칙">
          <List items={[
            <>내적 → <Code>cdot</Code> (bullet 아님)</>,
            <>쉼표 뒤 <Code>~</Code></>,
            <>분수 괄호 <Code>left(</Code> <Code>right)</Code></>,
            <>cdots 양쪽에 backtick: <Code>{"`cdots`"}</Code></>,
            "통수식 금지 — 등호 단위로 끊기",
          ]} />
        </Section>
        <Section title="연방풀이 (연립방정식)">
          <List items={[
            "연방풀이에서 원문자 번호는 (1), (2)가 아닌 문자표의 ㉠, ㉡ 사용",
          ]} />
          <Example label="연립방정식 예시">
{`cases{2x^2 - xy - 12y^2 = 3 & \`\`\`\`\` cdots CDOTS \`\`\`\`㉠
      # x^2 - 4xy + y^2 = -2 & \`\` \`\`\` cdots CDOTS \`\`\`\`㉡}`}
          </Example>
        </Section>
      </>
    ),
  },
  {
    title: "4. 해설 / 정답 / 서술형",
    content: (
      <>
        <Section title="해설 작성">
          <List items={[
            "정답 해설은 학생들이 익힐 수 있도록 상세히 풀이 작성",
            "쎈 교재 수준으로 작성하는 것을 기본으로 함",
            <>[다른 풀이]가 있으면 <Code>[다른 풀이]</Code>라 입력하고 추가 작성</>,
          ]} />
        </Section>
        <Section title="정답 라인">
          <List items={[
            "해설 구조: [정답] 라인 → 풀이 순서",
            "정답에 bold 처리 금지 (수식도 bold 금지)",
            "16페이지의 기본 [정답] 틀은 진하기/밑줄 등 수정하지 않음",
            "정답 라인 밑에 \"해설\", \"풀이\"라는 문구를 넣지 않음",
          ]} />
        </Section>
        <Section title="shift+enter 규칙">
          <List items={[
            <><Code>{"<hp:lineBreak>"}</Code> 사용 금지</>,
            "유일한 예외: [정답] 라인이 길어져서 2줄로 넘어갈 때만 허용",
          ]} />
        </Section>
        <Section title="서술형">
          <List items={[
            <><Code>[서술형 N]</Code> 형식으로 입력 (N은 일반 숫자)</>,
            "[단답형], [논술형]으로 되어 있어도 모두 [서술형 N]으로 변환",
            "소문항 번호: 모두 (1), (2)로 통일",
            "소문항에 점수가 있으면 전체 배점은 적지 않음",
            "소문항 배점이 없으면 전체 배점 기입 (오른쪽 정렬)",
          ]} />
        </Section>
        <Section title="해설 수식 규칙">
          <List items={[
            "통수식 금지 — 등호 단위로 끊어서 입력",
            "경우를 나누어 푸는 경우: i), ii) 또는 (i), (ii) — 문자표 로마자 사용",
            "cdotscdots 다음의 원문자(㉠, ㉡ 등)는 수식 내부가 아닌 바탕글(본문)에서 작성",
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "5. 단서 조항 처리",
    content: (
      <>
        <Section title="기본 원칙">
          <List items={[
            "문제 텍스트 뒤에 단서 조항 + 배점이 모두 들어가면 그대로 작업한다.",
          ]} />
        </Section>
        <Section title="Case 1: 단서 조항이 한 줄">
          <List items={[
            <>엔터 치고 오른쪽 정렬 (<Code>paraPrIDRef="4"</Code>)</>,
          ]} />
          <Example label="예시">
{`좌표평면 위의 네 점 A(-2, -1), B(-3, a), C(b, c), D(2, 0)에 대하여
사각형 ABCD가 마름모를 이룰 때, a+b+c의 값은?
                              (단, a, b, c는 양수이다.) [4.4점]`}
          </Example>
        </Section>
        <Section title="Case 2: 단서 조항이 두 줄 이상">
          <List items={[
            "문제 뒤에 이어서 작업한다 (엔터 안 침)",
          ]} />
          <Example label="예시">
{`정규분포 N(m, 10²)을 따르는 모집단에서 크기가 n인 표본을 임의추출할 때,
표본평균과 모평균의 차가 3α+1 이하일 확률은 0.9974이다. 이때 자연수 n, α에
대하여 n+α의 값은? (단, Z가 표준정규분포를 따르는 확률변수일 때,
P(0≤Z≤3)=0.4987로 계산하다.) [4.3점]`}
          </Example>
        </Section>
        <Section title="배점만 남는 경우">
          <List items={[
            <>단서 조항을 이어서 쓴 후에도 배점만 남으면: 배점만 따로 오른쪽 정렬 (<Code>paraPrIDRef="4"</Code>)</>,
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "6. 파일명 / 단원 분류",
    content: (
      <>
        <Section title="PDF 제목 형식">
          <Example>
            {"[코드][고][년도][학기-차수][지역][학교][과목][코드]"}
          </Example>
          <Example label="예시">
            {"[01001][고][2019][1-2-a][충남공주시][공주사대부고][수하][01001]"}
          </Example>
        </Section>
        <Section title="작업 HWPX 제목 형식">
          <Example>
            {"[코드][고][년도][학기-차수][지역][학교][과목][범위][코드][작업자][검수자][그림코드]"}
          </Example>
          <Example label="예시">
            {"[01001][고][2019][1-2-a][충남공주시][공주사대부고][수하][도형의 이동-명제][01001][그림2-3-1-0]"}
          </Example>
        </Section>
        <Section title="그림 코드">
          <List items={[
            <><Code>[그림A-B-C-D]</Code> — A: 문제그림 총수, B: 해설그림 총수, C: 작업자 문제그림 수, D: 작업자 해설그림 수</>,
            <>예: <Code>[그림2-3-1-0]</Code> = 문제그림 2개 중 1개 작업, 해설그림 3개 중 0개 작업</>,
          ]} />
        </Section>
        <Section title="범위 작성">
          <List items={[
            "파일명의 범위: 대단원명까지만 기재",
            "문서 내 [중단원] 태그: 양식지 단원분류표의 정규 단원명을 그대로 사용",
            "수II와 미적분의 도함수활용 단원은 4개로 세분화 (접선-평균값정리, 극대극소-최대최소, 방정식-부등식, 변화율-속도-가속도)",
          ]} />
        </Section>
        <Section title="난이도">
          <List items={[
            <>4단계: <Code>하</Code> / <Code>중</Code> / <Code>상</Code> / <Code>킬</Code></>,
            "\"최상\", \"최하\", \"보통\" 등 비표준 난이도 금지",
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "7. 그림 / 박스 / 특수 템플릿",
    content: (
      <>
        <Section title="그림 배치">
          <List items={[
            "모든 생성 그림에 NGD 워터마크 필수 (오른쪽 하단, 작고 연한 회색)",
            <>오른쪽 배치: 문제 첫 어절 뒤, <Code>textWrap="AROUND"</Code> + <Code>horzAlign="RIGHT"</Code> + <Code>vertAlign="TOP"</Code></>,
            <>단독 배치 (중간/끝): <Code>treatAsChar="1"</Code> + <Code>paraPrIDRef="2"</Code> (가운데 정렬)</>,
          ]} />
        </Section>
        <Section title="박스 종류 (5가지)">
          <List items={[
            "빈박스 (empty_box) — 답안 작성 공간",
            "보기틀 (bogi) — < 보 기 > 헤더 + ㄱ/ㄴ/ㄷ 항목",
            "그림보기틀 (image_choice) — 그림 포함 선지",
            "조건틀 (condition) — (가)/(나)/(다) 조건",
            "증명틀 (proof) — [ 증 명 ] 헤더 + 증명 내용",
          ]} />
        </Section>
        <Section title="특수 템플릿 (양식지에서 추출)">
          <List items={[
            "함수 증감표 — f'(x), f(x) 부호 변화와 증감 (2열/3열/4열/6열 변형)",
            "확률분포표 — 이산확률변수 X의 확률분포 (3~5열)",
            "표준 정규분포표 — P(0≤Z≤z) 값 (약 20가지 변형)",
            "조립제법 틀 — 다항식 나눗셈 과정",
            "파스칼삼각형 — 이항계수 삼각형 (수식/숫자 표기)",
          ]} />
        </Section>
        <Section title="기타">
          <List items={[
            "(가), (나), (다) — 문자표 사용하지 않고 한글 그대로 입력",
            "제곱근표/상용로그표 — 표를 직접 작성 (이미지 붙여넣기 금지)",
          ]} />
        </Section>
      </>
    ),
  },
];

// ============================================================
//  오검 참고사항
// ============================================================

export const reviewGuidePages: GuidePage[] = [
  {
    title: "1. 편집오검 내역표 (1~11번)",
    content: (
      <>
        <Section title="1. 배점 위치 수정">
          <List items={[
            "문제와 배점 사이 한 칸",
            "배점 숫자는 반드시 수식으로 입력",
          ]} />
        </Section>
        <Section title="2. 단서 조항 위치 수정">
          <List items={[
            "(단, ~) 문제 끝에서 한 칸 띄우고 입력",
            "한 줄에 안 들어가면: 한 줄이면 오른쪽 정렬, 두 줄 이상이면 이어서 작업",
            "배점만 남으면 배점만 오른쪽 정렬",
          ]} />
        </Section>
        <Section title="3. 조건틀, 보기틀, 증명틀 수정">
          <List items={[
            "조건/보기/증명 틀 형식이 양식지와 일치하는지 확인",
          ]} />
        </Section>
        <Section title="4. 확률과통계, 좌표 로마체 수정">
          <List items={[
            <>순열/조합/확률/분포 기호: <Code>{"{rmP}"}</Code>, <Code>{"{rmC}"}</Code>, <Code>{"{rmN}"}</Code></>,
            <>단위/도형 대문자: <Code>rmA</Code>, <Code>rmB</Code>, <Code>{"rm kg"}</Code></>,
          ]} />
        </Section>
        <Section title="5. therefore / because 수정">
          <List items={[
            <>therefore/because 뒤에 <Code>~</Code> 필수</>,
          ]} />
        </Section>
        <Section title="6. cdots 수정">
          <List items={[
            <>형식: [수식] + backtick + <Code>cdots</Code> + backtick + [수식]</>,
          ]} />
        </Section>
        <Section title="7. 괄호 수정">
          <List items={[
            <>분수 괄호: <Code>left(</Code> <Code>right)</Code> 사용</>,
          ]} />
        </Section>
        <Section title="8~11">
          <List items={[
            "8. 소문항 번호: (1), (2)로 통일",
            "9. 통수식: 등호 단위로 끊기",
            "10. 워딩규칙 준수, 중단원표페이지 삭제",
            "11. 제작연월일 확인",
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "2. 편집오검 내역표 (12~22번)",
    content: (
      <>
        <Section title="12. 글자크기, 수식 크기 수정">
          <List items={[
            <>서체: <Code>나눔고딕 10</Code>, 수식크기 <Code>11</Code>, 수식서체 <Code>HYhwpEQ</Code></>,
          ]} />
        </Section>
        <Section title="13. 비표 수정">
          <List items={[
            "비표(제곱근표/상용로그표): 한글 표로 직접 작업",
            "이미지 붙여넣기 금지",
          ]} />
        </Section>
        <Section title="14. 바탕글 이외의 스타일 삭제">
          <List items={[
            "F6 스타일: 바탕글 1개만 남겨야 함",
          ]} />
        </Section>
        <Section title="15. 문제의 독립수식 tab으로 수정">
          <List items={[
            "문제에서 독립줄 수식: 탭 들여쓰기",
            "해설에서는 적용하지 않음",
          ]} />
        </Section>
        <Section title="16. 중단원명 수정">
          <List items={[
            "중단원명과 난이도 입력 확인",
            "단원분류표(.claude/data/unit_classification.json)와 일치해야 함",
          ]} />
        </Section>
        <Section title="17. 콤마 수정">
          <List items={[
            <>쉼표 뒤 한 칸: <Code>~</Code> 또는 backtick 사용</>,
          ]} />
        </Section>
        <Section title="18. 그림, 표 위치 수정">
          <List items={[
            "오른쪽 배치: 문제 첫 어절 뒤, AROUND + RIGHT + TOP",
            "단독 배치: treatAsChar, 가운데 정렬",
          ]} />
        </Section>
        <Section title="19~22">
          <List items={[
            "19. 문제/그림과 객관식 보기 사이에 한 줄 띄움",
            "20. 미주와 문제 시작시 띄어쓰기 없음",
            "21. 서술형문제번호: [서술형 N] 형식",
            "22. 해설 항상 좌측 정렬 (들여쓰기 안함)",
          ]} />
        </Section>
      </>
    ),
  },
  {
    title: "3. 추가 검증 항목",
    content: (
      <>
        <Section title="정답/해설">
          <List items={[
            "정답 bold 처리 금지",
            "정답 라인 밑에 \"해설\", \"풀이\" 문구 넣지 않음",
            "[다른 풀이]가 있으면 [다른 풀이]라 입력하고 추가 작성",
            <><Code>shift+enter</Code> 사용금지 (정답 라인 2줄 넘어갈 때만 허용)</>,
          ]} />
        </Section>
        <Section title="수식 세부 규칙">
          <List items={[
            <>절댓값: 수식 기호 사용 (<Code>left|</Code> <Code>right|</Code>)</>,
            <>내적: <Code>cdot</Code> (bullet 아님)</>,
            <>부등호 뒤 음수: <Code>it</Code> 사용</>,
            <>극한 음수: <Code>{"lim_{x->it-2}"}</Code></>,
            "수식창 안에서 한글 작업 안함",
            <>여집합: 소문자 <Code>c</Code>, 합집합/교집합: <Code>cup</Code>, <Code>cap</Code></>,
            <>명제: <Code>{"p ` -> ` q"}</Code></>,
            <><Code>cases</Code>: <Code>&</Code> 3개 정렬</>,
            "삼각함수/로그 분수 뒤: 올바른 입력 확인",
          ]} />
        </Section>
        <Section title="기타">
          <List items={[
            "(가)(나)(다): 문자표 사용 안함, 한글 그대로 입력",
            "머릿말 오른쪽칸: 학년/과정/과목/출판사/시험범위",
            "서술형 전체 배점은 소문항에 점수 있으면 적지 않음",
            "서술형 소문항 번호: 모두 (1), (2)로 통일",
          ]} />
        </Section>
      </>
    ),
  },
];
