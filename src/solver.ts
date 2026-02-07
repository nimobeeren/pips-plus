import type {
  Constraint,
  DominoPlacement,
  Pip,
  Puzzle,
  ValidationResult,
} from "./types";
import { cellKey } from "./types";

/**
 * Validates a constraint against a complete set of values for a region.
 */
export function validateConstraint(
  constraint: Constraint,
  values: Pip[],
): boolean {
  switch (constraint.kind) {
    case "none":
      return true;
    case "equal":
      return values.length > 0 && values.every((v) => v === values[0]);
    case "not-equal":
      return new Set(values).size === values.length;
    case "sum":
      return values.reduce<number>((a, b) => a + b, 0) === constraint.target;
    case "greater":
      return values.every((v) => v > constraint.target);
    case "less":
      return values.every((v) => v < constraint.target);
  }
}

/**
 * Validates a partial constraint (region not yet fully filled).
 * Returns false if the constraint is already violated or can no longer be satisfied.
 */
function validatePartialConstraint(
  constraint: Constraint,
  values: Pip[],
  emptyCells: number,
): boolean {
  if (values.length === 0) return true;

  switch (constraint.kind) {
    case "none":
      return true;
    case "equal":
      if (!values.every((v) => v === values[0])) return false;
      return true;
    case "not-equal":
      if (new Set(values).size !== values.length) return false;
      // Check if enough unique values exist (0-6) for remaining cells
      if (values.length + emptyCells > 7) return false;
      return true;
    case "sum": {
      const sum = values.reduce<number>((a, b) => a + b, 0);
      if (sum > constraint.target) return false;
      if (emptyCells === 0) return sum === constraint.target;
      const remaining = constraint.target - sum;
      // Check if remaining cells can reach the target (each cell 0-6)
      if (remaining > emptyCells * 6) return false;
      if (remaining < 0) return false;
      return true;
    }
    case "greater":
      return values.every((v) => v > constraint.target);
    case "less":
      return values.every((v) => v < constraint.target);
  }
}

/**
 * Checks all region constraints against the current (partial) board state.
 */
