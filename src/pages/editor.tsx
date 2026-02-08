import {
  EditorBoard,
  type EditorDomino,
  type EditorTool,
} from "@/components/editor-board";
import { Domino } from "@/components/domino";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CELL_SIZE } from "@/components/domino";
import { generateDominoes } from "@/lib/design-solver";
import { encodePuzzle, getRegionColor } from "@/lib/puzzle-codec";
import { validateConstraint, validateMirrorGroups } from "@/solver";
import type {
  Constraint,
  DominoDef,
  DominoPlacement,
  Pip,
  Puzzle,
  Region,
} from "@/types";
import { cellKey, getCoveredCells } from "@/types";
import {
  Check,
  ChevronLeft,
  ClipboardCopy,
  Grid3x3,
  Link,
  Pencil,
  RectangleHorizontal,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router";

const GRID_ROWS = 8;
const GRID_COLS = 10;
const EDITOR_STORAGE_KEY = "editor-state";

// --- Storage ---

interface SavedEditorState {
  cells: string[];
  regions: Region[];
  dominoes: EditorDomino[];
  activeTool: EditorTool;
  activeRegionId: string | null;
  dominoPips: [Pip, Pip];
  nextRegionIndex: number;
  nextDominoIndex: number;
}

function saveEditorState(state: EditorState): void {
  const data: SavedEditorState = {
    cells: Array.from(state.cells),
    regions: state.regions,
    dominoes: state.dominoes,
    activeTool: state.activeTool,
    activeRegionId: state.activeRegionId,
    dominoPips: state.dominoPips,
    nextRegionIndex: state.nextRegionIndex,
    nextDominoIndex: state.nextDominoIndex,
  };
  localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(data));
}

function loadEditorState(): EditorState | null {
  const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
  if (!raw) return null;
  try {
    const data: SavedEditorState = JSON.parse(raw);
    return {
      cells: new Set(data.cells),
      regions: data.regions,
      dominoes: data.dominoes,
      activeTool: data.activeTool,
      activeRegionId: data.activeRegionId,
      dominoPips: data.dominoPips,
      checkState: "unchecked",
      checkValid: false,
      violatedRegions: [],
      nextRegionIndex: data.nextRegionIndex,
      nextDominoIndex: data.nextDominoIndex,
    };
  } catch {
    localStorage.removeItem(EDITOR_STORAGE_KEY);
    return null;
  }
}

function clearEditorState(): void {
  localStorage.removeItem(EDITOR_STORAGE_KEY);
}

// --- State ---

interface EditorState {
  cells: Set<string>;
  regions: Region[];
  dominoes: EditorDomino[];
  activeTool: EditorTool;
  activeRegionId: string | null;
  dominoPips: [Pip, Pip];
  checkState: "unchecked" | "checked";
  checkValid: boolean;
  violatedRegions: string[];
  nextRegionIndex: number;
  nextDominoIndex: number;
}

type EditorAction =
  | { type: "CELL_TOGGLE"; row: number; col: number }
  | { type: "SET_TOOL"; tool: EditorTool }
  | { type: "CREATE_REGION_AT"; row: number; col: number }
  | { type: "EXTEND_REGION"; row: number; col: number }
  | { type: "DELETE_REGION"; regionId: string }
  | { type: "SET_CONSTRAINT"; regionId: string; constraint: Constraint }
  | {
      type: "PLACE_DOMINO";
      row: number;
      col: number;
      values: [Pip, Pip];
      gridRows: number;
      gridCols: number;
    }
  | { type: "ROTATE_DOMINO"; id: string; gridRows: number; gridCols: number }
  | {
      type: "MOVE_DOMINO";
      id: string;
      row: number;
      col: number;
      gridRows: number;
      gridCols: number;
    }
  | { type: "UPDATE_DOMINO"; id: string; values: [Pip, Pip] }
  | { type: "REMOVE_DOMINO"; id: string }
  | { type: "SET_DOMINO_PIPS"; pips: [Pip, Pip] }
  | {
      type: "SET_GENERATED";
      dominoes: DominoDef[];
      placements: DominoPlacement[];
    }
  | { type: "CHECK" }
  | { type: "CLEAR" };

function initState(): EditorState {
  return (
    loadEditorState() ?? {
      cells: new Set(),
      regions: [],
      dominoes: [],
      activeTool: "cell",
      activeRegionId: null,
      dominoPips: [0, 0],
      checkState: "unchecked",
      checkValid: false,
      violatedRegions: [],
      nextRegionIndex: 0,
      nextDominoIndex: 1,
    }
  );
}

