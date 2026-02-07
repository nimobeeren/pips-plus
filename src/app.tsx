import { Game } from "@/components/game";
import { starterPuzzle } from "@/puzzles";

function App() {
  return (
    <div className="min-h-svh bg-neutral-50">
      <Game puzzle={starterPuzzle} />
    </div>
  );
}

export default App;
