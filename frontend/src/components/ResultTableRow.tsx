import { Pocket, AHoJResponse, AHoJStructure, LoadedStructure, PolymerRepresentationType, TrajectoryTaskResult, CryptoBenchResult, PocketRepresentationType } from "../types";
import { getColorString, getApiUrl } from "../utils";
import { loadPockets, loadStructure, playAnimation, removeFromStateTree, resetCamera, setStructureTransparency, showOnePocketRepresentation, showOnePolymerRepresentation } from "./MolstarComponent";
import { useState } from "react";
import { usePlugin } from "../hooks/usePlugin";

import "./ResultTableRow.css";

interface ResultTableRowProps {
    pocket: Pocket;
    index: number;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
    selectedPocketRepresentation: PocketRepresentationType;
    cryptoBenchResult: CryptoBenchResult;
}

const ResultTableRow = ({
    pocket,
    index,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
    setLoadedStructures,
    selectedPolymerRepresentation,
    selectedPocketRepresentation,
    cryptoBenchResult
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
                    {cryptoBenchResult.structure_name !== "custom" && (
                        <AHoJSection
                            pocket={pocket}
                            index={index}
                            ahoJJobId={ahoJJobId}
                            ahoJJobResult={ahoJJobResult}
                            onAHoJClick={onAHoJClick}
                            setLoadedStructures={setLoadedStructures}
                            selectedPolymerRepresentation={selectedPolymerRepresentation}
                            selectedPocketRepresentation={selectedPocketRepresentation}
                            cryptoBenchResult={cryptoBenchResult}
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
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
    selectedPocketRepresentation: PocketRepresentationType;
    cryptoBenchResult: CryptoBenchResult;
}

const AHoJSection = ({
    pocket,
    index,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick,
    setLoadedStructures,
    selectedPolymerRepresentation,
    selectedPocketRepresentation,
    cryptoBenchResult
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

        {ahoJJobResult && <AHoJResults pocket={pocket} ahoJJobResult={ahoJJobResult} setLoadedStructures={setLoadedStructures}
            selectedPolymerRepresentation={selectedPolymerRepresentation} cryptoBenchResult={cryptoBenchResult}
            selectedPocketRepresentation={selectedPocketRepresentation} />}
    </div>
);

interface AHoJResultsProps {
    pocket: Pocket;
    ahoJJobResult: AHoJResponse;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
    selectedPocketRepresentation: PocketRepresentationType;
    cryptoBenchResult: CryptoBenchResult;
}

const AHoJResults = ({ pocket, ahoJJobResult, setLoadedStructures, selectedPolymerRepresentation, selectedPocketRepresentation, cryptoBenchResult }: AHoJResultsProps) => (
    <div className="ahoj-results">
        <StructureSection
            pocket={pocket}
            title="APO Structures"
            structures={ahoJJobResult.queries[0]?.found_apo || []}
            setLoadedStructures={setLoadedStructures}
            selectedPolymerRepresentation={selectedPolymerRepresentation}
            selectedPocketRepresentation={selectedPocketRepresentation}
            cryptoBenchResult={cryptoBenchResult}
        />
        <StructureSection
            pocket={pocket}
            title="HOLO Structures"
            structures={ahoJJobResult.queries[0]?.found_holo || []}
            setLoadedStructures={setLoadedStructures}
            selectedPolymerRepresentation={selectedPolymerRepresentation}
            selectedPocketRepresentation={selectedPocketRepresentation}
            cryptoBenchResult={cryptoBenchResult}
        />
    </div>
);

interface StructureSectionProps {
    pocket: Pocket;
    title: string;
    structures: AHoJStructure[];
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
    selectedPocketRepresentation: PocketRepresentationType;
    cryptoBenchResult: CryptoBenchResult;
}

const StructureSection = ({ pocket, title, structures, setLoadedStructures, selectedPolymerRepresentation, selectedPocketRepresentation, cryptoBenchResult }: StructureSectionProps) => {
    const plugin = usePlugin();
    const [visibleCount, setVisibleCount] = useState(5);
    const [loading, setLoading] = useState(false);

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
                                        await fetch(getApiUrl(`/proxy/ahoj/${cryptoBenchResult.file_hash}/${s.structure_file_url}`));
                                        // after fetching the structure, we might calculate the animation
                                        // TODO: handle errors here
                                        const res = await fetch(getApiUrl(`/animate/${cryptoBenchResult.file_hash}/${s.structure_file}`));
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

                                                if (loading) return;
                                                setLoading(true);

                                                console.log("Animation task completed", data);

                                                const result: TrajectoryTaskResult = data.result;
                                                const ld = await loadStructure(plugin, getApiUrl(`/file/${cryptoBenchResult.file_hash}/${result.trimmed_pdb}`), getApiUrl(`/file/${cryptoBenchResult.file_hash}/${result.trajectory}`));
                                                showOnePolymerRepresentation(plugin, ld, selectedPolymerRepresentation);

                                                const pocketReprs = await loadPockets(plugin, ld.structure, cryptoBenchResult, pocket.pocket_id);
                                                ld.pocketRepresentations = pocketReprs;
                                                showOnePocketRepresentation(plugin, ld, selectedPocketRepresentation);

                                                // TODO: how to handle the case when the user wants to go back?
                                                playAnimation(plugin, 10);
                                                resetCamera(plugin);

                                                console.log("A");
                                                setLoadedStructures(prev => {
                                                    prev.forEach(async (s) => {
                                                        if (s.structureName.includes("structure")) {
                                                            console.log("removing structure", s);
                                                            await setStructureTransparency(plugin, 0.25, s.polymerRepresentations, s.structure);
                                                            await setStructureTransparency(plugin, 0.25, s.pocketRepresentations, s.structure);
                                                            return;
                                                        }
                                                        s.pocketRepresentations = [];
                                                        s.polymerRepresentations = [];
                                                        removeFromStateTree(plugin, s.data.ref);
                                                    });

                                                    console.log(prev);

                                                    return [...prev, ld];
                                                });
                                                setLoading(false);
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