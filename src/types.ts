export type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Constraint =
  | { kind: "sum"; target: number }
  | { kind: "product"; target: number }
  | { kind: "equal" }
  | { kind: "not-equal" }
  | { kind: "greater"; target: number }
  | { kind: "less"; target: number }
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
