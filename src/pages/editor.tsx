import { CodeEditorModal } from "@/components/code-editor-modal";
import { CELL_SIZE, Domino } from "@/components/domino";
import {
  EditorBoard,
  type EditorDomino,
  type EditorTool,
} from "@/components/editor-board";
import { PipDots } from "@/components/pip-dots";
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
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateDominoes } from "@/lib/design-solver";
import { encodePuzzle, getRegionColor } from "@/lib/puzzle-codec";
import {
  analyzePuzzle,
  validateConstraint,
  validateMirrorGroups,
  type AnalysisResult,
} from "@/solver";
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
  Braces,
  Check,
  ChevronLeft,
  Grid3x3,
  HelpCircle,
  Info,
  Link,
  Loader2,
  Pencil,
  RectangleHorizontal,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useReducer, useState } from "react";
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
  regionConstraintKind?: Constraint["kind"];
  regionConstraintTarget?: number;
  regionConstraintGroup?: string;
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
    regionConstraintKind: state.regionConstraintKind,
    regionConstraintTarget: state.regionConstraintTarget,
    regionConstraintGroup: state.regionConstraintGroup,
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
      regionConstraintKind: data.regionConstraintKind ?? "equal",
      regionConstraintTarget: data.regionConstraintTarget ?? 1,
      regionConstraintGroup: data.regionConstraintGroup ?? "n",
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
  regionConstraintKind: Constraint["kind"];
  regionConstraintTarget: number;
  regionConstraintGroup: string;
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
  | { type: "SET_REGION_CONSTRAINT_KIND"; kind: Constraint["kind"] }
  | { type: "SET_REGION_CONSTRAINT_TARGET"; target: number }
  | { type: "SET_REGION_CONSTRAINT_GROUP"; group: string }
  | {
      type: "SET_GENERATED";
      dominoes: DominoDef[];
      placements: DominoPlacement[];
    }
  | { type: "CHECK" }
  | {
      type: "LOAD_FROM_CODE";
      cells: [number, number][];
      regions: Region[];
      dominoes: EditorDomino[];
    }
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
      regionConstraintKind: "equal",
      regionConstraintTarget: 1,
      regionConstraintGroup: "n",
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

