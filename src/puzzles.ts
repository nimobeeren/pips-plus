import type { Puzzle } from "./types";

/**
 * A small diamond-shaped starter puzzle (12 cells, 6 dominoes).
 *
 * Board shape:
 *     . X X .
 *     X X X X
 *     X X X X
 *     . X X .
 *
 * Regions:
 *   A (top, rose):    (0,1) (0,2) (1,1) (1,2) — sum = 10
 *   B (left, sky):    (1,0) (2,0)              — equal
 *   C (right, green): (1,3) (2,3)              — > 3
 *   D (bottom, violet): (2,1) (2,2) (3,1) (3,2) — not-equal
 */
export const starterPuzzle: Puzzle = {
  cells: [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
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
        [0, 1],
        [0, 2],
        [1, 1],
        [1, 2],
      ],
      constraint: { kind: "sum", target: 10 },
      color: "#f4a0a0",
    },
    {
      id: "B",
      cells: [
        [1, 0],
        [2, 0],
      ],
      constraint: { kind: "equal" },
      color: "#a0c4e8",
    },
    {
      id: "C",
      cells: [
        [1, 3],
        [2, 3],
      ],
      constraint: { kind: "greater", target: 3 },
      color: "#a0d8a0",
    },
    {
      id: "D",
      cells: [
        [2, 1],
        [2, 2],
        [3, 1],
        [3, 2],
      ],
      constraint: { kind: "not-equal" },
      color: "#c4a0d8",
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