function clearCheck(state: EditorState): EditorState {
  if (state.checkState === "unchecked") return state;
  return {
    ...state,
    checkState: "unchecked",
    checkValid: false,
    violatedRegions: [],
  };
}

function getOccupiedCells(
  dominoes: EditorDomino[],
  excludeId?: string,
): Set<string> {
  const occupied = new Set<string>();
  for (const d of dominoes) {
    if (d.id === excludeId) continue;
    const cells = getCoveredCells(d.row, d.col, d.orientation, d.values);
    for (const { cell } of cells) {
      occupied.add(cellKey(cell[0], cell[1]));
    }
  }
  return occupied;
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "CELL_TOGGLE": {
      const key = cellKey(action.row, action.col);
      const newCells = new Set(state.cells);
      if (newCells.has(key)) {
        // Remove cell and from any region
        newCells.delete(key);
        const newRegions = state.regions
          .map((r) => ({
            ...r,
            cells: r.cells.filter(([cr, cc]) => cellKey(cr, cc) !== key),
          }))
          .filter((r) => r.cells.length > 0);
        return clearCheck({
          ...state,
          cells: newCells,
          regions: newRegions,
          activeRegionId: newRegions.find((r) => r.id === state.activeRegionId)
            ? state.activeRegionId
            : null,
        });
      }
      newCells.add(key);
      return clearCheck({ ...state, cells: newCells });
    }

    case "SET_TOOL":
      return { ...state, activeTool: action.tool };

    case "CREATE_REGION_AT": {
      const key = cellKey(action.row, action.col);
      if (!state.cells.has(key)) return state;

      // Don't create region if cell is already in one
      for (const r of state.regions) {
        if (r.cells.some(([cr, cc]) => cellKey(cr, cc) === key)) return state;
      }

      const id = String.fromCharCode(65 + state.nextRegionIndex);
      const color = getRegionColor(state.nextRegionIndex);
      const newRegion: Region = {
        id,
        cells: [[action.row, action.col]],
        constraint: { kind: "equal" },
        color,
      };
      return clearCheck({
        ...state,
        regions: [...state.regions, newRegion],
        activeRegionId: id,
        nextRegionIndex: state.nextRegionIndex + 1,
      });
    }

    case "EXTEND_REGION": {
      if (!state.activeRegionId) return state;
      const key = cellKey(action.row, action.col);
      if (!state.cells.has(key)) return state;

      // Skip if cell is already in any region
      for (const r of state.regions) {
        if (r.cells.some(([cr, cc]) => cellKey(cr, cc) === key)) return state;
      }

      const newRegions = state.regions.map((r) =>
        r.id === state.activeRegionId
          ? {
              ...r,
              cells: [...r.cells, [action.row, action.col] as [number, number]],
            }
          : r,
      );
      return clearCheck({ ...state, regions: newRegions });
    }

    case "DELETE_REGION": {
      const newRegions = state.regions.filter((r) => r.id !== action.regionId);
      return clearCheck({
        ...state,
        regions: newRegions,
        activeRegionId:
          state.activeRegionId === action.regionId
            ? null
            : state.activeRegionId,
      });
    }

    case "SET_CONSTRAINT": {
      const newRegions = state.regions.map((r) =>
        r.id === action.regionId ? { ...r, constraint: action.constraint } : r,
      );
      return clearCheck({ ...state, regions: newRegions });
    }

    case "PLACE_DOMINO": {
      const { row, col, values, gridRows, gridCols } = action;
      const occupied = getOccupiedCells(state.dominoes);

      if (occupied.has(cellKey(row, col))) return state;

      const canH = col + 1 < gridCols && !occupied.has(cellKey(row, col + 1));
      const canV = row + 1 < gridRows && !occupied.has(cellKey(row + 1, col));

      let orientation: 0 | 90;
      if (canH) {
        orientation = 0;
      } else if (canV) {
        orientation = 90;
      } else {
        return state;
      }

      const id = `d${String(state.nextDominoIndex).padStart(2, "0")}`;
      const newDomino: EditorDomino = { id, values, orientation, row, col };
      return clearCheck({
        ...state,
        dominoes: [...state.dominoes, newDomino],
        nextDominoIndex: state.nextDominoIndex + 1,
      });
    }

    case "ROTATE_DOMINO": {
      const { id, gridRows, gridCols } = action;
      return clearCheck({
        ...state,
        dominoes: state.dominoes.map((d) => {
          if (d.id !== id) return d;
          const newOrientation: 0 | 90 = d.orientation === 0 ? 90 : 0;

          if (newOrientation === 0 && d.col + 1 >= gridCols) return d;
          if (newOrientation === 90 && d.row + 1 >= gridRows) return d;

          const newCells = getCoveredCells(
            d.row,
            d.col,
            newOrientation,
            d.values,
          );
          const occupied = getOccupiedCells(state.dominoes, id);
          for (const { cell } of newCells) {
            if (occupied.has(cellKey(cell[0], cell[1]))) return d;
          }

          return { ...d, orientation: newOrientation };
        }),
      });
    }

    case "MOVE_DOMINO": {
      const { id, row, col, gridRows, gridCols } = action;
      const domino = state.dominoes.find((d) => d.id === id);
      if (!domino) return state;
      if (row === domino.row && col === domino.col) return state;

      // Check bounds
      if (row < 0 || col < 0) return state;
      if (domino.orientation === 0 && col + 1 >= gridCols) return state;
      if (domino.orientation === 90 && row + 1 >= gridRows) return state;
      if (row >= gridRows || col >= gridCols) return state;

      // Check overlap
      const occupied = getOccupiedCells(state.dominoes, id);
      const newCells = getCoveredCells(
        row,
        col,
        domino.orientation,
        domino.values,
      );
      for (const { cell } of newCells) {
        if (occupied.has(cellKey(cell[0], cell[1]))) return state;
      }

      return clearCheck({
        ...state,
        dominoes: state.dominoes.map((d) =>
          d.id === id ? { ...d, row, col } : d,
        ),
      });
    }

    case "UPDATE_DOMINO":
      return clearCheck({
        ...state,
        dominoes: state.dominoes.map((d) =>
          d.id === action.id ? { ...d, values: action.values } : d,
        ),
      });

    case "REMOVE_DOMINO":
      return clearCheck({
        ...state,
        dominoes: state.dominoes.filter((d) => d.id !== action.id),
      });

    case "SET_DOMINO_PIPS":
      return { ...state, dominoPips: action.pips };

    case "SET_GENERATED": {
      const editorDominoes: EditorDomino[] = action.placements.map((p, i) => {
        const horizontal = p.cells[0][0] === p.cells[1][0];
        return {
          id: action.dominoes[i].id,
          values: action.dominoes[i].values,
          orientation: (horizontal ? 0 : 90) as 0 | 90,
          row: Math.min(p.cells[0][0], p.cells[1][0]),
          col: Math.min(p.cells[0][1], p.cells[1][1]),
        };
      });
      return clearCheck({
        ...state,
        dominoes: editorDominoes,
        nextDominoIndex: action.dominoes.length + 1,
      });
    }

    case "CHECK": {
      if (state.dominoes.length === 0) {
        return {
          ...state,
          checkState: "checked",
          checkValid: false,
          violatedRegions: [],
        };
      }

      const board = new Map<string, Pip>();
      const coveredCells = new Set<string>();
      let hasOverlap = false;
      let hasOffCell = false;

      for (const d of state.dominoes) {
        const cells = getCoveredCells(d.row, d.col, d.orientation, d.values);
        for (const { cell, value } of cells) {
          const key = cellKey(cell[0], cell[1]);
          if (coveredCells.has(key)) hasOverlap = true;
          coveredCells.add(key);
          board.set(key, value);
          if (!state.cells.has(key)) hasOffCell = true;
        }
      }

      // All cells must be covered
      let allCovered = true;
      for (const key of state.cells) {
        if (!coveredCells.has(key)) {
          allCovered = false;
          break;
        }
      }

      // Check region constraints
      const violatedRegions: string[] = [];
      const regionValues = new Map<string, Pip[]>();
      for (const region of state.regions) {
        const values: Pip[] = [];
        for (const [r, c] of region.cells) {
          const val = board.get(cellKey(r, c));
          if (val !== undefined) values.push(val);
        }
        regionValues.set(region.id, values);

        if (values.length === region.cells.length && values.length > 0) {
          if (!validateConstraint(region.constraint, values)) {
            violatedRegions.push(region.id);
          }
        }
      }

      const mirrorViolated = validateMirrorGroups(state.regions, regionValues);
      for (const id of mirrorViolated) {
        if (!violatedRegions.includes(id)) violatedRegions.push(id);
      }

      const isValid =
        allCovered &&
        !hasOverlap &&
        !hasOffCell &&
        violatedRegions.length === 0;

      return {
        ...state,
        checkState: "checked",
        checkValid: isValid,
        violatedRegions,
      };
    }

    case "CLEAR":
      clearEditorState();
      return {
        cells: new Set(),
        regions: [],
        dominoes: [],
        activeTool: "cell",
        activeRegionId: null,
        dominoPips: [0, 0],
        checkState: "unchecked",
        checkValid: false,
        violatedRegions: [],
        nextRegionIndex: 0,
        nextDominoIndex: 1,
      };
  }
}

