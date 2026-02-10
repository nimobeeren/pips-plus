import type {
  Constraint,
  DominoPlacement,
  Pip,
  Puzzle,
  Region,
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
    case "product":
      return values.reduce<number>((a, b) => a * b, 1) === constraint.target;
    case "greater":
      return values.reduce<number>((a, b) => a + b, 0) > constraint.target;
    case "less":
      return values.reduce<number>((a, b) => a + b, 0) < constraint.target;
    case "mirror":
      // Cross-region constraint; single-region validation always passes.
      // Actual validation happens in validateMirrorGroups.
      return true;
  }
}

/**
 * Validates mirror constraints: all regions sharing the same mirror group
 * must have the same sum.
 */
export function validateMirrorGroups(
  regions: Region[],
  regionValues: Map<string, Pip[]>,
): string[] {
  const groups = new Map<string, string[]>();
  for (const region of regions) {
    if (region.constraint.kind === "mirror") {
      const group = region.constraint.group;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(region.id);
    }
  }

  const violated: string[] = [];
  for (const [, regionIds] of groups) {
    const sums = regionIds.map((id) => {
      const vals = regionValues.get(id) ?? [];
      return vals.reduce<number>((a, b) => a + b, 0);
    });
    if (!sums.every((s) => s === sums[0])) {
      violated.push(...regionIds);
    }
  }
  return violated;
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
    case "product": {
      if (constraint.target === 0) {
        // Need at least one 0 somewhere
        if (emptyCells === 0) return values.some((v) => v === 0);
        return true;
      }
      // Target is non-zero, so no value can be 0
      if (values.some((v) => v === 0)) return false;
      const product = values.reduce<number>((a, b) => a * b, 1);
      if (emptyCells === 0) return product === constraint.target;
      if (product > constraint.target) return false;
      if (constraint.target % product !== 0) return false;
      // Check remaining product is achievable (each remaining cell is 1-6)
      const remainingProduct = constraint.target / product;
      if (remainingProduct > 6 ** emptyCells) return false;
      return true;
    }
    case "greater": {
      const sum = values.reduce<number>((a, b) => a + b, 0);
      if (emptyCells === 0) return sum > constraint.target;
      // Even with max remaining values (6 each), can we exceed the target?
      if (sum + emptyCells * 6 <= constraint.target) return false;
      return true;
    }
    case "less": {
      const sum = values.reduce<number>((a, b) => a + b, 0);
      if (emptyCells === 0) return sum < constraint.target;
      // Even with min remaining values (0 each), already at or above target?
      if (sum >= constraint.target) return false;
      return true;
    }
    case "mirror":
      // Cross-region; partial pruning handled separately in checkMirrorPartial
      return true;
  }
}

/**
 * Partial mirror constraint check: if all regions in a mirror group are fully
 * filled, their sums must match. Also prunes when a filled region's sum is
 * already unreachable by a partially filled partner.
 */
function checkMirrorPartial(puzzle: Puzzle, board: Map<string, Pip>): boolean {
  const groups = new Map<string, { values: Pip[]; emptyCells: number }[]>();
  for (const region of puzzle.regions) {
    if (region.constraint.kind !== "mirror") continue;
    const group = region.constraint.group;
    if (!groups.has(group)) groups.set(group, []);

    const values: Pip[] = [];
    let emptyCells = 0;
    for (const [r, c] of region.cells) {
      const val = board.get(cellKey(r, c));
      if (val !== undefined) values.push(val);
      else emptyCells++;
    }
    groups.get(group)!.push({ values, emptyCells });
  }

  for (const [, entries] of groups) {
    const allFilled = entries.every((e) => e.emptyCells === 0);
    if (allFilled) {
      const sums = entries.map((e) =>
        e.values.reduce<number>((a, b) => a + b, 0),
      );
      if (!sums.every((s) => s === sums[0])) return false;
    } else {
      // Prune: check if any filled region's sum is outside the achievable
      // range of a partially filled partner
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].emptyCells > 0) continue;
        const filledSum = entries[i].values.reduce<number>((a, b) => a + b, 0);
        for (let j = 0; j < entries.length; j++) {
          if (i === j || entries[j].emptyCells === 0) continue;
          const partialSum = entries[j].values.reduce<number>(
            (a, b) => a + b,
            0,
          );
          const minPossible = partialSum; // remaining cells could be 0
          const maxPossible = partialSum + entries[j].emptyCells * 6;
          if (filledSum < minPossible || filledSum > maxPossible) return false;
        }
      }
    }
  }
  return true;
}

/**
 * Checks all region constraints against the current (partial) board state.
 */
export function checkConstraints(
  puzzle: Puzzle,
  board: Map<string, Pip>,
): boolean {
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
  return checkMirrorPartial(puzzle, board);
}

/**
 * Checks if any empty cell has become isolated (no empty neighbors),
 * which would make it impossible to place a domino there.
 */
