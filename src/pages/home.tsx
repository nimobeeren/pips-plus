import { Button } from "@/components/ui/button";
import { difficulties, puzzles, type Difficulty } from "@/puzzles";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";

export function HomePage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#a0d8a0] px-4">
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
            if (value) setDifficulty(value as Difficulty);
          }}
        >
          {difficulties.map((d) => (
            <ToggleGroupItem
              key={d}
              value={d}
              disabled={!(d in puzzles)}
              className="capitalize"
            >
              {d}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Play button */}
        <Button onClick={() => navigate(`/${difficulty}`)} size="lg">
          Play
        </Button>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-neutral-600 sm:mt-16">
        <p>Made with 🩵 by Nimo</p>
      </div>
    </div>
  );
}
