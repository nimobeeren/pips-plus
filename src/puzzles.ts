import type { Puzzle } from "./types";

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
export const starterPuzzle: Puzzle = {
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
};
