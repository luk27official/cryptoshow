import { Pocket, AHoJResponse, AHoJStructure, LoadedStructure, PolymerRepresentationType, TrajectoryTaskResult } from "../types";
import { getColorString, getApiUrl } from "../utils";
import { loadStructure, removeFromStateTree, showOnePolymerRepresentation } from "./MolstarComponent";
import { useState } from "react";
import { usePlugin } from "../hooks/usePlugin";

import "./ResultTableRow.css";

interface ResultTableRowProps {
    pocket: Pocket;
    index: number;
    structureId: string;
    taskHash: string;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
}

const ResultTableRow = ({
    pocket,
    index,
    structureId,
    taskHash,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
    setLoadedStructures,
    selectedPolymerRepresentation
}: ResultTableRowProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

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

                    {/* AHoJ should be available only for public structures */}
                    {structureId !== "custom" && (
                        <AHoJSection
                            pocket={pocket}
                            index={index}
                            taskHash={taskHash}
                            ahoJJobId={ahoJJobId}
                            ahoJJobResult={ahoJJobResult}
                            onAHoJClick={onAHoJClick}
                            setLoadedStructures={setLoadedStructures}
                            selectedPolymerRepresentation={selectedPolymerRepresentation}
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
            </div>
        </div>
    );
};

interface AHoJSectionProps {
    pocket: Pocket;
    index: number;
    taskHash: string;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
}

const AHoJSection = ({
    pocket,
    index,
    taskHash,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
    setLoadedStructures,
    selectedPolymerRepresentation
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

        {ahoJJobResult && <AHoJResults ahoJJobResult={ahoJJobResult} taskHash={taskHash} setLoadedStructures={setLoadedStructures} selectedPolymerRepresentation={selectedPolymerRepresentation} />}
    </div>
);

interface AHoJResultsProps {
    ahoJJobResult: AHoJResponse;
    taskHash: string;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
}

const AHoJResults = ({ ahoJJobResult, taskHash, setLoadedStructures, selectedPolymerRepresentation }: AHoJResultsProps) => (
    <div className="ahoj-results">
        <StructureSection
            title="APO Structures"
            structures={ahoJJobResult.queries[0]?.found_apo || []}
            taskHash={taskHash}
            setLoadedStructures={setLoadedStructures}
            selectedPolymerRepresentation={selectedPolymerRepresentation}
        />
        <StructureSection
            title="HOLO Structures"
            structures={ahoJJobResult.queries[0]?.found_holo || []}
            taskHash={taskHash}
            setLoadedStructures={setLoadedStructures}
            selectedPolymerRepresentation={selectedPolymerRepresentation}
        />
    </div>
);

interface StructureSectionProps {
    title: string;
    structures: AHoJStructure[];
    taskHash: string;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
}

const StructureSection = ({ title, structures, taskHash, setLoadedStructures, selectedPolymerRepresentation }: StructureSectionProps) => {
    const plugin = usePlugin();
    const [visibleCount, setVisibleCount] = useState(5);

    const showMore = () => {
        setVisibleCount(prev => prev + 5);
    };

    const visibleStructures = structures.slice(0, visibleCount);
    const hasMore = visibleCount < structures.length;

    return (
        <div className="result-section">
            <h4 className="result-heading">{title} ({structures.length})</h4>
            <div className="structure-list">
                {structures.length ? (
                    <>
                        {visibleStructures.map((s) => (
                            <div key={`${s.pdb_id}_${s.structure_file}`} className="structure-row">
                                <div className="structure-info">
                                    <div className="structure-id">{s.pdb_id}</div>
                                    <div className="structure-chains">Chains: {s.chains.join(", ")}</div>
                                    {/* {s.ligand_ids && s.ligand_ids.length > 0 && (
                                        <div className="structure-ligands">Ligands: {s.ligand_ids.join(", ")}</div>
                                    )} */}
                                    {s.rmsd && (
                                        <div className="structure-resolution">RMSD: {s.rmsd.toFixed(2)} Å</div>
                                    )}
                                </div>
                                <button
                                    className="load-structure-button"
                                    onClick={async () => {
                                        await fetch(getApiUrl(`/proxy/ahoj/${taskHash}/${s.structure_file_url}`));
                                        // after fetching the structure, we might calculate the animation
                                        // TODO: handle errors here
                                        const res = await fetch(getApiUrl(`/animate/${taskHash}/${s.structure_file}`));
                                        const animationTask = await res.json();
                                        const animationTaskId = animationTask.task_id;

                                        const ws = new WebSocket(`ws://localhost/ws/task-status/${animationTaskId}`);
                                        ws.onopen = () => {
                                            console.log("WebSocket connected");
                                        };

                                        ws.onmessage = async (event) => {
                                            const data = event.data ? JSON.parse(event.data) : { "status": "unknown" };

                                            if (data.status === "SUCCESS") {
                                                ws.close(); // close ASAP to prevent multiple loads

                                                const result: TrajectoryTaskResult = data.result;
                                                const ld = await loadStructure(plugin, getApiUrl(`/file/${taskHash}/${result.trimmed_pdb}`), getApiUrl(`/file/${taskHash}/${result.trajectory}`));
                                                setLoadedStructures(prev => {
                                                    prev.forEach((s) => { removeFromStateTree(plugin, s.data.ref); });
                                                    return [...prev, ld];
                                                });
                                                showOnePolymerRepresentation(plugin, ld, selectedPolymerRepresentation);
                                                plugin.canvas3d?.requestCameraReset();

                                                // TODO: add the pocket here
                                                // TODO: how to handle the case when the user wants to go back?
                                                // TODO: here we maybe want to add pocket in the ball-and-stick representation
                                                // TODO: autoplay the animation?

                                            } else if (data.status === "FAILURE") {
                                                ws.close();
                                            }
                                        };
                                    }}
                                >
                                    {/* TODO: maybe use an icon here */}
                                    Play Animation
                                </button>
                            </div>
                        ))}

                        {hasMore && (
                            <button
                                className="show-more-button"
                                onClick={showMore}
                            >
                                Show More ({structures.length - visibleCount} remaining)
                            </button>
                        )}
                    </>
                ) : (
                    <div className="no-results">No {title} found</div>
                )}
            </div>
        </div>
    );
};

export default ResultTableRow;