import { BrowserRouter, Route, Routes } from "react-router";
import { GamePage } from "./pages/game";
import { HomePage } from "./pages/home";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/:slug"
          element={
            <div className="min-h-svh bg-neutral-50">
              <GamePage />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
