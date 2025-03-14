import { Link } from "react-router-dom";
import "./Visualization.css";
import { getApiUrl } from "../utils";
import { useEffect, useState } from "react";
import { CryptoBenchResult } from "../types";

function Visualization() {
    const [result, setResult] = useState<CryptoBenchResult | null>(null);

    // get taskId from URL (viewer?id=taskId)
    const taskId = new URLSearchParams(window.location.search).get("id");

    useEffect(() => {
        if (!taskId) {
            return;
        }

        const fetchData = async () => {
            try {
                const response = await fetch(getApiUrl(`/task-status/${taskId}`));
                const data = await response.json();
                setResult(data["result"]);
            } catch (error) {
                console.error("Error fetching task status:", error);
                setTimeout(() => fetchData(), 1000);
            }
        };

        fetchData();
    }, [taskId]);

    if (!taskId) {
        return (
            <div>
                <h2>3D Structure Viewer</h2>
                <p>Task ID not found in URL.</p>
            </div>
        );
    }

    if (!result) {
        return (
            <div>
                <h2>3D Structure Viewer</h2>
                <p>Fetching task...</p>
                <p>Click here to reset the page: <a href={`/viewer?id=${taskId}`}>Reset</a></p>
            </div >
        );
    }

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
                <div className="viewer-3d" id="viewer-3d">
                    <p>AAA</p>
                </div>
                <div className="results-table">
                    <p>Task ID: {taskId}</p>
                    <p>Status: {result["status"]}</p>
                    <ul>
                        {result["prediction"].map((value: number, index: number) => (
                            <li key={index}>
                                {result["residue_ids"][index]}, {value.toFixed(5)}, {result["pockets"][index]}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Visualization;
