import { Button } from "@/components/ui/button";
import type { DominoState, Puzzle } from "@/types";
import { forwardRef } from "react";
import { DOMINO_SIZE, DOMINO_SPAN, Domino } from "./domino";

export const MAX_TRAY_COLS = 6;
export const TRAY_GAP = 24;
export const TRAY_PADDING = 48;

/** Compute how many columns fit in the given width (1..MAX_TRAY_COLS). */
export function trayCols(availableWidth: number): number {
  // Solve: TRAY_PADDING * 2 + cols * DOMINO_SPAN + (cols - 1) * TRAY_GAP <= availableWidth
  // cols * (DOMINO_SPAN + TRAY_GAP) <= availableWidth - TRAY_PADDING * 2 + TRAY_GAP
  const usable = availableWidth - TRAY_PADDING * 2 + TRAY_GAP;
  const cols = Math.floor(usable / (DOMINO_SPAN + TRAY_GAP));
  return Math.max(1, Math.min(cols, MAX_TRAY_COLS));
}

/** Compute initial tray position for a domino at the given index. */
export function initialTrayPosition(
  index: number,
  cols: number,
): { x: number; y: number } {
  return {
    x: TRAY_PADDING + (index % cols) * (DOMINO_SPAN + TRAY_GAP),
    y: TRAY_PADDING + Math.floor(index / cols) * (DOMINO_SIZE + TRAY_GAP),
  };
}

/** Compute tray dimensions based on the number of domino slots. */
export function trayDimensions(dominoCount: number, cols: number) {
  const effectiveCols = Math.min(dominoCount, cols);
  const rows = Math.ceil(dominoCount / cols);
  return {
    width:
      TRAY_PADDING * 2 +
      effectiveCols * DOMINO_SPAN +
      Math.max(0, effectiveCols - 1) * TRAY_GAP,
    height:
      TRAY_PADDING * 2 + rows * DOMINO_SIZE + Math.max(0, rows - 1) * TRAY_GAP,
  };
}

interface TrayProps {
  puzzle: Puzzle;
  dominoes: DominoState[];
  cols: number;
  draggedDominoId: string | null;
  onDominoPointerDown: (id: string, e: React.PointerEvent) => void;
  onDominoClick: (id: string) => void;
  onDominoKeyDown: (id: string, e: React.KeyboardEvent) => void;
  heldDominoId: string | null;
  trayOffsetX: number;
  onCleanUp: () => void;
}

export const Tray = forwardRef<HTMLDivElement, TrayProps>(function Tray(
  {
    puzzle,
    dominoes,
    cols,
    draggedDominoId,
    onDominoPointerDown,
    onDominoClick,
    onDominoKeyDown,
    heldDominoId,
    trayOffsetX,
    onCleanUp,
  },
  ref,
) {
  const trayDominoes = dominoes
    .filter(
      (d) =>
        d.location.type === "tray" &&
        d.id !== draggedDominoId &&
        d.id !== heldDominoId,
    )
    .sort((a, b) => a.zOrder - b.zOrder);

  const dims = trayDimensions(puzzle.dominoes.length, cols);

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ minHeight: dims.height }}
      data-testid="tray"
    >
      {/* Placeholder slots for original positions */}
      {puzzle.dominoes.map((_, i) => {
        const pos = initialTrayPosition(i, cols);
        return (
          <div
            key={`slot-${i}`}
            className="absolute bg-neutral-150 rounded-lg"
            style={{
              left: pos.x + trayOffsetX,
              top: pos.y,
              width: DOMINO_SPAN,
              height: DOMINO_SIZE,
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

      {/* Clean up button */}
      {trayDominoes.length > 0 && (
        <div className="absolute top-0 right-0">
          <Button variant="outline" size="sm" onClick={onCleanUp}>
            Clean up
          </Button>
        </div>
      )}
    </div>
  );
});
