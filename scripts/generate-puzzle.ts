/**
 * Puzzle generator v5: optimized solver + random tilings + multiple combos.
 *
 * Key improvements over v4:
 *  - Random tiling generation for domino set variety
 *  - Multiple constraint combos (tightest, all-product, all-sum)
 *  - Diagnostic counters for debugging
 *
 * Grid: 4×6 (24 cells, 12 dominoes)
 * Regions: 12 vertical 2-cell pairs
 */

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

// ======================== Grid constants ========================

const ROWS = 4,
  COLS = 6,
  N = ROWS * COLS,
  D = N / 2;

function idx(r: number, c: number): number {
  return r * COLS + c;
}

const ADJ: number[][] = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const nb: number[] = [];
    if (r > 0) nb.push(idx(r - 1, c));
    if (r < ROWS - 1) nb.push(idx(r + 1, c));
    if (c > 0) nb.push(idx(r, c - 1));
    if (c < COLS - 1) nb.push(idx(r, c + 1));
    ADJ.push(nb);
  }

// 12 vertical 2-cell regions
const RCELLS: [number, number][] = [];
for (let c = 0; c < COLS; c++) {
  RCELLS.push([idx(0, c), idx(1, c)]);
  RCELLS.push([idx(2, c), idx(3, c)]);
}
const RIDS = RCELLS.map((_, i) => String.fromCharCode(65 + i));
const COLORS = [
  "#e57373",
  "#4fc3f7",
  "#81c784",
  "#ffb74d",
  "#f06292",
  "#aed581",
  "#4dd0e1",
  "#ba68c8",
  "#ff8a65",
  "#a1887f",
  "#90a4ae",
  "#dce775",
];

// Constraint tightness
const PROD_OPTS = new Map<number, number>();
const SUM_OPTS = new Map<number, number>();
for (let a = 1; a <= 6; a++)
  for (let b = 1; b <= 6; b++) {
    PROD_OPTS.set(a * b, (PROD_OPTS.get(a * b) ?? 0) + 1);
    SUM_OPTS.set(a + b, (SUM_OPTS.get(a + b) ?? 0) + 1);
  }

// ======================== Random tiling ========================

function randomTiling(): [number, number][] | null {
  const covered = new Uint8Array(N);
  const result: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    if (covered[i]) continue;
    const r = Math.floor(i / COLS),
      c = i % COLS;
    const nb: number[] = [];
    if (r + 1 < ROWS && !covered[idx(r + 1, c)]) nb.push(idx(r + 1, c));
    if (c + 1 < COLS && !covered[idx(r, c + 1)]) nb.push(idx(r, c + 1));
    if (!nb.length) return null;
    const ni = nb[Math.floor(Math.random() * nb.length)];
    covered[i] = 1;
    covered[ni] = 1;
    result.push([i, ni]);
  }
  return result.length === D ? result : null;
}

// ======================== Fast solver ========================

const NODE_LIMIT = 50_000;

