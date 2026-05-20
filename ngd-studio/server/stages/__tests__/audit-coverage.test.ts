/**
 * audit-coverage.test.ts
 *
 * Phase 8 — coverage-matrix verification.
 *
 * Verifies that every one of the 39 audit doc rows in
 * docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md
 * is (a) marked as covered and (b) has an agentic→code 동치성 declaration.
 *
 * 39 rows × 2 assertions = 78 specs.
 * Any row that is missing a coverage claim or a 동치성 note will fail here.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// audit doc 39행 ID 목록 (Phase 1 coverage-matrix.md 기반)
const AUDIT_ROW_IDS = [
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12",
  "B1", "B2", "B3", "B4", "B5", "B6", "B7",
  "C1", "C2", "C3", "C4", "C5",
  "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9",
  "E1", "E2", "E3", "E4", "E5", "E6",
];

// Resolve path relative to this file: server/stages/__tests__ → 4 levels up to repo root
const MATRIX_PATH = path.resolve(
  __dirname,
  "../../../../docs/planning/audit-driven-full-agentic-codification/coverage-matrix.md",
);

describe("audit coverage matrix", () => {
  const matrix = readFileSync(MATRIX_PATH, "utf8");

  it.each(AUDIT_ROW_IDS)("row %s is covered", (id) => {
    // Each row must declare either "본 task cover: Phase N" or "covered (선행/이전)" form.
    const re = new RegExp(`### ${id}[\\s\\S]*?(본 task cover|covered)`);
    expect(matrix).toMatch(re);
  });

  it.each(AUDIT_ROW_IDS)("row %s declares agentic→code 동치성", (id) => {
    // Each row must declare the equivalence note — either label form.
    const re = new RegExp(`### ${id}[\\s\\S]*?(agentic→code 동치성|동치성)`);
    expect(matrix).toMatch(re);
  });
});
