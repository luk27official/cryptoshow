import { getAHoJJobConfiguration, submitAHoJJob, pollAHoJJobStatus } from "../services/AHoJservice";
import { AHoJResponse, CryptoBenchResult, LoadedStructure, Pocket, PocketRepresentationType, PolymerRepresentationType } from "../types";
import { useState } from "react";
import ResultTableRow from "./ResultTableRow";
import { usePlugin } from "../hooks/usePlugin";

import "./ResultTable.css";

interface ResultTableProps {
    cryptoBenchResult: CryptoBenchResult;
    taskId: string;
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
    selectedPocketRepresentation: PocketRepresentationType;
}

function ResultTable({ cryptoBenchResult, setLoadedStructures, selectedPolymerRepresentation, selectedPocketRepresentation }: ResultTableProps) {
    const plugin = usePlugin();
    const [ahoJJobIds, setAHoJJobIds] = useState<(string | null)[]>(new Array(cryptoBenchResult.pockets.length).fill(null));
    const [ahojJobResults, setAHoJJobResults] = useState<(AHoJResponse | null)[]>(new Array(cryptoBenchResult.pockets.length).fill(null));

    const handleClick = async (pocket: Pocket, idx: number) => {
        const config = getAHoJJobConfiguration(pocket, plugin, cryptoBenchResult.structure_name);

        const postData = await submitAHoJJob(config);

        if (postData) {
            ahoJJobIds[idx] = postData["job_id"];
            setAHoJJobIds([...ahoJJobIds]);
            console.log(postData);

            const jobResult = await pollAHoJJobStatus(cryptoBenchResult.file_hash, postData["job_id"]);
            ahojJobResults[idx] = jobResult;
            setAHoJJobResults([...ahojJobResults]);
            console.log("AHoJ Job Result:", jobResult);
        }
    };

    return (
        <div className="results-table">
            <div>
                {cryptoBenchResult.pockets.length > 0 ? (
                    cryptoBenchResult.pockets.map((pocket: Pocket, index: number) => (
                        <ResultTableRow
                            key={index}
                            pocket={pocket}
                            index={index}
                            ahoJJobId={ahoJJobIds[index]}
                            ahoJJobResult={ahojJobResults[index]}
                            onAHoJClick={handleClick}
                            setLoadedStructures={setLoadedStructures}
                            selectedPolymerRepresentation={selectedPolymerRepresentation}
                            selectedPocketRepresentation={selectedPocketRepresentation}
                            cryptoBenchResult={cryptoBenchResult}
                        />
                    ))
                ) : (
                    <h2>No pockets available.</h2>
                )}
            </div>
            <div className="download-results">
                {cryptoBenchResult.file_hash && (
                    <a
                        href={`./api/file/${cryptoBenchResult.file_hash}/results.zip`}
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
