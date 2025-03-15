import { Link } from "react-router-dom";
import "./Visualization.css";
import { getApiUrl, getColorString } from "../utils";
import { useEffect, useState } from "react";
import { CryptoBenchResult, Pocket } from "../types";
import { loadPockets, initializePlugin, loadStructure } from "../components/MolstarComponent";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";

function Visualization() {
    const [result, setResult] = useState<CryptoBenchResult | null>(null);
    const [plugin, setPlugin] = useState<PluginUIContext | null>(null);

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

    useEffect(() => {
        if (result && !plugin) {
            const initPlugin = async () => {
                const pluginInstance = await initializePlugin();
                setPlugin(pluginInstance);
                // TODO: save s
                const s = await loadStructure(pluginInstance, getApiUrl(`/file/${result.task_id}/${result.input_structure}`));
                loadPockets(pluginInstance, s, result.pockets);
            };

            initPlugin();
        }
    }, [result, plugin]);

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
            </div>
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
                <div className="viewer-3d" id="molstar-component"></div>
                <div className="results-table">
                    <p>Task ID: {taskId}</p>
                    <ul>
                        {result.pockets.map((pocket: Pocket, index: number) => {
                            const predictionString = pocket.prediction.map((e) => e.toFixed(3)).join(",");
                            const residueIds = pocket.residue_ids.join(",");
                            const displayString = `${pocket.pocket_id} - ${predictionString} - ${pocket.average_prediction.toFixed(3)} | IDs: ${residueIds}`;

                            return (
                                <li key={index} className="pocket-item">
                                    <span className="pocket-text" style={{
                                        wordBreak: "break-word",
                                        overflowWrap: "break-word",
                                        display: "inline-block",
                                        maxWidth: "100%",
                                        color: getColorString(pocket.pocket_id)
                                    }}>{displayString}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Visualization;
