import { Button } from "@/components/ui/button";
import { solve, validateSolution } from "@/solver";
import type {
  DominoPlacement,
  DominoState,
  Orientation,
  Pip,
  Puzzle,
} from "@/types";
import { cellKey, getCoveredCells, isHorizontal } from "@/types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Board } from "./board";
import { CELL_SIZE, DOMINO_SIZE, DOMINO_SPAN, Domino } from "./domino";
import { Tray, initialTrayPosition, trayDimensions } from "./tray";

// --- State management ---

interface GameState {
  puzzle: Puzzle;
  dominoes: DominoState[];
  status: "playing" | "solved" | "invalid";
  violatedRegions: string[];
  heldDominoId: string | null;
  keyboardCursor: [number, number] | null;
  nextZOrder: number;
}

type GameAction =
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

function initState(puzzle: Puzzle): GameState {
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

function canPlaceOnBoard(
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

function doValidation(state: GameState): GameState {
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
const ROTATION_VISUAL_OFFSET: Record<Orientation, { dx: number; dy: number }> =
  {
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
 * Rotate a board domino around its pivot cell (the cell the user clicked).
 * Returns new anchor and orientation, or null if invalid.
 */
function rotateBoardDomino(
  row: number,
  col: number,
  orientation: Orientation,
  values: [Pip, Pip],
  pivotCellIndex: 0 | 1,
): { row: number; col: number; orientation: Orientation } | null {
  const covered = getCoveredCells(row, col, orientation, values);
  const pivot = covered[pivotCellIndex];
  const other = covered[1 - pivotCellIndex];

  // Rotate the other cell 90° CW around pivot: (dr, dc) → (dc, -dr)
  const dr = other.cell[0] - pivot.cell[0];
  const dc = other.cell[1] - pivot.cell[1];
  const newOtherCell: [number, number] = [
    pivot.cell[0] + dc,
    pivot.cell[1] - dr,
  ];

  const sameRow = pivot.cell[0] === newOtherCell[0];

  if (sameRow) {
    const newAnchorCol = Math.min(pivot.cell[1], newOtherCell[1]);
    const leftIsPivot = pivot.cell[1] < newOtherCell[1];
    const leftValue = leftIsPivot ? pivot.value : other.value;
    const newOrientation: Orientation = leftValue === values[0] ? 0 : 180;
    return {
      row: pivot.cell[0],
      col: newAnchorCol,
      orientation: newOrientation,
    };
  } else {
    const newAnchorRow = Math.min(pivot.cell[0], newOtherCell[0]);
    const topIsPivot = pivot.cell[0] < newOtherCell[0];
    const topValue = topIsPivot ? pivot.value : other.value;
    const newOrientation: Orientation = topValue === values[0] ? 90 : 270;
    return {
      row: newAnchorRow,
      col: pivot.cell[1],
      orientation: newOrientation,
    };
  }
}

/**
 * Determine whether the user clicked the far half (vs anchor half) of a domino.
 * Uses the visual bounding rect offset to account for CSS rotation.
 */
function isClickOnFarHalf(
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

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ROTATE": {
      const traySize = trayDimensions(state.puzzle.dominoes.length);
      const trayWidth = action.trayWidth ?? traySize.width;
      const trayHeight = action.trayHeight ?? traySize.height;
      const nextDominoes = state.dominoes.map((d) => {
        if (d.id !== action.id) return d;
        const nextOrientation = ((d.orientation + 90) % 360) as Orientation;

        if (d.location.type === "board") {
          // Determine which cell index is the pivot (0 = anchor half, 1 = far half)
          const pivotCellIndex = action.pivotFar ? 1 : 0;
          const result = rotateBoardDomino(
            d.location.row,
            d.location.col,
            d.orientation,
            d.values,
            pivotCellIndex as 0 | 1,
          );
          if (!result) return d;
          if (
            !canPlaceOnBoard(
              state,
              d.id,
              result.row,
              result.col,
              result.orientation,
            )
          ) {
            return d;
          }
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
      const [row, col] = state.keyboardCursor;
      const domino = state.dominoes.find((d) => d.id === state.heldDominoId);
      if (!domino) return state;

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

interface DragInfo {
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

// --- Game component ---

interface GameProps {
  puzzle: Puzzle;
}

export function Game({ puzzle }: GameProps) {
  const [state, dispatch] = useReducer(reducer, puzzle, initState);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [trayLayout, setTrayLayout] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  const handleSolve = useCallback(() => {
    const solution = solve(puzzle);
    if (solution) {
      dispatch({ type: "SHOW_SOLUTION", placements: solution });
    }
  }, [puzzle]);

  const handleClear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const computeTrayLayout = useCallback(() => {
    const fallback = trayDimensions(puzzle.dominoes.length);
    const trayEl = trayRef.current;
    if (!trayEl) {
      return { width: fallback.width, height: fallback.height, offsetX: 0 };
    }
    const rect = trayEl.getBoundingClientRect();
    const offsetX = Math.max(0, (rect.width - fallback.width) / 2);
    return { width: rect.width, height: rect.height, offsetX };
  }, [puzzle.dominoes.length]);

  const getTraySize = useCallback(() => {
    if (trayLayout.width && trayLayout.height) {
      return { width: trayLayout.width, height: trayLayout.height };
    }
    const fallback = trayDimensions(puzzle.dominoes.length);
    return { width: fallback.width, height: fallback.height };
  }, [puzzle.dominoes.length, trayLayout.height, trayLayout.width]);

  useLayoutEffect(() => {
    const updateLayout = () => {
      setTrayLayout(computeTrayLayout());
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [computeTrayLayout]);

  useEffect(() => {
    if (!trayLayout.offsetX) return;
    const trayDominoes = state.dominoes.filter(
      (d) => d.location.type === "tray",
    );
    if (!trayDominoes.length) return;

    let allInitial = true;
    for (const d of trayDominoes) {
      if (d.location.type !== "tray") continue;
      const index = puzzle.dominoes.findIndex((pd) => pd.id === d.id);
      if (index < 0) continue;
      const pos = initialTrayPosition(index);
      if (d.location.x !== pos.x || d.location.y !== pos.y) {
        allInitial = false;
        break;
      }
    }
    if (allInitial) {
      dispatch({ type: "OFFSET_TRAY", dx: trayLayout.offsetX });
    }
  }, [puzzle.dominoes, state.dominoes, trayLayout.offsetX]);

  // Pointer drag handlers
  const handlePointerDown = useCallback(
    (dominoId: string, e: React.PointerEvent) => {
      if (state.status === "solved") return;

      const domino = state.dominoes.find((d) => d.id === dominoId);
      if (!domino) return;

      e.preventDefault();

      // Compute offset within the domino's visual bounding box
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const clickedFar = isClickOnFarHalf(
        domino.orientation,
        offsetX,
        offsetY,
        rect.width,
        rect.height,
      );

      setDragInfo({
        dominoId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX,
        offsetY,
        clickedFar,
        currentX: e.clientX,
        currentY: e.clientY,
        originLocation: domino.location,
      });
    },
    [state.dominoes, state.status],
  );

  useEffect(() => {
    if (!dragInfo) return;

    const handlePointerMove = (e: PointerEvent) => {
      setDragInfo((prev) =>
        prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null,
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragInfo) return;

      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If barely moved, treat as click (rotate around clicked half)
      if (distance < 5) {
        const traySize = getTraySize();
        dispatch({
          type: "ROTATE",
          id: dragInfo.dominoId,
          pivotFar: dragInfo.clickedFar,
          trayWidth: traySize.width,
          trayHeight: traySize.height,
        });
        setDragInfo(null);
        return;
      }

      const domino = state.dominoes.find((d) => d.id === dragInfo.dominoId);

      // Try dropping on the board
      const boardEl = boardRef.current;
      if (boardEl && domino) {
        const boardRect = boardEl.getBoundingClientRect();
        const dropX = e.clientX - boardRect.left;
        const dropY = e.clientY - boardRect.top;

        if (
          dropX >= -CELL_SIZE &&
          dropX <= boardRect.width + CELL_SIZE &&
          dropY >= -CELL_SIZE &&
          dropY <= boardRect.height + CELL_SIZE
        ) {
          const minRow = Math.min(...puzzle.cells.map(([r]) => r));
          const minCol = Math.min(...puzzle.cells.map(([, c]) => c));

          // Center the domino on the pointer position
          const horizontal = isHorizontal(domino.orientation);
          let anchorCol: number;
          let anchorRow: number;

          if (horizontal) {
            anchorCol = Math.round(dropX / CELL_SIZE - 1) + minCol;
            anchorRow = Math.floor(dropY / CELL_SIZE) + minRow;
          } else {
            anchorCol = Math.floor(dropX / CELL_SIZE) + minCol;
            anchorRow = Math.round(dropY / CELL_SIZE - 1) + minRow;
          }

          // Try primary position
          if (
            canPlaceOnBoard(
              state,
              dragInfo.dominoId,
              anchorRow,
              anchorCol,
              domino.orientation,
            )
          ) {
            dispatch({
              type: "PLACE_ON_BOARD",
              id: dragInfo.dominoId,
              row: anchorRow,
              col: anchorCol,
            });
            setDragInfo(null);
            return;
          }

          // Try nearby positions as fallback
          const offsets = horizontal
            ? [
                [0, -1],
                [0, 1],
                [-1, 0],
                [1, 0],
              ]
            : [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
              ];

          for (const [dr, dc] of offsets) {
            const r = anchorRow + dr;
            const c = anchorCol + dc;
            if (
              canPlaceOnBoard(
                state,
                dragInfo.dominoId,
                r,
                c,
                domino.orientation,
              )
            ) {
              dispatch({
                type: "PLACE_ON_BOARD",
                id: dragInfo.dominoId,
                row: r,
                col: c,
              });
              setDragInfo(null);
              return;
            }
          }
        }
      }

      // Try dropping on the tray
      const trayEl = trayRef.current;
      if (trayEl) {
        const trayRect = trayEl.getBoundingClientRect();
        if (e.clientY >= trayRect.top) {
          // Ghost visual top-left in tray coordinates
          const ghostLeft = e.clientX - dragInfo.offsetX;
          const ghostTop = e.clientY - dragInfo.offsetY;
          const visualX = ghostLeft - trayRect.left;
          const visualY = ghostTop - trayRect.top;

          // Convert visual position to wrapper position, compensating for
          // the CSS rotation offset so the domino appears where it was dropped
          const offset = ROTATION_VISUAL_OFFSET[domino?.orientation ?? 0];
          const traySize = getTraySize();
          dispatch({
            type: "MOVE_TO_TRAY",
            id: dragInfo.dominoId,
            x: visualX - offset.dx,
            y: visualY - offset.dy,
            trayWidth: traySize.width,
            trayHeight: traySize.height,
          });
          setDragInfo(null);
          return;
        }
      }

      // Drop outside both: snap back to origin
      if (dragInfo.originLocation.type === "tray") {
        const traySize = getTraySize();
        dispatch({
          type: "MOVE_TO_TRAY",
          id: dragInfo.dominoId,
          x: dragInfo.originLocation.x,
          y: dragInfo.originLocation.y,
          trayWidth: traySize.width,
          trayHeight: traySize.height,
        });
      } else if (dragInfo.originLocation.type === "board") {
        dispatch({
          type: "PLACE_ON_BOARD",
          id: dragInfo.dominoId,
          row: dragInfo.originLocation.row,
          col: dragInfo.originLocation.col,
        });
      }
      setDragInfo(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragInfo, getTraySize, puzzle, state]);

  // Keyboard handler
  const handleDominoKeyDown = useCallback(
    (dominoId: string, e: React.KeyboardEvent) => {
      if (state.status === "solved") return;

      switch (e.key) {
        case "r":
        case "R":
          e.preventDefault();
          {
            const traySize = getTraySize();
            dispatch({
              type: "ROTATE",
              id: dominoId,
              pivotFar: false,
              trayWidth: traySize.width,
              trayHeight: traySize.height,
            });
          }
          break;
        case "Enter":
          e.preventDefault();
          if (state.heldDominoId === dominoId) {
            dispatch({ type: "CONFIRM_PLACEMENT" });
          } else {
            dispatch({ type: "PICK_UP", id: dominoId });
          }
          break;
        case "Escape":
          e.preventDefault();
          dispatch({ type: "CANCEL_HELD" });
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: "MOVE_CURSOR", direction: "up" });
          break;
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: "MOVE_CURSOR", direction: "down" });
          break;
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "MOVE_CURSOR", direction: "left" });
          break;
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "MOVE_CURSOR", direction: "right" });
          break;
      }
    },
    [getTraySize, state.heldDominoId, state.status],
  );

  const handleDominoClick = useCallback(() => {}, []);

  // Ghost rendering: position using the grab offset so the domino stays under the pointer
  const draggingDomino = dragInfo
    ? state.dominoes.find((d) => d.id === dragInfo.dominoId)
    : null;

  let ghostLeft = 0;
  let ghostTop = 0;
  if (dragInfo && draggingDomino) {
    ghostLeft = dragInfo.currentX - dragInfo.offsetX;
    ghostTop = dragInfo.currentY - dragInfo.offsetY;
  }

  // Compute the ID of the currently dragged domino to hide it in board/tray
  const draggedId = dragInfo?.dominoId ?? null;

  return (
    <div className="flex min-h-svh flex-col">
      {/* Controls at top */}
      <div className="flex items-center justify-center gap-3 border-b border-neutral-200 p-3">
        <Button
          onClick={handleSolve}
          variant="outline"
          size="sm"
          data-testid="solve-button"
        >
          Show Solution
        </Button>
        <Button
          onClick={handleClear}
          variant="outline"
          size="sm"
          data-testid="clear-button"
        >
          Clear
        </Button>
      </div>

      {/* Status messages */}
      {state.status === "solved" && (
        <div
          className="bg-green-100 px-6 py-2 text-center font-medium text-green-800"
          data-testid="success-message"
        >
          Puzzle solved! All constraints satisfied.
        </div>
      )}
      {state.status === "invalid" && (
        <div
          className="bg-red-100 px-6 py-2 text-center font-medium text-red-800"
          data-testid="error-message"
        >
          Not quite right. Check the highlighted regions.
        </div>
      )}

      {/* Board area */}
      <div className="flex flex-1 items-center justify-center p-4">
        <Board
          ref={boardRef}
          puzzle={puzzle}
          dominoes={state.dominoes}
          draggedDominoId={draggedId}
          violatedRegions={state.violatedRegions}
          onDominoPointerDown={handlePointerDown}
          onDominoClick={handleDominoClick}
          onDominoKeyDown={handleDominoKeyDown}
          heldDominoId={state.heldDominoId}
          keyboardCursor={state.keyboardCursor}
        />
      </div>

      {/* Tray area (full width below separator) */}
      <div className="flex justify-center border-t border-neutral-300 p-4">
        <Tray
          ref={trayRef}
          puzzle={puzzle}
          dominoes={state.dominoes}
          draggedDominoId={draggedId}
          onDominoPointerDown={handlePointerDown}
          onDominoClick={handleDominoClick}
          onDominoKeyDown={handleDominoKeyDown}
          heldDominoId={state.heldDominoId}
          trayOffsetX={trayLayout.offsetX}
        />
      </div>

      {/* Drag ghost: rendered in physical orientation (no CSS rotation) */}
      {dragInfo && draggingDomino && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: ghostLeft, top: ghostTop }}
        >
          <Domino
            id={draggingDomino.id}
            values={draggingDomino.values}
            orientation={draggingDomino.orientation}
            noRotation
            isDragging
          />
        </div>
      )}
    </div>
  );
}
