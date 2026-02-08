import { validateSolution } from "@/solver";
import type {
  DominoPlacement,
  DominoState,
  Orientation,
  Pip,
  Puzzle,
} from "@/types";
import { cellKey, getCoveredCells, isHorizontal } from "@/types";
import { CELL_SIZE, DOMINO_SIZE, DOMINO_SPAN } from "./domino";
import { initialTrayPosition, trayDimensions } from "./tray";

// --- State management ---

export interface GameState {
  puzzle: Puzzle;
  dominoes: DominoState[];
  status: "playing" | "solved" | "invalid";
  violatedRegions: string[];
  heldDominoId: string | null;
  keyboardCursor: [number, number] | null;
  nextZOrder: number;
}

export type GameAction =
  | {
      type: "ROTATE";
      id: string;
      pivotFar: boolean;
      trayWidth?: number;
      trayHeight?: number;
    }
  | { type: "PLACE_ON_BOARD"; id: string; row: number; col: number }
  | {
      type: "MOVE_TO_TRAY";
      id: string;
      x: number;
      y: number;
      trayWidth?: number;
      trayHeight?: number;
    }
  | { type: "OFFSET_TRAY"; dx: number }
  | { type: "PICK_UP"; id: string }
  | { type: "MOVE_CURSOR"; direction: "up" | "down" | "left" | "right" }
  | { type: "CONFIRM_PLACEMENT" }
  | { type: "CANCEL_HELD" }
  | { type: "SHOW_SOLUTION"; placements: DominoPlacement[] }
  | { type: "CLEAR" };

export function initState(puzzle: Puzzle): GameState {
  const dominoes: DominoState[] = puzzle.dominoes.map((d, i) => {
    const pos = initialTrayPosition(i);
    return {
      id: d.id,
      values: d.values,
      orientation: 0 as Orientation,
      zOrder: i,
      location: { type: "tray" as const, x: pos.x, y: pos.y },
    };
  });

  return {
    puzzle,
    dominoes,
    status: "playing",
    violatedRegions: [],
    heldDominoId: null,
    keyboardCursor: null,
    nextZOrder: puzzle.dominoes.length,
  };
}

function getOccupiedCells(
  dominoes: DominoState[],
  excludeId?: string,
): Map<string, string> {
  const occupied = new Map<string, string>();
  for (const d of dominoes) {
    if (d.location.type !== "board" || d.id === excludeId) continue;
    const cells = getCoveredCells(
      d.location.row,
      d.location.col,
      d.orientation,
      d.values,
    );
    for (const { cell } of cells) {
      occupied.set(cellKey(cell[0], cell[1]), d.id);
    }
  }
  return occupied;
}

export function canPlaceOnBoard(
  state: GameState,
  dominoId: string,
  row: number,
  col: number,
  orientation: Orientation,
): boolean {
  const cellSet = new Set(state.puzzle.cells.map(([r, c]) => cellKey(r, c)));
  const occupied = getOccupiedCells(state.dominoes, dominoId);
  const domino = state.dominoes.find((d) => d.id === dominoId);
  if (!domino) return false;

  const cells = getCoveredCells(row, col, orientation, domino.values);
  for (const { cell } of cells) {
    const key = cellKey(cell[0], cell[1]);
    if (!cellSet.has(key)) return false;
    if (occupied.has(key)) return false;
  }
  return true;
}

export function doValidation(state: GameState): GameState {
  const boardDominoes = state.dominoes.filter(
    (d) => d.location.type === "board",
  );
  if (boardDominoes.length !== state.puzzle.dominoes.length) {
    return { ...state, status: "playing", violatedRegions: [] };
  }

  const placements: DominoPlacement[] = boardDominoes.map((d) => {
    if (d.location.type !== "board") throw new Error("Expected board location");
    const cells = getCoveredCells(
      d.location.row,
      d.location.col,
      d.orientation,
      d.values,
    );
    return {
      dominoId: d.id,
      cells: [cells[0].cell, cells[1].cell],
      values: [cells[0].value, cells[1].value] as [Pip, Pip],
    };
  });

  const result = validateSolution(state.puzzle, placements);
  if (result.valid) {
    return { ...state, status: "solved", violatedRegions: [] };
  }
  return {
    ...state,
    status: "invalid",
    violatedRegions: result.violatedRegions,
  };
}

