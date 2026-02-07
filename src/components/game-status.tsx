interface GameStatusProps {
  status: "playing" | "solved" | "invalid";
}

export function GameStatus({ status }: GameStatusProps) {
  return (
    <>
      {status === "solved" && (
        <div
          className="bg-green-100 px-6 py-2 text-center font-medium text-green-800"
          data-testid="success-message"
        >
          Puzzle solved! All constraints satisfied.
        </div>
      )}
      {status === "invalid" && (
        <div
          className="bg-red-100 px-6 py-2 text-center font-medium text-red-800"
          data-testid="error-message"
        >
          Not quite right. Check the highlighted regions.
        </div>
      )}
    </>
  );
}
