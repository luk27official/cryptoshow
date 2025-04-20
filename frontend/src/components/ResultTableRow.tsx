import { Pocket, AHoJResponse, AHoJStructure, TrajectoryTaskResult, LoadedStructure } from "../types";
import { getColorString, getApiUrl } from "../utils";
import { loadStructure, playAnimation, removeFromStateTree, resetCamera, setStructureTransparency, showOnePolymerRepresentation } from "./MolstarComponent";
import { useState } from "react";
import { usePlugin } from "../hooks/usePlugin";
import { useAppContext } from "../hooks/useApp";

import "./ResultTableRow.css";

interface ResultTableRowProps {
    pocket: Pocket;
    index: number;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
}

const ResultTableRow = ({
    pocket,
    index,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
}: ResultTableRowProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { cryptoBenchResult } = useAppContext();

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={`result-row ${isExpanded ? "expanded" : "collapsed"}`}>
            <PocketHeader
                pocket={pocket}
                isExpanded={isExpanded}
                toggleExpand={toggleExpand}
            />

            {isExpanded && (
                <div className="pocket-content">
                    <PocketDetails pocket={pocket} />

                    {cryptoBenchResult!.structure_name !== "custom" && (
                        <AHoJSection
                            pocket={pocket}
                            index={index}
                            ahoJJobId={ahoJJobId}
                            ahoJJobResult={ahoJJobResult}
                            onAHoJClick={onAHoJClick}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

interface PocketHeaderProps {
    pocket: Pocket;
    isExpanded: boolean;
    toggleExpand: (e: React.MouseEvent) => void;
}

const PocketHeader = ({ pocket, isExpanded, toggleExpand }: PocketHeaderProps) => (
    <div className="pocket-header" onClick={toggleExpand}>
        <div className="pocket-header-left">
            <span className="toggle-icon">{isExpanded ? "▼" : ">"}</span>
            <span className="pocket-id" style={{ color: getColorString(pocket.pocket_id) }}>
                Pocket {pocket.pocket_id}
            </span>
        </div>
        <span className="prediction-score">
            Score: {pocket.average_prediction.toFixed(3)}
        </span>
    </div>
);

interface PocketDetailsProps {
    pocket: Pocket;
}

const PocketDetails = ({ pocket }: PocketDetailsProps) => {
    const predictionString = pocket.prediction.map((e) => e.toFixed(3)).join(", ");
    const residueIds = pocket.residue_ids.join(", ");

    const { cryptoBenchResult } = useAppContext();
    const structureName = cryptoBenchResult!.structure_name;

    const residuesByChain: { [key: string]: string[]; } = {};
    pocket.residue_ids.forEach(residueId => {
        const [chain, resNum] = residueId.split("_");
        if (!residuesByChain[chain]) {
            residuesByChain[chain] = [];
        }
        residuesByChain[chain].push(resNum);
    });

    const chainSelectors = Object.entries(residuesByChain)
        .map(([chain, resNums]) => `(chain ${chain} and resi ${resNums.join("+")})`);

    const pymolCommand = `select s, ${structureName} and ( ${chainSelectors.join(" or ")} )`;

    return (
        <div className="pocket-details">
            <div className="pocket-info">
                <div className="prediction-values">
                    <span className="info-label">Predictions:</span>
                    <span className="info-value">{predictionString}</span>
                </div>
                <div className="residue-ids">
                    <span className="info-label">Residue IDs:</span>
                    <span className="info-value truncate-text">{residueIds}</span>
                </div>
                <div className="pymol-export">
                    <span className="info-label">PyMOL visualization:</span>
                    <span className="info-value code-block">{pymolCommand}</span>
                </div>
            </div>
        </div>
    );
};

interface AHoJSectionProps {
    pocket: Pocket;
    index: number;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
}

const AHoJSection = ({
    pocket,
    index,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
}: AHoJSectionProps) => (
    <div className="ahoj-section">
        <div className="ahoj-controls">
            <button
                className="ahoj-button"
                onClick={() => onAHoJClick(pocket, index)}
                disabled={!!ahoJJobId || !!ahoJJobResult}
            >
                {ahoJJobResult ? "Job Completed" : ahoJJobId ? "Loading..." : "Run AHoJ"}
            </button>

            {ahoJJobId && <a href={`https://apoholo.cz/job/${ahoJJobId}`} target="_blank" rel="noopener noreferrer" className="job-id">AHoJ Job ID: {ahoJJobId}</a>}
        </div>

        {ahoJJobResult && <AHoJResults pocket={pocket} ahoJJobResult={ahoJJobResult} />}
    </div>
);

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

            const res = await fetch(getApiUrl(`/animate/${cryptoBenchResult!.file_hash}/${structure.structure_file}`));
            if (!res.ok) throw new Error(`Failed to start animation task: ${res.statusText}`);
            const animationTask = await res.json();
            const animationTaskId = animationTask.task_id;

            // TODO: use dynamic host
            const ws = new WebSocket(`ws://localhost/ws/task-status/${animationTaskId}`);

            ws.onopen = () => console.log("Animation WebSocket connected");
            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                setLoadingStructure(null);
                ws.close();
            };
            ws.onclose = () => console.log("Animation WebSocket closed");

            ws.onmessage = async (event) => {
                const data = event.data ? JSON.parse(event.data) : { status: "unknown" };

                if (data.status === "SUCCESS") {
                    ws.close();
                    const result: TrajectoryTaskResult = data.result;

                    const ld = await loadStructure(plugin, getApiUrl(`/file/${cryptoBenchResult!.file_hash}/${result.trimmed_pdb}`), getApiUrl(`/file/${cryptoBenchResult!.file_hash}/${result.trajectory}`));
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


    return (
        <div className="ahoj-results">
            {allStructures.length > 0 ? (
                <>
                    <div className="ahoj-results-table-container">
                        <table className="ahoj-results-table">
                            <thead>
                                <tr>
                                    <th>Structure</th>
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
                                    <tr key={`${s.pdb_id}_${s.structure_file}`}>
                                        <td>
                                            {s.pdb_id.length === 4 ? (
                                                <a href={`https://www.rcsb.org/structure/${s.pdb_id}`} target="_blank" rel="noopener noreferrer">
                                                    {s.pdb_id}
                                                </a>
                                            ) : (
                                                s.uniprot_ids && s.uniprot_ids.length > 0 ? (
                                                    s.uniprot_ids.map((uniprotId, index) => (
                                                        <>
                                                            <a href={`https://alphafold.ebi.ac.uk/entry/${uniprotId}`} target="_blank" rel="noopener noreferrer">
                                                                {uniprotId}
                                                            </a>
                                                            {index < s.uniprot_ids.length - 1 && ", "}
                                                        </>
                                                    ))
                                                ) : (
                                                    s.pdb_id // if no uniprot IDs
                                                )
                                            )}
                                        </td>
                                        <td>{s.type}</td>
                                        <td>{s.rmsd ? s.rmsd.toFixed(2) : "N/A"}</td>
                                        <td>{s.sasa ? s.sasa.toFixed(2) : "N/A"}</td>
                                        <td>{s.chains.join(", ")}</td>
                                        <td>{s.ligands.filter((e) => e !== "").length > 0 ? s.ligands.filter((e) => e !== "").join(", ") : "N/A"}</td>
                                        <td>
                                            <button
                                                className="load-structure-button"
                                                onClick={() => handlePlayAnimation(s)}
                                                disabled={loadingStructure === s.structure_file}
                                            >
                                                {loadingStructure === s.structure_file ? "Loading..." : "Play"}
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

export default ResultTableRow;