import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PuzzleResult } from "@/lib/game-storage";
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
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => navigate("/")}>Solve Another Puzzle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
