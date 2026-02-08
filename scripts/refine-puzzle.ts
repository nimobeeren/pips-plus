/**
 * Post-processing: take the best found puzzle and try replacing some product
 * constraints with mirror constraints while maintaining uniqueness.
 *
 * The found puzzle has these region sums:
 *   A=3, B=7, C=10, D=5, E=11, F=10, G=8, H=8, I=7, J=4, K=9, L=8
 *
 * Matching sums (potential mirror pairs/groups):
 *   B+I: sum=7
 *   C+F: sum=10
 *   G+H+L: sum=8
 */

type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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

const RCELLS: [number, number][] = [];
for (let c = 0; c < COLS; c++) {
  RCELLS.push([idx(0, c), idx(1, c)]);
  RCELLS.push([idx(2, c), idx(3, c)]);
}

// ======================== Solver (product/sum/mirror) ========================

type RConstraint =
  | { kind: "product"; target: number }
  | { kind: "sum"; target: number }
  | { kind: "mirror"; group: string }
  | { kind: "none" };

const NODE_LIMIT = 200_000;

function countSolutions(
  rConstraints: RConstraint[],
  domValues: [number, number][],
  max: number,
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
      if (c.kind === "none" || c.kind === "mirror") continue;
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
    // Mirror check
    return checkMirrorPartial();
  }

  function checkMirrorPartial(): boolean {
    const groups = new Map<string, { sum: number; filled: boolean }[]>();
    for (let ri = 0; ri < 12; ri++) {
      const c = rConstraints[ri];
      if (c.kind !== "mirror") continue;
      if (!groups.has(c.group)) groups.set(c.group, []);
      const [ci1, ci2] = RCELLS[ri];
      const v1 = board[ci1],
        v2 = board[ci2];
      if (v1 >= 0 && v2 >= 0) {
        groups.get(c.group)!.push({ sum: v1 + v2, filled: true });
      } else if (v1 >= 0 || v2 >= 0) {
        const v = v1 >= 0 ? v1 : v2;
        groups.get(c.group)!.push({ sum: v, filled: false });
      }
    }
    for (const [, entries] of groups) {
      const filled = entries.filter((e) => e.filled);
      if (filled.length >= 2) {
        if (!filled.every((e) => e.sum === filled[0].sum)) return false;
      }
      if (filled.length >= 1) {
        const target = filled[0].sum;
        for (const e of entries) {
          if (e.filled) continue;
          // Partial: one cell filled with value v, other empty.
          // Sum must equal target, so other cell = target - v
          if (target - e.sum < 0 || target - e.sum > 6) return false;
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
      return seen.size >= max;
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

// ======================== Puzzle data ========================

const domValues: [number, number][] = [
  [1, 5],
  [5, 4],
  [6, 4],
  [2, 1],
  [5, 6],
  [4, 2],
  [1, 2],
  [5, 3],
  [1, 4],
  [6, 4],
  [6, 6],
  [2, 5],
];

// Base: all products
const baseConstraints: RConstraint[] = [
  { kind: "product", target: 2 },
  { kind: "product", target: 6 },
  { kind: "product", target: 25 },
  { kind: "product", target: 4 },
  { kind: "product", target: 30 },
  { kind: "product", target: 24 },
  { kind: "product", target: 16 },
  { kind: "product", target: 12 },
  { kind: "product", target: 6 },
  { kind: "product", target: 4 },
  { kind: "product", target: 20 },
  { kind: "product", target: 15 },
];

// Region indices: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11
// Sums:          3     7     10    5     11    10    8     8     7     4     9      8

console.log("=== Testing mirror constraint replacements ===\n");

// Test 1: Base puzzle (all products)
{
  const r = countSolutions(baseConstraints, domValues, 2);
  console.log(`Base (all products): count=${r.count}, nodes=${r.nodes}`);
}

// Test 2: Replace B(1) + I(8) with mirror group "m1" (both sum=7)
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  const r = countSolutions(c, domValues, 2);
  console.log(`B+I mirror(sum=7): count=${r.count}, nodes=${r.nodes}`);
}

// Test 3: Replace C(2) + F(5) with mirror group "m2" (both sum=10)
{
  const c = [...baseConstraints];
  c[2] = { kind: "mirror", group: "m2" };
  c[5] = { kind: "mirror", group: "m2" };
  const r = countSolutions(c, domValues, 2);
  console.log(`C+F mirror(sum=10): count=${r.count}, nodes=${r.nodes}`);
}

// Test 4: Replace G(6) + H(7) with mirror group "m3" (both sum=8)
{
  const c = [...baseConstraints];
  c[6] = { kind: "mirror", group: "m3" };
  c[7] = { kind: "mirror", group: "m3" };
  const r = countSolutions(c, domValues, 2);
  console.log(`G+H mirror(sum=8): count=${r.count}, nodes=${r.nodes}`);
}

// Test 5: Replace G(6) + L(11) with mirror group "m3" (both sum=8)
{
  const c = [...baseConstraints];
  c[6] = { kind: "mirror", group: "m3" };
  c[11] = { kind: "mirror", group: "m3" };
  const r = countSolutions(c, domValues, 2);
  console.log(`G+L mirror(sum=8): count=${r.count}, nodes=${r.nodes}`);
}

// Test 6: Replace H(7) + L(11) with mirror group "m3" (both sum=8)
{
  const c = [...baseConstraints];
  c[7] = { kind: "mirror", group: "m3" };
  c[11] = { kind: "mirror", group: "m3" };
  const r = countSolutions(c, domValues, 2);
  console.log(`H+L mirror(sum=8): count=${r.count}, nodes=${r.nodes}`);
}

// Test 7: Replace G+H+L all with mirror group "m3" (all sum=8)
{
  const c = [...baseConstraints];
  c[6] = { kind: "mirror", group: "m3" };
  c[7] = { kind: "mirror", group: "m3" };
  c[11] = { kind: "mirror", group: "m3" };
  const r = countSolutions(c, domValues, 2);
  console.log(`G+H+L mirror(sum=8): count=${r.count}, nodes=${r.nodes}`);
}

// Test 8: Replace B+I mirror AND G+H mirror (double mirror)
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  c[6] = { kind: "mirror", group: "m3" };
  c[7] = { kind: "mirror", group: "m3" };
  const r = countSolutions(c, domValues, 2);
  console.log(`B+I mirror + G+H mirror: count=${r.count}, nodes=${r.nodes}`);
}

// Test 9: B+I mirror + H+L mirror (both unique individually)
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  c[7] = { kind: "mirror", group: "m2" };
  c[11] = { kind: "mirror", group: "m2" };
  const r = countSolutions(c, domValues, 2);
  console.log(`B+I mirror + H+L mirror: count=${r.count}, nodes=${r.nodes}`);
}

// Test 10: B+I mirror + remove some redundant constraints
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  c[3] = { kind: "none" }; // Remove D
  const r = countSolutions(c, domValues, 2);
  console.log(`B+I mirror + remove D: count=${r.count}, nodes=${r.nodes}`);
}

