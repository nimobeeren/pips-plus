import type { DominoState } from "@/types";
import { Domino } from "./domino";
import type { DragInfo } from "./game-state";

interface GameDragGhostProps {
  dragInfo: DragInfo | null;
  draggingDomino: DominoState | null;
  scaleFactor: number;
}

export function GameDragGhost({
  dragInfo,
  draggingDomino,
  scaleFactor,
}: GameDragGhostProps) {
  if (!dragInfo || !draggingDomino) return null;

  // Ghost rendering: position using the grab offset so the domino stays under the pointer
  const ghostLeft = dragInfo.currentX - dragInfo.offsetX;
  const ghostTop = dragInfo.currentY - dragInfo.offsetY;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: ghostLeft,
        top: ghostTop,
        transform: `scale(${scaleFactor})`,
        transformOrigin: "top left",
      }}
    >
      <Domino
        id={draggingDomino.id}
        values={draggingDomino.values}
        orientation={draggingDomino.orientation}
        noRotation
        isDragging
      />
    </div>
  );
}