function fastCount(
  rConstraints: { kind: "product" | "sum"; target: number }[],
  domValues: [number, number][],
  maxSolutions: number,
): { count: number; nodes: number; board: Int8Array | null } {
  const board = new Int8Array(N).fill(-1);
  const used = new Uint8Array(D);
  const seen = new Set<string>();
  let nodes = 0;
  let firstBoard: Int8Array | null = null;
  let aborted = false;

  function checkPartial(): boolean {
    for (let ri = 0; ri < 12; ri++) {
      const [ci1, ci2] = RCELLS[ri];
      const v1 = board[ci1],
        v2 = board[ci2];
      const c = rConstraints[ri];
      if (v1 < 0 && v2 < 0) continue;
      if (v1 >= 0 && v2 >= 0) {
        if (c.kind === "product") {
          if (v1 * v2 !== c.target) return false;
        } else {
          if (v1 + v2 !== c.target) return false;
        }
      } else {
        const v = v1 >= 0 ? v1 : v2;
        if (c.kind === "product") {
          if (c.target === 0) continue;
          if (v === 0) return false;
          if (c.target % v !== 0) return false;
          const rem = c.target / v;
          if (rem < 1 || rem > 6) return false;
        } else {
          const rem = c.target - v;
          if (rem < 1 || rem > 6) return false;
        }
      }
    }
    return true;
  }

  function checkIsolation(): boolean {
    for (let i = 0; i < N; i++) {
      if (board[i] >= 0) continue;
      let ok = false;
      for (const ni of ADJ[i]) {
        if (board[ni] < 0) {
          ok = true;
          break;
        }
      }
      if (!ok) return true;
    }
    return false;
  }

  function dfs(): boolean {
    if (nodes >= NODE_LIMIT) {
      aborted = true;
      return true;
    }
    let fi = -1;
    for (let i = 0; i < N; i++) {
      if (board[i] < 0) {
        fi = i;
        break;
      }
    }
    if (fi < 0) {
      const fp = board.join(",");
      if (seen.has(fp)) return false;
      seen.add(fp);
      if (!firstBoard) firstBoard = new Int8Array(board);
      return seen.size >= maxSolutions;
    }
    for (const ni of ADJ[fi]) {
      if (board[ni] >= 0) continue;
      const tried = new Set<number>();
      for (let di = 0; di < D; di++) {
        if (used[di]) continue;
        const [a, b] = domValues[di];
        const orientations =
          a === b
            ? [[a, b]]
            : [
                [a, b],
                [b, a],
              ];
        for (const [v1, v2] of orientations) {
          const key = v1 * 7 + v2;
          if (tried.has(key)) continue;
          tried.add(key);
          nodes++;
          board[fi] = v1;
          board[ni] = v2;
          used[di] = 1;
          if (checkPartial() && !checkIsolation()) {
            if (dfs()) {
              board[fi] = -1;
              board[ni] = -1;
              used[di] = 0;
              return true;
            }
          }
          board[fi] = -1;
          board[ni] = -1;
          used[di] = 0;
        }
      }
    }
    return false;
  }

  dfs();
  if (aborted) return { count: -1, nodes, board: null };
  return { count: seen.size, nodes, board: firstBoard };
}

// ======================== Main search ========================

interface Candidate {
  constraints: { kind: "product" | "sum"; target: number }[];
  domValues: [number, number][];
  nodes: number;
  board: Int8Array;
}

const MAX_ITER = 100_000;
const TILINGS_PER_ITER = 8;
let bestNodes = 0;
let bestCandidate: Candidate | null = null;
let uniqueCount = 0;
let tested = 0;
let abortedCount = 0;
let zeroCount = 0;
let multiCount = 0;
const t0 = performance.now();

for (let iter = 0; iter < MAX_ITER; iter++) {
  const vals = new Int8Array(N);
  for (let i = 0; i < N; i++) vals[i] = Math.floor(Math.random() * 6) + 1;

  // Compute per-region info
  const prods: number[] = [];
  const sums: number[] = [];
  for (let ri = 0; ri < 12; ri++) {
    const [ci1, ci2] = RCELLS[ri];
    prods.push(vals[ci1] * vals[ci2]);
    sums.push(vals[ci1] + vals[ci2]);
  }

  // Build constraint combos
  const combos: { kind: "product" | "sum"; target: number }[][] = [];

  // Tightest
  combos.push(
    prods.map((p, ri) => {
      const po = PROD_OPTS.get(p) ?? 99;
      const so = SUM_OPTS.get(sums[ri]) ?? 99;
      return po <= so
        ? { kind: "product" as const, target: p }
        : { kind: "sum" as const, target: sums[ri] };
    }),
  );

  // All products
  combos.push(prods.map((p) => ({ kind: "product" as const, target: p })));

  // All sums
  combos.push(sums.map((s) => ({ kind: "sum" as const, target: s })));

  // Generate tilings
  const tilings: [number, number][][] = [];
  for (let t = 0; t < TILINGS_PER_ITER; t++) {
    const tiling = randomTiling();
    if (tiling) tilings.push(tiling);
  }

  for (const tiling of tilings) {
    const domValues: [number, number][] = tiling.map(([i1, i2]) => [
      vals[i1] as Pip,
      vals[i2] as Pip,
    ]);

    // Skip if too many duplicate domino types
    const tc = new Map<number, number>();
    let dups = 0;
    for (const [a, b] of domValues) {
      const key = Math.min(a, b) * 7 + Math.max(a, b);
      const c = (tc.get(key) ?? 0) + 1;
      tc.set(key, c);
      if (c > 1) dups++;
    }
    if (dups > 4) continue;

    for (const combo of combos) {
      tested++;
      const result = fastCount(combo, domValues, 2);
      if (result.count < 0) {
        abortedCount++;
      } else if (result.count === 0) {
        zeroCount++;
      } else if (result.count === 1 && result.board) {
        uniqueCount++;
        if (result.nodes > bestNodes) {
          bestNodes = result.nodes;
          bestCandidate = {
            constraints: combo,
            domValues,
            nodes: result.nodes,
            board: result.board,
          };
          console.log(
            `[${iter}] NEW BEST: ${result.nodes} nodes (${uniqueCount} total unique)`,
          );
        }
      } else {
        multiCount++;
      }
    }
  }

  if ((iter + 1) % 20000 === 0) {
    const el = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(
      `... ${iter + 1}/${MAX_ITER} (${el}s) unique=${uniqueCount} tested=${tested} abort=${abortedCount} zero=${zeroCount} multi=${multiCount}`,
    );
  }
}

