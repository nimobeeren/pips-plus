import type { DominoState, Orientation, Puzzle } from "@/types";
import { isHorizontal } from "@/types";
import { forwardRef } from "react";
import {
  BoardRegionBorderOverlay,
  BoardRegionFillOverlay,
  BoardRegionLabels,
  type BoardLayout,
} from "./board-regions.tsx";
import { CELL_INSET, CELL_SIZE, Domino } from "./domino";

interface BoardProps {
  puzzle: Puzzle;
  dominoes: DominoState[];
  draggedDominoId: string | null;
  violatedRegions: string[];
  onDominoPointerDown: (id: string, e: React.PointerEvent) => void;
  onDominoClick: (id: string) => void;
  onDominoKeyDown: (id: string, e: React.KeyboardEvent) => void;
  heldDominoId: string | null;
  keyboardCursor: [number, number] | null;
}

export const Board = forwardRef<HTMLDivElement, BoardProps>(function Board(
  {
    puzzle,
    dominoes,
    draggedDominoId,
    violatedRegions,
    onDominoPointerDown,
    onDominoClick,
    onDominoKeyDown,
    heldDominoId,
    keyboardCursor,
  },
  ref,
) {
  const layout = getBoardLayout(puzzle.cells);
  const boardDominoes = dominoes.filter(
    (d) => d.location.type === "board" && d.id !== draggedDominoId,
  );

  return (
    <div
      ref={ref}
      className="relative"
      style={{ width: layout.width, height: layout.height }}
      data-testid="board"
    >
      <BoardGrid cells={puzzle.cells} layout={layout} />
      <BoardRegionFillOverlay
        regions={puzzle.regions}
        layout={layout}
        cellSize={CELL_SIZE}
        cellInset={CELL_INSET}
      />
      <BoardDominoes
        dominoes={boardDominoes}
        layout={layout}
        heldDominoId={heldDominoId}
        onDominoPointerDown={onDominoPointerDown}
        onDominoClick={onDominoClick}
        onDominoKeyDown={onDominoKeyDown}
      />
      <BoardRegionBorderOverlay
        regions={puzzle.regions}
        layout={layout}
        cellSize={CELL_SIZE}
        cellInset={CELL_INSET}
      />
      <BoardCursor cursor={keyboardCursor} layout={layout} />
      <BoardRegionLabels
        regions={puzzle.regions}
        violatedRegions={violatedRegions}
        layout={layout}
        cellSize={CELL_SIZE}
      />
    </div>
  );
});

interface BoardGridProps {
  cells: [number, number][];
  layout: BoardLayout;
}

function BoardGrid({ cells, layout }: BoardGridProps) {
  const cellSize = CELL_SIZE - CELL_INSET * 2;

  return (
    <div className="pointer-events-none absolute inset-0">
      {cells.map(([r, c]) => (
        <div
          key={`cell-${r}-${c}`}
          className="absolute bg-neutral-150 rounded-lg"
          style={{
            left: (c - layout.minCol) * CELL_SIZE + CELL_INSET,
            top: (r - layout.minRow) * CELL_SIZE + CELL_INSET,
            width: cellSize,
            height: cellSize,
          }}
          data-testid={`cell-${r}-${c}`}
        />
      ))}
    </div>
  );
}

interface BoardDominoesProps {
  dominoes: DominoState[];
  layout: BoardLayout;
  heldDominoId: string | null;
  onDominoPointerDown: (id: string, e: React.PointerEvent) => void;
  onDominoClick: (id: string) => void;
  onDominoKeyDown: (id: string, e: React.KeyboardEvent) => void;
}

function BoardDominoes({
  dominoes,
  layout,
  heldDominoId,
  onDominoPointerDown,
  onDominoClick,
  onDominoKeyDown,
}: BoardDominoesProps) {
  return (
    <div className="absolute inset-0">
      {dominoes.map((d) => {
        if (d.location.type !== "board") return null;
        const { row, col } = d.location;
        const wrapperStyle = getBoardDominoWrapperStyle(
          row,
          col,
          d.orientation,
          layout.minRow,
          layout.minCol,
        );

        return (
          <div
            key={d.id}
            className="absolute"
            style={{ ...wrapperStyle, zIndex: 20 }}
          >
            <Domino
              id={d.id}
              values={d.values}
              orientation={d.orientation}
              isHeld={heldDominoId === d.id}
              onPointerDown={(e) => onDominoPointerDown(d.id, e)}
              onClick={() => onDominoClick(d.id)}
              onKeyDown={(e) => onDominoKeyDown(d.id, e)}
              tabIndex={0}
            />
          </div>
        );
      })}
    </div>
  );
}

interface BoardCursorProps {
  cursor: [number, number] | null;
  layout: BoardLayout;
}

function BoardCursor({ cursor, layout }: BoardCursorProps) {
  if (!cursor) return null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: (cursor[1] - layout.minCol) * CELL_SIZE - 2,
        top: (cursor[0] - layout.minRow) * CELL_SIZE - 2,
        width: CELL_SIZE + 4,
        height: CELL_SIZE + 4,
        outline: "3px solid #3b82f6",
        zIndex: 50,
      }}
    />
  );
}

function getBoardLayout(cells: [number, number][]): BoardLayout {
  if (!cells.length) {
    throw new Error("Board requires at least one cell.");
  }

  const minRow = Math.min(...cells.map(([r]) => r));
  const maxRow = Math.max(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  const maxCol = Math.max(...cells.map(([, c]) => c));

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  return {
    minRow,
    minCol,
    rows,
    cols,
    width: cols * CELL_SIZE,
    height: rows * CELL_SIZE,
  };
}

function getBoardDominoWrapperStyle(
  row: number,
  col: number,
  orientation: Orientation,
  minRow: number,
  minCol: number,
): React.CSSProperties {
  const cs = CELL_SIZE;
  const baseLeft = (col - minCol) * cs + CELL_INSET;
  const baseTop = (row - minRow) * cs + CELL_INSET;

  let left = baseLeft;
  let top = baseTop;

  if (!isHorizontal(orientation)) {
    // No offset needed for 90° (verified via rotation math).
    // For 270°, shift down by cs to compensate for rotation around (cs/2, cs/2).
    if (orientation === 270) {
      top = baseTop + CELL_SIZE;
    }
  } else if (orientation === 180) {
    left = baseLeft + CELL_SIZE;
  }

  return { left, top };
}
