import type { DominoState, Puzzle } from "@/types";

const STORAGE_PREFIX = "game-state:";
const RESULT_PREFIX = "puzzle-result:";
const TIMER_PREFIX = "puzzle-timer:";

interface SavedGameState {
  puzzleFingerprint: string;
  dominoes: DominoState[];
  nextZOrder: number;
}

export interface PuzzleResult {
  solveTimeMs: number;
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

export function savePuzzleResult(name: string, result: PuzzleResult): void {
  localStorage.setItem(`${RESULT_PREFIX}${name}`, JSON.stringify(result));
}

export function loadPuzzleResult(name: string): PuzzleResult | null {
  const raw = localStorage.getItem(`${RESULT_PREFIX}${name}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PuzzleResult;
  } catch {
    return null;
  }
}

export function saveElapsedTime(name: string, elapsedMs: number): void {
  localStorage.setItem(`${TIMER_PREFIX}${name}`, String(elapsedMs));
}

export function loadElapsedTime(name: string): number {
  const raw = localStorage.getItem(`${TIMER_PREFIX}${name}`);
  if (!raw) return 0;
  const val = Number(raw);
  return Number.isFinite(val) ? val : 0;
}

export function clearElapsedTime(name: string): void {
  localStorage.removeItem(`${TIMER_PREFIX}${name}`);
}

export function clearPuzzleResult(name: string): void {
  localStorage.removeItem(`${RESULT_PREFIX}${name}`);
}

export function isPuzzleSolved(name: string): boolean {
  return localStorage.getItem(`${RESULT_PREFIX}${name}`) !== null;
}