function defaultConstraint(
  kind: Constraint["kind"],
  target: number,
  group: string,
): Constraint {
  switch (kind) {
    case "sum":
      return { kind: "sum", target };
    case "product":
      return { kind: "product", target };
    case "greater":
      return { kind: "greater", target };
    case "less":
      return { kind: "less", target };
    case "mirror":
      return { kind: "mirror", group: group || "n" };
    case "equal":
      return { kind: "equal" };
    case "not-equal":
      return { kind: "not-equal" };
    case "none":
      return { kind: "none" };
  }
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

      const id = String(state.nextRegionIndex);
      const constraint = defaultConstraint(
        state.regionConstraintKind,
        state.regionConstraintTarget,
        state.regionConstraintGroup,
      );
      // Mirror regions with the same group letter share a color
      let color: string;
      if (constraint.kind === "mirror") {
        const sibling = state.regions.find(
          (r) =>
            r.constraint.kind === "mirror" &&
            r.constraint.group === constraint.group,
        );
        color = sibling ? sibling.color : getRegionColor(state.nextRegionIndex);
      } else {
        color = getRegionColor(state.nextRegionIndex);
      }
      const newRegion: Region = {
        id,
        cells: [[action.row, action.col]],
        constraint,
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
      let newRegions = state.regions.map((r) =>
        r.id === action.regionId ? { ...r, constraint: action.constraint } : r,
      );
      // Sync colors for mirror regions with the same group
      if (action.constraint.kind === "mirror") {
        const group = action.constraint.group;
        const sibling = newRegions.find(
          (r) =>
            r.id !== action.regionId &&
            r.constraint.kind === "mirror" &&
            r.constraint.group === group,
        );
        if (sibling) {
          newRegions = newRegions.map((r) =>
            r.id === action.regionId ? { ...r, color: sibling.color } : r,
          );
        }
      }
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

    case "SET_REGION_CONSTRAINT_KIND":
      return { ...state, regionConstraintKind: action.kind };

    case "SET_REGION_CONSTRAINT_TARGET":
      return { ...state, regionConstraintTarget: action.target };

    case "SET_REGION_CONSTRAINT_GROUP":
      return { ...state, regionConstraintGroup: action.group };

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

    case "LOAD_FROM_CODE": {
      const newCells = new Set<string>();
      for (const [r, c] of action.cells) {
        newCells.add(cellKey(r, c));
      }
      return {
        ...state,
        cells: newCells,
        regions: action.regions,
        dominoes: action.dominoes,
        checkState: "unchecked",
        checkValid: false,
        violatedRegions: [],
        nextRegionIndex: action.regions.length,
        nextDominoIndex: action.dominoes.length + 1,
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
        regionConstraintKind: "equal",
        regionConstraintTarget: 1,
        regionConstraintGroup: "n",
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
  const [codeEditorOpen, setCodeEditorOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [analyzing, setAnalyzing] = useState(false);

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
      dispatch({ type: "CREATE_REGION_AT", row, col });
    },
    [state.cells, state.regions],
  );

  const handleRegionExtend = useCallback((row: number, col: number) => {
    dispatch({ type: "EXTEND_REGION", row, col });
  }, []);

  const handleInteractionEnd = useCallback(() => {
    // no-op: region popup is no longer shown on creation
  }, []);

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

  // Disabled: can cause the page to hang on hard puzzles
  // useEffect(() => {
  //   if (!infoOpen) return;
  //   const puzzle = buildPuzzle();
  //   if (!puzzle || puzzle.dominoes.length === 0) {
  //     setAnalysisResult(null);
  //     return;
  //   }
  //   setAnalyzing(true);
  //   // Run in a microtask to keep UI responsive for the sheet animation
  //   const id = setTimeout(() => {
  //     const result = analyzePuzzle(puzzle, 10);
  //     setAnalysisResult(result);
  //     setAnalyzing(false);
  //   }, 50);
  //   return () => clearTimeout(id);
  // }, [infoOpen, buildPuzzle]);

  const buildEditorJson = useCallback((): string => {
    const cells: [number, number][] = [];
    for (const key of state.cells) {
      const [r, c] = key.split(",").map(Number);
      cells.push([r, c]);
    }
    const data = {
      cells,
      regions: state.regions,
      dominoes: state.dominoes.map((d) => ({
        id: d.id,
        values: d.values,
        row: d.row,
        col: d.col,
        orientation: d.orientation,
      })),
    };
    return JSON.stringify(data, null, 2);
  }, [state.cells, state.regions, state.dominoes]);

  const codeEditorJson = buildEditorJson();

  const validatePuzzleJson = useCallback((json: string): string | null => {
    try {
      const parsed = JSON.parse(json);

      if (!parsed || typeof parsed !== "object") {
        return "Expected a JSON object";
      }

      // Validate cells
      if (!Array.isArray(parsed.cells)) {
        return "Missing or invalid 'cells' array";
      }
      for (let i = 0; i < parsed.cells.length; i++) {
        const c = parsed.cells[i];
        if (
          !Array.isArray(c) ||
          c.length !== 2 ||
          typeof c[0] !== "number" ||
          typeof c[1] !== "number"
        ) {
          return `Invalid cell at index ${i}: expected [row, col]`;
        }
      }

      // Validate regions
      if (!Array.isArray(parsed.regions)) {
        return "Missing or invalid 'regions' array";
      }
      for (let i = 0; i < parsed.regions.length; i++) {
        const r = parsed.regions[i];
        if (!r || typeof r !== "object") {
          return `Invalid region at index ${i}`;
        }
        if (!Array.isArray(r.cells)) {
          return `Region ${i}: missing 'cells' array`;
        }
        if (!r.constraint || typeof r.constraint !== "object") {
          return `Region ${i}: missing 'constraint'`;
        }
        const validKinds = [
          "sum",
          "product",
          "equal",
          "not-equal",
          "greater",
          "less",
          "mirror",
          "none",
        ];
        if (!validKinds.includes(r.constraint.kind)) {
          return `Region ${i}: invalid constraint kind '${r.constraint.kind}'`;
        }
      }

      // Validate dominoes
      if (!Array.isArray(parsed.dominoes)) {
        return "Missing or invalid 'dominoes' array";
      }
      for (let i = 0; i < parsed.dominoes.length; i++) {
        const d = parsed.dominoes[i];
        if (!d || typeof d !== "object") {
          return `Invalid domino at index ${i}`;
        }
        if (!Array.isArray(d.values) || d.values.length !== 2) {
          return `Domino ${i}: 'values' must be [pip, pip]`;
        }
        for (const v of d.values) {
          if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 6) {
            return `Domino ${i}: pip values must be integers 0-6`;
          }
        }
        if (typeof d.row !== "number" || typeof d.col !== "number") {
          return `Domino ${i}: missing 'row' or 'col'`;
        }
        if (d.orientation !== 0 && d.orientation !== 90) {
          return `Domino ${i}: 'orientation' must be 0 or 90`;
        }
      }

      return null;
    } catch {
      return "Invalid JSON";
    }
  }, []);

  const handleCodeEditorChange = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      const cells: [number, number][] = parsed.cells;
      const regions: Region[] = parsed.regions.map(
        (r: Record<string, unknown>, i: number) => ({
          id: (r.id as string) || String(i),
          cells: r.cells,
          constraint: r.constraint,
          color: (r.color as string) || getRegionColor(i),
        }),
      );
      const dominoes: EditorDomino[] = parsed.dominoes.map(
        (d: Record<string, unknown>, i: number) => ({
          id: (d.id as string) || `d${String(i + 1).padStart(2, "0")}`,
          values: d.values as [Pip, Pip],
          row: d.row as number,
          col: d.col as number,
          orientation: d.orientation as 0 | 90,
        }),
      );
      dispatch({ type: "LOAD_FROM_CODE", cells, regions, dominoes });
    } catch {
      // validation should have caught this
    }
  }, []);

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
                onClick={() => setCodeEditorOpen(true)}
              >
                <Braces className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Code editor</TooltipContent>
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
                variant="outline"
                size="icon"
                onClick={() => setInfoOpen(true)}
              >
                <Info className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Puzzle info</TooltipContent>
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
              {state.activeTool === "region" && (
                <ConstraintKindSelector
                  kind={state.regionConstraintKind}
                  target={state.regionConstraintTarget}
                  group={state.regionConstraintGroup}
                  onKindChange={(kind) =>
                    dispatch({ type: "SET_REGION_CONSTRAINT_KIND", kind })
                  }
                  onTargetChange={(target) =>
                    dispatch({ type: "SET_REGION_CONSTRAINT_TARGET", target })
                  }
                  onGroupChange={(group) =>
                    dispatch({ type: "SET_REGION_CONSTRAINT_GROUP", group })
                  }
                />
              )}
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

      <CodeEditorModal
        open={codeEditorOpen}
        onOpenChange={setCodeEditorOpen}
        initialJson={codeEditorJson}
        onJsonChange={handleCodeEditorChange}
        validate={validatePuzzleJson}
      />

      <PuzzleInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        cells={state.cells}
        regions={state.regions}
        dominoes={state.dominoes}
        analysisResult={analysisResult}
        analyzing={analyzing}
      />
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

