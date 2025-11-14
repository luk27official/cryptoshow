import React, { useState } from "react";
import { AHoJResponse, AHoJStructure } from "../types";
import { usePlugin, useAppContext, useAHoJAnimation } from "../hooks";
import "./AHoJResults.css";

interface AHoJResultsProps {
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

    const {
        loadingStructure,
        handlePlayAnimation,
        checkStructureEquivalence,
        checkStructureInLoadedStructures
    } = useAHoJAnimation();

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

    const onPlayAnimation = (structure: AHoJStructure & { type: string; }) => {
        if (!cryptoBenchResult) return;
        handlePlayAnimation(
            structure,
            plugin,
            cryptoBenchResult,
            selectedPolymerRepresentation,
            loadedStructures,
            setLoadedStructures
        );
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
                                <tr key={`${s.pdb_id}_${s.structure_file}_${s.target_chains.join(",")}_${s.chains.join(",")}_${s.type}_${index}`}>
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
                                            className={`load-structure-button ${checkStructureInLoadedStructures(s, loadedStructures) ? "loaded" : ""}`}
                                            onClick={() => onPlayAnimation(s)}
                                            disabled={checkStructureEquivalence(loadingStructure, s) || checkStructureInLoadedStructures(s, loadedStructures)}
                                        >
                                            {loadingStructure && checkStructureEquivalence(loadingStructure, s)
                                                ? "Loading..."
                                                : checkStructureInLoadedStructures(s, loadedStructures)
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
