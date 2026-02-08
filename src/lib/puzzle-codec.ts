import type { Constraint, DominoDef, Pip, Puzzle, Region } from "@/types";
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

const CURRENT_VERSION = 1;

/**
 * Compact representation of a puzzle for serialization.
 * IDs and colors are stripped — they get regenerated on decode.
 */
interface EncodedPuzzle {
  v: number;
  cells: [number, number][];
  regions: {
    cells: [number, number][];
    constraint: Constraint;
  }[];
  dominoes: [Pip, Pip][];
}

const REGION_COLORS = [
  "#f4a0a0",
  "#a0c4e8",
  "#a0d8a0",
  "#c4a0d8",
  "#ffcc80",
  "#f48fb1",
  "#c5e1a5",
  "#80deea",
  "#ffe082",
  "#bcaaa4",
  "#b0bec5",
  "#e6ee9c",
];

export function getRegionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length];
}

export function encodePuzzle(puzzle: Puzzle): string {
  const encoded: EncodedPuzzle = {
    v: CURRENT_VERSION,
    cells: puzzle.cells,
    regions: puzzle.regions.map((r) => ({
      cells: r.cells,
      constraint: r.constraint,
    })),
    dominoes: puzzle.dominoes.map((d) => d.values),
  };
  const json = JSON.stringify(encoded);
  const compressed = compressToEncodedURIComponent(json);
  return compressed;
}

export function decodePuzzle(code: string): Puzzle {
  const json = decompressFromEncodedURIComponent(code);
  if (!json) {
    throw new Error("Failed to decompress puzzle code");
  }

  let encoded: unknown;
  try {
    encoded = JSON.parse(json);
  } catch {
    throw new Error("Failed to parse puzzle data");
  }

  return decodeEncodedPuzzle(encoded);
}

function decodeEncodedPuzzle(data: unknown): Puzzle {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid puzzle data: expected object");
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.v !== "number" || obj.v < 1) {
    throw new Error("Invalid puzzle data: missing or invalid version");
  }

  // We only know how to decode v1
  if (obj.v > CURRENT_VERSION) {
    throw new Error(
      `Unsupported puzzle version: ${obj.v} (max supported: ${CURRENT_VERSION})`,
    );
  }

  if (!Array.isArray(obj.cells)) {
    throw new Error("Invalid puzzle data: cells must be an array");
  }
  const cells = obj.cells.map(validateCell);

  if (!Array.isArray(obj.regions)) {
    throw new Error("Invalid puzzle data: regions must be an array");
  }
  const regions: Region[] = obj.regions.map((r: unknown, i: number): Region => {
    if (typeof r !== "object" || r === null) {
      throw new Error(`Invalid region at index ${i}`);
    }
    const regionObj = r as Record<string, unknown>;
    if (!Array.isArray(regionObj.cells)) {
      throw new Error(`Invalid region at index ${i}: cells must be an array`);
    }
    return {
      id: String.fromCharCode(65 + i), // A, B, C, ...
      cells: regionObj.cells.map(validateCell),
      constraint: validateConstraint(regionObj.constraint, i),
      color: getRegionColor(i),
    };
  });

  if (!Array.isArray(obj.dominoes)) {
    throw new Error("Invalid puzzle data: dominoes must be an array");
  }
  const dominoes: DominoDef[] = obj.dominoes.map(
    (d: unknown, i: number): DominoDef => {
      if (!Array.isArray(d) || d.length !== 2) {
        throw new Error(`Invalid domino at index ${i}`);
      }
      const [a, b] = d;
      if (!isValidPip(a) || !isValidPip(b)) {
        throw new Error(`Invalid pip values in domino at index ${i}`);
      }
      return {
        id: `d${String(i + 1).padStart(2, "0")}`,
        values: [a as Pip, b as Pip],
      };
    },
  );

  return { cells, regions, dominoes };
}

function validateCell(c: unknown): [number, number] {
  if (
    !Array.isArray(c) ||
    c.length !== 2 ||
    typeof c[0] !== "number" ||
    typeof c[1] !== "number"
  ) {
    throw new Error("Invalid cell coordinate");
  }
  return [c[0], c[1]];
}

function isValidPip(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6;
}

function validateConstraint(c: unknown, regionIndex: number): Constraint {
  if (typeof c !== "object" || c === null) {
    throw new Error(`Invalid constraint in region at index ${regionIndex}`);
  }
  const obj = c as Record<string, unknown>;
  switch (obj.kind) {
    case "sum":
    case "product":
    case "greater":
    case "less":
      if (typeof obj.target !== "number") {
        throw new Error(
          `Invalid target in constraint at region index ${regionIndex}`,
        );
      }
      return { kind: obj.kind, target: obj.target };
    case "equal":
      return { kind: "equal" };
    case "not-equal":
      return { kind: "not-equal" };
    case "mirror":
      if (typeof obj.group !== "string") {
        throw new Error(
          `Invalid mirror group in constraint at region index ${regionIndex}`,
        );
      }
      return { kind: "mirror", group: obj.group };
    case "none":
      return { kind: "none" };
    default:
      throw new Error(
        `Unknown constraint kind "${obj.kind}" in region at index ${regionIndex}`,
      );
  }
}
