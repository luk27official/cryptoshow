import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Visualization from "./pages/Visualization";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/viewer" element={<Visualization />} />
      </Routes>
    </Router>
  );
}

export default App;
