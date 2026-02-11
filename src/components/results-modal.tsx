import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isPuzzleSolved, type PuzzleResult } from "@/lib/game-storage";
import { difficulties, puzzles } from "@/puzzles";
import { useNavigate } from "react-router";

interface ResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: PuzzleResult;
  puzzleName: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function ResultsModal({
  open,
  onOpenChange,
  result,
  puzzleName,
}: ResultsModalProps) {
  const navigate = useNavigate();

  const existingPuzzles = difficulties.filter((d) => d in puzzles);
  const allPuzzlesSolved = existingPuzzles.every((d) => isPuzzleSolved(d));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader className="items-center">
          <DialogTitle className="text-2xl">Congrats!</DialogTitle>
          <DialogDescription>
            You finished{" "}
            {puzzleName.startsWith("custom:")
              ? "a custom"
              : `the ${puzzleName}`}{" "}
            puzzle in {formatTime(result.solveTimeMs)}.
          </DialogDescription>
        </DialogHeader>
        {allPuzzlesSolved && !puzzleName.startsWith("custom:") && (
          <p className="text-sm text-neutral-600">
            You&apos;ve completed all puzzles! The Puzzle Editor is now
            unlocked.
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:justify-center">
          <div className="flex flex-col gap-2">
            {allPuzzlesSolved && !puzzleName.startsWith("custom:") && (
              <Button variant="outline" onClick={() => navigate("/editor")}>
                Open Puzzle Editor
              </Button>
            )}
            <Button onClick={() => navigate("/")}>
              {allPuzzlesSolved ? "Back to Home" : "Solve Another Puzzle"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
