import { describe, it, expect } from "vitest";
import {
  screenToImage,
  imageToScreen,
  normalizeBox,
  clampBox,
  autoNumber,
} from "../coords";
import type { CropBox } from "../types";

const viewport = {
  displayWidth: 400,
  displayHeight: 600,
  imageWidth: 800,
  imageHeight: 1200,
};

describe("screenToImage / imageToScreen round-trip", () => {
  it("round-trips from screen to image and back", () => {
    const sx = 100;
    const sy = 150;
    const img = screenToImage(sx, sy, viewport);
    const screen = imageToScreen(img.x, img.y, viewport);
    expect(screen.x).toBeCloseTo(sx);
    expect(screen.y).toBeCloseTo(sy);
  });

  it("scales correctly (2x scale in both axes)", () => {
    const img = screenToImage(50, 75, viewport);
    expect(img.x).toBe(100);
    expect(img.y).toBe(150);
  });
});

describe("normalizeBox", () => {
  it("keeps positive w/h unchanged", () => {
    expect(normalizeBox({ x: 10, y: 20, w: 30, h: 40 })).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it("normalizes negative w (drag left)", () => {
    expect(normalizeBox({ x: 100, y: 20, w: -30, h: 40 })).toEqual({
      x: 70,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it("normalizes negative h (drag up)", () => {
    expect(normalizeBox({ x: 10, y: 100, w: 30, h: -40 })).toEqual({
      x: 10,
      y: 60,
      w: 30,
      h: 40,
    });
  });

  it("handles zero w and h", () => {
    expect(normalizeBox({ x: 5, y: 5, w: 0, h: 0 })).toEqual({
      x: 5,
      y: 5,
      w: 0,
      h: 0,
    });
  });
});

describe("clampBox", () => {
  it("leaves box inside page unchanged", () => {
    expect(clampBox({ x: 10, y: 10, w: 100, h: 100 }, 800, 1200)).toEqual({
      x: 10,
      y: 10,
      w: 100,
      h: 100,
    });
  });

  it("clamps box that extends beyond right/bottom", () => {
    const result = clampBox({ x: 750, y: 1150, w: 100, h: 100 }, 800, 1200);
    expect(result.x).toBe(750);
    expect(result.y).toBe(1150);
    expect(result.w).toBe(50);
    expect(result.h).toBe(50);
  });

  it("clamps box with negative starting point", () => {
    const result = clampBox({ x: -20, y: -10, w: 80, h: 60 }, 800, 1200);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.w).toBe(60);
    expect(result.h).toBe(50);
  });
});

describe("autoNumber", () => {
  it("returns empty array for empty input", () => {
    expect(autoNumber([])).toEqual([]);
  });

  it("numbers single box as 1", () => {
    const box: CropBox = { id: "a", page: 0, x: 0, y: 0, w: 100, h: 100, number: 99 };
    const result = autoNumber([box]);
    expect(result[0].number).toBe(1);
  });

  it("numbers boxes by array index (creation/sort order), not position", () => {
    // 위치(y) 순서와 배열 순서가 다른 경우 — 배열 순서 우선이어야 함
    const boxes: CropBox[] = [
      { id: "a", page: 0, x: 0, y: 300, w: 100, h: 100, number: 0 }, // y큼
      { id: "b", page: 0, x: 0, y: 100, w: 100, h: 100, number: 0 }, // y작음
      { id: "c", page: 1, x: 0, y: 50, w: 100, h: 100, number: 0 },
    ];
    const result = autoNumber(boxes);
    expect(result.map((r) => [r.id, r.number])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("preserves user-reordered order across pages", () => {
    // page 1 박스를 page 0 박스 앞에 배치한 시나리오 (drag-and-drop 재정렬)
    const boxes: CropBox[] = [
      { id: "x", page: 1, x: 0, y: 0, w: 100, h: 100, number: 0 },
      { id: "y", page: 0, x: 0, y: 0, w: 100, h: 100, number: 0 },
    ];
    const result = autoNumber(boxes);
    expect(result[0].id).toBe("x");
    expect(result[0].number).toBe(1);
    expect(result[1].id).toBe("y");
    expect(result[1].number).toBe(2);
  });

  it("does not mutate original array", () => {
    const boxes: CropBox[] = [
      { id: "x", page: 0, x: 0, y: 200, w: 100, h: 100, number: 0 },
      { id: "y", page: 0, x: 0, y: 100, w: 100, h: 100, number: 0 },
    ];
    const originalOrder = boxes.map((b) => b.id);
    autoNumber(boxes);
    expect(boxes.map((b) => b.id)).toEqual(originalOrder);
  });
});