/**
 * Position offset for tray domino rotation when pivoting around the far half.
 * Keeps the far half visually in place while the anchor half rotates around it.
 */
const PIVOT_FAR_OFFSET: Record<Orientation, { dx: number; dy: number }> = {
  0: { dx: CELL_SIZE, dy: -CELL_SIZE },
  90: { dx: CELL_SIZE, dy: CELL_SIZE },
  180: { dx: -CELL_SIZE, dy: CELL_SIZE },
  270: { dx: -CELL_SIZE, dy: -CELL_SIZE },
};

/**
 * Visual bounding box offset relative to the wrapper position for CSS-rotated dominoes.
 * The Domino component uses transformOrigin at (DOMINO_SIZE/2, DOMINO_SIZE/2) rather than
 * the center, so the visual box shifts for some orientations.
 */
export const ROTATION_VISUAL_OFFSET: Record<
  Orientation,
  { dx: number; dy: number }
> = {
  0: { dx: 0, dy: 0 },
  90: { dx: 0, dy: 0 },
  180: { dx: -CELL_SIZE, dy: 0 },
  270: { dx: 0, dy: -CELL_SIZE },
};

function clampTrayPosition(
  orientation: Orientation,
  x: number,
  y: number,
  trayWidth: number,
  trayHeight: number,
): { x: number; y: number } {
  const isH = isHorizontal(orientation);
  const visualWidth = isH ? DOMINO_SPAN : DOMINO_SIZE;
  const visualHeight = isH ? DOMINO_SIZE : DOMINO_SPAN;
  const offset = ROTATION_VISUAL_OFFSET[orientation];

  const visualX = x + offset.dx;
  const visualY = y + offset.dy;
  const maxVisualX = Math.max(0, trayWidth - visualWidth);
  const maxVisualY = Math.max(0, trayHeight - visualHeight);

  const clampedVisualX = Math.min(Math.max(0, visualX), maxVisualX);
  const clampedVisualY = Math.min(Math.max(0, visualY), maxVisualY);

  return {
    x: clampedVisualX - offset.dx,
    y: clampedVisualY - offset.dy,
  };
}

/**
 * Rotate a board domino 90° CW around a pivot cell.
 * The pivot cell must be one of the two cells the domino covers.
 * Returns new anchor position and orientation.
 */
