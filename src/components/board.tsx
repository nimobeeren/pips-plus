import type { Constraint, DominoState, Orientation, Puzzle } from "@/types";
import { cellKey, isHorizontal } from "@/types";
import { forwardRef } from "react";
import { CELL_SIZE, Domino } from "./domino";

function constraintLabel(constraint: Constraint): string {
  switch (constraint.kind) {
    case "none":
      return "";
    case "equal":
      return "=";
    case "not-equal":
      return "≠";
    case "sum":
      return String(constraint.target);
    case "greater":
      return `>${constraint.target}`;
    case "less":
      return `<${constraint.target}`;
  }
}

/** Find the bottom-right cell of a region for label placement. */
function getLabelCell(cells: [number, number][]): [number, number] {
  let best = cells[0];
  for (const cell of cells) {
    if (cell[0] > best[0] || (cell[0] === best[0] && cell[1] > best[1])) {
      best = cell;
    }
  }
  return best;
}

/** Compute which edges are on the boundary and which corners should be rounded for each cell in a region. */
function computeCellBoundaryInfo(regionCells: [number, number][]): Map<
  string,
  {
    borderTop: boolean;
    borderRight: boolean;
    borderBottom: boolean;
    borderLeft: boolean;
    roundTL: boolean;
    roundTR: boolean;
    roundBR: boolean;
    roundBL: boolean;
  }
> {
  const cellSet = new Set(regionCells.map(([r, c]) => cellKey(r, c)));
  const info = new Map<
    string,
    {
      borderTop: boolean;
      borderRight: boolean;
      borderBottom: boolean;
      borderLeft: boolean;
      roundTL: boolean;
      roundTR: boolean;
      roundBR: boolean;
      roundBL: boolean;
    }
  >();

  for (const [r, c] of regionCells) {
    const hasTop = cellSet.has(cellKey(r - 1, c));
    const hasBottom = cellSet.has(cellKey(r + 1, c));
    const hasLeft = cellSet.has(cellKey(r, c - 1));
    const hasRight = cellSet.has(cellKey(r, c + 1));

    // Border on edges where there's no adjacent cell in the same region
    const borderTop = !hasTop;
    const borderRight = !hasRight;
    const borderBottom = !hasBottom;
    const borderLeft = !hasLeft;

    // Round a corner only if both adjacent edges are on the boundary
    const roundTL = borderTop && borderLeft;
    const roundTR = borderTop && borderRight;
    const roundBR = borderBottom && borderRight;
    const roundBL = borderBottom && borderLeft;

    info.set(cellKey(r, c), {
      borderTop,
      borderRight,
      borderBottom,
      borderLeft,
      roundTL,
      roundTR,
      roundBR,
      roundBL,
    });
  }
  return info;
}

