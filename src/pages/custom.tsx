import { Game } from "@/components/game";
import { Button } from "@/components/ui/button";
import { decodePuzzle } from "@/lib/puzzle-codec";
import type { Puzzle } from "@/types";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";

export function CustomPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const result = useMemo((): { puzzle: Puzzle } | { error: string } => {
    if (!code) {
      return { error: "No puzzle code provided." };
    }
    try {
      return { puzzle: decodePuzzle(code) };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Failed to decode puzzle.",
      };
    }
  }, [code]);

  if ("error" in result) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-neutral-50 px-4">
        <p className="text-lg text-red-600">{result.error}</p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
          <Button asChild>
            <Link to="/editor">Open Editor</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Game
      key={code}
      puzzle={result.puzzle}
      name={`custom:${code}`}
      backTo="/editor"
    />
  );
}
