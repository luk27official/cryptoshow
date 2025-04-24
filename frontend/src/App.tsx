import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useLayoutEffect, useRef } from "react";
import Visualization from "./pages/Visualization";
import HomePage from "./pages/HomePage";
import ErrorPage from "./pages/ErrorPage";
import AboutPage from "./pages/AboutPage";
import Header from "./components/Header";

function App() {
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = useState(0);

    useLayoutEffect(() => {
        const updateHeight = () => {
            if (headerRef.current) {
                setHeaderHeight(headerRef.current.offsetHeight);
            }
        };
        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        if (headerRef.current) {
            resizeObserver.observe(headerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    return (
        <Router>
            <div ref={headerRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99, width: "100%" }}>
                <Header />
            </div>
            <div style={{ paddingTop: `${headerHeight}px` }}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/viewer" element={<Visualization />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="*" element={<ErrorPage />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