function checkConstraints(puzzle: Puzzle, board: Map<string, Pip>): boolean {
  for (const region of puzzle.regions) {
    const values: Pip[] = [];
    let emptyCells = 0;

    for (const [r, c] of region.cells) {
      const val = board.get(cellKey(r, c));
      if (val !== undefined) {
        values.push(val);
      } else {
        emptyCells++;
      }
    }

    if (!validatePartialConstraint(region.constraint, values, emptyCells)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if any empty cell has become isolated (no empty neighbors),
 * which would make it impossible to place a domino there.
 */
function hasIsolatedCell(
  cells: [number, number][],
  board: Map<string, Pip>,
  cellSet: Set<string>,
): boolean {
  for (const [r, c] of cells) {
    const key = cellKey(r, c);
    if (board.has(key)) continue;

    const hasEmptyNeighbor = (
      [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ] as [number, number][]
    ).some(([nr, nc]) => {
      const nk = cellKey(nr, nc);
      return cellSet.has(nk) && !board.has(nk);
    });

    if (!hasEmptyNeighbor) return true;
  }
  return false;
}

/**
 * Forward feasibility check: for partially filled regions, verify that
 * the remaining available domino values can still satisfy the constraint.
 */
function checkForwardFeasibility(
  puzzle: Puzzle,
  board: Map<string, Pip>,
  remainingDominoes: { values: [Pip, Pip] }[],
): boolean {
  // Collect all spare pip values from remaining dominoes
  const sparePips: Pip[] = [];
  for (const d of remainingDominoes) {
    sparePips.push(d.values[0], d.values[1]);
  }

  for (const region of puzzle.regions) {
    const placedVals: Pip[] = [];
    let emptyCells = 0;

    for (const [r, c] of region.cells) {
      const val = board.get(cellKey(r, c));
      if (val !== undefined) {
        placedVals.push(val);
      } else {
        emptyCells++;
      }
    }

    if (emptyCells === 0) continue;

    switch (region.constraint.kind) {
      case "equal": {
        if (placedVals.length > 0) {
          const mustMatch = placedVals[0];
          const available = sparePips.filter((p) => p === mustMatch).length;
          if (available < emptyCells) return false;
        }
        break;
      }
      case "not-equal": {
        const usedValues = new Set(placedVals);
        const uniqueAvailable = new Set(
          sparePips.filter((p) => !usedValues.has(p)),
        );
        if (uniqueAvailable.size < emptyCells) return false;
        break;
      }
      default:
        break;
    }
  }

  return true;
}

/**
 * Solves a Pips puzzle using backtracking DFS with pruning.
 * Returns an array of domino placements, or null if unsolvable.
 */
export function solve(puzzle: Puzzle): DominoPlacement[] | null {
  const totalCells = puzzle.cells.length;
  const totalDominoHalves = puzzle.dominoes.length * 2;
  if (totalDominoHalves !== totalCells) return null;

  const cellSet = new Set(puzzle.cells.map(([r, c]) => cellKey(r, c)));
  const board = new Map<string, Pip>();
  const used = new Set<string>();
  const placements: DominoPlacement[] = [];

  function dfs(): boolean {
    // Find first empty cell
    let firstEmpty: [number, number] | null = null;
    for (const cell of puzzle.cells) {
      if (!board.has(cellKey(cell[0], cell[1]))) {
        firstEmpty = cell;
        break;
      }
    }

    if (!firstEmpty) {
      return used.size === puzzle.dominoes.length;
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

      // Track domino value patterns tried at this position to skip duplicates
      const tried = new Set<string>();

      for (const domino of puzzle.dominoes) {
        if (used.has(domino.id)) continue;

        const [a, b] = domino.values;

        // Orientation 1: a at first cell, b at neighbor
        const typeKey1 = `${a},${b}`;
        if (!tried.has(typeKey1)) {
          tried.add(typeKey1);

          board.set(key, a);
          board.set(nk, b);
          used.add(domino.id);
          placements.push({
            dominoId: domino.id,
            cells: [
              [r, c],
              [nr, nc],
            ],
            values: [a, b],
          });

          const remainingDominoes = puzzle.dominoes.filter(
            (d) => !used.has(d.id),
          );

          if (
            checkConstraints(puzzle, board) &&
            !hasIsolatedCell(puzzle.cells, board, cellSet) &&
            checkForwardFeasibility(puzzle, board, remainingDominoes) &&
            dfs()
          ) {
            return true;
          }

          board.delete(key);
          board.delete(nk);
          used.delete(domino.id);
          placements.pop();
        }

        // Orientation 2: b at first cell, a at neighbor (skip if symmetric)
        if (a !== b) {
          const typeKey2 = `${b},${a}`;
          if (!tried.has(typeKey2)) {
            tried.add(typeKey2);

            board.set(key, b);
            board.set(nk, a);
            used.add(domino.id);
            placements.push({
              dominoId: domino.id,
              cells: [
                [r, c],
                [nr, nc],
              ],
              values: [b, a],
            });

            const remainingDominoes = puzzle.dominoes.filter(
              (d) => !used.has(d.id),
            );

            if (
              checkConstraints(puzzle, board) &&
              !hasIsolatedCell(puzzle.cells, board, cellSet) &&
              checkForwardFeasibility(puzzle, board, remainingDominoes) &&
              dfs()
            ) {
              return true;
            }

            board.delete(key);
            board.delete(nk);
            used.delete(domino.id);
            placements.pop();
          }
        }
      }
    }

    return false;
  }

  if (dfs()) return [...placements];
  return null;
}

/**
 * Validates a completed board: checks that all dominoes are placed,
 * all cells are covered, and all region constraints are satisfied.
 */
export function validateSolution(
  puzzle: Puzzle,
  placements: DominoPlacement[],
): ValidationResult {
  if (placements.length !== puzzle.dominoes.length) {
    return { valid: false, violatedRegions: [] };
  }

  // Build a board from the placements
  const board = new Map<string, Pip>();
  for (const placement of placements) {
    const [cell1, cell2] = placement.cells;
    const [val1, val2] = placement.values;
    board.set(cellKey(cell1[0], cell1[1]), val1);
    board.set(cellKey(cell2[0], cell2[1]), val2);
  }

  // Check all cells are covered
  const cellSet = new Set(puzzle.cells.map(([r, c]) => cellKey(r, c)));
  for (const key of cellSet) {
    if (!board.has(key)) {
      return { valid: false, violatedRegions: [] };
    }
  }

  // Check each region constraint
  const violatedRegions: string[] = [];
  for (const region of puzzle.regions) {
    const values: Pip[] = region.cells.map(
      ([r, c]) => board.get(cellKey(r, c))!,
    );
    if (!validateConstraint(region.constraint, values)) {
      violatedRegions.push(region.id);
    }
  }

  return {
    valid: violatedRegions.length === 0,
    violatedRegions,
  };
}
