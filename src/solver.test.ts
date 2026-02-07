import { describe, expect, test } from "vitest";
import { starterPuzzle } from "./puzzles";
import { solve, validateConstraint, validateSolution } from "./solver";
import type { Pip, Puzzle } from "./types";

describe("validateConstraint", () => {
  test("equal: passes when all values are the same", () => {
    expect(validateConstraint({ kind: "equal" }, [3, 3, 3])).toBe(true);
  });

  test("equal: fails when values differ", () => {
    expect(validateConstraint({ kind: "equal" }, [3, 3, 4])).toBe(false);
  });

  test("not-equal: passes when all values are unique", () => {
    expect(validateConstraint({ kind: "not-equal" }, [0, 1, 2, 3])).toBe(true);
  });

  test("not-equal: fails on duplicates", () => {
    expect(validateConstraint({ kind: "not-equal" }, [1, 2, 1])).toBe(false);
  });

  test("sum: passes when values sum to target", () => {
    expect(validateConstraint({ kind: "sum", target: 10 }, [3, 3, 4])).toBe(
      true,
    );
  });

  test("sum: fails when values don't sum to target", () => {
    expect(validateConstraint({ kind: "sum", target: 10 }, [3, 3, 5])).toBe(
      false,
    );
  });

  test("greater: passes when all values > target", () => {
    expect(validateConstraint({ kind: "greater", target: 3 }, [4, 5, 6])).toBe(
      true,
    );
  });

  test("greater: fails when any value <= target", () => {
    expect(validateConstraint({ kind: "greater", target: 3 }, [4, 3, 6])).toBe(
      false,
    );
  });

  test("less: passes when all values < target", () => {
    expect(validateConstraint({ kind: "less", target: 4 }, [0, 1, 3])).toBe(
      true,
    );
  });

  test("less: fails when any value >= target", () => {
    expect(validateConstraint({ kind: "less", target: 4 }, [3, 4, 1])).toBe(
      false,
    );
  });

  test("none: always passes", () => {
    expect(validateConstraint({ kind: "none" }, [0, 6, 3])).toBe(true);
    expect(validateConstraint({ kind: "none" }, [])).toBe(true);
  });
});

describe("solve", () => {
  test("empty puzzle (0 cells, 0 dominoes) returns empty array", () => {
    const puzzle: Puzzle = { cells: [], regions: [], dominoes: [] };
    const result = solve(puzzle);
    expect(result).toEqual([]);
  });

  test("trivial 2-cell puzzle with 1 domino", () => {
    const puzzle: Puzzle = {
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
          constraint: { kind: "sum", target: 7 },
          color: "#aaa",
        },
      ],
      dominoes: [{ id: "d1", values: [3, 4] }],
    };

    const result = solve(puzzle);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);

    // Verify the placement satisfies the constraint
    const validation = validateSolution(puzzle, result!);
    expect(validation.valid).toBe(true);
  });

  test("2-cell puzzle with wrong domino returns null", () => {
    const puzzle: Puzzle = {
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
          constraint: { kind: "sum", target: 7 },
          color: "#aaa",
        },
      ],
      dominoes: [{ id: "d1", values: [1, 2] }],
    };

    expect(solve(puzzle)).toBeNull();
  });

  test("4-cell linear puzzle with 2 dominoes and sum constraint", () => {
    const puzzle: Puzzle = {
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
            [0, 2],
            [0, 3],
          ],
          constraint: { kind: "sum", target: 10 },
          color: "#aaa",
        },
      ],
      dominoes: [
        { id: "d1", values: [2, 3] },
        { id: "d2", values: [1, 4] },
      ],
    };

    const result = solve(puzzle);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);

    const validation = validateSolution(puzzle, result!);
    expect(validation.valid).toBe(true);
  });

  test("4-cell L-shaped puzzle with mixed constraints", () => {
    // L shape:
    // X .
    // X X
    // . X
    const puzzle: Puzzle = {
      cells: [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [1, 0],
          ],
          constraint: { kind: "equal" },
          color: "#aaa",
        },
        {
          id: "R2",
          cells: [
            [1, 1],
            [2, 1],
          ],
          constraint: { kind: "sum", target: 5 },
          color: "#bbb",
        },
      ],
      dominoes: [
        { id: "d1", values: [2, 2] },
        { id: "d2", values: [1, 4] },
      ],
    };

    const result = solve(puzzle);
    expect(result).not.toBeNull();

    const validation = validateSolution(puzzle, result!);
    expect(validation.valid).toBe(true);
  });

  test("unsolvable: too many dominoes for the grid", () => {
    const puzzle: Puzzle = {
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
          constraint: { kind: "none" },
          color: "#aaa",
        },
      ],
      dominoes: [
        { id: "d1", values: [1, 2] },
        { id: "d2", values: [3, 4] },
      ],
    };

    expect(solve(puzzle)).toBeNull();
  });

  test("unsolvable: equal region but no matching domino halves", () => {
    const puzzle: Puzzle = {
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ],
          constraint: { kind: "equal" },
          color: "#aaa",
        },
      ],
      dominoes: [
        { id: "d1", values: [1, 2] },
        { id: "d2", values: [3, 4] },
      ],
    };

    expect(solve(puzzle)).toBeNull();
  });

  test("starter puzzle is solvable", () => {
    const result = solve(starterPuzzle);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(starterPuzzle.dominoes.length);

    const validation = validateSolution(starterPuzzle, result!);
    expect(validation.valid).toBe(true);
  });
});

describe("validateSolution", () => {
  test("valid complete board passes", () => {
    const puzzle: Puzzle = {
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
          constraint: { kind: "sum", target: 5 },
          color: "#aaa",
        },
      ],
      dominoes: [{ id: "d1", values: [2, 3] }],
    };

    const result = validateSolution(puzzle, [
      {
        dominoId: "d1",
        cells: [
          [0, 0],
          [0, 1],
        ],
        values: [2, 3] as [Pip, Pip],
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.violatedRegions).toHaveLength(0);
  });

  test("violated region is reported", () => {
    const puzzle: Puzzle = {
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
          constraint: { kind: "sum", target: 10 },
          color: "#aaa",
        },
      ],
      dominoes: [{ id: "d1", values: [2, 3] }],
    };

    const result = validateSolution(puzzle, [
      {
        dominoId: "d1",
        cells: [
          [0, 0],
          [0, 1],
        ],
        values: [2, 3] as [Pip, Pip],
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.violatedRegions).toContain("R1");
  });

  test("incomplete board (not all dominoes placed) fails", () => {
    const puzzle: Puzzle = {
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      regions: [
        {
          id: "R1",
          cells: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ],
          constraint: { kind: "none" },
          color: "#aaa",
        },
      ],
      dominoes: [
        { id: "d1", values: [1, 2] },
        { id: "d2", values: [3, 4] },
      ],
    };

    const result = validateSolution(puzzle, [
      {
        dominoId: "d1",
        cells: [
          [0, 0],
          [0, 1],
        ],
        values: [1, 2] as [Pip, Pip],
      },
    ]);

    expect(result.valid).toBe(false);
  });
});
