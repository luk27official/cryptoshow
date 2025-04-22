import "./Header.css";

const Header = () => {
    return (
        <header className="header">
            <div className="header-left">
                <a href="/" className="project-name">CryptoShow</a>
            </div>
            <div className="header-right">
                <a href="https://github.com/luk27official/cryptoshow" target="_blank" rel="noopener noreferrer" className="header-link">
                    GitHub
                </a>
                <a href="/help" className="header-link">
                    Help
                </a>
            </div>
        </header>
    );
};

export default Header;
