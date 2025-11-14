import { useTheme } from "../hooks/useTheme";
import "./Header.css";

const Header = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="header" id="header">
            <div className="header-left">
                <a href="/" className="project-name">CryptoShow</a>
            </div>
            <div className="header-right">
                <button
                    onClick={toggleTheme}
                    className="theme-toggle"
                    aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                >
                    {theme === "light" ? "🌙" : "☀️"}
                </button>
                <a href="/api/docs" className="header-link">
                    API Docs
                </a>
                <a href="https://github.com/luk27official/cryptoshow" target="_blank" rel="noopener noreferrer" className="header-link">
                    GitHub
                </a>
                <a href="/about" className="header-link">
                    About
                </a>
            </div>
        </header>
    );
};

export default Header;
