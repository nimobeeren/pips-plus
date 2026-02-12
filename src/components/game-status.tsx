import { useEffect, useState } from "react";

const DISMISS_DELAY_MS = 5_000;

interface GameStatusProps {
  status: "playing" | "solved" | "invalid";
  invalidCount: number;
}

export function GameStatus({ status, invalidCount }: GameStatusProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "invalid") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [status, invalidCount]);

  return (
    <div
      className="absolute inset-x-0 top-0 z-[100] bg-red-100 px-6 py-2 text-center font-medium text-red-800 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
      data-testid="error-message"
    >
      Not quite right. Check the highlighted regions.
    </div>
  );
}
