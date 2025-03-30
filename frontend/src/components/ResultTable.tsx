import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { getAHoJJobConfiguration, submitAHoJJob, pollAHoJJobStatus } from "../services/AHoJservice";
import { AHoJResponse, Pocket } from "../types";
import { useState } from "react";
import ResultTableRow from "./ResultTableRow";

import "./ResultTable.css";

interface ResultTableProps {
    taskId: string;
    pockets: Pocket[];
    plugin: PluginUIContext;
    structureId: string;
    taskHash: string;
}

function ResultTable({ taskId, pockets, plugin, structureId, taskHash }: ResultTableProps) {
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
                {pockets.map((pocket: Pocket, index: number) => (
                    <ResultTableRow
                        key={index}
                        pocket={pocket}
                        index={index}
                        structureId={structureId}
                        taskHash={taskHash}
                        plugin={plugin}
                        ahoJJobId={ahoJJobIds[index]}
                        ahoJJobResult={ahojJobResults[index]}
                        onAHoJClick={handleClick}
                    />
                ))}
            </div>
        </div>
    );
}

export default ResultTable;
