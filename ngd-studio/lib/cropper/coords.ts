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
 * 박스 배열의 현재 순서를 그대로 따라 1부터 번호 부여 (생성순/사용자 정렬순).
 * 위치(y,x) 기반 정렬은 하지 않는다 — 새 박스는 mouseup 시점에 배열 끝에
 * append되고, 박스 리스트 drag-and-drop 재정렬이 그대로 번호에 반영된다.
 */
export function autoNumber(boxes: CropBox[]): CropBox[] {
  return boxes.map((box, i) => ({ ...box, number: i + 1 }));
}
