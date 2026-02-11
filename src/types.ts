export type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Constraint =
  | { kind: "sum"; target: number }
  | { kind: "product"; target: number }
  | { kind: "equal" }
  | { kind: "not-equal" }
  | { kind: "greater"; target: number }
  | { kind: "less"; target: number }
  | { kind: "mirror"; group: string }
  | { kind: "none" };

export interface Region {
  id: string;
  cells: [number, number][];
  constraint: Constraint;
  color: string;
}

export interface DominoDef {
  id: string;
  values: [Pip, Pip];
}

export interface Puzzle {
  cells: [number, number][];
  regions: Region[];
  dominoes: DominoDef[];
}

export type Orientation = 0 | 90 | 180 | 270;

export interface DominoState {
  id: string;
  values: [Pip, Pip];
  orientation: Orientation;
  zOrder: number;
  location:
    | { type: "tray"; x: number; y: number }
    | { type: "board"; row: number; col: number };
}

export interface DominoPlacement {
  dominoId: string;
  cells: [[number, number], [number, number]];
  values: [Pip, Pip];
}

export interface ValidationResult {
  valid: boolean;
  violatedRegions: string[];
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Returns the two cells a domino covers and the pip value at each cell,
 * given its anchor position and orientation.
 */
export function getCoveredCells(
  row: number,
  col: number,
  orientation: Orientation,
  values: [Pip, Pip],
): [
  { cell: [number, number]; value: Pip },
  { cell: [number, number]; value: Pip },
] {
  const [a, b] = values;
  switch (orientation) {
    case 0:
      return [
        { cell: [row, col], value: a },
        { cell: [row, col + 1], value: b },
      ];
    case 90:
      return [
        { cell: [row, col], value: a },
        { cell: [row + 1, col], value: b },
      ];
    case 180:
      return [
        { cell: [row, col], value: b },
        { cell: [row, col + 1], value: a },
      ];
    case 270:
      return [
        { cell: [row, col], value: b },
        { cell: [row + 1, col], value: a },
      ];
  }
}

/** Whether the orientation results in a horizontal domino. */
export function isHorizontal(orientation: Orientation): boolean {
  return orientation === 0 || orientation === 180;
}

/**
 * Rotate a domino 90° CW around a pivot cell.
 * The pivot cell must be one of the two cells the domino covers.
 * Returns new anchor position and orientation.
 */
export function rotateDomino(
  row: number,
  col: number,
  orientation: Orientation,
  values: [Pip, Pip],
  pivotCell: [number, number],
): { row: number; col: number; orientation: Orientation } {
  const covered = getCoveredCells(row, col, orientation, values);
  const pivotIdx = covered.findIndex(
    (c) => c.cell[0] === pivotCell[0] && c.cell[1] === pivotCell[1],
  );
  if (pivotIdx === -1) {
    throw new Error("Pivot cell is not covered by the domino");
  }
  const other = covered[1 - pivotIdx];

  // Rotate the other cell 90° CW around pivot: (dr, dc) → (dc, -dr)
  const dr = other.cell[0] - pivotCell[0];
  const dc = other.cell[1] - pivotCell[1];
  const newOtherCell: [number, number] = [pivotCell[0] + dc, pivotCell[1] - dr];

  return {
    row: Math.min(pivotCell[0], newOtherCell[0]),
    col: Math.min(pivotCell[1], newOtherCell[1]),
    orientation: ((orientation + 90) % 360) as Orientation,
  };
}
