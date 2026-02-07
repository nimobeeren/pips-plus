import type { Pip } from "@/types";

/**
 * Standard domino pip layouts on a 3x3 grid.
 * Positions: TL TC TR / ML MC MR / BL BC BR
 */
const PIP_LAYOUTS: Record<Pip, string[]> = {
  0: [],
  1: ["MC"],
  2: ["TR", "BL"],
  3: ["TR", "MC", "BL"],
  4: ["TL", "TR", "BL", "BR"],
  5: ["TL", "TR", "MC", "BL", "BR"],
  6: ["TL", "ML", "BL", "TR", "MR", "BR"],
};

const POSITION_STYLES: Record<string, string> = {
  TL: "top-[15%] left-[15%]",
  TC: "top-[15%] left-1/2 -translate-x-1/2",
  TR: "top-[15%] right-[15%]",
  ML: "top-1/2 -translate-y-1/2 left-[15%]",
  MC: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  MR: "top-1/2 -translate-y-1/2 right-[15%]",
  BL: "bottom-[15%] left-[15%]",
  BC: "bottom-[15%] left-1/2 -translate-x-1/2",
  BR: "bottom-[15%] right-[15%]",
};

interface PipDotsProps {
  value: Pip;
  size?: number;
}

export function PipDots({ value, size = 48 }: PipDotsProps) {
  const dotSize = Math.max(4, Math.round(size * 0.16));

  return (
    <div className="relative h-full w-full">
      {PIP_LAYOUTS[value].map((pos) => (
        <div
          key={pos}
          className={`absolute rounded-full bg-neutral-800 ${POSITION_STYLES[pos]}`}
          style={{ width: dotSize, height: dotSize }}
        />
      ))}
    </div>
  );
}
