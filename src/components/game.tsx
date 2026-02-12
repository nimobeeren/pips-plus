import {
  clearElapsedTime,
  clearPuzzleResult,
  loadElapsedTime,
  loadGameState,
  loadPuzzleResult,
  saveElapsedTime,
  saveGameState,
  savePuzzleResult,
  type PuzzleResult,
} from "@/lib/game-storage";
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
import {
  ROTATION_VISUAL_OFFSET,
  canPlaceOnBoard,
  doValidation,
  initState,
  isClickOnFarHalf,
  reducer,
  type DragInfo,
} from "./game-state";
import { GameStatus } from "./game-status";
import { PauseModal } from "./pause-modal";
import { ResultsModal } from "./results-modal";
import { Tray, trayCols, trayDimensions } from "./tray";

const PAUSE_DELAY_MS = 10_000;

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

  // Puzzle result & timer (tracks only active page time)
  const [puzzleResult, setPuzzleResult] = useState<PuzzleResult | null>(() =>
    loadPuzzleResult(name),
  );
  const [showResults, setShowResults] = useState(false);
  const [showPaused, setShowPaused] = useState(false);

  // Accumulated elapsed ms from previous sessions, loaded on mount
  const accumulatedMsRef = useRef(0);
  // Timestamp when the current active session started
  const sessionStartRef = useRef(0);
  // Whether the timer is currently running
  const timerRunningRef = useRef(false);

  const getElapsedMs = useCallback(() => {
    if (!timerRunningRef.current) return accumulatedMsRef.current;
    return accumulatedMsRef.current + (Date.now() - sessionStartRef.current);
  }, []);

  const pauseTimer = useCallback(() => {
    if (!timerRunningRef.current) return;
    accumulatedMsRef.current += Date.now() - sessionStartRef.current;
    timerRunningRef.current = false;
    saveElapsedTime(name, accumulatedMsRef.current);
    console.log("[timer] paused at", accumulatedMsRef.current, "ms");
  }, [name]);

  const resumeTimer = useCallback(() => {
    if (timerRunningRef.current) return;
    sessionStartRef.current = Date.now();
    timerRunningRef.current = true;
    console.log("[timer] resumed from", accumulatedMsRef.current, "ms");
  }, []);

  // Initialize timer on mount (only if not already solved)
  useEffect(() => {
    if (puzzleResult) return;
    accumulatedMsRef.current = loadElapsedTime(name);
    sessionStartRef.current = Date.now();
    timerRunningRef.current = true;

    return () => {
      if (timerRunningRef.current) {
        accumulatedMsRef.current += Date.now() - sessionStartRef.current;
        timerRunningRef.current = false;
        saveElapsedTime(name, accumulatedMsRef.current);
      }
    };
  }, [name, puzzleResult]);

  // Visibility change: pause/resume timer, show pause modal if hidden long enough
  const hiddenAtRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPausedRef = useRef(false);

  useEffect(() => {
    showPausedRef.current = showPaused;
  }, [showPaused]);

  useEffect(() => {
    if (puzzleResult) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseTimer();
        hiddenAtRef.current = Date.now();
        pauseTimeoutRef.current = setTimeout(() => {
          setShowPaused(true);
        }, PAUSE_DELAY_MS);
      } else {
        if (pauseTimeoutRef.current) {
          clearTimeout(pauseTimeoutRef.current);
          pauseTimeoutRef.current = null;
        }

        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        const hiddenDuration = hiddenAt ? Date.now() - hiddenAt : 0;

        if (hiddenDuration >= PAUSE_DELAY_MS || showPausedRef.current) {
          setShowPaused(true);
        } else {
          resumeTimer();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    };
  }, [puzzleResult, pauseTimer, resumeTimer]);

  const handleResume = useCallback(() => {
    setShowPaused(false);
    resumeTimer();
  }, [resumeTimer]);

  // When puzzle becomes solved, compute and save result
  const prevStatusRef = useRef(state.status);
  useEffect(() => {
    if (
      state.status === "solved" &&
      prevStatusRef.current !== "solved" &&
      !puzzleResult
    ) {
      const solveTimeMs = getElapsedMs();
      pauseTimer();
      const result: PuzzleResult = { solveTimeMs };
      savePuzzleResult(name, result);
      clearElapsedTime(name);
      setPuzzleResult(result);
      setShowResults(true);
    }
    prevStatusRef.current = state.status;
  }, [state.status, name, puzzleResult, getElapsedMs, pauseTimer]);

  useEffect(() => {
    saveGameState(name, puzzle, state.dominoes, state.nextZOrder);
  }, [name, puzzle, state.dominoes, state.nextZOrder]);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [trayLayout, setTrayLayout] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    cols: 1,
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  const handleClear = useCallback(() => {
    dispatch({
      type: "CLEAR",
      trayOffsetX: prevOffsetXRef.current,
      cols: prevColsRef.current,
    });
    if (puzzleResult) {
      clearPuzzleResult(name);
      clearElapsedTime(name);
      setPuzzleResult(null);
      setShowResults(false);
      accumulatedMsRef.current = 0;
      sessionStartRef.current = Date.now();
      timerRunningRef.current = true;
    }
  }, [name, puzzleResult]);

  const handleCleanUp = useCallback(() => {
    dispatch({
      type: "CLEAN_UP",
      trayOffsetX: prevOffsetXRef.current,
      cols: prevColsRef.current,
    });
  }, []);

  const computeTrayLayout = useCallback(() => {
    const trayEl = trayRef.current;
    const availableWidth = trayEl
      ? trayEl.getBoundingClientRect().width
      : window.innerWidth;
    const cols = trayCols(availableWidth);
    const dims = trayDimensions(puzzle.dominoes.length, cols);
    const offsetX = Math.max(0, (availableWidth - dims.width) / 2);
    return { width: availableWidth, height: dims.height, offsetX, cols };
  }, [puzzle.dominoes.length]);

  const getTraySize = useCallback(() => {
    if (trayLayout.width && trayLayout.height) {
      return { width: trayLayout.width, height: trayLayout.height };
    }
    const dims = trayDimensions(puzzle.dominoes.length, trayLayout.cols);
    return { width: dims.width, height: dims.height };
  }, [
    puzzle.dominoes.length,
    trayLayout.height,
    trayLayout.width,
    trayLayout.cols,
  ]);

  const prevOffsetXRef = useRef(0);
  const prevColsRef = useRef(1);

  useLayoutEffect(() => {
    const updateLayout = () => {
      const layout = computeTrayLayout();
      const prevOffsetX = prevOffsetXRef.current;
      const prevCols = prevColsRef.current;
      if (layout.offsetX !== prevOffsetX || layout.cols !== prevCols) {
        dispatch({
          type: "REPOSITION_TRAY",
          prevOffsetX,
          newOffsetX: layout.offsetX,
          prevCols,
          newCols: layout.cols,
        });
        prevOffsetXRef.current = layout.offsetX;
        prevColsRef.current = layout.cols;
      }
      setTrayLayout(layout);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [computeTrayLayout]);

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
        onClear={handleClear}
        backTo={backTo}
        solved={!!puzzleResult}
        onViewResults={() => setShowResults(true)}
      />

      {/* Status messages (only for invalid) */}
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
          cols={trayLayout.cols}
          draggedDominoId={draggedId}
          onDominoPointerDown={handlePointerDown}
          onDominoClick={handleDominoClick}
          onDominoKeyDown={handleDominoKeyDown}
          heldDominoId={state.heldDominoId}
          trayOffsetX={trayLayout.offsetX}
          onCleanUp={handleCleanUp}
        />
      </div>

      {/* Drag ghost: rendered in physical orientation (no CSS rotation) */}
      <GameDragGhost dragInfo={dragInfo} draggingDomino={draggingDomino} />

      {/* Results modal */}
      {puzzleResult && (
        <ResultsModal
          open={showResults}
          onOpenChange={setShowResults}
          result={puzzleResult}
          puzzleName={name}
        />
      )}

      {/* Pause modal */}
      <PauseModal open={showPaused} onResume={handleResume} />
    </div>
  );
}
