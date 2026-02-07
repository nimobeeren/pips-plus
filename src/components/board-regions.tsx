import type { Constraint, Region } from "@/types";
import { cellKey } from "@/types";

export interface BoardLayout {
  minRow: number;
  minCol: number;
  rows: number;
  cols: number;
  width: number;
  height: number;
}

interface BoardRegionOverlayProps {
  regions: Region[];
  layout: BoardLayout;
  cellSize: number;
  cellInset: number;
}

interface BoardRegionLabelsProps {
  regions: Region[];
  violatedRegions: string[];
  layout: BoardLayout;
  cellSize: number;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function BoardRegionFillOverlay({
  regions,
  layout,
  cellSize,
  cellInset,
}: BoardRegionOverlayProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMinYMin meet"
      style={{ zIndex: 25 }}
      aria-hidden="true"
    >
      {regions
        .filter((region) => region.constraint.kind !== "none")
        .map((region) => {
          const path = buildRegionPath(region, layout, cellSize, cellInset);
          if (!path) return null;

          return (
            <path
              key={`region-fill-${region.id}`}
              d={path}
              fill={region.color}
              fillRule="evenodd"
              opacity={0.25}
            />
          );
        })}
    </svg>
  );
}

export function BoardRegionBorderOverlay({
  regions,
  layout,
  cellSize,
  cellInset,
}: BoardRegionOverlayProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMinYMin meet"
      style={{ zIndex: 30 }}
      aria-hidden="true"
    >
      {regions
        .filter((region) => region.constraint.kind !== "none")
        .map((region) => {
          const path = buildRegionPath(region, layout, cellSize, cellInset);
          if (!path) return null;

          return (
            <path
              key={`region-border-${region.id}`}
              d={path}
              fill="none"
              stroke={region.color}
              strokeWidth={2}
              strokeLinecap="square"
              strokeLinejoin="miter"
              opacity={0.7}
            />
          );
        })}
    </svg>
  );
}

