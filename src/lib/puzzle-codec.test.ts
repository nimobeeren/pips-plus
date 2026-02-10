import { puzzles } from "@/puzzles";
import type { Puzzle } from "@/types";
import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, test } from "vitest";
import { decodePuzzle, encodePuzzle } from "./puzzle-codec";

/** Strip IDs and colors so we can compare structural equality after roundtrip. */
function puzzleShape(p: Puzzle) {
  return {
    cells: p.cells,
    regions: p.regions.map((r) => ({
      cells: r.cells,
      constraint: r.constraint,
    })),
    dominoes: p.dominoes.map((d) => d.values),
  };
}

describe("puzzle codec", () => {
  test("roundtrip produces structurally equivalent puzzle", () => {
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
          ],
          constraint: { kind: "sum", target: 5 },
          color: "#aaa",
        },
        {
          id: "R2",
          cells: [
            [1, 0],
            [1, 1],
          ],
          constraint: { kind: "equal" },
          color: "#bbb",
        },
      ],
      dominoes: [
        { id: "d1", values: [2, 3] },
        { id: "d2", values: [4, 4] },
      ],
    };

    const code = encodePuzzle(puzzle);
    const decoded = decodePuzzle(code);
    expect(puzzleShape(decoded)).toEqual(puzzleShape(puzzle));
  });

  test.each(Object.keys(puzzles))("roundtrip for '%s' puzzle", (key) => {
    const puzzle = puzzles[key];
    const code = encodePuzzle(puzzle);
    const decoded = decodePuzzle(code);
    expect(puzzleShape(decoded)).toEqual(puzzleShape(puzzle));
  });

  test("decoded puzzle has regenerated IDs", () => {
    const puzzle: Puzzle = {
      cells: [
        [0, 0],
        [0, 1],
      ],
      regions: [
        {
          id: "custom-id",
          cells: [
            [0, 0],
            [0, 1],
          ],
          constraint: { kind: "none" },
          color: "#fff",
        },
      ],
      dominoes: [{ id: "custom-domino", values: [1, 2] }],
    };

    const decoded = decodePuzzle(encodePuzzle(puzzle));
    expect(decoded.regions[0].id).toBe("A");
    expect(decoded.dominoes[0].id).toBe("d01");
  });

  test("decoded puzzle preserves colors", () => {
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
          color: "#000",
        },
      ],
      dominoes: [{ id: "d1", values: [1, 2] }],
    };

    const decoded = decodePuzzle(encodePuzzle(puzzle));
    expect(decoded.regions[0].color).toBe("#000");
  });

  test("backward compatibility: puzzles without colors get auto-assigned colors", () => {
    const encodedWithoutColor =
      '{"v":1,"cells":[[0,0],[0,1]],"regions":[{"cells":[[0,0],[0,1]],"constraint":{"kind":"none"}}],"dominoes":[[1,2]]}';
    const decoded = decodePuzzle(
      compressToEncodedURIComponent(encodedWithoutColor),
    );
    expect(decoded.regions[0].color).toBe("#f4a0a0");
  });

  test("all constraint types survive roundtrip", () => {
    const puzzle: Puzzle = {
      cells: Array.from({ length: 16 }, (_, i) => [0, i] as [number, number]),
      regions: [
        {
          id: "A",
          cells: [
            [0, 0],
            [0, 1],
          ],
          constraint: { kind: "sum", target: 10 },
          color: "#aaa",
        },
        {
          id: "B",
          cells: [
            [0, 2],
            [0, 3],
          ],
          constraint: { kind: "product", target: 6 },
          color: "#aaa",
        },
        {
          id: "C",
          cells: [
            [0, 4],
            [0, 5],
          ],
          constraint: { kind: "equal" },
          color: "#aaa",
        },
        {
          id: "D",
          cells: [
            [0, 6],
            [0, 7],
          ],
          constraint: { kind: "not-equal" },
          color: "#aaa",
        },
        {
          id: "E",
          cells: [
            [0, 8],
            [0, 9],
          ],
          constraint: { kind: "greater", target: 3 },
          color: "#aaa",
        },
        {
          id: "F",
          cells: [
            [0, 10],
            [0, 11],
          ],
          constraint: { kind: "less", target: 5 },
          color: "#aaa",
        },
        {
          id: "G",
          cells: [
            [0, 12],
            [0, 13],
          ],
          constraint: { kind: "mirror", group: "g1" },
          color: "#aaa",
        },
        {
          id: "H",
          cells: [
            [0, 14],
            [0, 15],
          ],
          constraint: { kind: "none" },
          color: "#aaa",
        },
      ],
      dominoes: Array.from({ length: 8 }, (_, i) => ({
        id: `d${i}`,
        values: [1, 2] as [1, 2],
      })),
    };

    const decoded = decodePuzzle(encodePuzzle(puzzle));
    expect(puzzleShape(decoded)).toEqual(puzzleShape(puzzle));
  });

  test("decode with invalid string throws", () => {
    expect(() => decodePuzzle("not-valid-data")).toThrow();
  });

  test("decode with empty string throws", () => {
    expect(() => decodePuzzle("")).toThrow();
  });

  test("encoded string is URL-safe", () => {
    const puzzle: Puzzle = {
      cells: [
        [0, 0],
        [0, 1],
      ],
      regions: [],
      dominoes: [{ id: "d1", values: [1, 2] }],
    };

    const code = encodePuzzle(puzzle);
    // Should not contain characters that need URL encoding
    expect(code).toMatch(/^[A-Za-z0-9+/=-]*$/);
  });
});
