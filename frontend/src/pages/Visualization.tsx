import { getApiUrl } from "../utils";
import { useEffect, useState } from "react";
import { loadPockets, initializePlugin, loadStructure, showOnePolymerRepresentation, showOnePocketRepresentation } from "../components/MolstarComponent";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { PluginProvider } from "../providers/PluginProvider";
import { AppProvider } from "../providers/AppProvider";
import { useAppContext } from "../hooks";

import "./Visualization.css";
import ResultTable from "../components/ResultTable";
import MolstarControls from "../components/MolstarControls";

function VisualizationContent() {
    const {
        setLoadedStructures,
        selectedPolymerRepresentation,
        selectedPocketRepresentation,
        cryptoBenchResult,
        setCryptoBenchResult
    } = useAppContext();

    const [plugin, setPlugin] = useState<PluginUIContext | null>(null);
    const [taskFetchError, setTaskFetchError] = useState<string | null>(null);

    // get taskId from URL (viewer?id=taskId)
    const taskId = new URLSearchParams(window.location.search).get("id");

    useEffect(() => {
        if (!taskId) {
            return;
        }
        setCryptoBenchResult(null);
        setTaskFetchError(null);
        setLoadedStructures([]);

        let cancelled = false;

        const fetchData = async () => {
            if (cancelled) {
                return;
            }

            try {
                const response = await fetch(getApiUrl(`/task-status/${taskId}`));
                const data = await response.json();
                if (!response.ok || data.status === "FAILURE") {
                    setTaskFetchError(data.error || "Task not found.");
                    return;
                }

                if (data["result"]) {
                    setCryptoBenchResult(data["result"]);
                } else {
                    setTimeout(() => fetchData(), 3000);
                }
            } catch (error) {
                console.error("Error fetching task status:", error);
                setTaskFetchError("Failed to fetch task status.");
                if (!cancelled) {
                    setTimeout(() => fetchData(), 3000);
                }
            }
        };
        fetchData();

        return () => {
            cancelled = true;
        };
    }, [taskId, setCryptoBenchResult, setLoadedStructures]);

    useEffect(() => {
        if (cryptoBenchResult && !plugin) {
            const initPlugin = async () => {
                const pluginInstance = await initializePlugin();
                setPlugin(pluginInstance);
                const loaded = await loadStructure(pluginInstance, getApiUrl(`/file/${cryptoBenchResult!.file_hash}/${cryptoBenchResult!.input_structure}`), undefined, undefined, cryptoBenchResult);
                setLoadedStructures(prevStructures => [...prevStructures, loaded]);
                showOnePolymerRepresentation(pluginInstance, loaded, selectedPolymerRepresentation);
                const pocketReprs = await loadPockets(pluginInstance, loaded.structure, cryptoBenchResult!, null);
                loaded.pocketRepresentations = pocketReprs;
                showOnePocketRepresentation(pluginInstance, loaded, selectedPocketRepresentation);
            };
            initPlugin();
        }
    }, [cryptoBenchResult, plugin, selectedPolymerRepresentation, selectedPocketRepresentation, setLoadedStructures]);

    if (!taskId) {
        return (
            <div>
                <h2>3D Structure Viewer</h2>
                <p>Task ID not found in URL.</p>
            </div>
        );
    }

    if (taskFetchError) {
        return (
            <div>
                <h2>3D Structure Viewer</h2>
                <p>{taskFetchError}</p>
                <p>Click here to reset the page: <a href={`/viewer?id=${taskId}`}>Reset</a></p>
            </div>
        );
    }

    if (!cryptoBenchResult) {
        return (
            <div>
                <h2>3D Structure Viewer</h2>
                <p>Fetching task...</p>
                <p>Click here to reset the page: <a href={`/viewer?id=${taskId}`}>Reset</a></p>
                <p>If this takes too long, either the computation is still in progress or you may have made a typo in the task id.</p>
            </div>
        );
    }

    return (
        <div>
            <h2>3D Structure Viewer: {cryptoBenchResult.structure_name}</h2>
            <div className="viewer-container">
                <div className="left">
                    <div className="viewer-3d" id="molstar-component"></div>
                    {plugin && <PluginProvider plugin={plugin}>
                        <MolstarControls />
                    </PluginProvider>}
                </div>
                <div className="right">
                    {cryptoBenchResult && plugin && (
                        <PluginProvider plugin={plugin}>
                            <ResultTable />
                        </PluginProvider>
                    )}
                </div>
            </div>
        </div>
    );
}


function Visualization() {
    return (
        <AppProvider>
            <VisualizationContent />
        </AppProvider>
    );
}

export default Visualization;
