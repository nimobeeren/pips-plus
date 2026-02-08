import { puzzles } from "@/puzzles";
import { Navigate, useParams } from "react-router";
import { Game } from "../components/game";

export function GamePage() {
  const { slug } = useParams<{ slug: string }>();
  const puzzle = slug ? puzzles[slug] : undefined;

  if (!puzzle) {
    return <Navigate to="/" replace />;
  }

  return <Game key={slug} puzzle={puzzle} backTo="/" />;
}
