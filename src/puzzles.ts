import type { Puzzle } from "./types";

/** Difficulty levels shown on the homepage. */
export const difficulties = ["easy", "medium", "heart"] as const;
export type Difficulty = (typeof difficulties)[number];

/**
 * All puzzles keyed by URL slug. The slug is used as the route parameter.
 * Not every puzzle needs to appear on the homepage — only those listed in
 * `difficulties` are shown there, but any key here is navigable via URL.
 */
export const puzzles: Record<string, Puzzle> = {
  easy: {
    cells: [
      [6, 5],
      [6, 4],
      [5, 3],
      [4, 3],
      [3, 2],
      [5, 6],
      [3, 7],
      [4, 6],
      [2, 7],
      [2, 2],
      [1, 2],
      [3, 3],
      [5, 4],
      [5, 5],
      [3, 6],
      [1, 7],
    ],
    regions: [
      {
        id: "A",
        cells: [
          [5, 5],
          [5, 4],
          [6, 4],
          [6, 5],
        ],
        constraint: {
          kind: "product",
          target: 0,
        },
        color: "#c5e1a5",
      },
      {
        id: "B",
        cells: [[1, 2]],
        constraint: {
          kind: "less",
          target: 3,
        },
        color: "#e6ee9c",
      },
      {
        id: "C",
        cells: [[1, 7]],
        constraint: {
          kind: "less",
          target: 3,
        },
        color: "#f4a0a0",
      },
      {
        id: "D",
        cells: [[2, 2]],
        constraint: {
          kind: "less",
          target: 3,
        },
        color: "#a0c4e8",
      },
      {
        id: "E",
        cells: [[2, 7]],
        constraint: {
          kind: "less",
          target: 3,
        },
        color: "#a0d8a0",
      },
      {
        id: "F",
        cells: [[3, 2]],
        constraint: {
          kind: "mirror",
          group: "n",
        },
        color: "#c4a0d8",
      },
      {
        id: "G",
        cells: [[3, 7]],
        constraint: {
          kind: "mirror",
          group: "n",
        },
        color: "#c4a0d8",
      },
      {
        id: "H",
        cells: [
          [3, 3],
          [4, 3],
          [5, 3],
        ],
        constraint: {
          kind: "sum",
          target: 2,
        },
        color: "#f48fb1",
      },
      {
        id: "I",
        cells: [
          [3, 6],
          [4, 6],
          [5, 6],
        ],
        constraint: {
          kind: "sum",
          target: 14,
        },
        color: "#80deea",
      },
    ],
    dominoes: [
      {
        id: "d1",
        values: [0, 2],
      },
      {
        id: "d2",
        values: [2, 6],
      },
      {
        id: "d3",
        values: [3, 6],
      },
      {
        id: "d4",
        values: [2, 5],
      },
      {
        id: "d5",
        values: [0, 1],
      },
      {
        id: "d6",
        values: [1, 2],
      },
      {
        id: "d7",
        values: [2, 1],
      },
      {
        id: "d8",
        values: [2, 2],
      },
    ],
  },

  medium: {
    cells: [
      [7, 8],
      [6, 8],
      [5, 8],
      [4, 8],
      [5, 5],
      [2, 8],
      [5, 7],
      [5, 6],
      [5, 9],
      [1, 8],
      [3, 8],
      [3, 7],
      [2, 7],
      [3, 6],
      [4, 5],
      [4, 6],
      [5, 3],
      [7, 3],
      [6, 3],
      [4, 3],
      [3, 3],
      [2, 3],
      [3, 2],
      [3, 1],
    ],
    regions: [
      {
        id: "15",
        cells: [[7, 8]],
        constraint: {
          kind: "greater",
          target: 1,
        },
        color: "#c4a0d8",
      },
      {
        id: "16",
        cells: [
          [1, 8],
          [2, 8],
          [3, 8],
        ],
        constraint: {
          kind: "product",
          target: 6,
        },
        color: "#ffcc80",
      },
      {
        id: "17",
        cells: [
          [6, 3],
          [5, 3],
        ],
        constraint: {
          kind: "mirror",
          group: "n",
        },
        color: "#f48fb1",
      },
      {
        id: "18",
        cells: [
          [3, 3],
          [3, 2],
        ],
        constraint: {
          kind: "mirror",
          group: "n",
        },
        color: "#f48fb1",
      },
      {
        id: "19",
        cells: [[7, 3]],
        constraint: {
          kind: "greater",
          target: 2,
        },
        color: "#80deea",
      },
      {
        id: "21",
        cells: [
          [4, 8],
          [5, 8],
          [6, 8],
          [5, 7],
        ],
        constraint: {
          kind: "not-equal",
        },
        color: "#bcaaa4",
      },
      {
        id: "23",
        cells: [[5, 5]],
        constraint: {
          kind: "sum",
          target: 6,
        },
        color: "#e6ee9c",
      },
      {
        id: "24",
        cells: [
          [4, 5],
          [4, 6],
          [3, 6],
          [3, 7],
          [2, 7],
        ],
        constraint: {
          kind: "not-equal",
        },
        color: "#f4a0a0",
      },
      {
        id: "25",
        cells: [[3, 1]],
        constraint: {
          kind: "less",
          target: 3,
        },
        color: "#a0c4e8",
      },
      {
        id: "27",
        cells: [[2, 3]],
        constraint: {
          kind: "mirror",
          group: "m",
        },
        color: "#c4a0d8",
      },
      {
        id: "28",
        cells: [[5, 9]],
        constraint: {
          kind: "mirror",
          group: "m",
        },
        color: "#c4a0d8",
      },
    ],
    dominoes: [
      {
        id: "d15",
        values: [4, 2],
      },
      {
        id: "d20",
        values: [2, 3],
      },
      {
        id: "d21",
        values: [1, 6],
      },
      {
        id: "d22",
        values: [0, 6],
      },
      {
        id: "d23",
        values: [1, 3],
      },
      {
        id: "d24",
        values: [2, 3],
      },
      {
        id: "d25",
        values: [5, 1],
      },
      {
        id: "d26",
        values: [4, 2],
      },
      {
        id: "d27",
        values: [1, 4],
      },
      {
        id: "d28",
        values: [3, 5],
      },
      {
        id: "d29",
        values: [2, 6],
      },
      {
        id: "d30",
        values: [5, 1],
      },
    ],
  },

  heart: {
    cells: [
      [0, 2],
      [0, 3],
      [0, 6],
      [0, 7],
      [1, 1],
      [2, 0],
      [3, 0],
      [4, 1],
      [5, 2],
      [6, 3],
      [7, 4],
      [7, 5],
      [6, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 9],
      [1, 8],
      [1, 5],
      [1, 4],
      [1, 2],
      [5, 3],
      [6, 4],
      [6, 5],
      [5, 6],
      [1, 3],
      [1, 6],
      [1, 7],
      [4, 7],
      [4, 2],
      [2, 1],
      [3, 1],
      [2, 8],
      [3, 8],
    ],
    regions: [
      {
        id: "A",
        cells: [
          [2, 1],
          [2, 0],
          [3, 0],
          [3, 1],
        ],
        constraint: {
          kind: "mirror",
          group: "n",
        },
        color: "#f4a0a0",
      },
      {
        id: "B",
        cells: [
          [2, 8],
          [2, 9],
          [3, 9],
          [3, 8],
        ],
        constraint: {
          kind: "mirror",
          group: "n",
        },
        color: "#f4a0a0",
      },
      {
        id: "C",
        cells: [
          [1, 1],
          [1, 2],
          [0, 2],
        ],
        constraint: {
          kind: "product",
          target: 12,
        },
        color: "#a0d8a0",
      },
      {
        id: "D",
        cells: [
          [0, 3],
          [1, 3],
          [1, 4],
          [1, 5],
          [1, 6],
          [0, 6],
          [0, 7],
        ],
        constraint: {
          kind: "not-equal",
        },
        color: "#c4a0d8",
      },
      {
        id: "E",
        cells: [
          [1, 7],
          [1, 8],
        ],
        constraint: {
          kind: "equal",
        },
        color: "#ffcc80",
      },
      {
        id: "F",
        cells: [
          [4, 8],
          [4, 7],
          [5, 7],
        ],
        constraint: {
          kind: "greater",
          target: 11,
        },
        color: "#f48fb1",
      },
      {
        id: "G",
        cells: [
          [6, 5],
          [6, 4],
          [7, 4],
          [7, 5],
        ],
        constraint: {
          kind: "product",
          target: 72,
        },
        color: "#c5e1a5",
      },
      {
        id: "H",
        cells: [
          [5, 6],
          [6, 6],
        ],
        constraint: {
          kind: "less",
          target: 100,
        },
        color: "#ffe082",
      },
      {
        id: "I",
        cells: [
          [4, 1],
          [4, 2],
          [5, 2],
          [5, 3],
          [6, 3],
        ],
        constraint: {
          kind: "sum",
          target: 15,
        },
        color: "#bcaaa4",
      },
    ],
    dominoes: [
      {
        id: "d1",
        values: [3, 2],
      },
      { id: "d2", values: [3, 2] },
      { id: "d3", values: [2, 0] },
      {
        id: "d4",
        values: [1, 6],
      },
      {
        id: "d5",
        values: [4, 5],
      },
      {
        id: "d6",
        values: [0, 5],
      },
      {
        id: "d7",
        values: [5, 3],
      },
      {
        id: "d8",
        values: [2, 2],
      },
      {
        id: "d9",
        values: [3, 6],
      },
      {
        id: "d10",
        values: [6, 2],
      },
      {
        id: "d11",
        values: [3, 1],
      },
      {
        id: "d12",
        values: [1, 3],
      },
      {
        id: "d13",
        values: [4, 5],
      },
      {
        id: "d14",
        values: [1, 4],
      },
      {
        id: "d15",
        values: [3, 6],
      },
      {
        id: "d16",
        values: [4, 2],
      },
      {
        id: "d17",
        values: [0, 0],
      },
    ],
  },
};
