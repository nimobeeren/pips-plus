import type { Orientation, Pip, Region } from "@/types";
import { cellKey } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BoardRegionBorderOverlay,
  BoardRegionFillOverlay,
  BoardRegionLabels,
  buildCellsOutlinePath,
  type BoardLayout,
} from "./board-regions";
import { CELL_INSET, CELL_SIZE, Domino } from "./domino";

export type EditorTool = "cell" | "region" | "domino";

export interface EditorDomino {
  id: string;
  values: [Pip, Pip];
  orientation: Orientation;
  row: number;
  col: number;
}

const BOARD_PADDING = CELL_INSET * 2;
const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 8;

interface EditorBoardProps {
  gridRows: number;
  gridCols: number;
  cells: Set<string>;
  regions: Region[];
  dominoes: EditorDomino[];
  activeTool: EditorTool;
  violatedRegions: string[];
  onCellToggle: (row: number, col: number) => void;
  onRegionCreate: (row: number, col: number) => void;
  onRegionExtend: (row: number, col: number) => void;
  onRegionCellClick: (regionId: string, row: number, col: number) => void;
  onInteractionEnd: () => void;
  onDominoPlace: (row: number, col: number) => void;
  onDominoRotate: (id: string) => void;
  onDominoMove: (id: string, row: number, col: number) => void;
  onDominoEdit: (id: string) => void;
  onDominoDelete: (id: string) => void;
}

function pointerToCell(
  e: React.PointerEvent | PointerEvent | React.MouseEvent,
  container: HTMLElement,
  gridRows: number,
  gridCols: number,
): [number, number] | null {
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return null;
  return [row, col];
}

function findRegionAtCell(
  regions: Region[],
  row: number,
  col: number,
): Region | null {
  const key = cellKey(row, col);
  return (
    regions.find((r) => r.cells.some(([cr, cc]) => cellKey(cr, cc) === key)) ??
    null
  );
}

