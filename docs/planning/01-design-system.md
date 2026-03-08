# NGD Studio — 디자인 시스템

> 파스텔 톤 기반의 차분하고 통일된 시각 체계

참조: [00-overview.md](./00-overview.md) | [02-phase-checklist.md](./02-phase-checklist.md)

---

## 1. 디자인 원칙

1. **차분함**: 파스텔 톤으로 시각적 피로 최소화
2. **통일성**: 하나의 베이스 색조(라벤더)에서 파생된 일관된 팔레트
3. **명확함**: 상태/역할별 색상이 즉시 구분 가능
4. **절제**: 장식 최소화, 정보 전달에 집중

---

## 2. 색상 팔레트

### 2.1 베이스 컬러 (Neutral — Warm Gray 계열)

배경과 표면에 사용. 차가운 회색 대신 따뜻한 톤으로 부드러움 유지.

| 역할 | 이름 | HEX | HSL | 용도 |
|---|---|---|---|---|
| 배경 | `bg-base` | `#F8F7F4` | 40 20% 96% | 페이지 배경 |
| 표면 | `bg-surface` | `#FFFFFF` | 0 0% 100% | 카드, 패널 |
| 표면 (강조) | `bg-surface-alt` | `#F2F0EB` | 38 18% 93% | 사이드바, 헤더 |
| 보더 | `border-default` | `#E5E2DB` | 38 16% 88% | 구분선, 카드 테두리 |
| 보더 (약함) | `border-subtle` | `#EDEBE6` | 38 16% 92% | 내부 구분선 |
| 텍스트 (강) | `text-primary` | `#2D2A26` | 32 8% 16% | 제목, 본문 |
| 텍스트 (중) | `text-secondary` | `#6B6560` | 25 6% 40% | 보조 텍스트 |
| 텍스트 (약) | `text-muted` | `#9C9590` | 20 5% 59% | 힌트, 비활성 |

### 2.2 프라이머리 컬러 (Lavender — 보라 파스텔)

브랜드 색상. 버튼, 링크, 활성 상태에 사용.

| 역할 | 이름 | HEX | HSL | 용도 |
|---|---|---|---|---|
| 가장 연한 | `primary-50` | `#F0EEFB` | 248 60% 96% | 배지 배경, 호버 |
| 연한 | `primary-100` | `#DED8F5` | 250 58% 90% | 선택된 항목 배경 |
| 기본 | `primary-400` | `#9B8CE0` | 252 56% 71% | 버튼, 링크 |
| 강조 | `primary-500` | `#7C6BC8` | 252 45% 60% | 버튼 호버 |
| 진한 | `primary-700` | `#5A4A9E` | 252 36% 45% | 액티브, 포커스 |
| 텍스트 | `primary-900` | `#3D3370` | 252 36% 32% | 프라이머리 텍스트 |

### 2.3 상태 컬러 (파스텔 톤 통일)

모두 채도 40~55%, 명도 85~92%로 맞춰 파스텔 톤 통일.

| 상태 | 이름 | Light (배경) | Medium (아이콘/텍스트) | 용도 |
|---|---|---|---|---|
| 성공 | `success` | `#E8F5E9` | `#66A373` | 완료, 통과 |
| 진행중 | `info` | `#E3F0FB` | `#5B9BD5` | 진행중, 정보 |
| 경고 | `warning` | `#FFF3E0` | `#D4943A` | 주의, 부분완료 |
| 오류 | `error` | `#FDECEA` | `#D4594E` | 실패, 오류 |
| 대기 | `neutral` | `#F2F0EB` | `#9C9590` | 대기, 비활성 |

### 2.4 파이프라인 단계 컬러

각 에이전트 단계별 고유색. 프라이머리 색조에서 변주.

| 단계 | 이름 | Dot Color | Light BG | 용도 |
|---|---|---|---|---|
| reader | `stage-reader` | `#7BAFD4` | `#EAF3FA` | PDF 읽기 |
| solver | `stage-solver` | `#9B8CE0` | `#F0EEFB` | 해설 생성 |
| figure | `stage-figure` | `#D4943A` | `#FFF6EB` | 그림 처리 |
| builder | `stage-builder` | `#66A373` | `#EDF7EF` | HWPX 조립 |
| checker | `stage-checker` | `#C07BAF` | `#F8EDF5` | 품질 검수 |

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

| 용도 | 폰트 | 비고 |
|---|---|---|
| 본문/UI | Pretendard | Variable, 한글 최적화 |
| 코드/로그 | JetBrains Mono | 모노스페이스 |

### 3.2 스케일

