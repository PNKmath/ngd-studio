import type { CropBox } from "./types";

interface Viewport {
  displayWidth: number;
  displayHeight: number;
  imageWidth: number;
  imageHeight: number;
}

/** 화면 좌표 (clientX, clientY 기준 컨테이너 상대) → 이미지 픽셀 좌표 */
export function screenToImage(
  screenX: number,
  screenY: number,
  viewport: Viewport
): { x: number; y: number } {
  const scaleX = viewport.imageWidth / viewport.displayWidth;
  const scaleY = viewport.imageHeight / viewport.displayHeight;
  return {
    x: screenX * scaleX,
    y: screenY * scaleY,
  };
}

/** 이미지 픽셀 좌표 → 화면 좌표 */
export function imageToScreen(
  imgX: number,
  imgY: number,
  viewport: Viewport
): { x: number; y: number } {
  const scaleX = viewport.displayWidth / viewport.imageWidth;
  const scaleY = viewport.displayHeight / viewport.imageHeight;
  return {
    x: imgX * scaleX,
    y: imgY * scaleY,
  };
}

/** w/h가 음수인 박스 → 정규화 (드래그 방향 무관하게 양수) */
export function normalizeBox(box: {
  x: number;
  y: number;
  w: number;
  h: number;
}): { x: number; y: number; w: number; h: number } {
  return {
    x: box.w >= 0 ? box.x : box.x + box.w,
    y: box.h >= 0 ? box.y : box.y + box.h,
    w: Math.abs(box.w),
    h: Math.abs(box.h),
  };
}

/** 박스를 페이지 경계에 클램프 */
export function clampBox(
  box: { x: number; y: number; w: number; h: number },
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, Math.min(box.x, pageWidth));
  const y = Math.max(0, Math.min(box.y, pageHeight));
  const x2 = Math.max(0, Math.min(box.x + box.w, pageWidth));
  const y2 = Math.max(0, Math.min(box.y + box.h, pageHeight));
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * 같은 페이지의 박스들을 Y좌표(ties면 X) 순으로 정렬하여 자동 번호 부여.
 * 페이지 순(0,1,2…) → 각 페이지 내 Y → 같은 Y면 X 순으로 1부터 매김.
 */
export function autoNumber(boxes: CropBox[]): CropBox[] {
  const sorted = [...boxes].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return sorted.map((box, i) => ({ ...box, number: i + 1 }));
}
