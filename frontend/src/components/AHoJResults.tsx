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

type SortField = "pdb_id" | "type" | "rmsd" | "sasa" | "chains" | "ligands";
type SortDirection = "asc" | "desc";

const AHoJResults = ({ ahoJJobResult }: AHoJResultsProps) => {
    const plugin = usePlugin();
    const {
        loadedStructures,
        setLoadedStructures,
        selectedPolymerRepresentation,
        cryptoBenchResult
    } = useAppContext();
    const [loadingStructure, setLoadingStructure] = useState<AHoJStructure | undefined>(undefined);
    const [sortField, setSortField] = useState<SortField>("rmsd");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const apoStructures = ahoJJobResult.queries[0]?.found_apo.map(s => ({ ...s, type: "APO" })) || [];
    const holoStructures = ahoJJobResult.queries[0]?.found_holo.map(s => ({ ...s, type: "HOLO" })) || [];
    const alphaFoldStructures = ahoJJobResult.queries[0]?.found_alphafold.map(s => ({ ...s, type: "AlphaFold" })) || [];
    const allStructures = [...holoStructures, ...apoStructures, ...alphaFoldStructures];

    const sortedStructures = [...allStructures].sort((a, b) => {
        // numbers
        if (sortField === "rmsd" || sortField === "sasa") {
            const valueA = a[sortField] ?? Number.MAX_VALUE;
            const valueB = b[sortField] ?? Number.MAX_VALUE;
            return sortDirection === "asc"
                ? valueA - valueB
                : valueB - valueA;
        }

        // strings
        if (sortField === "type" || sortField === "pdb_id") {
            const valueA = a[sortField]?.toString() || "";
            const valueB = b[sortField]?.toString() || "";
            return sortDirection === "asc"
                ? valueA.localeCompare(valueB)
                : valueB.localeCompare(valueA);
        }

        // arrays
        if (sortField === "chains" || sortField === "ligands") {
            const valueA = a[sortField]?.join(",") || "";
            const valueB = b[sortField]?.join(",") || "";
            return sortDirection === "asc"
                ? valueA.localeCompare(valueB)
                : valueB.localeCompare(valueA);
        }

        return 0;
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const handlePlayAnimation = async (structure: AHoJStructure & { type: string; }) => {
        if (loadingStructure) return;
        setLoadingStructure(structure);

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
                setLoadingStructure(undefined);
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
                    setLoadingStructure(undefined);

                } else if (data.status === "FAILURE") {
                    console.error("Animation task failed:", data.result || "Unknown error");
                    ws.close();
                    setLoadingStructure(undefined);
                }
            };

        } catch (error) {
            console.error("Error during animation process:", error);
            setLoadingStructure(undefined);
        }
    };

    const checkStructureInLoadedStructures = (s: AHoJStructure) => {
        return loadedStructures.some((ld) => checkStructureEquivalence(ld.ahojStructure, s));
    };

    const checkStructureEquivalence = (s1: AHoJStructure | undefined, s2: AHoJStructure | undefined) => {
        return s1 && s2 &&
            s1.pdb_id === s2.pdb_id &&
            s1.structure_file === s2.structure_file &&
            s1.sasa === s2.sasa &&
            s1.rmsd === s2.rmsd &&
            s1.pocket_rmsd === s2.pocket_rmsd;
    };

    const renderSortIndicator = (field: SortField) => {
        if (sortField !== field) return null;
        return sortDirection === "asc" ? " ↑" : " ↓";
    };

    return (
        <div className="ahoj-results">
            {allStructures.length > 0 ? (
                <div className="ahoj-results-table-container">
                    <table className="ahoj-results-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort("pdb_id")} className="sortable">
                                    Structure{renderSortIndicator("pdb_id")}
                                </th>
                                <th>OG Chains</th>
                                <th onClick={() => handleSort("type")} className="sortable">
                                    Type{renderSortIndicator("type")}
                                </th>
                                <th onClick={() => handleSort("rmsd")} className="sortable">
                                    RMSD (Å){renderSortIndicator("rmsd")}
                                </th>
                                <th onClick={() => handleSort("sasa")} className="sortable">
                                    SASA (Å²){renderSortIndicator("sasa")}
                                </th>
                                <th onClick={() => handleSort("chains")} className="sortable">
                                    Chains{renderSortIndicator("chains")}
                                </th>
                                <th onClick={() => handleSort("ligands")} className="sortable">
                                    Ligands{renderSortIndicator("ligands")}
                                </th>
                                <th>Animation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStructures.map((s, index) => (
                                <tr key={`${s.pdb_id}_${s.structure_file}_${s.chains.join(",")}_${s.type}_${index}`}>
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
                                            className={`load-structure-button ${checkStructureInLoadedStructures(s) ? "loaded" : ""}`}
                                            onClick={() => handlePlayAnimation(s)}
                                            disabled={checkStructureEquivalence(loadingStructure, s) || checkStructureInLoadedStructures(s)}
                                        >
                                            {loadingStructure && checkStructureEquivalence(loadingStructure, s)
                                                ? "Loading..."
                                                : checkStructureInLoadedStructures(s)
                                                    ? "Loaded"
                                                    : "Play"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="no-results">No APO or HOLO structures found by AHoJ.</div>
            )}
        </div>
    );
};

export default AHoJResults;
