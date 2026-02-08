import type { DominoState, Puzzle } from "@/types";

const STORAGE_PREFIX = "game-state:";

interface SavedGameState {
  puzzleFingerprint: string;
  dominoes: DominoState[];
  nextZOrder: number;
}

function fingerprint(puzzle: Puzzle): string {
  return JSON.stringify(puzzle);
}

function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

export function saveGameState(
  name: string,
  puzzle: Puzzle,
  dominoes: DominoState[],
  nextZOrder: number,
): void {
  const data: SavedGameState = {
    puzzleFingerprint: fingerprint(puzzle),
    dominoes,
    nextZOrder,
  };
  localStorage.setItem(storageKey(name), JSON.stringify(data));
}

export function loadGameState(
  name: string,
  puzzle: Puzzle,
): { dominoes: DominoState[]; nextZOrder: number } | null {
  const raw = localStorage.getItem(storageKey(name));
  if (!raw) return null;

  try {
    const data: SavedGameState = JSON.parse(raw);
    if (data.puzzleFingerprint !== fingerprint(puzzle)) {
      localStorage.removeItem(storageKey(name));
      return null;
    }
    return { dominoes: data.dominoes, nextZOrder: data.nextZOrder };
  } catch {
    localStorage.removeItem(storageKey(name));
    return null;
  }
}