// --- Component ---

export function EditorPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  // Auto-save editor state to localStorage on every change
  useEffect(() => {
    saveEditorState(state);
  }, [state]);

  // Popover state for region editing on board
  const [regionPopover, setRegionPopover] = useState<{
    regionId: string;
    row: number;
    col: number;
  } | null>(null);

  // Pending region popup: set on create, opened on interaction end
  const [pendingRegionPopup, setPendingRegionPopup] = useState<{
    regionId: string;
    row: number;
    col: number;
  } | null>(null);

  // Popover state for domino editing
  const [dominoPopover, setDominoPopover] = useState<string | null>(null);

  const handleCellToggle = useCallback((row: number, col: number) => {
    dispatch({ type: "CELL_TOGGLE", row, col });
  }, []);

  const handleRegionCreate = useCallback(
    (row: number, col: number) => {
      const key = cellKey(row, col);
      if (!state.cells.has(key)) return;
      // Check if already in a region
      for (const r of state.regions) {
        if (r.cells.some(([cr, cc]) => cellKey(cr, cc) === key)) return;
      }
      const newRegionId = String.fromCharCode(65 + state.nextRegionIndex);
      dispatch({ type: "CREATE_REGION_AT", row, col });
      setPendingRegionPopup({ regionId: newRegionId, row, col });
    },
    [state.nextRegionIndex, state.cells, state.regions],
  );

  const handleRegionExtend = useCallback((row: number, col: number) => {
    dispatch({ type: "EXTEND_REGION", row, col });
  }, []);

  const handleInteractionEnd = useCallback(() => {
    if (pendingRegionPopup) {
      setRegionPopover(pendingRegionPopup);
      setPendingRegionPopup(null);
    }
  }, [pendingRegionPopup]);

  const handleRegionCellClick = useCallback(
    (regionId: string, row: number, col: number) => {
      setRegionPopover({ regionId, row, col });
    },
    [],
  );

  const handleDominoPlace = useCallback(
    (row: number, col: number) => {
      dispatch({
        type: "PLACE_DOMINO",
        row,
        col,
        values: state.dominoPips,
        gridRows: GRID_ROWS,
        gridCols: GRID_COLS,
      });
    },
    [state.dominoPips],
  );

  const handleDominoRotate = useCallback((id: string) => {
    dispatch({
      type: "ROTATE_DOMINO",
      id,
      gridRows: GRID_ROWS,
      gridCols: GRID_COLS,
    });
  }, []);

  const handleDominoMove = useCallback(
    (id: string, row: number, col: number) => {
      dispatch({
        type: "MOVE_DOMINO",
        id,
        row,
        col,
        gridRows: GRID_ROWS,
        gridCols: GRID_COLS,
      });
    },
    [],
  );

  const handleDominoEdit = useCallback((id: string) => {
    setDominoPopover(id);
  }, []);

  const handleDominoDelete = useCallback((id: string) => {
    dispatch({ type: "REMOVE_DOMINO", id });
    setDominoPopover(null);
  }, []);

  const handleAutoFill = useCallback(() => {
    const cells: [number, number][] = [];
    for (const key of state.cells) {
      const [r, c] = key.split(",").map(Number);
      cells.push([r, c]);
    }

    if (cells.length === 0) {
      setAutoFillMessage("No cells drawn yet.");
      setTimeout(() => setAutoFillMessage(null), 3000);
      return;
    }

    if (cells.length % 2 !== 0) {
      setAutoFillMessage(
        `Need an even number of cells (currently ${cells.length}).`,
      );
      setTimeout(() => setAutoFillMessage(null), 3000);
      return;
    }

    const result = generateDominoes({ cells, regions: state.regions });
    if (result) {
      dispatch({
        type: "SET_GENERATED",
        dominoes: result.dominoes,
        placements: result.placements,
      });
      setAutoFillMessage(null);
    } else {
      setAutoFillMessage("No valid domino placement exists for this layout.");
      setTimeout(() => setAutoFillMessage(null), 3000);
    }
  }, [state.cells, state.regions]);

  const handleCheck = useCallback(() => {
    dispatch({ type: "CHECK" });
  }, []);

  const buildPuzzle = useCallback((): Puzzle | null => {
    if (state.dominoes.length === 0) return null;
    const cells: [number, number][] = [];
    for (const key of state.cells) {
      const [r, c] = key.split(",").map(Number);
      cells.push([r, c]);
    }
    const dominoDefs: DominoDef[] = state.dominoes.map((d) => ({
      id: d.id,
      values: d.values,
    }));
    return { cells, regions: state.regions, dominoes: dominoDefs };
  }, [state.cells, state.regions, state.dominoes]);

  const handleCopyJSON = useCallback(() => {
    const puzzle = buildPuzzle();
    if (!puzzle) return;
    navigator.clipboard.writeText(JSON.stringify(puzzle, null, 2));
  }, [buildPuzzle]);

  const handleCopyShareLink = useCallback(() => {
    const puzzle = buildPuzzle();
    if (!puzzle) return;
    const code = encodePuzzle(puzzle);
    navigator.clipboard.writeText(
      `${window.location.origin}/custom?code=${code}`,
    );
  }, [buildPuzzle]);

  const handlePlaytest = useCallback(() => {
    const puzzle = buildPuzzle();
    if (!puzzle) return;
    const code = encodePuzzle(puzzle);
    navigate(`/custom?code=${code}`);
  }, [buildPuzzle, navigate]);

  const hasDominoes = state.dominoes.length > 0;

  // Popover anchor positions (relative to board)
  const regionPopoverPos = regionPopover
    ? {
        x: regionPopover.col * CELL_SIZE + CELL_SIZE / 2,
        y: regionPopover.row * CELL_SIZE + CELL_SIZE / 2,
      }
    : null;

  const dominoPopoverDomino = dominoPopover
    ? state.dominoes.find((d) => d.id === dominoPopover)
    : null;
  const dominoPopoverPos = dominoPopoverDomino
    ? {
        x:
          dominoPopoverDomino.col * CELL_SIZE +
          (dominoPopoverDomino.orientation === 0 ? CELL_SIZE : CELL_SIZE / 2),
        y:
          dominoPopoverDomino.row * CELL_SIZE +
          (dominoPopoverDomino.orientation === 90 ? CELL_SIZE : CELL_SIZE / 2),
      }
    : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh flex-col bg-neutral-50">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ChevronLeft className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to home</TooltipContent>
          </Tooltip>

          <h1 className="text-lg font-semibold">Puzzle Editor</h1>

          <div className="flex-1" />

          {/* Check state badge */}
          {state.checkState === "checked" && (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                state.checkValid
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {state.checkValid ? (
                <>
                  <Check className="size-3" /> Valid
                </>
              ) : (
                <>
                  <X className="size-3" /> Invalid
                </>
              )}
            </span>
          )}

          {autoFillMessage && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              {autoFillMessage}
            </span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheck}
                disabled={state.dominoes.length === 0}
              >
                <ShieldCheck className="mr-1 size-4" />
                Check
              </Button>
            </TooltipTrigger>
            <TooltipContent>Validate current solution</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleAutoFill}>
                <Sparkles className="mr-1 size-4" />
                Auto-fill
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Auto-generate dominoes for this puzzle
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyJSON}
                disabled={!hasDominoes}
              >
                <ClipboardCopy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy puzzle JSON</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyShareLink}
                disabled={!hasDominoes}
              >
                <Link className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy share link</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={handlePlaytest}
                disabled={!hasDominoes}
              >
                Play
              </Button>
            </TooltipTrigger>
            <TooltipContent>Playtest this puzzle</TooltipContent>
          </Tooltip>
        </div>

        {/* Main area */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <div className="relative">
            <EditorBoard
              gridRows={GRID_ROWS}
              gridCols={GRID_COLS}
              cells={state.cells}
              regions={state.regions}
              dominoes={state.dominoes}
              activeTool={state.activeTool}
              violatedRegions={state.violatedRegions}
              onCellToggle={handleCellToggle}
              onRegionCreate={handleRegionCreate}
              onRegionExtend={handleRegionExtend}
              onRegionCellClick={handleRegionCellClick}
              onInteractionEnd={handleInteractionEnd}
              onDominoPlace={handleDominoPlace}
              onDominoRotate={handleDominoRotate}
              onDominoMove={handleDominoMove}
              onDominoEdit={handleDominoEdit}
              onDominoDelete={handleDominoDelete}
            />

            {/* Region popover */}
            <Popover
              open={!!regionPopover}
              onOpenChange={(open) => {
                if (!open) setRegionPopover(null);
              }}
            >
              <PopoverAnchor asChild>
                <div
                  className="pointer-events-none absolute size-px"
                  style={{
                    left: regionPopoverPos?.x ?? 0,
                    top: regionPopoverPos?.y ?? 0,
                  }}
                />
              </PopoverAnchor>
              <PopoverContent className="w-64" side="right" align="start">
                {regionPopover &&
                  (() => {
                    const region = state.regions.find(
                      (r) => r.id === regionPopover.regionId,
                    );
                    if (!region) return null;
                    return (
                      <RegionConfig
                        region={region}
                        onConstraintChange={(constraint) =>
                          dispatch({
                            type: "SET_CONSTRAINT",
                            regionId: regionPopover.regionId,
                            constraint,
                          })
                        }
                        onDelete={() => {
                          dispatch({
                            type: "DELETE_REGION",
                            regionId: regionPopover.regionId,
                          });
                          setRegionPopover(null);
                        }}
                      />
                    );
                  })()}
              </PopoverContent>
            </Popover>

            {/* Domino edit popover */}
            <Popover
              open={!!dominoPopover}
              onOpenChange={(open) => {
                if (!open) setDominoPopover(null);
              }}
            >
              <PopoverAnchor asChild>
                <div
                  className="pointer-events-none absolute size-px"
                  style={{
                    left: dominoPopoverPos?.x ?? 0,
                    top: dominoPopoverPos?.y ?? 0,
                  }}
                />
              </PopoverAnchor>
              <PopoverContent className="w-auto" side="right" align="start">
                {dominoPopoverDomino && (
                  <DominoEditPopup
                    domino={dominoPopoverDomino}
                    onUpdate={(values) =>
                      dispatch({
                        type: "UPDATE_DOMINO",
                        id: dominoPopoverDomino.id,
                        values,
                      })
                    }
                    onDelete={() => handleDominoDelete(dominoPopoverDomino.id)}
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="border-t border-neutral-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            {/* Tool buttons: cell, region, domino */}
            <div className="flex gap-1">
              <ToolButton
                icon={<Pencil className="size-4" />}
                label="Cell"
                tooltip="Draw / erase cells"
                active={state.activeTool === "cell"}
                onClick={() => dispatch({ type: "SET_TOOL", tool: "cell" })}
              />
              <ToolButton
                icon={<Grid3x3 className="size-4" />}
                label="Region"
                tooltip="Paint regions"
                active={state.activeTool === "region"}
                onClick={() => dispatch({ type: "SET_TOOL", tool: "region" })}
              />
              <ToolButton
                icon={<RectangleHorizontal className="size-4" />}
                label="Domino"
                tooltip="Place dominoes"
                active={state.activeTool === "domino"}
                onClick={() => dispatch({ type: "SET_TOOL", tool: "domino" })}
              />
            </div>

            <div className="h-6 w-px bg-neutral-200" />

            {/* Tool-specific controls — min-h keeps toolbar stable across tools */}
            <div
              className="flex flex-1 items-center gap-2"
              style={{ minHeight: 60 }}
            >
              {state.activeTool === "domino" && (
                <PipSelector
                  values={state.dominoPips}
                  onChange={(pips) =>
                    dispatch({ type: "SET_DOMINO_PIPS", pips })
                  }
                />
              )}
            </div>

            <div className="h-6 w-px bg-neutral-200" />

            {/* Clear */}
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <RotateCcw className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Clear everything</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all cells, regions, and dominoes. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => dispatch({ type: "CLEAR" })}
                  >
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// --- Sub-components ---

function ToolButton({
  icon,
  label,
  tooltip,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "outline"}
          size="sm"
          onClick={onClick}
          className="gap-1"
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function PipButtons({
  value,
  onChange,
}: {
  value: Pip;
  onChange: (pip: Pip) => void;
}) {
  const pips: Pip[] = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex gap-0.5">
      {pips.map((p) => (
        <button
          key={p}
          className={`flex size-6 items-center justify-center rounded text-xs font-medium transition-colors ${
            value === p
              ? "bg-neutral-800 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function PipSelector({
  values,
  onChange,
}: {
  values: [Pip, Pip];
  onChange: (values: [Pip, Pip]) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="shrink-0 overflow-hidden"
        style={{ width: 28, height: 60 }}
      >
        <div style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>
          <Domino id="preview" values={values} orientation={90} noRotation />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <PipButtons
          value={values[0]}
          onChange={(p) => onChange([p, values[1]])}
        />
        <PipButtons
          value={values[1]}
          onChange={(p) => onChange([values[0], p])}
        />
      </div>
    </div>
  );
}

function RegionConfig({
  region,
  onConstraintChange,
  onDelete,
}: {
  region: Region;
  onConstraintChange: (constraint: Constraint) => void;
  onDelete: () => void;
}) {
  const kind = region.constraint.kind;
  const hasTarget =
    kind === "sum" ||
    kind === "product" ||
    kind === "greater" ||
    kind === "less";
  const hasMirrorGroup = kind === "mirror";
  const target = hasTarget
    ? (region.constraint as { target: number }).target
    : 0;
  const mirrorGroup = hasMirrorGroup
    ? (region.constraint as { group: string }).group
    : "n";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: region.color }}
          />
          <span className="text-sm font-medium">Region {region.id}</span>
          <span className="text-xs text-neutral-400">
            {region.cells.length} cells
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-6 px-2 text-xs text-red-500 hover:text-red-700"
        >
          Delete
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Constraint</Label>
        <Select
          value={kind}
          onValueChange={(value) => {
            const newKind = value as Constraint["kind"];
            switch (newKind) {
              case "sum":
                onConstraintChange({ kind: "sum", target: target || 10 });
                break;
              case "product":
                onConstraintChange({ kind: "product", target: target || 6 });
                break;
              case "greater":
                onConstraintChange({ kind: "greater", target: target || 3 });
                break;
              case "less":
                onConstraintChange({ kind: "less", target: target || 5 });
                break;
              case "equal":
                onConstraintChange({ kind: "equal" });
                break;
              case "not-equal":
                onConstraintChange({ kind: "not-equal" });
                break;
              case "mirror":
                onConstraintChange({
                  kind: "mirror",
                  group: mirrorGroup || "n",
                });
                break;
              case "none":
                onConstraintChange({ kind: "none" });
                break;
            }
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="sum">Sum</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="equal">Equal</SelectItem>
            <SelectItem value="not-equal">Not Equal</SelectItem>
            <SelectItem value="greater">Greater Than</SelectItem>
            <SelectItem value="less">Less Than</SelectItem>
            <SelectItem value="mirror">Mirror</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasTarget && (
        <div className="space-y-2">
          <Label className="text-xs">Target</Label>
          <Input
            type="number"
            value={target}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!Number.isFinite(val)) return;
              onConstraintChange({
                kind: kind as "sum" | "product" | "greater" | "less",
                target: val,
              });
            }}
            className="h-8"
          />
        </div>
      )}

      {hasMirrorGroup && (
        <div className="space-y-2">
          <Label className="text-xs">Mirror Group</Label>
          <Input
            type="text"
            value={mirrorGroup}
            onChange={(e) => {
              onConstraintChange({ kind: "mirror", group: e.target.value });
            }}
            className="h-8"
            placeholder="e.g. n"
          />
        </div>
      )}
    </div>
  );
}

function DominoEditPopup({
  domino,
  onUpdate,
  onDelete,
}: {
  domino: EditorDomino;
  onUpdate: (values: [Pip, Pip]) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: 28, height: 60 }}
        >
          <div style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>
            <Domino
              id="edit-preview"
              values={domino.values}
              orientation={90}
              noRotation
            />
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <PipButtons
            value={domino.values[0]}
            onChange={(p) => onUpdate([p, domino.values[1]])}
          />
          <PipButtons
            value={domino.values[1]}
            onChange={(p) => onUpdate([domino.values[0], p])}
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="gap-1 text-xs text-red-500 hover:text-red-700"
      >
        <Trash2 className="size-3" />
        Delete
      </Button>
    </div>
  );
}
