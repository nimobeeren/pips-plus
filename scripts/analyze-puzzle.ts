type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Constraint =
  | { kind: "sum"; target: number }
  | { kind: "product"; target: number }
  | { kind: "equal" }
  | { kind: "not-equal" }
  | { kind: "greater"; target: number }
  | { kind: "less"; target: number }
  | { kind: "mirror"; group: string }
  | { kind: "none" };
interface Region {
  id: string;
  cells: [number, number][];
  constraint: Constraint;
  color: string;
}
interface DominoDef {
  id: string;
  values: [Pip, Pip];
}
interface Puzzle {
  cells: [number, number][];
  regions: Region[];
  dominoes: DominoDef[];
}
interface DominoPlacement {
  dominoId: string;
  cells: [[number, number], [number, number]];
  values: [Pip, Pip];
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

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
      return values.every((v) => v === values[0]);
    case "not-equal":
      if (new Set(values).size !== values.length) return false;
      return values.length + emptyCells <= 7;
    case "sum": {
      const sum = values.reduce<number>((a, b) => a + b, 0);
      if (sum > constraint.target) return false;
      if (emptyCells === 0) return sum === constraint.target;
      return constraint.target - sum <= emptyCells * 6;
    }
    case "product": {
      if (constraint.target === 0) {
        return emptyCells > 0 || values.some((v) => v === 0);
      }
      if (values.some((v) => v === 0)) return false;
      const product = values.reduce<number>((a, b) => a * b, 1);
      if (emptyCells === 0) return product === constraint.target;
      if (product > constraint.target) return false;
      if (constraint.target % product !== 0) return false;
      return constraint.target / product <= 6 ** emptyCells;
    }
    case "greater":
      return values.every((v) => v > constraint.target);
    case "less":
      return values.every((v) => v < constraint.target);
    case "mirror":
      return true;
  }
}

function validateConstraint(constraint: Constraint, values: Pip[]): boolean {
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
      return values.every((v) => v > constraint.target);
    case "less":
      return values.every((v) => v < constraint.target);
    case "mirror":
      return true;
  }
}

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
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].emptyCells > 0) continue;
        const filledSum = entries[i].values.reduce<number>((a, b) => a + b, 0);
        for (let j = 0; j < entries.length; j++) {
          if (i === j || entries[j].emptyCells === 0) continue;
          const ps = entries[j].values.reduce<number>((a, b) => a + b, 0);
          if (filledSum < ps || filledSum > ps + entries[j].emptyCells * 6)
            return false;
        }
      }
    }
  }
  return true;
}

function checkConstraints(puzzle: Puzzle, board: Map<string, Pip>): boolean {
  for (const region of puzzle.regions) {
    const values: Pip[] = [];
    let emptyCells = 0;
    for (const [r, c] of region.cells) {
      const val = board.get(cellKey(r, c));
      if (val !== undefined) values.push(val);
      else emptyCells++;
    }
    if (!validatePartialConstraint(region.constraint, values, emptyCells))
      return false;
  }
  return checkMirrorPartial(puzzle, board);
}