| 이름 | 크기 | 무게 | 행간 | 용도 |
|---|---|---|---|---|
| `heading-lg` | 24px | 600 (SemiBold) | 32px | 페이지 제목 |
| `heading-md` | 18px | 600 | 26px | 섹션 제목 |
| `heading-sm` | 15px | 600 | 22px | 카드 제목 |
| `body` | 14px | 400 (Regular) | 22px | 본문 |
| `body-sm` | 13px | 400 | 20px | 보조 텍스트 |
| `caption` | 12px | 400 | 16px | 라벨, 타임스탬프 |
| `code` | 13px | 400 | 20px | 로그, 코드 (JetBrains Mono) |

---

## 4. 간격 & 레이아웃

### 4.1 간격 스케일 (4px 기반)

| 토큰 | 값 | 용도 |
|---|---|---|
| `space-1` | 4px | 아이콘-텍스트 간격 |
| `space-2` | 8px | 인라인 요소 간격 |
| `space-3` | 12px | 카드 내부 패딩 (소) |
| `space-4` | 16px | 카드 내부 패딩 (기본) |
| `space-6` | 24px | 섹션 간격 |
| `space-8` | 32px | 페이지 패딩 |

### 4.2 라운딩

| 토큰 | 값 | 용도 |
|---|---|---|
| `radius-sm` | 6px | 버튼, 인풋 |
| `radius-md` | 8px | 카드 |
| `radius-lg` | 12px | 모달, 큰 패널 |
| `radius-full` | 9999px | 배지, 도트 |

### 4.3 그림자

최소한의 그림자로 깊이 표현.

```css
--shadow-sm: 0 1px 2px rgba(45, 42, 38, 0.04);
--shadow-md: 0 2px 8px rgba(45, 42, 38, 0.06);
--shadow-lg: 0 4px 16px rgba(45, 42, 38, 0.08);
```

---

## 5. 컴포넌트 스타일 가이드

### 5.1 버튼

| 종류 | 배경 | 텍스트 | 호버 |
|---|---|---|---|
| Primary | `primary-400` | white | `primary-500` |
| Secondary | `bg-surface` | `text-primary` | `bg-surface-alt` |
| Ghost | transparent | `text-secondary` | `bg-surface-alt` |
| Danger | `error` light | `error` medium | error medium 10% |

### 5.2 카드

```
배경: bg-surface (white)
보더: border-default (1px solid)
패딩: space-4 (16px)
라운딩: radius-md (8px)
그림자: shadow-sm
```

### 5.3 사이드바

```
배경: bg-surface-alt (#F2F0EB)
너비: 240px
활성 항목: primary-50 배경 + primary-700 텍스트
비활성 항목: text-secondary
아이콘: 20px, text-muted → 활성 시 primary-400
```

### 5.4 파이프라인 스테이지 카드

```
┌─ ● ─ reader ──────────────────┐
│  PDF 읽기                      │
│  ━━━━━━━━━━━━━━━━━━ 100%      │
│  15개 문제 추출 완료            │
└───────────────────────────────┘
- 좌측 도트: stage-reader dot color
- 배경: stage-reader light bg
- 진행 바: stage-reader dot color
- 비활성(대기): neutral 배경 + neutral 텍스트
```

### 5.5 로그 패널

```
배경: #2D2A26 (text-primary — 다크)
텍스트: #E5E2DB (border-default — 밝은 톤)
폰트: JetBrains Mono 13px
타임스탬프: text-muted
단계 라벨: 각 stage dot color
```

---

## 6. CSS 변수 (Tailwind / shadcn 연동)

```css
@layer base {
  :root {
    /* Base */
    --background: 40 20% 96%;
    --foreground: 32 8% 16%;
    --card: 0 0% 100%;
    --card-foreground: 32 8% 16%;
    --popover: 0 0% 100%;
    --popover-foreground: 32 8% 16%;

    /* Primary (Lavender) */
    --primary: 252 56% 71%;
    --primary-foreground: 0 0% 100%;

    /* Secondary */
    --secondary: 38 18% 93%;
    --secondary-foreground: 32 8% 16%;

    /* Muted */
    --muted: 38 16% 92%;
    --muted-foreground: 20 5% 59%;

    /* Accent */
    --accent: 248 60% 96%;
    --accent-foreground: 252 36% 32%;

    /* Destructive */
    --destructive: 4 55% 57%;
    --destructive-foreground: 0 0% 100%;

    /* Border & Input */
    --border: 38 16% 88%;
    --input: 38 16% 88%;
    --ring: 252 45% 60%;

    /* Radius */
    --radius: 0.5rem;
  }
}
```

---

## 7. 아이콘

- **Lucide React** (shadcn/ui 기본)
- 크기: 16px (인라인), 20px (사이드바), 24px (빈 상태)
- 색상: `text-muted` 기본, 활성/호버 시 해당 상태색

---

## 8. 반응형

최소 지원 너비: **1024px** (데스크톱 전용 도구)
- 사이드바 고정 240px
- 메인 영역 flex-1
- 최대 너비 제한 없음 (wide 모니터 지원)
