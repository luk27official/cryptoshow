import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { getAHoJJobConfiguration, submitAHoJJob, getAHoJJobStatus } from "../services/AHoJservice";
import { Pocket } from "../types";
import { getColorString } from "../utils";
import { useState } from "react";

interface ResultTableProps {
    taskId: string | null;
    pockets: Pocket[];
    plugin: PluginUIContext;
    structureId: string;
}

function ResultTable({ taskId, pockets, plugin, structureId }: ResultTableProps) {
    const [ahoJJobIds, setAHoJJobIds] = useState<(string | null)[]>(new Array(pockets.length).fill(null));

    const handleClick = async (pocket: Pocket, idx: number) => {
        const config = getAHoJJobConfiguration(pocket, plugin, structureId);

        const postData = await submitAHoJJob(config);

        if (postData) {
            ahoJJobIds[idx] = postData["job_id"];
            setAHoJJobIds([...ahoJJobIds]);
            console.log(postData);

            const jobStatus = await getAHoJJobStatus(postData["job_id"]);
            console.log("Job status:", jobStatus);
        }

        console.log("Pocket clicked:", pocket);
    };

    return (
        <div className="results-table">
            <p>Task ID: {taskId}</p>
            <div>
                {pockets.map((pocket: Pocket, index: number) => {
                    const predictionString = pocket.prediction.map((e) => e.toFixed(3)).join(",");
                    const residueIds = pocket.residue_ids.join(",");
                    const displayString = `${pocket.pocket_id} - ${predictionString} - ${pocket.average_prediction.toFixed(3)} | IDs: ${residueIds}`;

                    return (
                        <div key={index}>
                            <span className="pocket-item">
                                <span className="pocket-text" style={{
                                    wordBreak: "break-word",
                                    overflowWrap: "break-word",
                                    display: "inline-block",
                                    maxWidth: "100%",
                                    color: getColorString(pocket.pocket_id)
                                }}>{displayString}</span>
                            </span>

                            {/* AHoJ should be available only for public structures */}
                            {structureId !== "custom" && (
                                <>
                                    <button onClick={() => handleClick(pocket, index)}>AHoJ</button>
                                    <br />
                                    <span>{ahoJJobIds[index] ?? ""}</span>
                                </>
                            )}

                            <hr />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ResultTable;
