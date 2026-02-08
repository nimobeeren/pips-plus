import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";

interface GameControlsProps {
  onSolve: () => void;
  onClear: () => void;
  backTo?: string;
  solved?: boolean;
  onViewResults?: () => void;
}

export function GameControls({
  onSolve,
  onClear,
  backTo,
  solved,
  onViewResults,
}: GameControlsProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 p-3">
      {backTo && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(backTo)}
          className="mr-auto"
        >
          <ChevronLeft className="size-5" />
        </Button>
      )}
      {solved && onViewResults && (
        <Button onClick={onViewResults} variant="outline" size="sm">
          View Results
        </Button>
      )}
      {!solved && (
        <Button
          onClick={onSolve}
          variant="outline"
          size="sm"
          data-testid="solve-button"
        >
          Show Solution
        </Button>
      )}
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