const elapsed = (performance.now() - t0) / 1000;
console.log(
  `\nDone: ${elapsed.toFixed(1)}s, unique=${uniqueCount}, tested=${tested}, abort=${abortedCount}, zero=${zeroCount}, multi=${multiCount}`,
);

// ======================== Output ========================

if (bestCandidate) {
  const bc = bestCandidate;
  console.log(`\n=== BEST PUZZLE (${bc.nodes} nodes) ===`);

  console.log("\nRegion map:");
  for (let r = 0; r < ROWS; r++) {
    let row = "";
    for (let c = 0; c < COLS; c++) {
      const ci = idx(r, c);
      const ri = RCELLS.findIndex(([a, b]) => a === ci || b === ci);
      row += RIDS[ri].padStart(3);
    }
    console.log(row);
  }

  console.log("\nConstraints:");
  for (let ri = 0; ri < 12; ri++) {
    const c = bc.constraints[ri];
    console.log(
      `  ${RIDS[ri]}: ${c.kind === "product" ? "Π" : "Σ"}=${c.target}`,
    );
  }

  console.log("\nSolution:");
  for (let r = 0; r < ROWS; r++) {
    let row = "";
    for (let c = 0; c < COLS; c++) row += ` ${bc.board[idx(r, c)]}`;
    console.log(row);
  }

  console.log("\nDominoes:");
  for (let i = 0; i < D; i++)
    console.log(`  d${String(i).padStart(2, "0")}: [${bc.domValues[i]}]`);

  // TypeScript output
  const cells: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) cells.push([r, c]);

  console.log("\n// --- TypeScript for puzzles.ts ---");
  console.log("export const hardPuzzle: Puzzle = {");
  console.log(
    `  cells: [\n    ${cells.map(([r, c]) => `[${r}, ${c}]`).join(", ")},\n  ],`,
  );
  console.log("  regions: [");
  for (let ri = 0; ri < 12; ri++) {
    const [ci1, ci2] = RCELLS[ri];
    const r1 = Math.floor(ci1 / COLS),
      c1 = ci1 % COLS;
    const r2 = Math.floor(ci2 / COLS),
      c2 = ci2 % COLS;
    const c = bc.constraints[ri];
    const cs =
      c.kind === "product"
        ? `{ kind: "product", target: ${c.target} }`
        : `{ kind: "sum", target: ${c.target} }`;
    console.log(
      `    { id: "${RIDS[ri]}", cells: [[${r1}, ${c1}], [${r2}, ${c2}]], constraint: ${cs}, color: "${COLORS[ri]}" },`,
    );
  }
  console.log("  ],");
  console.log("  dominoes: [");
  for (let i = 0; i < D; i++) {
    const [a, b] = bc.domValues[i];
    console.log(
      `    { id: "d${String(i).padStart(2, "0")}", values: [${a}, ${b}] },`,
    );
  }
  console.log("  ],");
  console.log("};");
} else {
  console.log("\nNo unique puzzle found.");
}
