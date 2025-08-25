import { useAHoJService, useAHoJConfiguration, usePlugin, useAppContext } from "../hooks";
import { AHoJResponse, Pocket } from "../types";
import { useState } from "react";
import ResultTableRow from "./ResultTableRow";

import "./ResultTable.css";

function ResultTable() {
    const { cryptoBenchResult } = useAppContext();
    const plugin = usePlugin();
    const { submitJob, pollJobStatus } = useAHoJService();
    const { getAHoJJobConfiguration } = useAHoJConfiguration();

    const [ahoJJobIds, setAHoJJobIds] = useState<(string | null)[]>(
        new Array(cryptoBenchResult!.pockets.length).fill(null)
    );
    const [ahojJobResults, setAHoJJobResults] = useState<(AHoJResponse | null)[]>(
        new Array(cryptoBenchResult!.pockets.length).fill(null)
    );

    const handleClick = async (pocket: Pocket, idx: number) => {
        const config = getAHoJJobConfiguration(pocket, plugin, cryptoBenchResult!.structure_name);
        const postData = await submitJob(config);

        if (postData) {
            const newJobIds = [...ahoJJobIds];
            newJobIds[idx] = postData.job_id;
            setAHoJJobIds(newJobIds);

            const jobResult = await pollJobStatus(cryptoBenchResult!.file_hash, postData.job_id);
            const newJobResults = [...ahojJobResults];
            newJobResults[idx] = jobResult;
            setAHoJJobResults(newJobResults);
        }
    };

    return (
        <div className="results-table">
            <div>
                {cryptoBenchResult!.pockets.length > 0 ? (
                    cryptoBenchResult!.pockets
                        .map((pocket, index) => ({ pocket, originalIndex: index }))
                        .sort((a, b) => {
                            return a.pocket.pocket_id - b.pocket.pocket_id;
                        })
                        .map(({ pocket, originalIndex }) => (
                            <ResultTableRow
                                key={originalIndex}
                                pocket={pocket}
                                index={originalIndex}
                                ahoJJobId={ahoJJobIds[originalIndex]}
                                ahoJJobResult={ahojJobResults[originalIndex]}
                                onAHoJClick={handleClick}
                            />
                        ))
                ) : (
                    <h2>No pockets available.</h2>
                )}
            </div>
            <div className="download-results">
                {cryptoBenchResult!.file_hash && (
                    <a
                        href={`./api/file/${cryptoBenchResult!.file_hash}/results.zip`}
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
