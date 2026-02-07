import { cn } from "@/lib/utils";
import type { Orientation, Pip } from "@/types";
import { isHorizontal } from "@/types";
import { PipDots } from "./pip-dots";

export const CELL_SIZE = 64;
export const CELL_INSET = 4;
export const DOMINO_SIZE = CELL_SIZE - 2 * CELL_INSET;
export const DOMINO_GAP = CELL_INSET * 2;
export const DOMINO_SPAN = 2 * DOMINO_SIZE + DOMINO_GAP;

interface DominoProps {
  id: string;
  values: [Pip, Pip];
  orientation: Orientation;
  isHeld?: boolean;
  isDragging?: boolean;
  /**
   * When true, renders the domino in its physical orientation
   * (horizontal or vertical DOM layout) without CSS rotation.
   * Used for the drag ghost to avoid transform-related offset issues.
   */
  noRotation?: boolean;
  style?: React.CSSProperties;
  tabIndex?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function Domino({
  values,
  orientation,
  isHeld,
  isDragging,
  noRotation,
  style,
  tabIndex,
  onPointerDown,
  onClick,
  onKeyDown,
}: DominoProps) {
  const horizontal = isHorizontal(orientation);

  // In noRotation mode, determine physical layout and value ordering
  if (noRotation) {
    const swapped = orientation === 180 || orientation === 270;
    const displayValues: [Pip, Pip] = swapped ? [values[1], values[0]] : values;
    const pipRotation = orientation === 0 ? 0 : orientation;

    return (
      <div
        className={cn(
          "flex cursor-grab touch-none select-none items-stretch rounded-lg border-2 border-neutral-300 bg-white shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
          isDragging && "cursor-grabbing shadow-lg opacity-90",
          isHeld && "ring-3 ring-blue-500 shadow-lg -translate-y-1",
        )}
        style={{
          width: horizontal ? DOMINO_SPAN : DOMINO_SIZE,
          height: horizontal ? DOMINO_SIZE : DOMINO_SPAN,
          flexDirection: horizontal ? "row" : "column",
          ...style,
        }}
        tabIndex={tabIndex}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onKeyDown={onKeyDown}
        role="button"
        aria-label={`Domino ${values[0]}-${values[1]}`}
      >
        <div className="flex flex-1 items-center justify-center p-1">
          <div
            className="h-full w-full"
            style={{
              transform: pipRotation ? `rotate(${pipRotation}deg)` : undefined,
            }}
          >
            <PipDots value={displayValues[0]} size={DOMINO_SIZE - 8} />
          </div>
        </div>
        <div
          className="flex items-center justify-center"
          style={
            horizontal
              ? { width: DOMINO_GAP }
              : { height: DOMINO_GAP, width: "100%" }
          }
        >
          <div
            className={cn(
              "bg-neutral-300",
              horizontal ? "h-full w-px" : "w-full h-px",
            )}
          />
        </div>
        <div className="flex flex-1 items-center justify-center p-1">
          <div
            className="h-full w-full"
            style={{
              transform: pipRotation ? `rotate(${pipRotation}deg)` : undefined,
            }}
          >
            <PipDots value={displayValues[1]} size={DOMINO_SIZE - 8} />
          </div>
        </div>
      </div>
    );
  }

  // Default: render horizontally with CSS rotation
  return (
    <div
      className={cn(
        "flex cursor-grab touch-none select-none items-stretch rounded-lg border-2 border-neutral-300 bg-white shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
        isDragging && "cursor-grabbing shadow-lg opacity-90",
        isHeld && "ring-3 ring-blue-500 shadow-lg -translate-y-1",
        "transition-transform duration-150 ease-in-out",
      )}
      style={{
        width: DOMINO_SPAN,
        height: DOMINO_SIZE,
        transform: `rotate(${orientation}deg)`,
        transformOrigin: `${DOMINO_SIZE / 2}px ${DOMINO_SIZE / 2}px`,
        ...style,
      }}
      tabIndex={tabIndex}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="button"
      aria-label={`Domino ${values[0]}-${values[1]}`}
    >
      <div className="flex flex-1 items-center justify-center p-1">
        <PipDots value={values[0]} size={DOMINO_SIZE - 8} />
      </div>
      <div
        className="flex items-center justify-center"
        style={{ width: DOMINO_GAP }}
      >
        <div className="h-full w-px bg-neutral-300" />
      </div>
      <div className="flex flex-1 items-center justify-center p-1">
        <PipDots value={values[1]} size={DOMINO_SIZE - 8} />
      </div>
    </div>
  );
}
