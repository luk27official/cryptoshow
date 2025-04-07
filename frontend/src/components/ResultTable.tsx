import { getAHoJJobConfiguration, submitAHoJJob, pollAHoJJobStatus } from "../services/AHoJservice";
import { AHoJResponse, LoadedStructure, Pocket, PolymerRepresentationType } from "../types";
import { useState } from "react";
import ResultTableRow from "./ResultTableRow";
import { usePlugin } from "../hooks/usePlugin";

import "./ResultTable.css";

interface ResultTableProps {
    taskId: string;
    pockets: Pocket[];
    structureId: string;
    taskHash: string;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
}

function ResultTable({ pockets, structureId, taskHash, setLoadedStructures, selectedPolymerRepresentation }: ResultTableProps) {
    const plugin = usePlugin();
    const [ahoJJobIds, setAHoJJobIds] = useState<(string | null)[]>(new Array(pockets.length).fill(null));
    const [ahojJobResults, setAHoJJobResults] = useState<(AHoJResponse | null)[]>(new Array(pockets.length).fill(null));

    const handleClick = async (pocket: Pocket, idx: number) => {
        const config = getAHoJJobConfiguration(pocket, plugin, structureId);

        const postData = await submitAHoJJob(config);

        if (postData) {
            ahoJJobIds[idx] = postData["job_id"];
            setAHoJJobIds([...ahoJJobIds]);
            console.log(postData);

            const jobResult = await pollAHoJJobStatus(taskHash, postData["job_id"]);
            ahojJobResults[idx] = jobResult;
            setAHoJJobResults([...ahojJobResults]);
            console.log("AHoJ Job Result:", jobResult);
        }
    };

    return (
        <div className="results-table">
            <div>
                {pockets.length > 0 ? (
                    pockets.map((pocket: Pocket, index: number) => (
                        <ResultTableRow
                            key={index}
                            pocket={pocket}
                            index={index}
                            structureId={structureId}
                            taskHash={taskHash}
                            ahoJJobId={ahoJJobIds[index]}
                            ahoJJobResult={ahojJobResults[index]}
                            onAHoJClick={handleClick}
                            setLoadedStructures={setLoadedStructures}
                            selectedPolymerRepresentation={selectedPolymerRepresentation}
                        />
                    ))
                ) : (
                    <h2>No pockets available.</h2>
                )}
            </div>
            <div className="download-results">
                {taskHash && (
                    <a
                        href={`./api/file/${taskHash}/results.zip`}
                        className="download-button"
                        download
                    >
                        Download Results
                    </a>
                )}
            </div>
        </div>
    );
}

export default ResultTable;