// Test 11: B+I mirror + remove D + remove J
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  c[3] = { kind: "none" }; // Remove D
  c[9] = { kind: "none" }; // Remove J
  const r = countSolutions(c, domValues, 2);
  console.log(`B+I mirror + remove D,J: count=${r.count}, nodes=${r.nodes}`);
}

// Test 12: B+I mirror + D+J mirror (sum=5 vs sum=4, NOT matching - invalid mirror)
// Actually D sum=5, J sum=4, so they can't be mirrored. Skip.

// Test 13: B+I mirror + remove F
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  c[5] = { kind: "none" }; // Remove F
  const r = countSolutions(c, domValues, 2);
  console.log(`B+I mirror + remove F: count=${r.count}, nodes=${r.nodes}`);
}

// Test 14: B+I mirror + H+L mirror + remove D
{
  const c = [...baseConstraints];
  c[1] = { kind: "mirror", group: "m1" };
  c[8] = { kind: "mirror", group: "m1" };
  c[7] = { kind: "mirror", group: "m2" };
  c[11] = { kind: "mirror", group: "m2" };
  c[3] = { kind: "none" }; // Remove D
  const r = countSolutions(c, domValues, 2);
  console.log(
    `B+I + H+L mirror + remove D: count=${r.count}, nodes=${r.nodes}`,
  );
}

// Test 15: Just check redundancy analysis
console.log("\n=== Testing individual constraint removal ===\n");
const RIDS = "ABCDEFGHIJKL".split("");
for (let ri = 0; ri < 12; ri++) {
  const c = [...baseConstraints];
  c[ri] = { kind: "none" };
  const r = countSolutions(c, domValues, 2);
  console.log(
    `Remove ${RIDS[ri]}: count=${r.count}, nodes=${r.nodes}${r.count === 1 ? " ← REDUNDANT" : ""}`,
  );
}
