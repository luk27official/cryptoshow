import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Pocket, AHoJResponse } from "../types";
import { getColorString, getApiUrl } from "../utils";
import { loadStructure } from "./MolstarComponent";

import "./ResultTableRow.css";

interface ResultTableRowProps {
    pocket: Pocket;
    index: number;
    structureId: string;
    taskHash: string;
    plugin: PluginUIContext;
    ahoJJobId: string | null;
    ahoJJobResult: AHoJResponse | null;
    onAHoJClick: (pocket: Pocket, index: number) => void;
}

const ResultTableRow = ({
    pocket,
    index,
    structureId,
    taskHash,
    plugin,
    ahoJJobId,
    ahoJJobResult,
    onAHoJClick
}: ResultTableRowProps) => {
    const predictionString = pocket.prediction.map((e) => e.toFixed(3)).join(", ");
    const residueIds = pocket.residue_ids.join(", ");

    return (
        <div className="result-row">
            <div className="pocket-details">
                <div className="pocket-header">
                    <span className="pocket-id" style={{ color: getColorString(pocket.pocket_id) }}>
                        Pocket {pocket.pocket_id}
                    </span>
                    <span className="prediction-score">
                        Score: {pocket.average_prediction.toFixed(3)}
                    </span>
                </div>

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

            {/* AHoJ should be available only for public structures */}
            {structureId !== "custom" && (
                <div className="ahoj-section">
                    <div className="ahoj-controls">
                        <button
                            className="ahoj-button"
                            onClick={() => onAHoJClick(pocket, index)}
                            disabled={!!ahoJJobId || !!ahoJJobResult}
                        >
                            {ahoJJobResult ? "Job Completed" : ahoJJobId ? "Loading..." : "Run AHoJ"}
                        </button>

                        {ahoJJobId && <span className="job-id">Job ID: {ahoJJobId}</span>}
                    </div>

                    {ahoJJobResult && (
                        <div className="ahoj-results">
                            <div className="result-section">
                                <h4 className="result-heading">APO Structures</h4>
                                <div className="structure-links">
                                    {ahoJJobResult.queries[0]?.found_apo.length ? (
                                        ahoJJobResult.queries[0]?.found_apo.map((v) => (
                                            <span
                                                key={v.pdb_id}
                                                className="structure-link"
                                                onClick={async () => {
                                                    await fetch(getApiUrl(`/proxy/ahoj/${taskHash}/${v.structure_file_url}`));
                                                    loadStructure(plugin, getApiUrl(`/file/${taskHash}/${v.structure_file}`));
                                                }}
                                            >
                                                {v.pdb_id}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="no-results">No APO structures found</span>
                                    )}
                                </div>
                            </div>

                            <div className="result-section">
                                <h4 className="result-heading">HOLO Structures</h4>
                                <div className="structure-links">
                                    {ahoJJobResult.queries[0]?.found_holo.length ? (
                                        ahoJJobResult.queries[0]?.found_holo.map((v) => (
                                            <span
                                                key={v.pdb_id}
                                                className="structure-link"
                                                onClick={async () => {
                                                    await fetch(getApiUrl(`/proxy/ahoj/${taskHash}/${v.structure_file_url}`));
                                                    loadStructure(plugin, getApiUrl(`/file/${taskHash}/${v.structure_file}`));
                                                }}
                                            >
                                                {v.pdb_id}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="no-results">No HOLO structures found</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResultTableRow;