function rotateBoardDomino(
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

/**
 * Determine whether the user clicked the far half (vs anchor half) of a domino.
 * Uses the visual bounding rect offset to account for CSS rotation.
 */
export function isClickOnFarHalf(
  orientation: Orientation,
  offsetX: number,
  offsetY: number,
  visualWidth: number,
  visualHeight: number,
): boolean {
  const horizontal = isHorizontal(orientation);
  if (horizontal) {
    const clickedRight = offsetX >= visualWidth / 2;
    return orientation === 0 ? clickedRight : !clickedRight;
  } else {
    const clickedBottom = offsetY >= visualHeight / 2;
    return orientation === 90 ? clickedBottom : !clickedBottom;
  }
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ROTATE": {
      const traySize = trayDimensions(state.puzzle.dominoes.length);
      const trayWidth = action.trayWidth ?? traySize.width;
      const trayHeight = action.trayHeight ?? traySize.height;
      const nextDominoes = state.dominoes.map((d) => {
        if (d.id !== action.id) return d;
        const nextOrientation = ((d.orientation + 90) % 360) as Orientation;

        // Held domino is "in the air": freely rotate without constraints
        if (state.heldDominoId === d.id) {
          return { ...d, orientation: nextOrientation };
        }

        if (d.location.type === "board") {
          // Resolve pivot to a cell position (stays fixed across chained rotations)
          const covered = getCoveredCells(
            d.location.row,
            d.location.col,
            d.orientation,
            d.values,
          );
          const isFlipped = d.orientation === 180 || d.orientation === 270;
          const pivotIdx = action.pivotFar !== isFlipped ? 1 : 0;
          const pivotCell = covered[pivotIdx].cell;

          // Try rotating 90°, 180°, 270° CW and use the first that fits
          let current = {
            row: d.location.row,
            col: d.location.col,
            orientation: d.orientation,
          };
          for (let step = 0; step < 3; step++) {
            const result = rotateBoardDomino(
              current.row,
              current.col,
              current.orientation,
              d.values,
              pivotCell,
            );
            if (
              canPlaceOnBoard(
                state,
                d.id,
                result.row,
                result.col,
                result.orientation,
              )
            ) {
              return {
                ...d,
                orientation: result.orientation,
                location: {
                  type: "board" as const,
                  row: result.row,
                  col: result.col,
                },
              };
            }
            current = result;
          }
          return d;
        }

        // Tray domino: adjust position if pivoting around far half
        if (d.location.type === "tray") {
          const offset = action.pivotFar
            ? PIVOT_FAR_OFFSET[d.orientation]
            : { dx: 0, dy: 0 };
          const next = clampTrayPosition(
            nextOrientation,
            d.location.x + offset.dx,
            d.location.y + offset.dy,
            trayWidth,
            trayHeight,
          );
          return {
            ...d,
            orientation: nextOrientation,
            location: {
              type: "tray" as const,
              x: next.x,
              y: next.y,
            },
          };
        }

        return { ...d, orientation: nextOrientation };
      });
      return doValidation({
        ...state,
        dominoes: nextDominoes,
        status: "playing",
        violatedRegions: [],
      });
    }

    case "PLACE_ON_BOARD": {
      const domino = state.dominoes.find((d) => d.id === action.id);
      if (!domino) return state;

      if (
        !canPlaceOnBoard(
          state,
          action.id,
          action.row,
          action.col,
          domino.orientation,
        )
      ) {
        return state;
      }

      const nextDominoes = state.dominoes.map((d) =>
        d.id === action.id
          ? {
              ...d,
              zOrder: state.nextZOrder,
              location: {
                type: "board" as const,
                row: action.row,
                col: action.col,
              },
            }
          : d,
      );
      return doValidation({
        ...state,
        dominoes: nextDominoes,
        nextZOrder: state.nextZOrder + 1,
        status: "playing",
        violatedRegions: [],
      });
    }

    case "MOVE_TO_TRAY": {
      const traySize = trayDimensions(state.puzzle.dominoes.length);
      const trayWidth = action.trayWidth ?? traySize.width;
      const trayHeight = action.trayHeight ?? traySize.height;
      const domino = state.dominoes.find((d) => d.id === action.id);
      if (!domino) return state;
      const nextPos = clampTrayPosition(
        domino.orientation,
        action.x,
        action.y,
        trayWidth,
        trayHeight,
      );
      const nextDominoes = state.dominoes.map((d) =>
        d.id === action.id
          ? {
              ...d,
              zOrder: state.nextZOrder,
              location: {
                type: "tray" as const,
                x: nextPos.x,
                y: nextPos.y,
              },
            }
          : d,
      );
      return {
        ...state,
        dominoes: nextDominoes,
        nextZOrder: state.nextZOrder + 1,
        status: "playing",
        violatedRegions: [],
      };
    }

    case "OFFSET_TRAY": {
      const nextDominoes = state.dominoes.map((d) =>
        d.location.type === "tray"
          ? {
              ...d,
              location: {
                type: "tray" as const,
                x: d.location.x + action.dx,
                y: d.location.y,
              },
            }
          : d,
      );
      return { ...state, dominoes: nextDominoes };
    }

    case "PICK_UP": {
      if (state.heldDominoId === action.id) {
        return { ...state, heldDominoId: null, keyboardCursor: null };
      }
      return {
        ...state,
        heldDominoId: action.id,
        keyboardCursor: [
          Math.max(...state.puzzle.cells.map(([r]) => r)),
          Math.min(...state.puzzle.cells.map(([, c]) => c)),
        ],
      };
    }

    case "MOVE_CURSOR": {
      if (!state.keyboardCursor) return state;
      const [r, c] = state.keyboardCursor;
      let nextR = r;
      let nextC = c;
      switch (action.direction) {
        case "up":
          nextR = r - 1;
          break;
        case "down":
          nextR = r + 1;
          break;
        case "left":
          nextC = c - 1;
          break;
        case "right":
          nextC = c + 1;
          break;
      }
      return { ...state, keyboardCursor: [nextR, nextC] };
    }

    case "CONFIRM_PLACEMENT": {
      if (!state.heldDominoId || !state.keyboardCursor) return state;
      const [cursorRow, cursorCol] = state.keyboardCursor;
      const domino = state.dominoes.find((d) => d.id === state.heldDominoId);
      if (!domino) return state;

      // The cursor marks the pivot cell. For 180°/270° the domino extends
      // in the negative direction, so shift the anchor to the top-left cell.
      let row = cursorRow;
      let col = cursorCol;
      if (domino.orientation === 180) col -= 1;
      if (domino.orientation === 270) row -= 1;

      if (!canPlaceOnBoard(state, domino.id, row, col, domino.orientation)) {
        return state;
      }

      const nextDominoes = state.dominoes.map((d) =>
        d.id === state.heldDominoId
          ? {
              ...d,
              zOrder: state.nextZOrder,
              location: { type: "board" as const, row, col },
            }
          : d,
      );
      return doValidation({
        ...state,
        dominoes: nextDominoes,
        nextZOrder: state.nextZOrder + 1,
        heldDominoId: null,
        keyboardCursor: null,
        status: "playing",
        violatedRegions: [],
      });
    }

    case "CANCEL_HELD": {
      return { ...state, heldDominoId: null, keyboardCursor: null };
    }

    case "SHOW_SOLUTION": {
      const nextDominoes = state.dominoes.map((d, i) => {
        const placement = action.placements.find((p) => p.dominoId === d.id);
        if (!placement) return d;

        const [cell1, cell2] = placement.cells;
        const [val1] = placement.values;
        const [a] = d.values;

        const isH = cell1[0] === cell2[0];
        let orientation: Orientation;
        if (isH) {
          orientation = val1 === a ? 0 : 180;
        } else {
          orientation = val1 === a ? 90 : 270;
        }

        const anchorRow = Math.min(cell1[0], cell2[0]);
        const anchorCol = Math.min(cell1[1], cell2[1]);

        return {
          ...d,
          orientation,
          zOrder: state.nextZOrder + i,
          location: { type: "board" as const, row: anchorRow, col: anchorCol },
        };
      });
      return {
        ...state,
        dominoes: nextDominoes,
        nextZOrder: state.nextZOrder + nextDominoes.length,
        status: "solved",
        violatedRegions: [],
        heldDominoId: null,
        keyboardCursor: null,
      };
    }

    case "CLEAR": {
      const nextDominoes = state.dominoes.map((d, i) => {
        const pos = initialTrayPosition(
          state.puzzle.dominoes.findIndex((pd) => pd.id === d.id),
        );
        return {
          ...d,
          orientation: 0 as Orientation,
          zOrder: i,
          location: { type: "tray" as const, x: pos.x, y: pos.y },
        };
      });
      return {
        ...state,
        dominoes: nextDominoes,
        nextZOrder: nextDominoes.length,
        status: "playing",
        violatedRegions: [],
        heldDominoId: null,
        keyboardCursor: null,
      };
    }

    default:
      return state;
  }
}

// --- Drag tracking ---

export interface DragInfo {
  dominoId: string;
  startX: number;
  startY: number;
  /** Pointer offset within the domino's visual bounding box at drag start */
  offsetX: number;
  offsetY: number;
  /** Whether the user initially clicked the far half of the domino */
  clickedFar: boolean;
  currentX: number;
  currentY: number;
  originLocation: DominoState["location"];
}
