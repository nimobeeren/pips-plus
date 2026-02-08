import { loadGameState, saveGameState } from "@/lib/game-storage";
import { solve } from "@/solver";
import type { Puzzle } from "@/types";
import { isHorizontal } from "@/types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Board } from "./board";
import { CELL_SIZE, DOMINO_SIZE, DOMINO_SPAN } from "./domino";
import { GameControls } from "./game-controls";
import { GameDragGhost } from "./game-drag-ghost";
import { GameStatus } from "./game-status";
import {
  ROTATION_VISUAL_OFFSET,
  canPlaceOnBoard,
  doValidation,
  initState,
  isClickOnFarHalf,
  reducer,
  type DragInfo,
} from "./game-state";
import { Tray, initialTrayPosition, trayDimensions } from "./tray";

// --- Game component ---

interface GameProps {
  puzzle: Puzzle;
  name: string;
  backTo?: string;
}

export function Game({ puzzle, name, backTo }: GameProps) {
  const [state, dispatch] = useReducer(reducer, puzzle, (puzzle) => {
    const saved = loadGameState(name, puzzle);
    if (saved) {
      return doValidation({
        puzzle,
        dominoes: saved.dominoes,
        nextZOrder: saved.nextZOrder,
        status: "playing",
        violatedRegions: [],
        heldDominoId: null,
        keyboardCursor: null,
      });
    }
    return initState(puzzle);
  });

  useEffect(() => {
    saveGameState(name, puzzle, state.dominoes, state.nextZOrder);
  }, [name, puzzle, state.dominoes, state.nextZOrder]);
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

      // Try dropping on the board: snap to closest valid position that
      // overlaps with the ghost's visual bounding box
      const boardEl = boardRef.current;
      if (boardEl && domino) {
        const boardRect = boardEl.getBoundingClientRect();
        const minRow = Math.min(...puzzle.cells.map(([r]) => r));
        const minCol = Math.min(...puzzle.cells.map(([, c]) => c));
        const maxRow = Math.max(...puzzle.cells.map(([r]) => r));
        const maxCol = Math.max(...puzzle.cells.map(([, c]) => c));

        const ghostLeft = e.clientX - dragInfo.offsetX - boardRect.left;
        const ghostTop = e.clientY - dragInfo.offsetY - boardRect.top;
        const horizontal = isHorizontal(domino.orientation);
        const ghostW = horizontal ? DOMINO_SPAN : DOMINO_SIZE;
        const ghostH = horizontal ? DOMINO_SIZE : DOMINO_SPAN;
        const cellsWide = horizontal ? 2 : 1;
        const cellsTall = horizontal ? 1 : 2;

        let bestRow = 0;
        let bestCol = 0;
        let bestDist = Infinity;

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            if (
              !canPlaceOnBoard(
                state,
                dragInfo.dominoId,
                r,
                c,
                domino.orientation,
              )
            )
              continue;

            const candLeft = (c - minCol) * CELL_SIZE;
            const candTop = (r - minRow) * CELL_SIZE;
            const candRight = candLeft + cellsWide * CELL_SIZE;
            const candBottom = candTop + cellsTall * CELL_SIZE;

            if (
              ghostLeft + ghostW <= candLeft ||
              ghostLeft >= candRight ||
              ghostTop + ghostH <= candTop ||
              ghostTop >= candBottom
            )
              continue;

            const ghostCx = ghostLeft + ghostW / 2;
            const ghostCy = ghostTop + ghostH / 2;
            const candCx = candLeft + (cellsWide * CELL_SIZE) / 2;
            const candCy = candTop + (cellsTall * CELL_SIZE) / 2;
            const dist = (ghostCx - candCx) ** 2 + (ghostCy - candCy) ** 2;

            if (dist < bestDist) {
              bestDist = dist;
              bestRow = r;
              bestCol = c;
            }
          }
        }

        if (bestDist < Infinity) {
          dispatch({
            type: "PLACE_ON_BOARD",
            id: dragInfo.dominoId,
            row: bestRow,
            col: bestCol,
          });
          setDragInfo(null);
          return;
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

  const draggingDomino = dragInfo
    ? (state.dominoes.find((d) => d.id === dragInfo.dominoId) ?? null)
    : null;

  // Compute the ID of the currently dragged domino to hide it in board/tray
  const draggedId = dragInfo?.dominoId ?? null;

  return (
    <div className="flex min-h-svh flex-col">
      {/* Controls at top */}
      <GameControls
        onSolve={handleSolve}
        onClear={handleClear}
        backTo={backTo}
      />

      {/* Status messages */}
      <GameStatus status={state.status} />

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
      <GameDragGhost dragInfo={dragInfo} draggingDomino={draggingDomino} />
    </div>
  );
}
