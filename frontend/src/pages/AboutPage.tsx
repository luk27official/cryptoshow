import "./AboutPage.css";

function AboutPage() {
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
        </div>
    );
}

export default AboutPage;
