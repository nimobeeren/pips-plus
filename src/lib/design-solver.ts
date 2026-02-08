import { checkConstraints, hasIsolatedCell } from "@/solver";
import type { DominoDef, DominoPlacement, Pip, Puzzle } from "@/types";
import { cellKey } from "@/types";

export interface GenerateResult {
  dominoes: DominoDef[];
  placements: DominoPlacement[];
}

/**
 * Given a puzzle's cells and regions (with constraints), finds a set of
 * domino definitions that makes the puzzle satisfiable.
 *
 * Unlike the regular solver which places pre-defined dominoes, this solver
 * assigns pip values (0-6) to pairs of adjacent cells via backtracking,
 * effectively generating the domino set from scratch.
 *
 * Returns domino definitions and their placements if a valid set exists,
 * or `null` if the puzzle cannot be satisfied (e.g. odd cell count,
 * impossible constraints, no valid tiling).
 */
export function generateDominoes(
  puzzle: Omit<Puzzle, "dominoes">,
): GenerateResult | null {
  const { cells, regions } = puzzle;

  if (cells.length === 0) return { dominoes: [], placements: [] };
  if (cells.length % 2 !== 0) return null;

  const cellSet = new Set(cells.map(([r, c]) => cellKey(r, c)));
  const board = new Map<string, Pip>();
  const pairings: {
    cells: [[number, number], [number, number]];
    values: [Pip, Pip];
  }[] = [];

  // Build a puzzle-like object for checkConstraints (it only needs cells and regions)
  const puzzleForConstraints = { cells, regions, dominoes: [] } as Puzzle;

  const ALL_PIPS: Pip[] = [0, 1, 2, 3, 4, 5, 6];

  function dfs(): boolean {
    // Find first empty cell
    let firstEmpty: [number, number] | null = null;
    for (const cell of cells) {
      if (!board.has(cellKey(cell[0], cell[1]))) {
        firstEmpty = cell;
        break;
      }
    }

    if (!firstEmpty) {
      return true; // All cells filled
    }

    const [r, c] = firstEmpty;
    const key = cellKey(r, c);

    // Get empty neighbors
    const emptyNeighbors: [number, number][] = [];
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ] as [number, number][]) {
      const nk = cellKey(nr, nc);
      if (cellSet.has(nk) && !board.has(nk)) {
        emptyNeighbors.push([nr, nc]);
      }
    }

    if (emptyNeighbors.length === 0) return false;

    for (const [nr, nc] of emptyNeighbors) {
      const nk = cellKey(nr, nc);

      for (const a of ALL_PIPS) {
        for (const b of ALL_PIPS) {
          board.set(key, a);
          board.set(nk, b);

          if (
            checkConstraints(puzzleForConstraints, board) &&
            !hasIsolatedCell(cells, board, cellSet)
          ) {
            pairings.push({
              cells: [
                [r, c],
                [nr, nc],
              ],
              values: [a, b],
            });

            if (dfs()) return true;

            pairings.pop();
          }

          board.delete(key);
          board.delete(nk);
        }
      }
    }

    return false;
  }

  if (!dfs()) return null;

  const dominoes: DominoDef[] = pairings.map((p, i) => ({
    id: `d${String(i + 1).padStart(2, "0")}`,
    values: p.values,
  }));

  const placements: DominoPlacement[] = pairings.map((p, i) => ({
    dominoId: `d${String(i + 1).padStart(2, "0")}`,
    cells: p.cells,
    values: p.values,
  }));

  return { dominoes, placements };
}
