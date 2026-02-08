import type { Puzzle } from "./types";

/** Difficulty levels shown on the homepage. */
export const difficulties = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof difficulties)[number];

/**
 * All puzzles keyed by URL slug. The slug is used as the route parameter.
 * Not every puzzle needs to appear on the homepage — only those listed in
 * `difficulties` are shown there, but any key here is navigable via URL.
 */
export const puzzles: Record<string, Puzzle> = {
  /**
   * A compact starter puzzle with a middle gap (12 cells, 6 dominoes).
   *
   * Board shape:
   *     X X X .
   *     X . X X
   *     X X X X
   *     . X X .
   *
   * Regions:
   *   A (L-shape, rose): (0,0) (0,1) (1,0)           — equal
   *   B (2×2, sky): (1,2) (1,3) (2,2) (2,3)          — not-equal
   *   C (MC, green): (0,2)                            — blank
   *   D (mirror "1", violet): (2,0) (2,1)             — mirror
   *   E (mirror "1", violet): (3,1) (3,2)             — mirror
   */
  easy: {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [1, 3],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [3, 1],
      [3, 2],
    ],
    regions: [
      {
        id: "A",
        cells: [
          [0, 0],
          [0, 1],
          [1, 0],
        ],
        constraint: { kind: "product", target: 64 },
        color: "#f4a0a0",
      },
      {
        id: "B",
        cells: [
          [1, 2],
          [1, 3],
          [2, 2],
          [2, 3],
        ],
        constraint: { kind: "not-equal" },
        color: "#a0c4e8",
      },
      {
        id: "C",
        cells: [[0, 2]],
        constraint: { kind: "none" },
        color: "#a0d8a0",
      },
      {
        id: "D",
        cells: [
          [2, 0],
          [2, 1],
        ],
        constraint: { kind: "mirror", group: "1" },
        color: "#c4a0d8",
      },
      {
        id: "E",
        cells: [
          [3, 1],
          [3, 2],
        ],
        constraint: { kind: "mirror", group: "1" },
        color: "#c4a0d8",
      },
    ],
    dominoes: [
      { id: "d1", values: [4, 4] },
      { id: "d2", values: [4, 2] },
      { id: "d3", values: [1, 6] },
      { id: "d4", values: [0, 3] },
      { id: "d5", values: [3, 5] },
      { id: "d6", values: [2, 6] },
    ],
  },

  /**
   * A hard puzzle on a 4×6 grid (24 cells, 12 dominoes).
   *
   * Board shape: full 4×6 rectangle.
   *
   * Regions: 12 vertical 2-cell pairs (one per column, split at the midpoint).
   * 10 product constraints + 1 mirror pair (B and I share sum=7).
   *
   * Solution (172 581 solver nodes to verify uniqueness):
   *     1 5 5 4 6 4
   *     2 5 6 4 1 5
   *     1 1 4 2 2 3
   *     6 4 6 6 2 5
   */
  hard: {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
      [3, 5],
    ],
    regions: [
      {
        id: "A",
        cells: [
          [0, 0],
          [1, 0],
        ],
        constraint: { kind: "product", target: 2 },
        color: "#f4a0a0",
      },
      {
        id: "B",
        cells: [
          [2, 0],
          [3, 0],
        ],
        constraint: { kind: "mirror", group: "1" },
        color: "#c4a0d8",
      },
      {
        id: "C",
        cells: [
          [0, 1],
          [1, 1],
        ],
        constraint: { kind: "product", target: 25 },
        color: "#a0d8a0",
      },
      {
        id: "D",
        cells: [
          [2, 1],
          [3, 1],
        ],
        constraint: { kind: "product", target: 4 },
        color: "#ffcc80",
      },
      {
        id: "E",
        cells: [
          [0, 2],
          [1, 2],
        ],
        constraint: { kind: "product", target: 30 },
        color: "#f48fb1",
      },
      {
        id: "F",
        cells: [
          [2, 2],
          [3, 2],
        ],
        constraint: { kind: "product", target: 24 },
        color: "#c5e1a5",
      },
      {
        id: "G",
        cells: [
          [0, 3],
          [1, 3],
        ],
        constraint: { kind: "product", target: 16 },
        color: "#80deea",
      },
      {
        id: "H",
        cells: [
          [2, 3],
          [3, 3],
        ],
        constraint: { kind: "product", target: 12 },
        color: "#ffe082",
      },
      {
        id: "I",
        cells: [
          [0, 4],
          [1, 4],
        ],
        constraint: { kind: "mirror", group: "1" },
        color: "#c4a0d8",
      },
      {
        id: "J",
        cells: [
          [2, 4],
          [3, 4],
        ],
        constraint: { kind: "product", target: 4 },
        color: "#bcaaa4",
      },
      {
        id: "K",
        cells: [
          [0, 5],
          [1, 5],
        ],
        constraint: { kind: "product", target: 20 },
        color: "#b0bec5",
      },
      {
        id: "L",
        cells: [
          [2, 5],
          [3, 5],
        ],
        constraint: { kind: "product", target: 15 },
        color: "#e6ee9c",
      },
    ],
    dominoes: [
      { id: "d01", values: [1, 5] },
      { id: "d02", values: [5, 4] },
      { id: "d03", values: [6, 4] },
      { id: "d04", values: [2, 1] },
      { id: "d05", values: [5, 6] },
      { id: "d06", values: [4, 2] },
      { id: "d07", values: [1, 2] },
      { id: "d08", values: [5, 3] },
      { id: "d09", values: [1, 4] },
      { id: "d10", values: [6, 4] },
      { id: "d11", values: [6, 6] },
      { id: "d12", values: [2, 5] },
    ],
  },
};
