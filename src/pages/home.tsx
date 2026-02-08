import { Button } from "@/components/ui/button";
import { isPuzzleSolved } from "@/lib/game-storage";
import { difficulties, puzzles, type Difficulty } from "@/puzzles";
import { Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";

export function HomePage() {
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = localStorage.getItem("difficulty");
    if (saved && difficulties.includes(saved as Difficulty)) {
      return saved as Difficulty;
    }
    return "easy";
  });
  const navigate = useNavigate();

  // Counter to force re-evaluation of solved state after reset
  const [resetKey, setResetKey] = useState(0);
  void resetKey;

  const isSolved = difficulty in puzzles && isPuzzleSolved(difficulty);

  const handleReset = useCallback(() => {
    localStorage.clear();
    setDifficulty("easy");
    setResetKey((k) => k + 1);
  }, []);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#a0d8a0] px-4">
      <div className="flex flex-col items-center gap-6">
        {/* Title */}
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Pips+
        </h1>

        {/* Subtitle */}
        <p className="text-center text-lg sm:text-xl max-w-50">
          Because regular pips was too easy.
        </p>

        {/* Difficulty selector */}
        <ToggleGroup
          type="single"
          variant="outline"
          value={difficulty}
          size="lg"
          onValueChange={(value) => {
            if (value) {
              setDifficulty(value as Difficulty);
              localStorage.setItem("difficulty", value);
            }
          }}
        >
          {difficulties.map((d) => {
            const solved = d in puzzles && isPuzzleSolved(d);
            return (
              <ToggleGroupItem
                key={d}
                value={d}
                disabled={!(d in puzzles)}
                className="capitalize px-6 gap-1"
              >
                {solved && <Check className="size-4" />}
                {d}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        {/* Play button */}
        <Button onClick={() => navigate(`/${difficulty}`)} size="lg">
          {isSolved ? "Admire Puzzle" : "Play"}
        </Button>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-neutral-600 sm:mt-16">
        <p>Made with 🩵 by Nimo</p>
      </div>

      <button
        onClick={handleReset}
        className="absolute bottom-6 text-xs text-neutral-600 underline-offset-2 hover:underline hover:text-neutral-800"
      >
        Reset everything
      </button>
    </div>
  );
}
