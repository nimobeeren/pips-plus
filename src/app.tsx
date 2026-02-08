import { BrowserRouter, Route, Routes } from "react-router";
import { CustomPage } from "./pages/custom";
import { EditorPage } from "./pages/editor";
import { GamePage } from "./pages/game";
import { HomePage } from "./pages/home";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route
          path="/custom"
          element={
            <div className="min-h-svh bg-neutral-50">
              <CustomPage />
            </div>
          }
        />
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