function hasIsolatedCell(
  cells: [number, number][],
  board: Map<string, Pip>,
  cellSet: Set<string>,
): boolean {
  for (const [r, c] of cells) {
    const key = cellKey(r, c);
    if (board.has(key)) continue;
    const ok = (
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
    if (!ok) return true;
  }
  return false;
}

function checkForwardFeasibility(
  puzzle: Puzzle,
  board: Map<string, Pip>,
  remainingDominoes: { values: [Pip, Pip] }[],
): boolean {
  const spare: Pip[] = [];
  for (const d of remainingDominoes) spare.push(d.values[0], d.values[1]);
  for (const region of puzzle.regions) {
    const placed: Pip[] = [];
    let empty = 0;
    for (const [r, c] of region.cells) {
      const v = board.get(cellKey(r, c));
      if (v !== undefined) placed.push(v);
      else empty++;
    }
    if (empty === 0) continue;
    if (region.constraint.kind === "equal" && placed.length > 0) {
      if (spare.filter((p) => p === placed[0]).length < empty) return false;
    }
    if (region.constraint.kind === "not-equal") {
      const used = new Set(placed);
      if (new Set(spare.filter((p) => !used.has(p))).size < empty) return false;
    }
  }
  return true;
}

interface AnalysisResult {
  solvable: boolean;
  uniqueBoardCount: number;
  nodesExplored: number;
  firstSolutionNodes: number;
}

function analyzePuzzle(puzzle: Puzzle, maxBoards = 20): AnalysisResult {
  const totalCells = puzzle.cells.length;
  if (puzzle.dominoes.length * 2 !== totalCells)
    return {
      solvable: false,
      uniqueBoardCount: 0,
      nodesExplored: 0,
      firstSolutionNodes: 0,
    };

  const cellSet = new Set(puzzle.cells.map(([r, c]) => cellKey(r, c)));
  const board = new Map<string, Pip>();
  const used = new Set<string>();
  const seenBoards = new Set<string>();
  let nodesExplored = 0;
  let firstSolutionNodes = -1;

  function boardFP(): string {
    return puzzle.cells
      .map(([r, c]) => board.get(cellKey(r, c)) ?? "?")
      .join(",");
  }

  function isValid(): boolean {
    for (const region of puzzle.regions) {
      const vals: Pip[] = region.cells.map(
        ([r, c]) => board.get(cellKey(r, c))!,
      );
      if (!validateConstraint(region.constraint, vals)) return false;
    }
    // mirror
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
      if (used.size === puzzle.dominoes.length && isValid()) {
        const fp = boardFP();
        if (!seenBoards.has(fp)) {
          seenBoards.add(fp);
          if (firstSolutionNodes < 0) firstSolutionNodes = nodesExplored;
          if (seenBoards.size <= 3) {
            printBoard(puzzle, board, seenBoards.size);
          }
        }
        return seenBoards.size >= maxBoards;
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
    uniqueBoardCount: seenBoards.size,
    nodesExplored,
    firstSolutionNodes,
  };
}

function printBoard(
  puzzle: Puzzle,
  board: Map<string, Pip>,
  num: number,
): void {
  const minR = Math.min(...puzzle.cells.map(([r]) => r));
  const maxR = Math.max(...puzzle.cells.map(([r]) => r));
  const minC = Math.min(...puzzle.cells.map(([, c]) => c));
  const maxC = Math.max(...puzzle.cells.map(([, c]) => c));
  const cs = new Set(puzzle.cells.map(([r, c]) => cellKey(r, c)));
  console.log(`\n--- Board #${num} ---`);
  for (let r = minR; r <= maxR; r++) {
    let row = "";
    for (let c = minC; c <= maxC; c++) {
      const k = cellKey(r, c);
      row += cs.has(k) ? ` ${board.get(k) ?? "_"}` : " .";
    }
    console.log(row);
  }
}

function printRegions(puzzle: Puzzle): void {
  const minR = Math.min(...puzzle.cells.map(([r]) => r));
  const maxR = Math.max(...puzzle.cells.map(([r]) => r));
  const minC = Math.min(...puzzle.cells.map(([, c]) => c));
  const maxC = Math.max(...puzzle.cells.map(([, c]) => c));
  const cs = new Set(puzzle.cells.map(([r, c]) => cellKey(r, c)));
  const m = new Map<string, string>();
  for (const reg of puzzle.regions)
    for (const [r, c] of reg.cells) m.set(cellKey(r, c), reg.id);
  console.log("\nRegion map:");
  for (let r = minR; r <= maxR; r++) {
    let row = "";
    for (let c = minC; c <= maxC; c++) {
      const k = cellKey(r, c);
      row += cs.has(k) ? (m.get(k) ?? "?").padStart(3) : "  .";
    }
    console.log(row);
  }
  console.log("\nConstraints:");
  for (const reg of puzzle.regions) {
    const c = reg.constraint;
    let d: string;
    switch (c.kind) {
      case "sum":
        d = `sum=${c.target}`;
        break;
      case "product":
        d = `Π=${c.target}`;
        break;
      case "equal":
        d = "=";
        break;
      case "not-equal":
        d = "≠";
        break;
      case "greater":
        d = `>${c.target}`;
        break;
      case "less":
        d = `<${c.target}`;
        break;
      case "mirror":
        d = `=n(${c.group})`;
        break;
      case "none":
        d = "—";
        break;
    }
    console.log(`  ${reg.id} (${reg.cells.length} cells): ${d}`);
  }
}

// ================================================================
// PUZZLE DEFINITION
// ================================================================
// 4×6 rectangle, 24 cells, 12 dominoes.
// 8 regions of 3 cells each (all odd → guarantees cross-boundary dominos).
//
// Region layout:
//   Row 0: A  B  B  C  C  D
//   Row 1: A  A  B  C  D  D
//   Row 2: E  E  F  G  G  H
//   Row 3: E  F  F  G  H  H

const cells: [number, number][] = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) cells.push([r, c]);

const colors = [
  "#e57373",
  "#ba68c8",
  "#4fc3f7",
  "#81c784",
  "#ffb74d",
  "#f06292",
  "#aed581",
  "#4dd0e1",
];
const regionDefs: { id: string; cells: [number, number][] }[] = [
  {
    id: "A",
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  },
  {
    id: "B",
    cells: [
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    id: "C",
    cells: [
      [0, 3],
      [0, 4],
      [1, 3],
    ],
  },
  {
    id: "D",
    cells: [
      [0, 5],
      [1, 4],
      [1, 5],
    ],
  },
  {
    id: "E",
    cells: [
      [2, 0],
      [2, 1],
      [3, 0],
    ],
  },
  {
    id: "F",
    cells: [
      [2, 2],
      [3, 1],
      [3, 2],
    ],
  },
  {
    id: "G",
    cells: [
      [2, 3],
      [2, 4],
      [3, 3],
    ],
  },
  {
    id: "H",
    cells: [
      [2, 5],
      [3, 4],
      [3, 5],
    ],
  },
];

// Unique-multiset products for 3 cells (only 1 valid value set each):
// {3,5,6}→90, {2,4,5}→40, {4,5,6}→120, {3,3,5}→45,
// {4,4,5}→80, {5,5,6}→150, {3,3,6}→54, {4,5,5}→100

function buildPuzzle(constraints: Constraint[], dominoes: DominoDef[]): Puzzle {
  return {
    cells,
    regions: regionDefs.map((rd, i) => ({
      ...rd,
      constraint: constraints[i],
      color: colors[i],
    })),
    dominoes,
  };
}

// Try a specific configuration
// Alternating product/sum for maximum coupling:
// A=Π90, B=Σ11, C=Π120, D=Σ11, E=Σ13, F=Π150, G=Σ12, H=Π100
const constraintList: Constraint[] = [
  { kind: "product", target: 90 },
  { kind: "sum", target: 11 },
  { kind: "product", target: 120 },
  { kind: "sum", target: 11 },
  { kind: "sum", target: 13 },
  { kind: "product", target: 150 },
  { kind: "sum", target: 12 },
  { kind: "product", target: 100 },
];
// A={3,5,6}, B={2,4,5}, C={4,5,6}, D={3,3,5}
// E={4,4,5}, F={5,5,6}, G={3,3,6}, H={4,5,5}

// I need to find domino assignments that tile the grid AND match the value sets.
// Let me place values on the grid and derive dominos:
//
// Row 0: A  B  B  C  C  D     →  3  4  2  6  5  3
// Row 1: A  A  B  C  D  D     →  6  5  5  4  3  5
// Row 2: E  E  F  G  G  H     →  4  5  5  3  6  5
// Row 3: E  F  F  G  H  H     →  4  6  5  3  4  5
//
// Domino tiling (12 dominoes, all horizontal or vertical):
// d01: V(0,0)-(1,0) = [3,6] (A,A) → A={3,6,...} need 5. OK cell(1,1)=5.
// d02: H(0,1)-(0,2) = [4,2] (B,B) → B={4,2,...} need 5. Cell(1,2)=5.
// d03: H(0,3)-(0,4) = [6,5] (C,C) → C={6,5,...} need 4. Cell(1,3)=4.
// d04: V(0,5)-(1,5) = [3,5] (D,D) → D={3,5,...} need 3. Cell(1,4)=3.
// d05: H(1,1)-(1,2) = [5,5] (A→B cross!) A-side=5, B-side=5.
// d06: H(1,3)-(1,4) = [4,3] (C→D cross!) C-side=4, D-side=3.
// d07: V(2,0)-(3,0) = [4,4] (E,E) → E={4,4,...} need 5. Cell(2,1)=5.
// d08: H(2,1)-(2,2) = [5,5] (E→F cross!) E-side=5, F-side=5.
// Wait, d05=[5,5] and d08=[5,5]! Same type. That's OK.
// d09: V(2,3)-(3,3) = [3,3] (G,G) → G={3,3,...} need 6. Cell(2,4)=6.
// d10: H(2,4)-(2,5) = [6,5] (G→H cross!) G-side=6, H-side=5.
// Wait, d03=[6,5] and d10=[6,5]! Same type.
// d11: H(3,1)-(3,2) = [6,5] (F,F) → F={5,6,5} product=150 ✓.
// d03, d10, d11 all [6,5]! Three copies.
// d12: H(3,4)-(3,5) = [4,5] (H,H) → H={5,4,5} product=100 ✓.
//
// Verify regions:
// A: (0,0)=3, (1,0)=6, (1,1)=5 → {3,5,6} product=90 ✓
// B: (0,1)=4, (0,2)=2, (1,2)=5 → {2,4,5} product=40 ✓
// C: (0,3)=6, (0,4)=5, (1,3)=4 → {4,5,6} product=120 ✓
// D: (0,5)=3, (1,4)=3, (1,5)=5 → {3,3,5} product=45 ✓
// E: (2,0)=4, (2,1)=5, (3,0)=4 → {4,4,5} product=80 ✓
// F: (2,2)=5, (3,1)=6, (3,2)=5 → {5,5,6} product=150 ✓
// G: (2,3)=3, (2,4)=6, (3,3)=3 → {3,3,6} product=54 ✓
// H: (2,5)=5, (3,4)=4, (3,5)=5 → {4,5,5} product=100 ✓
//
// Cross-boundary dominos:
// d05: H(1,1)-(1,2) crosses A→B ✓
// d06: H(1,3)-(1,4) crosses C→D ✓
// d08: H(2,1)-(2,2) crosses E→F ✓
// d10: H(2,4)-(2,5) crosses G→H ✓
// That's 4 out of 12 = 33% cross-boundary.
//
// Let me try a different tiling with more cross-boundary:
// Row 0: 3  4  2  6  5  3
// Row 1: 6  5  5  4  3  5
//
// Tiling top half:
// d01: V(0,0)-(1,0) = [3,6] (A→A)
// d02: V(0,1)-(1,1) = [4,5] (B→A cross!) ← B-side=4, A-side=5
// d03: V(0,2)-(1,2) = [2,5] (B→B)
// d04: V(0,3)-(1,3) = [6,4] (C→C)
// d05: V(0,4)-(1,4) = [5,3] (C→D cross!) ← C-side=5, D-side=3
// d06: V(0,5)-(1,5) = [3,5] (D→D)
//
// Row 2: 4  5  5  3  6  5
// Row 3: 4  6  5  3  4  5
//
// d07: V(2,0)-(3,0) = [4,4] (E→E)
// d08: V(2,1)-(3,1) = [5,6] (E→F cross!) ← E-side=5, F-side=6
// d09: V(2,2)-(3,2) = [5,5] (F→F)
// d10: V(2,3)-(3,3) = [3,3] (G→G)
// d11: V(2,4)-(3,4) = [6,4] (G→H cross!) ← G-side=6, H-side=4
// d12: V(2,5)-(3,5) = [5,5] (H→H)
//
// Cross-boundary: d02(B→A), d05(C→D), d08(E→F), d11(G→H) = 4/12 = 33%
// Hmm same. The grid structure limits cross-boundary with all-vertical.
//
// Let me mix horizontal and vertical for more crossings:
// Row 0: 3  2  4  5  6  3
// Row 1: 5  6  5  4  5  3
// Row 2: 4  4  6  3  3  5
// Row 3: 5  5  5  6  4  5
//
// A: (0,0)=3, (1,0)=5, (1,1)=6 → product=90 ✓
// B: (0,1)=2, (0,2)=4, (1,2)=5 → product=40 ✓
// C: (0,3)=5, (0,4)=6, (1,3)=4 → product=120 ✓
// D: (0,5)=3, (1,4)=5, (1,5)=3 → product=45 ✓
// E: (2,0)=4, (2,1)=4, (3,0)=5 → product=80 ✓
// F: (2,2)=6, (3,1)=5, (3,2)=5 → product=150 ✓
// G: (2,3)=3, (2,4)=3, (3,3)=6 → product=54 ✓
// H: (2,5)=5, (3,4)=4, (3,5)=5 → product=100 ✓
//
// Tiling with maximum cross-boundary:
// d01: H(0,0)-(0,1) = [3,2] (A→B cross!)
// d02: V(0,2)-(1,2) = [4,5] (B→B)
// d03: H(0,3)-(0,4) = [5,6] (C→C)
// d04: V(0,5)-(1,5) = [3,3] (D→D)
// d05: V(1,0)-(2,0) = [5,4] (A→E cross!)
// d06: V(1,1)-(2,1) = [6,4] (A→E cross!) Wait, A only has (0,0),(1,0),(1,1).
//   (1,1) is in A. (2,1) is in E. So V(1,1)-(2,1) = A→E cross. ✓
// d07: V(1,3)-(2,3) = [4,3] (C→G cross!)
// d08: V(1,4)-(2,4) = [5,3] (D→G cross!)
// d09: H(2,2)-(2,5)... no, not adjacent. Let me think about remaining cells.
//
// Covered: (0,0)(0,1)(0,2)(1,2)(0,3)(0,4)(0,5)(1,5)(1,0)(2,0)(1,1)(2,1)(1,3)(2,3)(1,4)(2,4)
// = 16 cells covered by d01-d08.
// Remaining: (2,2)(2,5)(3,0)(3,1)(3,2)(3,3)(3,4)(3,5) = 8 cells = 4 dominos.
// d09: V(2,2)-(3,2) = [6,5] (F→F)
// d10: V(2,5)-(3,5) = [5,5] (H→H)
// d11: H(3,0)-(3,1) = [5,5] (E→F cross!)
// d12: H(3,3)-(3,4) = [6,4] (G→H cross!)
//
// Cross-boundary: d01,d05,d06,d07,d08,d11,d12 = 7/12 = 58%! Much better.
//
// Domino list: [3,2],[4,5],[5,6],[3,3],[5,4],[6,4],[4,3],[5,3],[6,5],[5,5],[5,5],[6,4]
// Duplicates: [5,5]×2, [6,4]×2. Manageable.

const dominos: DominoDef[] = [
  { id: "d01", values: [3, 2] },
  { id: "d02", values: [4, 5] },
  { id: "d03", values: [5, 6] },
  { id: "d04", values: [3, 3] },
  { id: "d05", values: [5, 4] },
  { id: "d06", values: [6, 4] },
  { id: "d07", values: [4, 3] },
  { id: "d08", values: [5, 3] },
  { id: "d09", values: [6, 5] },
  { id: "d10", values: [5, 5] },
  { id: "d11", values: [5, 5] },
  { id: "d12", values: [6, 4] },
];

const puzzle = buildPuzzle(constraintList, dominos);

console.log("=== Puzzle Analysis ===");
console.log(
  `Cells: ${puzzle.cells.length}, Dominoes: ${puzzle.dominoes.length}`,
);
printRegions(puzzle);

console.log("\nSearching for distinct board states (max 20)...");
const t0 = performance.now();
const result = analyzePuzzle(puzzle, 20);
const elapsed = performance.now() - t0;

console.log(`\n=== Results ===`);
console.log(
  `Unique board states: ${result.uniqueBoardCount}${result.uniqueBoardCount >= 20 ? "+" : ""}`,
);
console.log(`Nodes explored: ${result.nodesExplored}`);
console.log(`Nodes to first solution: ${result.firstSolutionNodes}`);
console.log(`Time: ${elapsed.toFixed(0)}ms`);

if (result.uniqueBoardCount === 1) {
  console.log("\n✅ UNIQUE SOLUTION!");
  console.log(`Difficulty: ${result.nodesExplored} total nodes`);
} else if (result.uniqueBoardCount > 1) {
  console.log("\n⚠️  Multiple solutions — need tighter constraints");
} else {
  console.log("\n❌ Unsolvable");
}
