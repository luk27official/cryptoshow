import React, { useState } from "react";
import { Pocket, AHoJResponse, AHoJStructure, TrajectoryTaskResult, LoadedStructure } from "../types";
import { getApiUrl } from "../utils";
import { usePlugin } from "../hooks/usePlugin";
import { useAppContext } from "../hooks/useApp";
import { loadStructure, playAnimation, removeFromStateTree, resetCamera, setStructureTransparency, showOnePolymerRepresentation } from "./MolstarComponent";
import "./AHoJResults.css";

interface AHoJResultsProps {
    pocket: Pocket;
    ahoJJobResult: AHoJResponse;
}

const AHoJResults = ({ ahoJJobResult }: AHoJResultsProps) => {
    const plugin = usePlugin();
    const {
        loadedStructures,
        setLoadedStructures,
        selectedPolymerRepresentation,
        cryptoBenchResult
    } = useAppContext();
    const [loadingStructure, setLoadingStructure] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(10);

    const apoStructures = ahoJJobResult.queries[0]?.found_apo.map(s => ({ ...s, type: "APO" })) || [];
    const holoStructures = ahoJJobResult.queries[0]?.found_holo.map(s => ({ ...s, type: "HOLO" })) || [];
    const alphaFoldStructures = ahoJJobResult.queries[0]?.found_alphafold.map(s => ({ ...s, type: "AlphaFold" })) || [];
    const allStructures = [...holoStructures, ...apoStructures, ...alphaFoldStructures];

    const showMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const visibleStructures = allStructures.slice(0, visibleCount);
    const hasMore = visibleCount < allStructures.length;

    const handlePlayAnimation = async (structure: AHoJStructure & { type: string; }) => {
        if (loadingStructure) return;
        setLoadingStructure(structure.structure_file);

        try {
            await fetch(getApiUrl(`/proxy/ahoj/${cryptoBenchResult!.file_hash}/${structure.structure_file_url}`));

            const res = await fetch(getApiUrl(`/animate/${cryptoBenchResult!.file_hash}/${structure.structure_file}/${structure.target_chains.join(",")}`));
            if (!res.ok) throw new Error(`Failed to start animation task: ${res.statusText}`);
            const animationTask = await res.json();
            const animationTaskId = animationTask.task_id;

            const ws = new WebSocket(
                `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/task-status/${animationTaskId}`
            );

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                setLoadingStructure(null);
                ws.close();
            };

            ws.onmessage = async (event) => {
                const data = event.data ? JSON.parse(event.data) : { status: "unknown" };

                if (data.status === "SUCCESS") {
                    ws.close();
                    const result: TrajectoryTaskResult = data.result;

                    const ld = await loadStructure(plugin, getApiUrl(`/file/${cryptoBenchResult!.file_hash}/${result.trimmed_pdb}`), getApiUrl(`/file/${cryptoBenchResult!.file_hash}/${result.trajectory}`), structure);
                    showOnePolymerRepresentation(plugin, ld, selectedPolymerRepresentation);

                    const updatedStructures = await Promise.all(
                        loadedStructures.map(async (s) => {
                            if (s.structureName.includes("structure")) {
                                await setStructureTransparency(plugin, 0.25, s.polymerRepresentations, s.structure);
                                await setStructureTransparency(plugin, 0.4, s.pocketRepresentations, s.structure);
                                return s;
                            } else {
                                removeFromStateTree(plugin, s.data.ref);
                                return null;
                            }
                        })
                    );

                    const filtered: LoadedStructure[] = updatedStructures.filter((s): s is LoadedStructure => s !== null);
                    setLoadedStructures([...filtered, ld]);

                    playAnimation(plugin, 10);
                    resetCamera(plugin);
                    setLoadingStructure(null);

                } else if (data.status === "FAILURE") {
                    console.error("Animation task failed:", data.error || "Unknown error");
                    ws.close();
                    setLoadingStructure(null);
                }
            };

        } catch (error) {
            console.error("Error during animation process:", error);
            setLoadingStructure(null);
        }
    };

    const checkStructureInLoadedStructures = (s: AHoJStructure) => {
        return loadedStructures.some((ld) => ld.ahojStructure === s);
    };

    return (
        <div className="ahoj-results">
            {allStructures.length > 0 ? (
                <>
                    <div className="ahoj-results-table-container">
                        <table className="ahoj-results-table">
                            <thead>
                                <tr>
                                    <th>Structure</th>
                                    <th>OG Chains</th>
                                    <th>Type</th>
                                    <th>RMSD (Å)</th>
                                    <th>SASA (Å²)</th>
                                    <th>Chains</th>
                                    <th>Ligands</th>
                                    <th>Animation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleStructures.map((s) => (
                                    <tr key={`${s.pdb_id}_${s.structure_file}_${s.chains.join(",")}`}>
                                        <td>
                                            {s.pdb_id.length === 4 ? (
                                                <a href={`https://www.rcsb.org/structure/${s.pdb_id}`} target="_blank" rel="noopener noreferrer">
                                                    {s.pdb_id}
                                                </a>
                                            ) : (
                                                s.uniprot_ids && s.uniprot_ids.length > 0 ? (
                                                    s.uniprot_ids.map((uniprotId, index) => (
                                                        <React.Fragment key={uniprotId}>
                                                            <a href={`https://alphafold.ebi.ac.uk/entry/${uniprotId}`} target="_blank" rel="noopener noreferrer">
                                                                {uniprotId}
                                                            </a>
                                                            {index < s.uniprot_ids.length - 1 && ", "}
                                                        </React.Fragment>
                                                    ))
                                                ) : (
                                                    s.pdb_id // if no uniprot IDs
                                                )
                                            )}
                                        </td>
                                        <td>{s.target_chains.join(", ")}</td>
                                        <td>{s.type}</td>
                                        <td>{s.rmsd ? s.rmsd.toFixed(2) : "N/A"}</td>
                                        <td>{s.sasa ? s.sasa.toFixed(2) : "N/A"}</td>
                                        <td>{s.chains.join(", ")}</td>
                                        <td>{s.ligands.filter((e) => e !== "").length > 0 ? s.ligands.filter((e) => e !== "").join(", ") : "N/A"}</td>
                                        <td>
                                            <button
                                                className={`load-structure-button ${checkStructureInLoadedStructures(s) ? "loaded" : ""
                                                    }`}
                                                onClick={() => handlePlayAnimation(s)}
                                                disabled={loadingStructure === s.structure_file}
                                            >
                                                {loadingStructure === s.structure_file
                                                    ? "Loading..." : checkStructureInLoadedStructures(s)
                                                        ? "Loaded" : "Play"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <button
                            className="show-more-button"
                            onClick={showMore}
                        >
                            Show More ({allStructures.length - visibleCount} remaining)
                        </button>
                    )}
                </>
            ) : (
                <div className="no-results">No APO or HOLO structures found by AHoJ.</div>
            )}
        </div>
    );
};

export default AHoJResults;
