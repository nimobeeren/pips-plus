import { cn } from "@/lib/utils";
import type { Orientation, Pip } from "@/types";
import { isHorizontal } from "@/types";
import { PipDots } from "./pip-dots";

export const CELL_SIZE = 64;

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
          width: horizontal ? 2 * CELL_SIZE : CELL_SIZE,
          height: horizontal ? CELL_SIZE : 2 * CELL_SIZE,
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
            <PipDots value={displayValues[0]} size={CELL_SIZE - 8} />
          </div>
        </div>
        <div
          className={cn(
            "bg-neutral-300",
            horizontal ? "w-px self-stretch" : "h-px self-stretch",
          )}
        />
        <div className="flex flex-1 items-center justify-center p-1">
          <div
            className="h-full w-full"
            style={{
              transform: pipRotation ? `rotate(${pipRotation}deg)` : undefined,
            }}
          >
            <PipDots value={displayValues[1]} size={CELL_SIZE - 8} />
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
        width: 2 * CELL_SIZE,
        height: CELL_SIZE,
        transform: `rotate(${orientation}deg)`,
        transformOrigin: `${CELL_SIZE / 2}px ${CELL_SIZE / 2}px`,
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
        <PipDots value={values[0]} size={CELL_SIZE - 8} />
      </div>
      <div className="w-px self-stretch bg-neutral-300" />
      <div className="flex flex-1 items-center justify-center p-1">
        <PipDots value={values[1]} size={CELL_SIZE - 8} />
      </div>
    </div>
  );
}
