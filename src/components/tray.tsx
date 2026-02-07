import type { DominoState, Puzzle } from "@/types";
import { forwardRef } from "react";
import { CELL_SIZE, Domino } from "./domino";

export const TRAY_COLS = 3;
export const TRAY_GAP = 12;
export const TRAY_PADDING = 16;

/** Compute initial tray position for a domino at the given index. */
export function initialTrayPosition(index: number): { x: number; y: number } {
  const dominoWidth = 2 * CELL_SIZE;
  return {
    x: TRAY_PADDING + (index % TRAY_COLS) * (dominoWidth + TRAY_GAP),
    y: TRAY_PADDING + Math.floor(index / TRAY_COLS) * (CELL_SIZE + TRAY_GAP),
  };
}

/** Compute tray dimensions based on the number of domino slots. */
export function trayDimensions(dominoCount: number) {
  const dominoWidth = 2 * CELL_SIZE;
  const rows = Math.ceil(dominoCount / TRAY_COLS);
  return {
    width:
      TRAY_PADDING * 2 + TRAY_COLS * dominoWidth + (TRAY_COLS - 1) * TRAY_GAP,
    height:
      TRAY_PADDING * 2 + rows * CELL_SIZE + Math.max(0, rows - 1) * TRAY_GAP,
  };
}

interface TrayProps {
  puzzle: Puzzle;
  dominoes: DominoState[];
  draggedDominoId: string | null;
  onDominoPointerDown: (id: string, e: React.PointerEvent) => void;
  onDominoClick: (id: string) => void;
  onDominoKeyDown: (id: string, e: React.KeyboardEvent) => void;
  heldDominoId: string | null;
}

export const Tray = forwardRef<HTMLDivElement, TrayProps>(function Tray(
  {
    puzzle,
    dominoes,
    draggedDominoId,
    onDominoPointerDown,
    onDominoClick,
    onDominoKeyDown,
    heldDominoId,
  },
  ref,
) {
  const trayDominoes = dominoes
    .filter((d) => d.location.type === "tray" && d.id !== draggedDominoId)
    .sort((a, b) => a.zOrder - b.zOrder);

  const dims = trayDimensions(puzzle.dominoes.length);

  return (
    <div
      ref={ref}
      className="relative"
      style={{ width: dims.width, minHeight: dims.height }}
      data-testid="tray"
    >
      {/* Placeholder slots for original positions */}
      {puzzle.dominoes.map((_, i) => {
        const pos = initialTrayPosition(i);
        return (
          <div
            key={`slot-${i}`}
            className="absolute rounded-lg bg-neutral-150"
            style={{
              left: pos.x,
              top: pos.y,
              width: 2 * CELL_SIZE,
              height: CELL_SIZE,
            }}
          />
        );
      })}

      {/* Domino pieces (sorted by zOrder so latest dropped is on top) */}
      {trayDominoes.map((d) => {
        if (d.location.type !== "tray") return null;

        return (
          <div
            key={d.id}
            className="absolute"
            style={{
              left: d.location.x,
              top: d.location.y,
              zIndex: d.zOrder,
            }}
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
});
