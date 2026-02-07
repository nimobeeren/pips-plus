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
 *   A (top-left, rose): (0,0) (0,1) (1,0)          — sum = 8
 *   B (top-right, sky): (0,2) (1,2) (1,3)         — not-equal
 *   C (right, green):   (2,2) (2,3)               — > 2
 *   D (bottom-left, violet): (2,0) (2,1) (3,1)    — equal
 *   E (bottom tip, sand): (3,2)                   — blank
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
      constraint: { kind: "sum", target: 8 },
      color: "#f4a0a0",
    },
    {
      id: "B",
      cells: [
        [0, 2],
        [1, 2],
        [1, 3],
      ],
      constraint: { kind: "not-equal" },
      color: "#a0c4e8",
    },
    {
      id: "C",
      cells: [
        [2, 2],
        [2, 3],
      ],
      constraint: { kind: "greater", target: 2 },
      color: "#a0d8a0",
    },
    {
      id: "D",
      cells: [
        [2, 0],
        [2, 1],
        [3, 1],
      ],
      constraint: { kind: "equal" },
      color: "#c4a0d8",
    },
    {
      id: "E",
      cells: [[3, 2]],
      constraint: { kind: "none" },
      color: "#e8c4a0",
    },
  ],
  dominoes: [
    { id: "d1", values: [4, 4] },
    { id: "d2", values: [5, 6] },
    { id: "d3", values: [1, 4] },
    { id: "d4", values: [2, 3] },
    { id: "d5", values: [0, 5] },
    { id: "d6", values: [1, 6] },
  ],
};