export function EditorBoard({
  gridRows,
  gridCols,
  cells,
  regions,
  dominoes,
  activeTool,
  violatedRegions,
  onCellToggle,
  onRegionCreate,
  onRegionExtend,
  onRegionCellClick,
  onInteractionEnd,
  onDominoPlace,
  onDominoRotate,
  onDominoMove,
  onDominoEdit,
  onDominoDelete,
}: EditorBoardProps) {
  const layout: BoardLayout = {
    minRow: 0,
    minCol: 0,
    rows: gridRows,
    cols: gridCols,
    width: gridCols * CELL_SIZE,
    height: gridRows * CELL_SIZE,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastCellRef = useRef<string | null>(null);
  // Track whether current drag started a new region (for extending during drag)
  const regionDragActiveRef = useRef(false);
  // Track region cell that was clicked (for deferred popup on existing region)
  const regionClickRef = useRef<{
    regionId: string;
    row: number;
    col: number;
  } | null>(null);

  // Domino drag state
  const [dragDomino, setDragDomino] = useState<{
    id: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Grid pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "domino") {
        const container = containerRef.current;
        if (!container) return;
        const cell = pointerToCell(e, container, gridRows, gridCols);
        if (cell) {
          onDominoPlace(cell[0], cell[1]);
        }
        return;
      }

      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      isDraggingRef.current = true;
      lastCellRef.current = null;
      regionDragActiveRef.current = false;
      regionClickRef.current = null;

      const cell = pointerToCell(e, container, gridRows, gridCols);
      if (!cell) return;

      if (activeTool === "region") {
        const region = findRegionAtCell(regions, cell[0], cell[1]);
        if (region) {
          // Defer existing-region popup to pointer up
          regionClickRef.current = {
            regionId: region.id,
            row: cell[0],
            col: cell[1],
          };
          isDraggingRef.current = false;
          return;
        }
        // Empty cell → create new region (parent tracks pending popup)
        onRegionCreate(cell[0], cell[1]);
        regionDragActiveRef.current = true;
        lastCellRef.current = cellKey(cell[0], cell[1]);
        return;
      }

      if (activeTool === "cell") {
        const key = cellKey(cell[0], cell[1]);
        lastCellRef.current = key;
        onCellToggle(cell[0], cell[1]);
      }
    },
    [
      activeTool,
      gridRows,
      gridCols,
      onCellToggle,
      onRegionCreate,
      onDominoPlace,
      regions,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activeTool === "domino") return;
      const container = containerRef.current;
      if (!container) return;

      const cell = pointerToCell(e, container, gridRows, gridCols);
      if (!cell) return;
      const key = cellKey(cell[0], cell[1]);
      if (key === lastCellRef.current) return;
      lastCellRef.current = key;

      if (activeTool === "region" && regionDragActiveRef.current) {
        // Extend the region being created during drag (popup still opens on release)
        onRegionExtend(cell[0], cell[1]);
        return;
      }

      if (activeTool === "cell") {
        onCellToggle(cell[0], cell[1]);
      }
    },
    [activeTool, gridRows, gridCols, onCellToggle, onRegionExtend],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    lastCellRef.current = null;
    regionDragActiveRef.current = false;

    // Fire deferred existing-region popup on release
    const clicked = regionClickRef.current;
    if (clicked) {
      regionClickRef.current = null;
      onRegionCellClick(clicked.regionId, clicked.row, clicked.col);
      return;
    }

    // Notify parent that interaction ended (used for new region popup)
    onInteractionEnd();
  }, [onRegionCellClick, onInteractionEnd]);

  // Context menu: right-click on region cells opens popup (any tool)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const cell = pointerToCell(e, container, gridRows, gridCols);
      if (!cell) return;

      const region = findRegionAtCell(regions, cell[0], cell[1]);
      if (region) {
        e.preventDefault();
        onRegionCellClick(region.id, cell[0], cell[1]);
      }
    },
    [regions, gridRows, gridCols, onRegionCellClick],
  );

  // Domino pointer handlers
  const handleDominoPointerDown = useCallback(
    (dominoId: string, e: React.PointerEvent) => {
      if (activeTool !== "domino") return;
      e.stopPropagation();
      e.preventDefault();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragDomino({
        id: dominoId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: false,
      });

      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setDragDomino(null);
        onDominoEdit(dominoId);
      }, LONG_PRESS_MS);
    },
    [activeTool, clearLongPress, onDominoEdit],
  );

  const handleDominoContextMenu = useCallback(
    (dominoId: string, e: React.MouseEvent) => {
      if (activeTool !== "domino") return;
      e.preventDefault();
      e.stopPropagation();
      clearLongPress();
      setDragDomino(null);
      onDominoEdit(dominoId);
    },
    [activeTool, clearLongPress, onDominoEdit],
  );

  // Global pointer move/up for domino drag
  useEffect(() => {
    if (!dragDomino) return;

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - dragDomino.startX;
      const dy = e.clientY - dragDomino.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > DRAG_THRESHOLD) {
        clearLongPress();
      }

      setDragDomino((prev) =>
        prev
          ? {
              ...prev,
              currentX: e.clientX,
              currentY: e.clientY,
              isDragging: dist > DRAG_THRESHOLD,
            }
          : null,
      );
    };

    const handleUp = (e: PointerEvent) => {
      clearLongPress();

      const dx = e.clientX - dragDomino.startX;
      const dy = e.clientY - dragDomino.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DRAG_THRESHOLD) {
        // Treat as click → rotate
        onDominoRotate(dragDomino.id);
      } else {
        // Check if dropped outside board → delete
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const margin = CELL_SIZE;
          if (
            e.clientX < rect.left - margin ||
            e.clientX > rect.right + margin ||
            e.clientY < rect.top - margin ||
            e.clientY > rect.bottom + margin
          ) {
            onDominoDelete(dragDomino.id);
          } else {
            // Dropped inside board → snap to new position
            const visualLeft = e.clientX - dragDomino.offsetX - rect.left;
            const visualTop = e.clientY - dragDomino.offsetY - rect.top;
            const snapCol = Math.round((visualLeft - CELL_INSET) / CELL_SIZE);
            const snapRow = Math.round((visualTop - CELL_INSET) / CELL_SIZE);
            onDominoMove(dragDomino.id, snapRow, snapCol);
          }
        }
      }

      setDragDomino(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    dragDomino,
    clearLongPress,
    onDominoRotate,
    onDominoMove,
    onDominoDelete,
  ]);

  const cellSize = CELL_SIZE - CELL_INSET * 2;

  let cursor: string = "crosshair";
  if (activeTool === "region") cursor = "cell";
  if (activeTool === "domino") cursor = "default";

  const regionsWithCells = regions.filter((r) => r.cells.length > 0);
  const hasRegions = regionsWithCells.length > 0;

  // Board background from filled cells
  const filledCells: [number, number][] = [];
  for (const key of cells) {
    const [r, c] = key.split(",").map(Number);
    filledCells.push([r, c]);
  }

  const cornerRadius = CELL_INSET * 3;
  const bgPath =
    filledCells.length > 0
      ? buildCellsOutlinePath(
          filledCells,
          layout,
          CELL_SIZE,
          BOARD_PADDING,
          cornerRadius,
        )
      : "";
  const bgSvgWidth = layout.width + 2 * BOARD_PADDING;
  const bgSvgHeight = layout.height + 2 * BOARD_PADDING;

  return (
    <div
      ref={containerRef}
      className="relative select-none touch-none"
      style={{ width: layout.width, height: layout.height, cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {/* Grid lines — SVG extended by 1px on each side so edge strokes render at full width */}
      <svg
        className="pointer-events-none absolute"
        style={{ left: -0.5, top: -0.5, zIndex: 0 }}
        width={layout.width + 1}
        height={layout.height + 1}
        viewBox={`-0.5 -0.5 ${layout.width + 1} ${layout.height + 1}`}
        aria-hidden="true"
      >
        {Array.from({ length: gridCols + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * CELL_SIZE}
            y1={0}
            x2={i * CELL_SIZE}
            y2={layout.height}
            stroke="var(--color-neutral-200)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: gridRows + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * CELL_SIZE}
            x2={layout.width}
            y2={i * CELL_SIZE}
            stroke="var(--color-neutral-200)"
            strokeWidth={1}
          />
        ))}
      </svg>

      {/* Board background */}
      {bgPath && (
        <svg
          className="pointer-events-none absolute"
          style={{
            left: -BOARD_PADDING,
            top: -BOARD_PADDING,
            width: bgSvgWidth,
            height: bgSvgHeight,
            zIndex: 1,
          }}
          viewBox={`${-BOARD_PADDING} ${-BOARD_PADDING} ${bgSvgWidth} ${bgSvgHeight}`}
          preserveAspectRatio="xMinYMin meet"
          aria-hidden="true"
        >
          <path d={bgPath} fill="var(--color-neutral-200)" fillRule="evenodd" />
        </svg>
      )}

      {/* Filled cells */}
      {filledCells.map(([r, c]) => (
        <div
          key={`cell-${r}-${c}`}
          className="absolute pointer-events-none bg-neutral-150 rounded-lg"
          style={{
            left: c * CELL_SIZE + CELL_INSET,
            top: r * CELL_SIZE + CELL_INSET,
            width: cellSize,
            height: cellSize,
            zIndex: 5,
          }}
        />
      ))}

      {/* Region fills */}
      {hasRegions && (
        <BoardRegionFillOverlay
          regions={regionsWithCells}
          layout={layout}
          cellSize={CELL_SIZE}
          cellInset={CELL_INSET}
        />
      )}

      {/* Dominoes */}
      {dominoes.map((d) => {
        const isDragTarget = dragDomino?.id === d.id && dragDomino.isDragging;

        const left = d.col * CELL_SIZE + CELL_INSET;
        const top = d.row * CELL_SIZE + CELL_INSET;

        const style: React.CSSProperties = isDragTarget
          ? {
              left: left + (dragDomino!.currentX - dragDomino!.startX),
              top: top + (dragDomino!.currentY - dragDomino!.startY),
              zIndex: 50,
              opacity: 0.8,
            }
          : {
              left,
              top,
              zIndex: 20,
            };

        return (
          <div
            key={d.id}
            className="absolute"
            style={{
              ...style,
              pointerEvents: activeTool === "domino" ? "auto" : "none",
              cursor: activeTool === "domino" ? "default" : "default",
            }}
            onPointerDown={(e) => handleDominoPointerDown(d.id, e)}
            onContextMenu={(e) => handleDominoContextMenu(d.id, e)}
          >
            <Domino
              id={d.id}
              values={d.values}
              orientation={d.orientation}
              noRotation
            />
          </div>
        );
      })}

      {/* Region borders */}
      {hasRegions && (
        <BoardRegionBorderOverlay
          regions={regionsWithCells}
          layout={layout}
          cellSize={CELL_SIZE}
          cellInset={CELL_INSET}
        />
      )}

      {/* Region labels */}
      {hasRegions && (
        <BoardRegionLabels
          regions={regionsWithCells}
          violatedRegions={violatedRegions}
          layout={layout}
          cellSize={CELL_SIZE}
        />
      )}
    </div>
  );
}
