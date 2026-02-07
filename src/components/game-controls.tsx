import { Button } from "@/components/ui/button";

interface GameControlsProps {
  onSolve: () => void;
  onClear: () => void;
}

export function GameControls({ onSolve, onClear }: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-neutral-200 p-3">
      <Button
        onClick={onSolve}
        variant="outline"
        size="sm"
        data-testid="solve-button"
      >
        Show Solution
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="sm"
        data-testid="clear-button"
      >
        Clear
      </Button>
    </div>
  );
}
