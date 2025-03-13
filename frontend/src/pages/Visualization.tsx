import { Link } from "react-router-dom";
import "./Visualization.css";

function Visualization() {
    return (
        <div>
            <div>
                <h2>3D Structure Viewer</h2>
            </div>
            <div>
                <nav>
                    <ul className="navigation">
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/viewer">3D Viewer</Link></li>
                    </ul>
                </nav>
            </div>
            <div className="viewer-container">
                <p>3D molecule viewer will be integrated here.</p>
            </div>
        </div>
    );
}

export default Visualization;
