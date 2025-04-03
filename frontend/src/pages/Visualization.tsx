import { Link } from "react-router-dom";
import { getApiUrl } from "../utils";
import { useEffect, useState } from "react";
import { CryptoBenchResult, LoadedStructure, PolymerRepresentationType, PocketRepresentationType, PolymerRepresentationValues, PocketRepresentationValues } from "../types";
import { loadPockets, initializePlugin, loadStructure, showOnePolymerRepresentation } from "../components/MolstarComponent";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { PluginProvider } from "../providers/PluginProvider";

import "./Visualization.css";
import ResultTable from "../components/ResultTable";
import MolstarControls from "../components/MolstarControls";

function Visualization() {
    const [result, setResult] = useState<CryptoBenchResult | null>(null);
    const [plugin, setPlugin] = useState<PluginUIContext | null>(null);
    const [loadedStructures, setLoadedStructures] = useState<LoadedStructure[]>([]);
    const [selectedPolymerRepresentation, setSelectedPolymerRepresentation] = useState<PolymerRepresentationType>(PolymerRepresentationValues.Cartoon);
    const [selectedPocketRepresentation, setSelectedPocketRepresentation] = useState<PocketRepresentationType>(PocketRepresentationValues.Cartoon);

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
                const loaded = await loadStructure(pluginInstance, getApiUrl(`/file/${result.file_hash}/${result.input_structure}`));
                setLoadedStructures(prevStructures => [...prevStructures, loaded]);
                showOnePolymerRepresentation(pluginInstance, loaded, selectedPolymerRepresentation);
                const pocketReprs = await loadPockets(pluginInstance, loaded.structure, result);
                loaded.pocketRepresentations = pocketReprs;
            };

            initPlugin();
        }
    }, [result, plugin, selectedPolymerRepresentation]);

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
                <div className="left">
                    <div className="viewer-3d" id="molstar-component"></div>
                    {plugin && <PluginProvider plugin={plugin}>
                        <MolstarControls
                            loadedStructures={loadedStructures}
                            selectedPolymerRepresentation={selectedPolymerRepresentation}
                            setSelectedPolymerRepresentation={setSelectedPolymerRepresentation}
                            selectedPocketRepresentation={selectedPocketRepresentation}
                            setSelectedPocketRepresentation={setSelectedPocketRepresentation}
                        />
                    </PluginProvider>}
                </div>
                <div className="right">
                    {result && plugin && (
                        <PluginProvider plugin={plugin}>
                            <ResultTable
                                taskId={taskId}
                                pockets={result.pockets}
                                structureId={result.structure_name}
                                taskHash={result.file_hash}
                                setLoadedStructures={setLoadedStructures}
                                selectedPolymerRepresentation={selectedPolymerRepresentation}
                            />
                        </PluginProvider>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Visualization;