export function hasIsolatedCell(
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
  const regionValues = new Map<string, Pip[]>();
  for (const region of puzzle.regions) {
    const values: Pip[] = region.cells.map(
      ([r, c]) => board.get(cellKey(r, c))!,
    );
    regionValues.set(region.id, values);
    if (!validateConstraint(region.constraint, values)) {
      violatedRegions.push(region.id);
    }
  }

  // Check cross-region mirror constraints
  const mirrorViolated = validateMirrorGroups(puzzle.regions, regionValues);
  for (const id of mirrorViolated) {
    if (!violatedRegions.includes(id)) {
      violatedRegions.push(id);
    }
  }

  return {
    valid: violatedRegions.length === 0,
    violatedRegions,
  };
}

/**
 * Result of analyzing a puzzle's difficulty and solvability.
 */
export interface AnalysisResult {
  solvable: boolean;
  solutionCount: number;
  nodesExplored: number;
  firstSolutionNodes: number;
}

/**
 * Analyzes a puzzle by exhaustively searching for solutions.
 * Returns difficulty metrics including node count and solution count.
 * Stops after finding `maxSolutions` distinct board states.
 */
export function analyzePuzzle(
  puzzle: Puzzle,
  maxSolutions = 10,
): AnalysisResult {
  const totalCells = puzzle.cells.length;
  if (puzzle.dominoes.length * 2 !== totalCells) {
    return {
      solvable: false,
      solutionCount: 0,
      nodesExplored: 0,
      firstSolutionNodes: 0,
    };
  }

  const cellSet = new Set(puzzle.cells.map(([r, c]) => cellKey(r, c)));
  const board = new Map<string, Pip>();
  const used = new Set<string>();
  const seenBoards = new Set<string>();
  let nodesExplored = 0;
  let firstSolutionNodes = -1;

  function boardFingerprint(): string {
    return puzzle.cells
      .map(([r, c]) => board.get(cellKey(r, c)) ?? "?")
      .join(",");
  }

  function isFullyValid(): boolean {
    for (const region of puzzle.regions) {
      const vals: Pip[] = region.cells.map(
        ([r, c]) => board.get(cellKey(r, c))!,
      );
      if (!validateConstraint(region.constraint, vals)) return false;
    }
    const groups = new Map<string, number[]>();
    for (const region of puzzle.regions) {
      if (region.constraint.kind === "mirror") {
        const g = region.constraint.group;
        if (!groups.has(g)) groups.set(g, []);
        const s = region.cells.reduce(
          (a, [r, c]) => a + board.get(cellKey(r, c))!,
          0,
        );
        groups.get(g)!.push(s);
      }
    }
    for (const [, sums] of groups) {
      if (!sums.every((s) => s === sums[0])) return false;
    }
    return true;
  }

  function dfs(): boolean {
    let firstEmpty: [number, number] | null = null;
    for (const cell of puzzle.cells) {
      if (!board.has(cellKey(cell[0], cell[1]))) {
        firstEmpty = cell;
        break;
      }
    }

    if (!firstEmpty) {
      if (used.size === puzzle.dominoes.length && isFullyValid()) {
        const fp = boardFingerprint();
        if (!seenBoards.has(fp)) {
          seenBoards.add(fp);
          if (firstSolutionNodes < 0) firstSolutionNodes = nodesExplored;
        }
        return seenBoards.size >= maxSolutions;
      }
      return false;
    }

    const [r, c] = firstEmpty;
    const key = cellKey(r, c);
    const neighbors: [number, number][] = [];
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ] as [number, number][]) {
      if (cellSet.has(cellKey(nr, nc)) && !board.has(cellKey(nr, nc)))
        neighbors.push([nr, nc]);
    }
    if (!neighbors.length) return false;

    for (const [nr, nc] of neighbors) {
      const nk = cellKey(nr, nc);
      const tried = new Set<string>();

      for (const domino of puzzle.dominoes) {
        if (used.has(domino.id)) continue;
        const [a, b] = domino.values;

        for (const [v1, v2] of a === b
          ? [[a, b]]
          : [
              [a, b],
              [b, a],
            ]) {
          const tk = `${v1},${v2}`;
          if (tried.has(tk)) continue;
          tried.add(tk);
          nodesExplored++;

          board.set(key, v1 as Pip);
          board.set(nk, v2 as Pip);
          used.add(domino.id);

          const rem = puzzle.dominoes.filter((d) => !used.has(d.id));
          if (
            checkConstraints(puzzle, board) &&
            !hasIsolatedCell(puzzle.cells, board, cellSet) &&
            checkForwardFeasibility(puzzle, board, rem)
          ) {
            if (dfs()) {
              board.delete(key);
              board.delete(nk);
              used.delete(domino.id);
              return true;
            }
          }
          board.delete(key);
          board.delete(nk);
          used.delete(domino.id);
        }
      }
    }
    return false;
  }

  dfs();
  if (firstSolutionNodes < 0) firstSolutionNodes = nodesExplored;

  return {
    solvable: seenBoards.size > 0,
    solutionCount: seenBoards.size,
    nodesExplored,
    firstSolutionNodes,
  };
}