export function BoardRegionLabels({
  regions,
  violatedRegions,
  layout,
  cellSize,
}: BoardRegionLabelsProps) {
  const violatedSet = new Set(violatedRegions);
  const labelSize = 28;
  const labelOffset = labelSize / 2;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 40 }}
    >
      {regions.map((region) => {
        const label = constraintLabel(region.constraint);
        if (!label) return null;

        const isViolated = violatedSet.has(region.id);
        const [lr, lc] = getLabelCell(region.cells);

        return (
          <div
            key={`label-${region.id}`}
            className="absolute flex items-center justify-center rotate-45"
            style={{
              left: (lc - layout.minCol + 1) * cellSize - labelOffset,
              top: (lr - layout.minRow + 1) * cellSize - labelOffset,
              width: labelSize,
              height: labelSize,
            }}
          >
            <div
              className="absolute h-full w-full shadow-sm rounded-sm"
              style={{
                backgroundColor: isViolated ? "#ef4444" : region.color,
                opacity: 1,
                filter: isViolated ? "none" : "brightness(0.7)",
              }}
            />
            <span className="relative z-10 -rotate-45 text-xs font-bold text-white">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function buildCellsOutlinePath(
  cells: [number, number][],
  layout: BoardLayout,
  cellSize: number,
  padding: number,
  cornerRadius: number,
): string {
  const cellSet = new Set(cells.map(([r, c]) => cellKey(r, c)));
  const borderSegments: Segment[] = [];

  for (const [r, c] of cells) {
    const x = (c - layout.minCol) * cellSize;
    const y = (r - layout.minRow) * cellSize;

    if (!cellSet.has(cellKey(r - 1, c)))
      borderSegments.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
    if (!cellSet.has(cellKey(r, c + 1)))
      borderSegments.push({
        x1: x + cellSize,
        y1: y,
        x2: x + cellSize,
        y2: y + cellSize,
      });
    if (!cellSet.has(cellKey(r + 1, c)))
      borderSegments.push({
        x1: x,
        y1: y + cellSize,
        x2: x + cellSize,
        y2: y + cellSize,
      });
    if (!cellSet.has(cellKey(r, c - 1)))
      borderSegments.push({ x1: x, y1: y, x2: x, y2: y + cellSize });
  }

  const loops = segmentsToLoops(borderSegments);
  if (!loops.length) return "";

  const simplified = loops.map((loop) => simplifyLoop(loop));

  // Find the outer loop (largest area) so we can expand it outward,
  // while inner loops (holes) get expanded inward.
  let outerIdx = 0;
  let maxArea = 0;
  for (let i = 0; i < simplified.length; i++) {
    const area = Math.abs(shoelaceArea(simplified[i]));
    if (area > maxArea) {
      maxArea = area;
      outerIdx = i;
    }
  }

  const paddedLoops = simplified.map((loop, i) =>
    insetLoop(loop, i === outerIdx ? -padding : padding),
  );
  return paddedLoops
    .map((loop) => pointsToRoundedPath(loop, cornerRadius))
    .join(" ");
}

function shoelaceArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return area / 2;
}

function buildRegionPath(
  region: Region,
  layout: BoardLayout,
  cellSize: number,
  cellInset: number,
): string {
  const cellSet = new Set(region.cells.map(([r, c]) => cellKey(r, c)));
  const borderSegments: Segment[] = [];

  for (const [r, c] of region.cells) {
    const hasTop = cellSet.has(cellKey(r - 1, c));
    const hasBottom = cellSet.has(cellKey(r + 1, c));
    const hasLeft = cellSet.has(cellKey(r, c - 1));
    const hasRight = cellSet.has(cellKey(r, c + 1));

    const x = (c - layout.minCol) * cellSize;
    const y = (r - layout.minRow) * cellSize;
    const width = cellSize;
    const height = cellSize;

    if (!hasTop) {
      borderSegments.push({ x1: x, y1: y, x2: x + width, y2: y });
    }
    if (!hasRight) {
      borderSegments.push({
        x1: x + width,
        y1: y,
        x2: x + width,
        y2: y + height,
      });
    }
    if (!hasBottom) {
      borderSegments.push({
        x1: x,
        y1: y + height,
        x2: x + width,
        y2: y + height,
      });
    }
    if (!hasLeft) {
      borderSegments.push({ x1: x, y1: y, x2: x, y2: y + height });
    }
  }

  const loops = segmentsToLoops(borderSegments);
  if (!loops.length) return "";

  const simplified = loops.map((loop) => simplifyLoop(loop));

  // Find the outer loop (largest area) so we can inset it inward,
  // while inner loops (holes) get inset outward to keep consistent padding.
  let outerIdx = 0;
  let maxArea = 0;
  for (let i = 0; i < simplified.length; i++) {
    const area = Math.abs(shoelaceArea(simplified[i]));
    if (area > maxArea) {
      maxArea = area;
      outerIdx = i;
    }
  }

  const insetLoops = simplified.map((loop, i) =>
    insetLoop(loop, i === outerIdx ? cellInset : -cellInset),
  );
  const cornerRadius = cellInset * 2;
  return insetLoops
    .map((loop) => pointsToRoundedPath(loop, cornerRadius))
    .join(" ");
}

function segmentsToLoops(segments: Segment[]): Point[][] {
  if (!segments.length) return [];

  const adjacency = new Map<string, Set<string>>();
  const edgeSet = new Set<string>();

  const addEdge = (a: string, b: string) => {
    const key = edgeKey(a, b);
    edgeSet.add(key);
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  };

  for (const segment of segments) {
    const start = pointKey(segment.x1, segment.y1);
    const end = pointKey(segment.x2, segment.y2);
    addEdge(start, end);
  }

  const visited = new Set<string>();
  const loops: Point[][] = [];

  for (const edge of edgeSet) {
    if (visited.has(edge)) continue;
    const [start, next] = edge.split("|");
    let prev = start;
    let current = next;
    const points = [start, current];
    visited.add(edge);

    while (current !== start) {
      const neighbors = adjacency.get(current);
      if (!neighbors) break;
      let candidate: string | null = null;
      for (const neighbor of neighbors) {
        if (neighbor === prev) continue;
        const candidateEdge = edgeKey(current, neighbor);
        if (!visited.has(candidateEdge)) {
          candidate = neighbor;
          break;
        }
      }
      if (!candidate) break;
      visited.add(edgeKey(current, candidate));
      points.push(candidate);
      prev = current;
      current = candidate;
    }

    if (points.length > 2 && points[0] === points[points.length - 1]) {
      loops.push(pointsToCoords(points));
    }
  }

  return loops;
}

interface Point {
  x: number;
  y: number;
}

function pointsToCoords(points: string[]): Point[] {
  const coords = points.map((point) => {
    const [x, y] = point.split(",").map(Number);
    return { x, y };
  });
  if (coords.length > 1) {
    coords.pop();
  }
  return coords;
}

function pointsToPath(points: Point[]): string {
  if (!points.length) return "";
  const [startX, startY] = [points[0].x, points[0].y];
  const commands = [`M ${startX} ${startY}`];

  for (let i = 1; i < points.length; i += 1) {
    const { x, y } = points[i];
    commands.push(`L ${x} ${y}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

function pointsToRoundedPath(points: Point[], radius: number): string {
  if (points.length < 3 || radius <= 0) {
    return pointsToPath(points);
  }

  const commands: string[] = [];
  const total = points.length;

  for (let i = 0; i < total; i += 1) {
    const prev = points[(i - 1 + total) % total];
    const current = points[i];
    const next = points[(i + 1) % total];

    const v1 = { x: current.x - prev.x, y: current.y - prev.y };
    const v2 = { x: next.x - current.x, y: next.y - current.y };
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);

    const cornerRadius = Math.min(radius, len1 / 2, len2 / 2);
    if (cornerRadius <= 0) continue;

    const dir1 = { x: v1.x / len1, y: v1.y / len1 };
    const dir2 = { x: v2.x / len2, y: v2.y / len2 };

    const p1 = {
      x: current.x - dir1.x * cornerRadius,
      y: current.y - dir1.y * cornerRadius,
    };
    const p2 = {
      x: current.x + dir2.x * cornerRadius,
      y: current.y + dir2.y * cornerRadius,
    };

    if (i === 0) {
      commands.push(`M ${p1.x} ${p1.y}`);
    } else {
      commands.push(`L ${p1.x} ${p1.y}`);
    }

    commands.push(`Q ${current.x} ${current.y} ${p2.x} ${p2.y}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function insetLoop(points: Point[], inset: number): Point[] {
  if (points.length < 3) return points;
  const orientation = polygonOrientation(points);
  const insetPoints: Point[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const v1 = { x: current.x - prev.x, y: current.y - prev.y };
    const v2 = { x: next.x - current.x, y: next.y - current.y };

    const n1 = inwardNormal(v1, orientation);
    const n2 = inwardNormal(v2, orientation);

    const line1 = offsetLine(current, v1, n1, inset);
    const line2 = offsetLine(current, v2, n2, inset);

    const intersection = intersectOrthogonalLines(line1, line2);
    insetPoints.push(intersection);
  }

  return insetPoints;
}

function simplifyLoop(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const simplified: Point[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const v1 = { x: current.x - prev.x, y: current.y - prev.y };
    const v2 = { x: next.x - current.x, y: next.y - current.y };

    const collinear = (v1.x === 0 && v2.x === 0) || (v1.y === 0 && v2.y === 0);
    if (!collinear) {
      simplified.push(current);
    }
  }

  return simplified.length >= 3 ? simplified : points;
}

function polygonOrientation(points: Point[]): "cw" | "ccw" {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return area >= 0 ? "ccw" : "cw";
}

function inwardNormal(vector: Point, orientation: "cw" | "ccw"): Point {
  const dx = Math.sign(vector.x);
  const dy = Math.sign(vector.y);

  if (orientation === "ccw") {
    return { x: -dy, y: dx };
  }
  return { x: dy, y: -dx };
}

interface OffsetLine {
  orientation: "horizontal" | "vertical";
  value: number;
}

function offsetLine(
  point: Point,
  vector: Point,
  normal: Point,
  inset: number,
): OffsetLine {
  if (Math.abs(vector.y) < 1) {
    return { orientation: "horizontal", value: point.y + normal.y * inset };
  }
  return { orientation: "vertical", value: point.x + normal.x * inset };
}

function intersectOrthogonalLines(line1: OffsetLine, line2: OffsetLine): Point {
  if (line1.orientation === line2.orientation) {
    if (line1.orientation === "horizontal") {
      return { x: line2.value, y: line1.value };
    }
    return { x: line1.value, y: line2.value };
  }
  if (line1.orientation === "horizontal") {
    return { x: line2.value, y: line1.value };
  }
  return { x: line1.value, y: line2.value };
}

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

function getLabelCell(cells: [number, number][]): [number, number] {
  let best = cells[0];
  for (const cell of cells) {
    if (cell[0] > best[0] || (cell[0] === best[0] && cell[1] > best[1])) {
      best = cell;
    }
  }
  return best;
}
