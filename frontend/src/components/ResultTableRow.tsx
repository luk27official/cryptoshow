import { Pocket, AHoJResponse, AHoJStructure, LoadedStructure, PolymerRepresentationType } from "../types";
import { getColorString, getApiUrl } from "../utils";
import { loadStructure, showOnePolymerRepresentation } from "./MolstarComponent";
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

            {ahoJJobId && <span className="job-id">AHoJ Job ID: {ahoJJobId}</span>}
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

    return (
        <div className="result-section">
            <h4 className="result-heading">{title}</h4>
            <div className="structure-links">
                {structures.length ? (
                    structures.map((s) => (
                        <span
                            key={s.pdb_id}
                            className="structure-link"
                            onClick={async () => {
                                await fetch(getApiUrl(`/proxy/ahoj/${taskHash}/${s.structure_file_url}`));
                                const ld = await loadStructure(plugin, getApiUrl(`/file/${taskHash}/${s.structure_file}`));

                                setLoadedStructures(prev => [...prev, ld]);
                                showOnePolymerRepresentation(plugin, ld, selectedPolymerRepresentation);
                            }}
                        >
                            {s.pdb_id}_{s.chains.join(" ")}
                        </span>
                    ))
                ) : (
                    <span className="no-results">No {title} found</span>
                )}
            </div>
        </div>
    );
};

export default ResultTableRow;
