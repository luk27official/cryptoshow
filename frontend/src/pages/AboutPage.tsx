import "./AboutPage.css";

function AboutPage() {
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

    return (
        <div className="about-container">
            <h2>About CryptoShow</h2>
            <p>
                CryptoShow is a web application designed to visualize cryptic pockets in protein structures.
            </p>
            <p>
                It utilizes CryptoBench with ESM-2 embeddings for a residue-level prediction. This prediction is then
                clustered into pockets.
            </p>
            <p>
                For more details, check out the <a href="https://github.com/luk27official/cryptoshow" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
            </p>
            <p>
                Contact us at <i>admin [at] lukaspolak.cz</i>
            </p>
            <div className="logo-container">
                <a href="https://www.elixir-czech.cz/services" target="_blank" rel="noopener noreferrer">
                    <img src={isDarkMode ? "/elixir-czech-dark.svg" : "/elixir-czech.svg"} alt="ELIXIR CZ Logo" className="elixir-logo" width="120rem" height="96rem" />
                </a>
            </div>
            <p>
                Part of this work was carried out with the support of <a href="https://www.elixir-czech.cz/services" target="_blank" rel="noopener noreferrer">ELIXIR CZ</a> Research Infrastructure (ID LM2023055, MEYS CR).
            </p>
        </div>
    );
}

export default AboutPage;
