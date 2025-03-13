import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Visualization from "./pages/Visualization";
import HomePage from "./pages/HomePage";
import ErrorPage from "./pages/ErrorPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/viewer" element={<Visualization />} />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
