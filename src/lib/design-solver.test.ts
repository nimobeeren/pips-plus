import { solve, validateSolution } from "@/solver";
import type { Puzzle } from "@/types";
import { describe, expect, test } from "vitest";
import { generateDominoes } from "./design-solver";

/** Helper: builds a full Puzzle from partial definition + generated result. */
function buildPuzzle(
  partial: Omit<Puzzle, "dominoes">,
  result: NonNullable<ReturnType<typeof generateDominoes>>,
): Puzzle {
  return { ...partial, dominoes: result.dominoes };
}

describe("generateDominoes", () => {
  test("empty puzzle returns empty result", () => {
    const result = generateDominoes({ cells: [], regions: [] });
    expect(result).not.toBeNull();
    expect(result!.dominoes).toEqual([]);
    expect(result!.placements).toEqual([]);
  });

  test("odd number of cells returns null", () => {
    expect(
      generateDominoes({
        cells: [
          [0, 0],
          [0, 1],
          [1, 0],
        ],
        regions: [],
      }),
    ).toBeNull();
  });

  test("2-cell puzzle with sum constraint", () => {
    const partial = {
      cells: [
        [0, 0],
        [0, 1],
      ] as [number, number][],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
          ] as [number, number][],
          constraint: { kind: "sum" as const, target: 7 },
          color: "#aaa",
        },
      ],
    };

    const result = generateDominoes(partial);
    expect(result).not.toBeNull();
    expect(result!.dominoes).toHaveLength(1);

    // The generated domino values should sum to 7
    const [a, b] = result!.dominoes[0].values;
    expect(a + b).toBe(7);

    // The resulting puzzle should be solvable by the regular solver
    const puzzle = buildPuzzle(partial, result!);
    const solution = solve(puzzle);
    expect(solution).not.toBeNull();
    expect(validateSolution(puzzle, solution!).valid).toBe(true);
  });

  test("4-cell puzzle with product constraint", () => {
    const partial = {
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ] as [number, number][],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ] as [number, number][],
          constraint: { kind: "product" as const, target: 24 },
          color: "#aaa",
        },
      ],
    };

    const result = generateDominoes(partial);
    expect(result).not.toBeNull();
    expect(result!.dominoes).toHaveLength(2);

    const puzzle = buildPuzzle(partial, result!);
    const solution = solve(puzzle);
    expect(solution).not.toBeNull();
    expect(validateSolution(puzzle, solution!).valid).toBe(true);
  });

  test("4-cell puzzle with equal constraint", () => {
    const partial = {
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ] as [number, number][],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ] as [number, number][],
          constraint: { kind: "equal" as const },
          color: "#aaa",
        },
      ],
    };

    const result = generateDominoes(partial);
    expect(result).not.toBeNull();
    expect(result!.dominoes).toHaveLength(2);

    // All pip values should be the same
    const allValues = result!.dominoes.flatMap((d) => d.values);
    expect(new Set(allValues).size).toBe(1);
  });

  test("4-cell puzzle with mirror constraints", () => {
    const partial = {
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ] as [number, number][],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
          ] as [number, number][],
          constraint: { kind: "mirror" as const, group: "1" },
          color: "#aaa",
        },
        {
          id: "R2",
          cells: [
            [1, 0],
            [1, 1],
          ] as [number, number][],
          constraint: { kind: "mirror" as const, group: "1" },
          color: "#bbb",
        },
      ],
    };

    const result = generateDominoes(partial);
    expect(result).not.toBeNull();
    expect(result!.dominoes).toHaveLength(2);

    const puzzle = buildPuzzle(partial, result!);
    const solution = solve(puzzle);
    expect(solution).not.toBeNull();
    expect(validateSolution(puzzle, solution!).valid).toBe(true);
  });

  test("impossible constraint returns null", () => {
    // Product of 1000 is impossible with two pip values (max 6*6=36)
    const result = generateDominoes({
      cells: [
        [0, 0],
        [0, 1],
      ],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
          ],
          constraint: { kind: "product", target: 1000 },
          color: "#aaa",
        },
      ],
    });
    expect(result).toBeNull();
  });

  test("disconnected cells that can't be paired returns null", () => {
    // Two cells with no adjacency
    const result = generateDominoes({
      cells: [
        [0, 0],
        [5, 5],
      ],
      regions: [],
    });
    expect(result).toBeNull();
  });

  test("puzzle with no constraints (none) produces valid dominoes", () => {
    const partial = {
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ] as [number, number][],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
            [0, 2],
            [0, 3],
          ] as [number, number][],
          constraint: { kind: "none" as const },
          color: "#aaa",
        },
      ],
    };

    const result = generateDominoes(partial);
    expect(result).not.toBeNull();
    expect(result!.dominoes).toHaveLength(2);
  });

  test("puzzle with mixed region constraints", () => {
    const partial = {
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ] as [number, number][],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
          ] as [number, number][],
          constraint: { kind: "sum" as const, target: 5 },
          color: "#aaa",
        },
        {
          id: "R2",
          cells: [
            [1, 0],
            [1, 1],
          ] as [number, number][],
          constraint: { kind: "not-equal" as const },
          color: "#bbb",
        },
      ],
    };

    const result = generateDominoes(partial);
    expect(result).not.toBeNull();
    expect(result!.dominoes).toHaveLength(2);

    const puzzle = buildPuzzle(partial, result!);
    const solution = solve(puzzle);
    expect(solution).not.toBeNull();
    expect(validateSolution(puzzle, solution!).valid).toBe(true);
  });

  test("generated domino IDs are sequential", () => {
    const result = generateDominoes({
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
      regions: [],
    });

    expect(result).not.toBeNull();
    expect(result!.dominoes[0].id).toBe("d01");
    expect(result!.dominoes[1].id).toBe("d02");
  });
});