const BORDER_RADIUS = 10;
const CELL_INSET = 3;

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
  const minRow = Math.min(...puzzle.cells.map(([r]) => r));
  const maxRow = Math.max(...puzzle.cells.map(([r]) => r));
  const minCol = Math.min(...puzzle.cells.map(([, c]) => c));
  const maxCol = Math.max(...puzzle.cells.map(([, c]) => c));

  const boardWidth = (maxCol - minCol + 1) * CELL_SIZE;
  const boardHeight = (maxRow - minRow + 1) * CELL_SIZE;

  // Build per-region boundary info
  const regionBoundaryInfos = new Map<
    string,
    ReturnType<typeof computeCellBoundaryInfo>
  >();
  for (const region of puzzle.regions) {
    regionBoundaryInfos.set(region.id, computeCellBoundaryInfo(region.cells));
  }

  // Map cells to their region
  const cellRegionMap = new Map<string, { color: string; regionId: string }>();
  for (const region of puzzle.regions) {
    for (const [r, c] of region.cells) {
      cellRegionMap.set(cellKey(r, c), {
        color: region.color,
        regionId: region.id,
      });
    }
  }

  const violatedSet = new Set(violatedRegions);
  const boardDominoes = dominoes.filter(
    (d) => d.location.type === "board" && d.id !== draggedDominoId,
  );

  return (
    <div
      ref={ref}
      className="relative"
      style={{ width: boardWidth, height: boardHeight }}
      data-testid="board"
    >
      {/* Layer 0: Base cell backgrounds */}
      {puzzle.cells.map(([r, c]) => (
        <div
          key={`base-${r}-${c}`}
          className="absolute rounded-lg bg-neutral-150"
          style={{
            left: (c - minCol) * CELL_SIZE + CELL_INSET,
            top: (r - minRow) * CELL_SIZE + CELL_INSET,
            width: CELL_SIZE - 2 * CELL_INSET,
            height: CELL_SIZE - 2 * CELL_INSET,
          }}
        />
      ))}

      {/* Layer 1: Cell backgrounds with region colors and smart rounding */}
      {puzzle.cells.map(([r, c]) => {
        const info = cellRegionMap.get(cellKey(r, c));
        if (!info) return null;
        const boundary = regionBoundaryInfos
          .get(info.regionId)
          ?.get(cellKey(r, c));
        const br = boundary
          ? `${boundary.roundTL ? BORDER_RADIUS : 0}px ${boundary.roundTR ? BORDER_RADIUS : 0}px ${boundary.roundBR ? BORDER_RADIUS : 0}px ${boundary.roundBL ? BORDER_RADIUS : 0}px`
          : "0px";

        return (
          <div
            key={`cell-${r}-${c}`}
            className="absolute"
            style={{
              left: (c - minCol) * CELL_SIZE,
              top: (r - minRow) * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: info.color,
              opacity: 0.35,
              borderRadius: br,
              zIndex: 1,
            }}
            data-testid={`cell-${r}-${c}`}
          />
        );
      })}

      {/* Layer 2: Placed dominoes */}
      {boardDominoes.map((d) => {
        if (d.location.type !== "board") return null;
        const { row, col } = d.location;
        const wrapperStyle = getBoardDominoWrapperStyle(
          row,
          col,
          d.orientation,
          minRow,
          minCol,
        );

        return (
          <div
            key={d.id}
            className="absolute"
            style={{ ...wrapperStyle, zIndex: 10 }}
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

      {/* Layer 3: Semi-transparent region overlay on top of dominoes */}
      {puzzle.cells.map(([r, c]) => {
        const info = cellRegionMap.get(cellKey(r, c));
        if (!info) return null;
        const boundary = regionBoundaryInfos
          .get(info.regionId)
          ?.get(cellKey(r, c));
        const br = boundary
          ? `${boundary.roundTL ? BORDER_RADIUS : 0}px ${boundary.roundTR ? BORDER_RADIUS : 0}px ${boundary.roundBR ? BORDER_RADIUS : 0}px ${boundary.roundBL ? BORDER_RADIUS : 0}px`
          : "0px";

        return (
          <div
            key={`overlay-${r}-${c}`}
            className="pointer-events-none absolute"
            style={{
              left: (c - minCol) * CELL_SIZE,
              top: (r - minRow) * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: info.color,
              opacity: 0.15,
              borderRadius: br,
              zIndex: 20,
            }}
          />
        );
      })}

      {/* Layer 4: Region boundary borders (on top of dominoes) */}
      {puzzle.regions.map((region) => {
        const boundaryInfo = regionBoundaryInfos.get(region.id);
        if (!boundaryInfo) return null;

        return region.cells.map(([r, c]) => {
          const boundary = boundaryInfo.get(cellKey(r, c));
          if (!boundary) return null;

          const hasBorder =
            boundary.borderTop ||
            boundary.borderRight ||
            boundary.borderBottom ||
            boundary.borderLeft;
          if (!hasBorder) return null;

          const br = `${boundary.roundTL ? BORDER_RADIUS : 0}px ${boundary.roundTR ? BORDER_RADIUS : 0}px ${boundary.roundBR ? BORDER_RADIUS : 0}px ${boundary.roundBL ? BORDER_RADIUS : 0}px`;

          return (
            <div
              key={`rborder-${region.id}-${r}-${c}`}
              className="pointer-events-none absolute"
              style={{
                left: (c - minCol) * CELL_SIZE,
                top: (r - minRow) * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderTop: boundary.borderTop
                  ? `2px dashed ${region.color}`
                  : "none",
                borderRight: boundary.borderRight
                  ? `2px dashed ${region.color}`
                  : "none",
                borderBottom: boundary.borderBottom
                  ? `2px dashed ${region.color}`
                  : "none",
                borderLeft: boundary.borderLeft
                  ? `2px dashed ${region.color}`
                  : "none",
                borderRadius: br,
                opacity: 0.7,
                zIndex: 21,
              }}
            />
          );
        });
      })}

      {/* Layer 5: Keyboard cursor */}
      {keyboardCursor && (
        <div
          className="pointer-events-none absolute rounded-lg"
          style={{
            left: (keyboardCursor[1] - minCol) * CELL_SIZE - 2,
            top: (keyboardCursor[0] - minRow) * CELL_SIZE - 2,
            width: CELL_SIZE + 4,
            height: CELL_SIZE + 4,
            outline: "3px solid #3b82f6",
            zIndex: 25,
          }}
        />
      )}

      {/* Layer 6: Region constraint labels (highest) */}
      {puzzle.regions.map((region) => {
        const label = constraintLabel(region.constraint);
        if (!label) return null;

        const isViolated = violatedSet.has(region.id);
        const [lr, lc] = getLabelCell(region.cells);
        return (
          <div
            key={`label-${region.id}`}
            className="absolute flex items-center justify-center"
            style={{
              left: (lc - minCol + 1) * CELL_SIZE - 16,
              top: (lr - minRow + 1) * CELL_SIZE - 16,
              width: 28,
              height: 28,
              zIndex: 30,
            }}
          >
            <div
              className="flex h-full w-full rotate-45 items-center justify-center rounded-sm text-white shadow-sm"
              style={{
                backgroundColor: isViolated ? "#ef4444" : region.color,
                filter: isViolated ? "none" : "brightness(0.7)",
              }}
            >
              <span className="-rotate-45 text-xs font-bold">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

function getBoardDominoWrapperStyle(
  row: number,
  col: number,
  orientation: Orientation,
  minRow: number,
  minCol: number,
): React.CSSProperties {
  const cs = CELL_SIZE;
  const baseLeft = (col - minCol) * cs;
  const baseTop = (row - minRow) * cs;

  let left = baseLeft;
  let top = baseTop;

  if (!isHorizontal(orientation)) {
    // No offset needed for 90° (verified via rotation math).
    // For 270°, shift down by cs to compensate for rotation around (cs/2, cs/2).
    if (orientation === 270) {
      top = baseTop + cs;
    }
  } else if (orientation === 180) {
    left = baseLeft + cs;
  }

  return { left, top };
}