const CONSTRAINT_KIND_OPTIONS: {
  value: Constraint["kind"];
  label: string;
  shortLabel: string;
  hasTarget?: boolean;
  hasGroup?: boolean;
}[] = [
  { value: "sum", label: "Sum", shortLabel: "Σ", hasTarget: true },
  { value: "product", label: "Product", shortLabel: "Π", hasTarget: true },
  { value: "equal", label: "Equal", shortLabel: "=" },
  { value: "not-equal", label: "Not Equal", shortLabel: "≠" },
  { value: "greater", label: "Greater Than", shortLabel: ">", hasTarget: true },
  { value: "less", label: "Less Than", shortLabel: "<", hasTarget: true },
  { value: "mirror", label: "Mirror", shortLabel: "⇔", hasGroup: true },
];

function ConstraintKindSelector({
  kind,
  target,
  group,
  onKindChange,
  onTargetChange,
  onGroupChange,
}: {
  kind: Constraint["kind"];
  target: number;
  group: string;
  onKindChange: (kind: Constraint["kind"]) => void;
  onTargetChange: (target: number) => void;
  onGroupChange: (group: string) => void;
}) {
  const activeOption = CONSTRAINT_KIND_OPTIONS.find((o) => o.value === kind);
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-wrap gap-0.5">
        {CONSTRAINT_KIND_OPTIONS.map((opt) => (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <Button
                variant={kind === opt.value ? "default" : "outline"}
                size="sm"
                className="h-7 w-7 px-0 text-xs"
                onClick={() => onKindChange(opt.value)}
              >
                {opt.shortLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{opt.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {activeOption?.hasTarget && (
        <Input
          type="number"
          value={target}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (Number.isFinite(val)) onTargetChange(val);
          }}
          className="h-7 w-16 text-xs"
          min={0}
        />
      )}
      {activeOption?.hasGroup && (
        <Input
          type="text"
          value={group}
          maxLength={1}
          onChange={(e) => {
            const val = e.target.value.slice(0, 1);
            onGroupChange(val);
          }}
          className="h-7 w-10 text-center text-xs"
          placeholder="n"
        />
      )}
    </div>
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
          <span className="text-sm font-medium">Region</span>
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

function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="ml-1 inline-flex items-center text-neutral-400 hover:text-neutral-600">
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-64 text-xs text-neutral-600">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function getDifficultyLabel(
  result: AnalysisResult,
  dominoCount: number,
): { label: string; color: string; tooltip?: string } {
  if (!result.solvable) {
    return {
      label: "Unsolvable",
      color: "text-red-600",
      tooltip:
        "No valid way to place all dominoes on the grid while satisfying every region constraint. Try loosening a constraint or changing the domino set.",
    };
  }

  // Scale by puzzle size: normalize nodes per domino
  const nodesPerDomino = result.nodesExplored / Math.max(dominoCount, 1);

  if (nodesPerDomino < 50) return { label: "Easy", color: "text-green-600" };
  if (nodesPerDomino < 500)
    return { label: "Medium", color: "text-yellow-600" };
  if (nodesPerDomino < 2000) return { label: "Hard", color: "text-orange-600" };
  if (nodesPerDomino < 10000)
    return { label: "Very Hard", color: "text-red-500" };
  return { label: "Extreme", color: "text-red-700" };
}

function PuzzleInfoSheet({
  open,
  onOpenChange,
  cells,
  regions,
  dominoes,
  analysisResult,
  analyzing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cells: Set<string>;
  regions: Region[];
  dominoes: EditorDomino[];
  analysisResult: AnalysisResult | null;
  analyzing: boolean;
}) {
  const cellCount = cells.size;
  const dominoCount = dominoes.length;
  const regionCount = regions.length;
  // Constraint type breakdown
  const constraintCounts = new Map<string, number>();
  for (const r of regions) {
    const kind = r.constraint.kind;
    constraintCounts.set(kind, (constraintCounts.get(kind) ?? 0) + 1);
  }

  // Cross-region domino count
  const regionMap = new Map<string, string>();
  for (const r of regions) {
    for (const [row, col] of r.cells) {
      regionMap.set(cellKey(row, col), r.id);
    }
  }
  let crossRegionCount = 0;
  for (const d of dominoes) {
    const covered = getCoveredCells(d.row, d.col, d.orientation, d.values);
    const r0 = regionMap.get(cellKey(covered[0].cell[0], covered[0].cell[1]));
    const r1 = regionMap.get(cellKey(covered[1].cell[0], covered[1].cell[1]));
    if (r0 && r1 && r0 !== r1) crossRegionCount++;
  }

  // Pip value distribution
  const pipCounts = new Array(7).fill(0) as number[];
  for (const d of dominoes) {
    pipCounts[d.values[0]]++;
    pipCounts[d.values[1]]++;
  }

  // Duplicate domino types
  const typeCounts = new Map<string, number>();
  for (const d of dominoes) {
    const key =
      d.values[0] <= d.values[1]
        ? `${d.values[0]}|${d.values[1]}`
        : `${d.values[1]}|${d.values[0]}`;
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  }
  const duplicateTypes = [...typeCounts.entries()].filter(([, c]) => c > 1);

  const constraintLabels: Record<string, string> = {
    sum: "Sum",
    product: "Product",
    equal: "Equal",
    "not-equal": "Not Equal",
    greater: "Greater",
    less: "Less",
    mirror: "Mirror",
    none: "None",
  };

  const difficulty = analysisResult
    ? getDifficultyLabel(analysisResult, dominoCount)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Puzzle Info</SheetTitle>
          <SheetDescription>Metrics and difficulty analysis</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {/* Structure */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Structure
            </h3>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                    Cells
                  </td>
                  <td className="py-0.5 text-right font-medium">{cellCount}</td>
                </tr>
                <tr>
                  <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                    Dominoes
                  </td>
                  <td className="py-0.5 text-right font-medium">
                    {dominoCount}
                  </td>
                </tr>
                <tr>
                  <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                    Regions
                  </td>
                  <td className="py-0.5 text-right font-medium">
                    {regionCount}
                  </td>
                </tr>
                <tr>
                  <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                    Cross-region dominoes
                    <InfoTooltip>
                      Dominoes that span two different regions. More
                      cross-region dominoes means tighter coupling between
                      constraints, which generally makes the puzzle harder.
                    </InfoTooltip>
                  </td>
                  <td className="py-0.5 text-right font-medium">
                    {dominoCount > 0
                      ? `${crossRegionCount} / ${dominoCount}`
                      : "\u2014"}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Constraints */}
          {regionCount > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Constraints
              </h3>
              <table className="text-sm">
                <tbody>
                  {[...constraintCounts.entries()].map(([kind, count]) => (
                    <tr key={kind}>
                      <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                        {constraintLabels[kind] ?? kind}
                      </td>
                      <td className="py-0.5 text-right font-medium">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Pip distribution */}
          {dominoCount > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Pip Distribution
              </h3>
              <div className="flex gap-2">
                {pipCounts.map((count, pip) => (
                  <div key={pip} className="flex flex-col items-center gap-1">
                    <div
                      className={`flex items-center justify-center rounded border ${
                        count > 0
                          ? "border-neutral-300 bg-white"
                          : "border-neutral-200 bg-neutral-50 opacity-40"
                      }`}
                      style={{ width: 32, height: 32 }}
                    >
                      <div
                        style={{ width: 22, height: 22 }}
                        className="relative"
                      >
                        <PipDots value={pip as Pip} size={22} />
                      </div>
                    </div>
                    <span className="text-xs tabular-nums text-neutral-600">
                      &times;{count}
                    </span>
                  </div>
                ))}
              </div>
              {duplicateTypes.length > 0 && (
                <p className="mt-2 text-xs text-neutral-500">
                  Duplicate types:{" "}
                  {duplicateTypes
                    .map(([type, count]) => `${type} (\u00d7${count})`)
                    .join(", ")}
                </p>
              )}
            </section>
          )}

          {/* Difficulty analysis - disabled: can cause the page to hang on hard puzzles */}
          {/* <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Difficulty
            </h3>
            {analyzing ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                Analyzing...
              </div>
            ) : analysisResult ? (
              <>
                <table className="text-sm">
                  <tbody>
                    <tr>
                      <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                        Number of solutions
                      </td>
                      <td className="py-0.5 text-right font-medium">
                        {analysisResult.solutionCount === 0
                          ? "0"
                          : analysisResult.solutionCount >= 10
                            ? "10+"
                            : analysisResult.solutionCount}
                        {analysisResult.solutionCount === 1 && " (unique)"}
                      </td>
                    </tr>
                    <tr>
                      <td className="flex items-center py-0.5 pr-6 text-neutral-500">
                        Search depth
                        <InfoTooltip>
                          Total placement attempts the solver explored before
                          exhausting all possibilities. Higher means the puzzle
                          resists shortcuts and requires exploring more dead
                          ends.
                        </InfoTooltip>
                      </td>
                      <td className="py-0.5 text-right font-medium">
                        {analysisResult.nodesExplored.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="flex items-center py-0.5 pr-6 font-semibold text-neutral-500">
                        Level
                        {difficulty?.tooltip && (
                          <InfoTooltip>{difficulty.tooltip}</InfoTooltip>
                        )}
                      </td>
                      <td className="py-0.5 text-right font-medium">
                        <span className={`font-semibold ${difficulty?.color}`}>
                          {difficulty?.label}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-sm text-neutral-400">
                {dominoCount === 0
                  ? "Add dominoes to analyze difficulty."
                  : cellCount !== dominoCount * 2
                    ? `Cell/domino mismatch: ${cellCount} cells, ${dominoCount * 2} domino halves.`
                    : "No analysis available."}
              </p>
            )}
          </section> */}
        </div>
      </SheetContent>
    </Sheet>
  );
}
